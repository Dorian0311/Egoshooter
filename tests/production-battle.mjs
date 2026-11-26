// Run the normal seven-bot Harbour Road test against a separately built release client.
// node --import tsx tests/production-battle.mjs [--check]
// --check verifies the bundle, compressed delivery and account ticket without starting a browser.
// The Python harness accepts the same BATTLE_* and HARBOUR_* options as in development.
// Set BATTLE_FIXED_TURNS=1 for repeatable 100 ms sweeps from the same compass heading.
// Set BATTLE_DRAW_PROFILE=1 to trace CPU draw submission and actual WebGL program binds.
// Set BATTLE_GPU_PROFILE=1 to sample raw GPU frame times, including on High and Ultra.
// Set BATTLE_FRAME_PHASES=1 to attribute long CPU frames to work inside the game callback.
// BATTLE_SNAPSHOT_PROFILE=1 times client snapshot merge, HUD/event dispatch, scene sync and the test observer.
// HARBOUR_NEAR_SPAWN=1 starts the tester behind the Diner on the isolated server.
// BATTLE_SEED sets the isolated server's starting random sequence for comparable runs.
// Bots, difficulty, damage and movement retain their normal game rules.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdtemp, readdir, rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'vite';
import {createTunnelGateway} from '../server/tunnelGateway.ts';

