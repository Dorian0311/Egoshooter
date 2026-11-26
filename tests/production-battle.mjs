// Run the normal seven-bot Harbour Road test against a separately built release client.
// node --import tsx tests/production-battle.mjs [--check]
// --check verifies the bundle, compressed delivery and account ticket without starting a browser.
// The Python harness accepts the same BATTLE_* and HARBOUR_* options as in development.
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
  let patched = false;
  await build({root, mode:'production', logLevel:'warn', build:{outDir:dist}, plugins:[{
    name:'local-battle-observation', enforce:'pre',
    transform(source, id) {
      if(!id.replaceAll('\\','/').endsWith('/client/App.tsx')) return;
      const anchor = 'scene.current?.update(s, access.playerId);';
      assert.equal(source.split(anchor).length, 2, 'App snapshot hook changed');
      patched = true;
      return "import {interiorWorld as battleInteriorWorld} from '../shared/interiors';\n"+
        source.replace(anchor, anchor+"\nwindow.observeHarbourBattle?.(own,s,scene.current,()=>battleInteriorWorld(getWorld(s.mapId),s.interiors).boxes);");
    }
  }]});
  assert(patched, 'Missing App observation hook');
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
  const server = child(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,
    NODE_ENV:'production', BIND_HOST:'127.0.0.1', PORT:String(backendPort), DATABASE_URL:'',
    SHOOTER_ACCOUNTS_DB:join(scratch,'accounts.sqlite'), SHOOTER_ORIGINS:origin,
    SHOOTER_PUBLIC_URL:origin+'/game', SHOOTER_TICKET_SECRET:randomBytes(32).toString('hex')}});
  const ready = async()=>{
    for(let i=0;i<100;i++) {
      if((await fetch(origin+'/game/health')).ok) return;
      await delay(150);
    }
    throw Error('Game server startup timed out');
  };
  await Promise.race([ready(),server.done.then(()=>{throw Error('Game server exited early');})]);
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
