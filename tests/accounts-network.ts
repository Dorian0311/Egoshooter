import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {Client,type Room} from '@colyseus/sdk';
import {mergeSnapshot,type SnapshotPacket} from '../shared/protocol';
import type {Snapshot} from '../shared/game';
const base='http://127.0.0.1:2587',origin='http://127.0.0.1:5173';
const processHandle=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,NODE_ENV:'test',PORT:'2587',BIND_HOST:'127.0.0.1',DATABASE_URL:'',SHOOTER_ACCOUNTS_DB:':memory:',SHOOTER_TICKET_SECRET:'account-integration-test-secret-32-characters',SHOOTER_ORIGINS:origin},stdio:['ignore','pipe','pipe']});
let logs='';for(const stream of [processHandle.stdout,processHandle.stderr])stream.on('data',v=>{logs=(logs+String(v)).slice(-3500);});
const rooms:Room[]=[];
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check:()=>boolean,ms=10000){const deadline=Date.now()+ms;while(!check()){if(Date.now()>deadline)throw Error('Timeout: '+logs);await sleep(30);}}
async function request(path:string,method='GET',body?:unknown,cookie?:string){return fetch(base+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});}
try{
 await until(()=>logs.includes('multiplayer listening'),60000);
 assert.equal((await request('/account/ticket','POST')).status,401);
 assert.equal((await request('/rooms')).status,401);
 const users: {cookie:string;ticket:string;playerId:string}[]=[];
 for(const name of ['NetworkAlpha','NetworkBravo','NetworkCharlie']){
  const response=await request('/account/register','POST',{username:name,password:'Integration-only-1945!'});assert.equal(response.status,201);
  const setCookie=response.headers.get('set-cookie')!;assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=Lax/i);
  const cookie=setCookie.split(';')[0],me=await (await request('/account/me','GET',undefined,cookie)).json();assert.equal(me.user.username,name);
  const ticket=await (await request('/account/ticket','POST',undefined,cookie)).json();assert.equal(ticket.playerId,me.user.id);users.push({cookie,...ticket});
 }
 assert.equal((await request('/account/login','POST',{username:'NetworkAlpha',password:'incorrect-password'})).status,401);
 const sdk=new Client(base,{headers:{Origin:origin}}),states=new Map<number,Snapshot>();
 function watch(room:Room,n:number){rooms.push(room);room.onMessage('snapshot',(packet:SnapshotPacket)=>{const snapshot=mergeSnapshot(states.get(n)??null,packet);if(snapshot)states.set(n,snapshot);});room.send('sync');}
 watch(await sdk.create('altstadt',{ticket:users[0].ticket,mapId:'storm',uniform:'task-olive'}),0);
 const list=()=>fetch(base+'/rooms',{headers:{Origin:origin,Authorization:'Bearer '+users[0].ticket}}).then(r=>r.json());
 let listed=(await list()).rooms;assert.equal(listed.length,1);assert.equal(listed[0].phase,'waiting');assert.equal(listed[0].players,1);assert.equal(listed[0].host,'NetworkAlpha');
 watch(await sdk.joinById(rooms[0].roomId,{ticket:users[1].ticket}),1);
 for(const room of rooms)room.send('ready',true);
 await until(()=>states.get(0)?.phase==='playing');
 listed=(await list()).rooms;assert.equal(listed[0].phase,'playing');assert.equal(listed[0].joinable,true);
 watch(await sdk.joinById(rooms[0].roomId,{ticket:users[2].ticket,uniform:'task-olive'}),2);
 await until(()=>states.get(0)?.players.length===3);
 const joined=states.get(0)!.players.find(p=>p.id===users[2].playerId)!;assert.ok(joined.ready&&joined.connected);assert.ok(joined.protectedUntil>states.get(0)!.now);
 await rooms[2].leave();await until(()=>!!states.get(0)?.players.find(p=>p.id===users[2].playerId)?.departed);
 assert.equal((await list()).rooms[0].players,2);
 watch(await sdk.joinById(rooms[0].roomId,{ticket:users[2].ticket}),3);
 await until(()=>states.get(0)?.players.find(p=>p.id===users[2].playerId)?.departed===false);
 assert.equal(states.get(0)!.players.length,3);
 await request('/account/logout','POST',undefined,users[2].cookie);
 assert.equal((await request('/account/ticket','POST',undefined,users[2].cookie)).status,401);
 assert.equal((await (await request('/account/me','GET',undefined,users[2].cookie)).json()).user,null);
 console.log('PASS: account register/login/cookies/logout, protected room list, waiting/playing join, spawn protection and returning player.');
}finally{await Promise.allSettled(rooms.map(room=>room.leave()));processHandle.kill();}
