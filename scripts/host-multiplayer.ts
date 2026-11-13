import {spawn,type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import http from 'node:http';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTunnelGateway} from '../server/tunnelGateway.ts';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const runtimeDirectory=resolve(root,'data/tunnel'),statePath=resolve(runtimeDirectory,'runtime.json');
const controlPort=4181,frontendPort=4180,backendPort=2588;
type Runtime={url:string;pid:number;controlToken:string};
const readState=()=>JSON.parse(readFileSync(statePath,'utf8')) as Runtime;
async function control(action:'status'|'stop',state:Runtime){
 return fetch(`http://127.0.0.1:${controlPort}/${action}`,{method:action==='stop'?'POST':'GET',headers:{Authorization:`Bearer ${state.controlToken}`},signal:AbortSignal.timeout(2000)});
}
if(process.argv.includes('--stop')){
 try{const response=await control('stop',readState());if(!response.ok)throw Error('Steuerung nicht erreichbar.');console.log('Multiplayer wird beendet.');}
 catch{console.error('Kein erreichbarer Multiplayer-Host.');process.exitCode=1;}
}else{
 await start();
}
async function start(){
 if(existsSync(statePath)){
  try{const state=readState(),response=await control('status',state);if(response.ok){console.log('Multiplayer läuft bereits: '+state.url);return;}}catch{/* Stale state after a shutdown. */}
 }
 const binary=process.env.CLOUDFLARED_PATH??resolve(runtimeDirectory,'cloudflared.exe');
 if(!existsSync(binary))throw Error('Cloudflare-Client fehlt: '+binary);
 if(!existsSync(resolve(root,'dist/index.html')))throw Error('Spiel-Build fehlt. Bitte npm run build ausführen.');
 mkdirSync(runtimeDirectory,{recursive:true});
 const controlToken=randomBytes(32).toString('hex'),children:ChildProcess[]=[];
 let gateway:ReturnType<typeof createTunnelGateway>|undefined,stopping=false;
 const controller=http.createServer((req,res)=>{
  if(req.headers.authorization!==`Bearer ${controlToken}`){res.writeHead(403).end();return;}
  if(req.url==='/status'&&req.method==='GET'){res.writeHead(200).end('ok');return;}
  if(req.url==='/stop'&&req.method==='POST'){res.writeHead(200).end('stopping');void shutdown();return;}
  res.writeHead(404).end();
 });
 const closeController=()=>new Promise<void>(done=>{controller.close(()=>done());controller.closeAllConnections();});
 async function shutdown(code=0){
  if(stopping)return;stopping=true;
  for(const child of children)child.kill();
  await Promise.all([gateway?.close(),closeController()]);
  try{if(readState().controlToken===controlToken)unlinkSync(statePath);}catch{/* No runtime state yet. */}
  console.log('Multiplayer beendet.');process.exit(code);
 }
 for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>void shutdown());
 function watch(child:ChildProcess,label:string){
  children.push(child);
  child.on('error',error=>{console.error(label+': '+error.message);void shutdown(1);});
  child.on('exit',code=>{if(!stopping){console.error(`${label} wurde beendet (${code}).`);void shutdown(1);}});
 }
 try{
  await new Promise<void>((done,reject)=>{controller.once('error',reject);controller.listen(controlPort,'127.0.0.1',done);});
  console.log('Cloudflare-Verbindung wird aufgebaut …');
  const tunnel=spawn(binary,['tunnel','--no-autoupdate','--protocol','http2','--url',`http://127.0.0.1:${frontendPort}`],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  watch(tunnel,'Cloudflare');
  const publicUrl=await new Promise<string>((done,reject)=>{
   let buffer='';const timer=setTimeout(()=>reject(Error('Cloudflare liefert nach 60 Sekunden keinen Link.')),60000);
   const consume=(chunk:Buffer)=>{
    const line=chunk.toString();process.stdout.write(line);buffer=(buffer+line).slice(-12000);
    const url=buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/)?.[0];
    if(url){clearTimeout(timer);done(url);}
   };
   tunnel.stdout!.on('data',consume);tunnel.stderr!.on('data',consume);
   tunnel.once('error',error=>{clearTimeout(timer);reject(error);});
   tunnel.once('exit',()=>{clearTimeout(timer);reject(Error('Cloudflare-Tunnel konnte nicht starten.'));});
  });
  const game=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:root,windowsHide:true,
   env:{...process.env,NODE_ENV:'production',PORT:String(backendPort),BIND_HOST:'127.0.0.1',DATABASE_URL:'',SHOOTER_LOCAL_TRAINING:'false',
    SHOOTER_ACCOUNTS_DB:resolve(root,'data/users.sqlite'),SHOOTER_TICKET_SECRET:randomBytes(48).toString('hex'),
    SHOOTER_PUBLIC_URL:publicUrl+'/game',SHOOTER_ORIGINS:`${publicUrl},http://127.0.0.1:${frontendPort},http://localhost:${frontendPort}`},
   stdio:['ignore','pipe','pipe']});
  watch(game,'Spielserver');game.stdout!.pipe(process.stdout);game.stderr!.pipe(process.stderr);
  const deadline=Date.now()+30000;
  while(true){
   try{const response=await fetch(`http://127.0.0.1:${backendPort}/health`,{signal:AbortSignal.timeout(500)});if(response.ok)break;}catch{/* Backend is starting. */}
   if(Date.now()>deadline)throw Error('Spielserver startet nicht.');
   await new Promise(done=>setTimeout(done,150));
  }
  gateway=createTunnelGateway({staticDirectory:resolve(root,'dist'),backendPort,publicOrigin:publicUrl});
  await new Promise<void>((done,reject)=>{gateway!.server.once('error',reject);gateway!.server.listen(frontendPort,'127.0.0.1',done);});
  writeFileSync(statePath,JSON.stringify({url:publicUrl,pid:process.pid,controlToken} satisfies Runtime),{mode:0o600});
  writeFileSync(resolve(runtimeDirectory,'Spiel-Link.txt'),publicUrl+'\n');
  console.log('\nSPIEL BEREIT: '+publicUrl+'\nLink teilen. Jeder Spieler legt sein eigenes Profil an.\nZum Beenden Stop-Multiplayer.cmd ausführen oder Strg+C drücken.\n');
 }catch(error){console.error(error instanceof Error?error.message:error);await shutdown(1);}
}
