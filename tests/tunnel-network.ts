import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Client,type Room} from '@colyseus/sdk';
import {mergeSnapshot,type SnapshotPacket} from '../shared/protocol.ts';
import {neutral,type Snapshot} from '../shared/game.ts';

// Explicit live check: creates eight disposable QA profiles on the running host.
// Passwords, cookies, and tickets stay in this process; no existing profile is changed.
const url=process.env.TEST_TUNNEL_URL??readFileSync('data/tunnel/Spiel-Link.txt','utf8').trim();
assert.match(url,/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/);
const rooms:Room[]=[],sessions:{cookie:string;ticket:string;playerId:string}[]=[];
const states=new Map<number,Snapshot>(),run=randomBytes(3).toString('hex');
async function until(check:()=>boolean,timeout=30000){
 const end=Date.now()+timeout;
 while(!check()){if(Date.now()>end)throw Error('Multiplayer-Zeitlimit überschritten.');await new Promise(done=>setTimeout(done,50));}
}
async function request(path:string,method='GET',body?:unknown,cookie?:string){
 return fetch(url+'/game'+path,{method,headers:{Origin:url,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
}
try{
 assert.equal((await fetch(url)).status,200);
 assert.equal((await (await request('/health')).json()).ok,true);
 assert.equal((await request('/account/ticket','POST')).status,401);
 for(const path of ['/server/auth.ts','/data/users.sqlite','/api/shooter/ticket'])assert.ok([403,404].includes((await fetch(url+path)).status));
 for(let n=0;n<8;n++){
  const response=await request('/account/register','POST',{username:`TunnelQA_${run}_${n}`,password:randomBytes(24).toString('hex')});
  assert.equal(response.status,201);
  assert.match(response.headers.get('set-cookie')!,/Secure/i);
  const cookie=response.headers.get('set-cookie')!.split(';')[0];
  const ticketResponse=await request('/account/ticket','POST',undefined,cookie);
  assert.equal(ticketResponse.status,200);
  const access=await ticketResponse.json();assert.equal(access.serverUrl,url+'/game');
  sessions.push({cookie,...access});
  const client=new Client(access.serverUrl,{headers:{Origin:url}});
  const room=n===0?await client.create('altstadt',{ticket:access.ticket,mapId:'storm'}):await client.joinById(rooms[0].roomId,{ticket:access.ticket});
  rooms.push(room);
  room.onMessage('snapshot',(packet:SnapshotPacket)=>{const state=mergeSnapshot(states.get(n)??null,packet);if(state)states.set(n,state);});
  room.send('sync');
 }
 await until(()=>states.size===8&&[...states.values()].every(state=>state.players.length===8));
 const roomList=await (await fetch(url+'/game/rooms',{headers:{Origin:url,Authorization:'Bearer '+sessions[0].ticket}})).json();
 assert.ok(roomList.rooms.some((room:{players:number;joinable:boolean})=>room.players===8&&!room.joinable));
 for(const room of rooms)room.send('ready',true);
 await until(()=>[...states.values()].every(state=>state.phase==='playing'));
 assert.equal(new Set([...states.values()].map(state=>state.startsAt)).size,1);
 const before=states.get(0)!.players.find(player=>player.id===sessions[0].playerId)!;
 const start={x:before.x,z:before.z};
 for(let seq=1;seq<=12;seq++){
  rooms[0].send('input',{...neutral(seq),forward:1,yaw:0,time:states.get(0)!.now});
  await new Promise(done=>setTimeout(done,40));
 }
 await until(()=>{const player=states.get(0)!.players.find(value=>value.id===sessions[0].playerId)!;return Math.hypot(player.x-start.x,player.z-start.z)>.05;});
 console.log(JSON.stringify({passed:true,publicHttps:true,profiles:8,webSocketClients:8,synchronizedMatch:true,movement:true,profilePrefix:`TunnelQA_${run}_`}));
}finally{
 await Promise.allSettled(rooms.map(room=>room.leave()));
 await Promise.allSettled(sessions.map(session=>request('/account/logout','POST',undefined,session.cookie)));
}