const seed=process.env.BATTLE_SEED;
assert(seed===undefined||/^\d{1,10}$/.test(seed)&&Number(seed)<=0xffffffff,'BATTLE_SEED must be an unsigned 32-bit integer');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(tmpdir());
const scratch = await mkdtemp(join(tempRoot, 'harbour-release-'));
const dist = join(scratch, 'dist');
const children = new Set();
let gateway;
function child(command, args, options = {}) {
  const proc = spawn(command, args, {cwd:root, stdio:'inherit', windowsHide:true, ...options});
  children.add(proc);
  const done = new Promise((ok, fail) => {
    proc.once('error', fail);
    proc.once('exit', (code, signal) => code === 0 ? ok() : fail(Error(command+' exited '+(code ?? signal))));
  }).finally(() => children.delete(proc));
  done.catch(()=>{}); // Also observe early server exit during startup and cleanup.
  return {proc, done};
}
async function listen(server) {
  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', ok);
  });
  return server.address().port;
}
function stop() {
  for(const proc of children) proc.kill();
}
process.once('SIGINT', () => {process.exitCode=130; stop();});
process.once('SIGTERM', () => {process.exitCode=143; stop();});
try {
  assert(process.argv.slice(2).every(arg=>arg==='--check'), 'Expected --check or no arguments');
  assert(process.env.BATTLE_SHADER_PROFILE!=='1','Shader material tagging requires the development build');
  let patched = false, drawPatched=false, phasePatched=false, gpuHooks=0;
  const traceDraws=process.env.BATTLE_DRAW_PROFILE==='1';
  const traceGpu=process.env.BATTLE_GPU_PROFILE==='1';
  const tracePhases=process.env.BATTLE_FRAME_PHASES==='1';
  await build({root, mode:'production', logLevel:'warn', build:{outDir:dist}, plugins:[{
    name:'local-battle-observation', enforce:'pre',
    transform(source, id) {
      const path=id.replaceAll('\\','/');
      if(traceGpu&&path.endsWith('/client/gpuTiming.ts')){
        const anchor='state.samples++;';
        assert.equal(source.split(anchor).length,2,'GPU sample hook changed');
        gpuHooks++;
        return source.replace(anchor,anchor+'state.latestSample=ms;');
      }
      if(traceGpu&&path.endsWith('/client/graphics.ts')){
        const sampling='timingEnabled&&adaptiveQuality&&adaptive&&currentTimingFrame%17===0';
        const capture='frameState.gpuMs=gpuTiming.state.ms;';
        assert.equal(source.split(sampling).length,2,'GPU timing condition changed');
        assert.equal(source.split(capture).length,2,'GPU frame capture hook changed');
        gpuHooks++;
        return source.replace(sampling,'timingEnabled&&adaptive&&currentTimingFrame%17===0')
          .replace(capture,capture+'frameState.gpuQueryCount=gpuTiming.state.samples;frameState.gpuQueryMs=gpuTiming.state.latestSample;');
      }
      if(path.endsWith('/client/scene.ts')&&(traceDraws||tracePhases)) {
        if(traceDraws){
          const marker=/^  const renderer = new T\.WebGLRenderer\([^\n]+;$/gm;
          assert.equal([...source.matchAll(marker)].length,1,'Scene renderer hook changed');
          drawPatched=true;
          source="import {attachBattleDrawProbe} from '../tests/battle-draw-probe.mjs';\n"+
            source.replace(marker,'$&\nwindow.battleDrawProbe=attachBattleDrawProbe(renderer);');
        }
        if(tracePhases){
          const hooks=[
            ['const frameMs=t-last;', 'const phaseMarkers=frameProfile.length<profileLimit?[cpuStarted]:undefined;'],
            ['for (const g of avatars.values()) {', 'phaseMarkers?.push(performance.now());'],
            ['contactShadows.end();', 'phaseMarkers?.push(performance.now());'],
            ['graphics.render(dt,', 'phaseMarkers?.push(performance.now());']
          ];
          for(const [anchor,probe] of hooks){
            assert.equal(source.split(anchor).length,2,'Frame phase hook changed: '+anchor);
            source=source.replace(anchor,probe+'\n'+anchor);
          }
          const sample='frameProfile.push({frameMs,cpuMs,';
          assert.equal(source.split(sample).length,2,'Frame sample hook changed');
          source=source.replace(sample,sample+'phases:{simulationAndCamera:phaseMarkers[1]-phaseMarkers[0],actors:phaseMarkers[2]-phaseMarkers[1],effectsAndHud:phaseMarkers[3]-phaseMarkers[2],graphics:cpuStarted+cpuMs-phaseMarkers[3]},');
          phasePatched=true;
        }
        return source;
      }
      if(!path.endsWith('/client/App.tsx')) return;
      const anchor = "scene.current?.update(s, access.playerId, 'network');";
      assert.equal(source.split(anchor).length, 2, 'App snapshot hook changed');
      patched = true;
      let observe="window.observeHarbourBattle?.(own,s,scene.current,()=>battleInteriorWorld(getWorld(s.mapId),s.interiors).boxes,harbourBotRules[s.operation.config.difficulty].vision);";
      if(process.env.BATTLE_SNAPSHOT_PROFILE==='1'){
        const merge='const s = mergeSnapshot(last.current, packet);';
        assert.equal(source.split(merge).length,2,'Snapshot merge timing hook changed');
        source=source.replace(merge,'const snapshotStart=performance.now();\n'+merge+'\nconst mergedAt=performance.now();');
        observe=`const sceneDone=performance.now();\n${observe}
          const done=performance.now();
          const probe=window.harbourSnapshotProbe??={samples:[],count:0};
          probe.samples[probe.count++%2048]={start:snapshotStart,end:done,mergeMs:mergedAt-snapshotStart,
            hudEventsMs:sceneStarted-mergedAt,sceneMs:sceneDone-sceneStarted,observerMs:done-sceneDone,
            full:!!packet.full,players:(packet.full?.players??packet.players??[]).length,
            freshEvents:freshEvents.map(e=>e.type)};`;
        source=source.replace(anchor,'const sceneStarted=performance.now();\n'+anchor);
      }
      return "import {interiorWorld as battleInteriorWorld} from '../shared/interiors';\n"+
        "import {difficultyRules as harbourBotRules} from '../shared/operationConfig';\n"+
        source.replace(anchor,anchor+"\n"+observe);
    }
  }]});
  assert(patched, 'Missing App observation hook');
  assert.equal(drawPatched,traceDraws,'Missing scene renderer hook');
  assert.equal(phasePatched,tracePhases,'Missing CPU phase hooks');
  assert.equal(gpuHooks,traceGpu?2:0,'Missing GPU profile hook');
  await child(process.execPath, [join(root,'scripts/compress-client.mjs')], {cwd:scratch}).done;

  const reservation = createServer();
  const backendPort = await listen(reservation);
  const publicPortReservation = createServer();
  const publicPort = await listen(publicPortReservation);
  const origin = 'http://127.0.0.1:'+publicPort;
  gateway = createTunnelGateway({staticDirectory:dist,backendPort,publicOrigin:origin});
  await new Promise(done=>publicPortReservation.close(done));
  await new Promise((done,fail)=>gateway.server.once('error',fail).listen(publicPort,'127.0.0.1',done));
  await new Promise(done=>reservation.close(done));
  const serverEntry = process.env.HARBOUR_NEAR_SPAWN === '1'||seed!==undefined ? ['--input-type=module','--eval',`
    import {Game} from './shared/game.ts';
    import {getWorld,ground} from './shared/world.ts';
    if(process.env.BATTLE_SEED!==undefined){
      let state=Number(process.env.BATTLE_SEED);
      Math.random=()=>{
        state=(Math.imul(1664525,state)+1013904223)>>>0;
        return state/4294967296;
      };
    }
    if(process.env.HARBOUR_NEAR_SPAWN==='1'){
      const tick=Game.prototype.tick;
      Game.prototype.tick=function(now){
        const player=this.state.players.find(p=>p.kind==='human');
        const previousLife=player?.life;
        tick.call(this,now);
        if(this.state.phase==='playing' && this.state.mapId==='storm' && player?.hp>0 && player.life!==previousLife){
          const x=60,z=-41;
          Object.assign(player,{x,y:ground(x,z,getWorld('storm')),z});
        }
      };
    }
    await import('./server/index.ts');
  `] : ['server/index.ts'];
  const server = child(process.execPath,['--import','tsx',...serverEntry],{env:{...process.env,
    NODE_ENV:'production', BIND_HOST:'127.0.0.1', PORT:String(backendPort), DATABASE_URL:'',
    SHOOTER_ACCOUNTS_DB:join(scratch,'accounts.sqlite'), SHOOTER_ORIGINS:origin,
    SHOOTER_PUBLIC_URL:origin+'/game', SHOOTER_TICKET_SECRET:randomBytes(32).toString('hex')}});
  const startup=new AbortController();
  const ready = async()=>{
    // Each isolated process warms navigation for all maps before it listens.
    const deadline=Date.now()+60_000;
    const health=async(url)=>{
      try {
        const response=await fetch(url,{signal:AbortSignal.timeout(1000)});
        return {ok:response.ok,status:`HTTP ${response.status}`};
      } catch(error) {
        return {ok:false,status:String(error.cause?.code??error.name)};
      }
    };
    let gatewayHealth;
    do {
      gatewayHealth=await health(origin+'/game/health');
      if(gatewayHealth.ok) return;
      await delay(150,undefined,{signal:startup.signal});
    } while(Date.now()<deadline);
    const backendHealth=await health(`http://127.0.0.1:${backendPort}/health`);
    throw Error(`Game server startup timed out (gateway ${gatewayHealth.status}, backend ${backendHealth.status})`);
  };
  try {
    await Promise.race([ready(),server.done.then(()=>{throw Error('Game server exited early');})]);
  } finally {
    startup.abort();
  }
  const html = await (await fetch(origin)).text();
  assert(!html.includes('/@vite/client') && /\/assets\/[^"]+\.js/.test(html),'Expected built HTML');
  const bundle = (await readdir(join(dist,'assets'))).find(name=>/^App-[\w-]+\.js$/.test(name));
  assert(bundle,'Missing lazy App chunk');
  const response = await fetch(origin+'/assets/'+bundle,{headers:{'accept-encoding':'br'}});
  assert.equal(response.headers.get('content-encoding'),'br');
  assert((await response.text()).includes('observeHarbourBattle'),'Probe missing from release chunk');
  const signup = await fetch(origin+'/game/account/register',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({username:'ReleaseSmoke',password:randomBytes(16).toString('hex')})});
  assert.equal(signup.status,201);
  const ticket = await fetch(origin+'/game/account/ticket',{method:'POST',headers:{cookie:signup.headers.get('set-cookie').split(';')[0]}});
  assert.equal(ticket.status,200);
  assert.equal((await ticket.json()).serverUrl,origin+'/game');
  console.log('Release bundle, Brotli and authenticated game ticket verified:',origin);
  if(!process.argv.includes('--check')) {
    await Promise.race([child(process.env.PYTHON ?? 'python',['tests/harbour-road-battle.py'],{env:{
      ...process.env,BATTLE_PRODUCTION:'1',BATTLE_BASE_URL:origin}}).done,server.done]);
  }
} finally {
  const exits=[...children].map(proc=>new Promise(done=>proc.once('close',done)));
  stop();
  await Promise.all(exits);
  if(gateway) await gateway.close();
  assert.equal(dirname(scratch),tempRoot);
  await rm(scratch,{recursive:true,force:true,maxRetries:4});
}
