import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Client,type Room} from '@colyseus/sdk';
import {mergeSnapshot,type SnapshotPacket} from '../shared/protocol.ts';
import {neutral,type Snapshot} from '../shared/game.ts';

const base=process.env.TEST_DOCKER_URL??'https://localhost';
const origin=new URL(base).origin;
assert.equal(new URL(base).protocol,'https:','Docker smoke test expects HTTPS');
const rooms:Room[]=[],states=new Map<number,Snapshot>();
const users:{cookie:string;ticket:string;playerId:string;username:string}[]=[];
const run=randomBytes(3).toString('hex');
async function request(path:string,method='GET',body?:unknown,cookie?:string){
 return fetch(base+'/game'+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
}
async function until(check:()=>boolean|Promise<boolean>,timeout=30000){
 const deadline=Date.now()+timeout;
 while(!await check()){if(Date.now()>deadline)throw Error('Docker smoke test timed out');await new Promise(done=>setTimeout(done,100));}
}
try{
 await until(async()=>{try{return (await request('/health')).ok;}catch{return false;}},60000);
 const health=await (await request('/health')).json();assert.equal(health.persistence,true);
 const page=await fetch(base);assert.equal(page.status,200);
 const html=await page.text(),asset=html.match(/src="([^"]+\.js)"/)?.[1];assert.ok(asset);
 const script=await fetch(base+asset);assert.equal(script.status,200);assert.match(script.headers.get('content-type')!,/javascript/);
 assert.match(script.headers.get('cache-control')!,/immutable/);
 for(const path of ['/.env','/server/auth.ts','/data/users.sqlite','/api/shooter/ticket'])assert.ok([403,404].includes((await fetch(base+path)).status));
 assert.equal((await request('/account/ticket','POST')).status,401);
 // A browser-origin mismatch must be rejected even behind the web proxy.
 assert.equal((await fetch(base+'/game/account/login',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'})).status,403);
 for(let n=0;n<8;n++){
  const username=`DockerQA_${run}_${n}`;
  const registered=await request('/account/register','POST',{username,password:randomBytes(24).toString('hex')});
  assert.equal(registered.status,201);
  const setCookie=registered.headers.get('set-cookie')!;assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/Secure/i);
  const cookie=setCookie.split(';')[0];
  const access=await (await request('/account/ticket','POST',undefined,cookie)).json();assert.equal(access.serverUrl,origin+'/game');
  users.push({cookie,username,...access});
  const sdk=new Client(access.serverUrl,{headers:{Origin:origin}});
  const room=n===0?await sdk.create('altstadt',{ticket:access.ticket,mapId:'storm'}):await sdk.joinById(rooms[0].roomId,{ticket:access.ticket});
  rooms.push(room);room.onMessage('snapshot',(packet:SnapshotPacket)=>{const state=mergeSnapshot(states.get(n)??null,packet);if(state)states.set(n,state);});room.send('sync');
 }
 await until(()=>states.size===8&&[...states.values()].every(state=>state.players.length===8));
 for(const room of rooms)room.send('ready',true);
 await until(()=>[...states.values()].every(state=>state.phase==='playing'));
 assert.equal(new Set([...states.values()].map(state=>state.startsAt)).size,1);
 const player=states.get(0)!.players.find(value=>value.id===users[0].playerId)!,start={x:player.x,z:player.z};
 for(let seq=1;seq<=12;seq++){rooms[0].send('input',{...neutral(seq),forward:1,yaw:0,time:states.get(0)!.now});await new Promise(done=>setTimeout(done,40));}
 await until(()=>{const current=states.get(0)!.players.find(value=>value.id===users[0].playerId)!;return Math.hypot(current.x-start.x,current.z-start.z)>.05;});
 const stats=await request('/stats','GET',undefined,undefined).then(response=>response.status);assert.equal(stats,503);
 const authorizedStats=await fetch(base+'/game/stats',{headers:{Origin:origin,Authorization:'Bearer '+users[0].ticket}});
 assert.equal(authorizedStats.status,200);assert.ok(Array.isArray((await authorizedStats.json()).leaderboard));
 await Promise.all(rooms.map(room=>room.leave()));rooms.length=0;
 if(process.env.TEST_DOCKER_RESTART==='true'){
  assert.equal(base,'https://localhost','Automatic restart is limited to the local test stack');
  await promisify(execFile)('docker',['compose','restart','game'],{timeout:60000});
  await until(async()=>{try{return (await request('/health')).ok;}catch{return false;}},60000);
  const me=await (await request('/account/me','GET',undefined,users[0].cookie)).json();
  assert.equal(me.user.id,users[0].playerId);assert.equal(me.user.username,users[0].username);
  assert.equal((await request('/account/ticket','POST',undefined,users[0].cookie)).status,200);
 }
 console.log('PASS: Docker HTTPS/assets, protected APIs, eight-player WebSockets, synchronized match, movement, PostgreSQL stats'+(process.env.TEST_DOCKER_RESTART==='true'?' and persistent login after restart.':'.'));
}finally{
 await Promise.allSettled(rooms.map(room=>room.leave()));
 await Promise.allSettled(users.map(user=>request('/account/logout','POST',undefined,user.cookie)));
}
