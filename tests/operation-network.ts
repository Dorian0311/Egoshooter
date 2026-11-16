import {writeFileSync,mkdirSync} from 'node:fs';
import {createNavigation} from '../server/navigation';
import {neutral} from '../shared/game';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {Client,type Room} from '@colyseus/sdk';
import {SignJWT} from 'jose';
import {mergeSnapshot,type SnapshotPacket} from '../shared/protocol';
import type {Snapshot} from '../shared/game';
const port=2594,secret='operation-network-test-only-secret-32-chars';
const server=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,NODE_ENV:'test',PORT:String(port),BIND_HOST:'127.0.0.1',DATABASE_URL:'',SHOOTER_ACCOUNTS_DB:':memory:',SHOOTER_TICKET_SECRET:secret,SHOOTER_ORIGINS:'http://127.0.0.1:5173'},stdio:['ignore','pipe','pipe']});
let logs='';server.stdout?.on('data',d=>logs=(logs+String(d)).slice(-5000));server.stderr?.on('data',d=>logs=(logs+String(d)).slice(-5000));
const rooms:Room[]=[],states=new Map<Room,Snapshot>(),checks:string[]=[];
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean,timeout=15000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(fn())return;await sleep(30);}throw Error('Timed out: '+logs.slice(-1500));}
async function token(id:string){return new SignJWT({name:id,role:'Support.Agent'}).setProtectedHeader({alg:'HS256'}).setIssuer('supporthub').setAudience('altstadt-1940').setSubject(id).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(secret));}
const sdk=()=>new Client(`ws://127.0.0.1:${port}`,{headers:{Origin:'http://127.0.0.1:5173'}});
async function attach(room:Room){rooms.push(room);room.reconnection.minUptime=0;room.onMessage('snapshot',(packet:SnapshotPacket)=>{const state=mergeSnapshot(states.get(room)??null,packet);if(state)states.set(room,state);});room.send('sync');await until(()=>states.has(room));return room;}
try{
 await until(()=>logs.includes('multiplayer listening'),30000);
 await assert.rejects(async()=>sdk().create('altstadt',{ticket:await token('bad'),operation:{kind:'coop',mode:'training'}}),/Spielmodus/);
 const solo=await attach(await sdk().create('altstadt',{ticket:await token('solo'),mapId:'cologne',uniform:'kroenen',operation:{kind:'solo',mode:'training'}}));
 assert.equal(states.get(solo)!.players.find(p=>p.id==='solo')!.uniform,'kroenen');
 await assert.rejects(async()=>sdk().joinById(solo.roomId,{ticket:await token('intruder')}));
 const code=states.get(solo)!.roomCode,headers={Authorization:`Bearer ${await token('observer')}`};
 assert.equal((await fetch(`http://127.0.0.1:${port}/rooms/${code}`,{headers})).status,404);
 assert.ok(!(await (await fetch(`http://127.0.0.1:${port}/rooms`,{headers})).json()).rooms.some((r:{code:string})=>r.code===code));
 solo.send('ready',true);await until(()=>states.get(solo)?.phase==='playing');
 assert.equal(states.get(solo)!.pickups.length,12);assert.equal(states.get(solo)!.npcs.length,4);assert.equal(states.get(solo)!.operation.config.kind,'solo');
 checks.push('Solo is private through list, code and direct room ID; Kroenen and authoritative NPC/item snapshots synchronize');
 let reconnected=false;solo.onReconnect(()=>{reconnected=true;});solo.connection.close(4010,'QA reconnect');await until(()=>reconnected,12000);await until(()=>states.get(solo)?.players.find(p=>p.id==='solo')?.connected===true);assert.equal(states.get(solo)!.host,'solo');assert.equal(states.get(solo)!.operation.paused,false);checks.push('Solo reconnect resumes logical clock and preserves human ownership');
 await solo.leave();
 const coop=await attach(await sdk().create('altstadt',{ticket:await token('coop-a'),mapId:'storm',operation:{kind:'coop',mode:'survival'}}));
 const peer=await attach(await sdk().joinById(coop.roomId,{ticket:await token('coop-b')}));
 coop.send('ready',true);await sleep(200);assert.equal(states.get(coop)!.phase,'waiting');peer.send('ready',true);
 await until(()=>states.get(coop)?.phase==='playing'&&states.get(peer)?.phase==='playing');
 assert.equal(states.get(coop)!.operation.remaining,4);assert.equal(states.get(coop)!.players.filter(p=>p.kind==='human').length,2);
 assert.equal(states.get(peer)!.operation.config.kind,'coop');assert.equal(states.get(coop)!.matchId,states.get(peer)!.matchId);
 await assert.rejects(async()=>sdk().joinById(coop.roomId,{ticket:await token('late')}));
 checks.push('Two real coop clients require readiness; scaled wave and matching snapshots; late joins rejected');
 const navigation=await createNavigation('storm');navigation.sync(states.get(coop)!.interiors);
 try{
  let seq=1000;const initial=states.get(coop)!.players.find(p=>p.id==='coop-a')!,gift=states.get(coop)!.pickups.filter(p=>p.kind==='gift').sort((a,b)=>Math.hypot(a.x-initial.x,a.z-initial.z)-Math.hypot(b.x-initial.x,b.z-initial.z))[0],path=navigation.path(initial,gift),deadline=Date.now()+18000;
  while(true){const state=states.get(coop)!,player=state.players.find(p=>p.id==='coop-a')!;if(Math.hypot(player.x-gift.x,player.z-gift.z)<.3)break;assert.ok(Date.now()<deadline,'Could not reach gift through validated movement');while(path.length&&Math.hypot(path[0].x-player.x,path[0].z-player.z)<.6)path.shift();const point=path[0]??gift;coop.send('input',{...neutral(++seq),forward:1,yaw:Math.atan2(player.x-point.x,player.z-point.z),time:state.now});await sleep(65);}
  coop.send('input',{...neutral(++seq),pitch:1.4,time:states.get(coop)!.now});await sleep(150);coop.send('interact',gift.id);
  await until(()=>states.get(peer)!.pickups.find(p=>p.id===gift.id)?.taken===true&&states.get(coop)!.players.find(p=>p.id==='coop-a')!.stars===3);
  peer.send('interact',gift.id);await sleep(500);assert.equal(states.get(peer)!.players.find(p=>p.id==='coop-b')!.stars,0);
  coop.send('interact','throw');await until(()=>states.get(peer)!.projectiles.some(p=>p.owner==='coop-a'));
  assert.equal(states.get(peer)!.players.find(p=>p.id==='coop-a')!.stars,2);
  checks.push('Gift reached through real movement; single global collection and thrown projectile synchronize to another client');
 }finally{navigation.dispose();}

 const match=states.get(coop)!.matchId;await coop.leave();await sleep(300);assert.equal(states.get(peer)!.host,'coop-b');assert.equal(states.get(peer)!.matchId,match);checks.push('Coop continues and transfers ownership when the host leaves');
 const result={passed:checks,expectedRejections:['Invalid coop mode','Additional solo participant','Late coop participant'],unexpectedErrors:logs.split('\n').filter(line=>/Error|failed/.test(line)&&!line.includes('Dieser Spielmodus ist für die Einsatzart nicht verfügbar')).slice(-4)};mkdirSync('artifacts/operations-20261116',{recursive:true});writeFileSync('artifacts/operations-20261116/network-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){mkdirSync('artifacts/operations-20261116',{recursive:true});writeFileSync('artifacts/operations-20261116/network-failure.json',JSON.stringify([...states.values()],null,2));throw error;}finally{await Promise.allSettled(rooms.map(r=>r.leave()));server.kill();}
