import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,makePlayer,move,neutral} from '../shared/game';
import {corpseHeadPoint,CORPSE_SHIELD,type LooseBodyPart} from '../shared/remains';
import {getWorld} from '../shared/world';

function setup(coop=false){
 const g=new Game('REMAINS',600000,'cologne',()=>.5,{kind:coop?'coop':'multiplayer',mode:coop?'survival':'battle'});g.add('a','Anna');g.add('b','Bruno');if(coop)g.operation.configureBots();for(const p of g.state.players)g.ready(p.id,true,1000);g.tick(4000);
 for(const p of g.state.players)Object.assign(p,{x:8,y:0,z:p.id==='a'?8:6,yaw:0,protectedUntil:0});return g;
}
function body(g:Game,id='b'){const p=g.player(id)!;g.operation.damage(p,'',0,100,'body',[p.x,1,p.z]);if(p.downedUntil){g.tick(p.downedUntil+1);}return g.state.corpses.find(c=>c.sourceId===id)!;}
function advance(g:Game,ms:number){const end=g.state.now+ms;for(let now=g.state.now+33;now<end;now+=33)g.tick(now);g.tick(end);}

test('final deaths leave a unique source-life corpse after respawn until the next match',()=>{
 const g=setup(),p=g.player('b')!,oldLife=p.life,corpse=body(g);assert.ok(corpse);assert.equal(corpse.sourceLife,oldLife);assert.equal(corpse.uniform,p.uniform);g.operation.remains.recordDeath(p);assert.equal(g.state.corpses.length,1);g.tick(15000);assert.equal(p.hp,100);assert.ok(p.life>oldLife);assert.equal(g.state.corpses[0].id,corpse.id);g.tick(30000);assert.equal(g.state.corpses.length,1);
});
test('severed parts have one authoritative owner, preserve appearance and survive respawns',()=>{
 const g=setup(),b=g.player('b')!,a=g.player('a')!,c=g.add('c','Charlie');Object.assign(c,{x:8,y:0,z:8,protectedUntil:0});g.operation.damage(b,'a',0,45,'armL',[8,1.2,6]);const item=g.state.bodyParts[0];assert.ok(item);assert.equal(item.uniform,b.uniform);assert.equal(item.sourceLife,b.life);assert.ok(g.interact('a',`part:pickup:${item.id}`));assert.equal(g.interact('c',`part:pickup:${item.id}`),false);assert.equal(a.heldPart,item.id);assert.equal(item.carrierId,'a');g.operation.damage(a,'',0,100,'body',[8,1,8]);assert.equal(a.heldPart,null);assert.equal(item.state,'ground');assert.equal(item.carrierId,null);
});
for(const part of ['head','armL','armR','legL','legR'] as LooseBodyPart[])test(`${part} can be picked up and thrown without consuming throwing stars`,()=>{
 const g=setup(),b=g.player('b')!,a=g.player('a')!;a.stars=3;g.operation.damage(b,'a',0,part==='head'?100:45,part,[8,part==='head'?1.6:1,6]);const item=g.state.bodyParts.find(i=>i.part===part)!;assert.ok(g.interact('a',`part:pickup:${item.id}`));assert.ok(g.interact('a','throw'),'G must work immediately after E pickup');assert.equal(a.heldPart,null);assert.equal(item.state,'flying');assert.equal(item.throwerId,a.id);assert.equal(a.stars,3);assert.equal(g.interact('a','throw'),false);advance(g,6000);assert.equal(item.state,'ground');assert.ok(g.state.bodyParts.includes(item));
});
test('corpse head harvesting takes three seconds, is exclusive and cannot duplicate a head',()=>{
 const g=setup(),corpse=body(g),a=g.player('a')!,head=corpseHeadPoint(corpse);Object.assign(a,{x:head.x,y:0,z:head.z+1});const c=g.add('c','Charlie');Object.assign(c,{x:a.x,y:0,z:a.z});assert.ok(g.interact('a',`corpse:harvest:${corpse.id}`));assert.equal(g.interact('c',`corpse:harvest:${corpse.id}`),false);advance(g,2999);assert.equal(corpse.lost&1,0);advance(g,2);assert.equal(corpse.lost&1,1);assert.ok(a.heldPart);const item=g.state.bodyParts.find(i=>i.id===a.heldPart)!;assert.equal(item.part,'head');assert.equal(item.name,'Bruno');assert.equal(item.corpseId,corpse.id);advance(g,500);assert.equal(g.interact('c',`corpse:harvest:${corpse.id}`),false);assert.equal(g.state.bodyParts.filter(i=>i.corpseId===corpse.id&&i.part==='head').length,1);
});
test('moving, receiving damage or disconnecting releases a corpse-head reservation',()=>{
 const g=setup(),corpse=body(g),a=g.player('a')!,head=corpseHeadPoint(corpse);Object.assign(a,{x:head.x,y:0,z:head.z+1});assert.ok(g.interact('a',`corpse:harvest:${corpse.id}`));a.x+=.3;advance(g,33);assert.equal(a.treatment,undefined);assert.equal(corpse.harvesterId,null);assert.equal(corpse.lost,0);assert.equal(g.state.bodyParts.length,0);advance(g,500);assert.ok(g.interact('a',`corpse:harvest:${corpse.id}`));g.operation.damage(a,'',0,5,'body',[a.x,1,a.z]);advance(g,33);assert.equal(corpse.harvesterId,null);advance(g,500);assert.ok(g.interact('a',`corpse:harvest:${corpse.id}`));a.connected=false;advance(g,33);assert.equal(corpse.harvesterId,null);
});
test('corpse shield absorbs frontal damage only and does not refill when dropped and picked up',()=>{
 const g=setup(),corpse=body(g),a=g.player('a')!,attacker=g.add('c','Charlie');Object.assign(attacker,{team:'fr',x:8,y:0,z:4,protectedUntil:0});assert.ok(g.interact('a',`corpse:carry:${corpse.id}`));assert.equal(a.corpseShield,CORPSE_SHIELD);g.operation.damage(a,'c',0,60,'body',[8,1,8]);assert.equal(a.hp,100);assert.equal(a.corpseShield,90);attacker.z=12;g.operation.damage(a,'c',0,20,'body',[8,1,8]);assert.equal(a.hp,80);assert.equal(a.corpseShield,90);advance(g,500);assert.ok(g.interact('a','corpse:drop'));assert.equal(a.corpseShield,0);advance(g,500);assert.ok(g.interact('a',`corpse:carry:${corpse.id}`));assert.equal(a.corpseShield,90);attacker.z=4;g.operation.damage(a,'c',0,100,'body',[8,1,8]);assert.equal(a.corpseShield,0);assert.equal(a.hp,70);
});
test('carrying slows movement, prevents sprint/jump and drops the corpse on death',()=>{
 const g=setup(),corpse=body(g),a=g.player('a')!;assert.ok(g.interact('a',`corpse:carry:${corpse.id}`));const oldZ=a.z;for(let i=0;i<30;i++)move(a,{...neutral(i),forward:1,sprint:true,jump:true,yaw:0,time:g.state.now},1/30,getWorld('cologne'));assert.ok(Math.abs(a.z-oldZ)<=2.4);assert.equal(a.sprinting,false);assert.equal(a.y,0);g.operation.damage(a,'',0,100,'body',[a.x,1,a.z]);assert.equal(corpse.carrierId,null);assert.equal(a.carriedCorpse,null);
});
test('held parts strike as clubs while respecting protection, friends and walls',()=>{
 const g=setup(),b=g.player('b')!,a=g.player('a')!;g.operation.damage(b,'a',0,45,'armL',[8,1.1,6]);b.injuries.bleeding=0;const item=g.state.bodyParts[0];assert.ok(g.interact('a',`part:pickup:${item.id}`));const hp=b.hp;assert.ok(g.operation.remains.swing(a,g.state.now));assert.equal(b.hp,hp-32);advance(g,1000);b.team=a.team;assert.ok(g.operation.remains.swing(a,g.state.now));assert.equal(b.hp,hp-32);advance(g,1000);b.team='fr';b.protectedUntil=g.state.now+1000;assert.ok(g.operation.remains.swing(a,g.state.now));assert.equal(b.hp,hp-32);advance(g,1100);const world=g.world();g.world=()=>({...world,boxes:[...world.boxes,{x:8,y:1.5,z:7,w:1,h:3,d:.05,kind:'wall'}]});assert.ok(g.operation.remains.swing(a,g.state.now));assert.equal(b.hp,hp-32);
});
test('gun-selection inputs cannot shorten the held body-part attack interval',()=>{
 const g=setup(),a=g.player('a')!,b=g.player('b')!;g.operation.damage(b,'a',0,45,'armL',[8,1.1,6]);b.injuries.bleeding=0;assert.ok(g.interact('a',`part:pickup:${g.state.bodyParts[0].id}`));g.input('a',{...neutral(1),fire:true,yaw:0,time:g.state.now});g.tick(4033);assert.equal(b.hp,23);const next=a.fireAt;
 for(let n=1;n<=7;n++){g.input('a',{...neutral(n+1),fire:true,yaw:0,weapon:n%2?1:0,time:g.state.now});g.tick(4033+n*100);assert.equal(b.hp,23);assert.equal(a.fireAt,next);}
 g.input('a',{...neutral(9),fire:true,yaw:0,time:g.state.now});g.tick(next);assert.equal(b.hp,0);
});
test('coop tent restores the matching dead teammate after eight seconds and consumes that corpse',()=>{
 const g=setup(true),b=g.player('b')!,a=g.player('a')!;b.uniform='kroenen';const corpse=body(g),life=b.life;assert.ok(corpse);Object.assign(a,{x:corpse.x,y:0,z:corpse.z+.5});assert.ok(g.interact('a',`corpse:carry:${corpse.id}`));const tent=g.state.aidTents.find(t=>t.team===a.team)!;Object.assign(a,{x:tent.x,y:tent.y,z:tent.z+1});advance(g,500);assert.ok(g.interact('a',`tent:deposit:${tent.id}`));advance(g,7999);assert.equal(b.hp,0);advance(g,2);assert.equal(b.hp,100);assert.equal(b.injuries.lost,0);assert.equal(b.uniform,'kroenen');assert.equal(b.life,life+1);assert.equal(b.x,tent.x);assert.ok(!g.state.corpses.includes(corpse));assert.equal(a.carriedCorpse,null);
});
test('a deposited coop patient recovers even if the last active helper dies during treatment',()=>{
 const g=setup(true),a=g.player('a')!,b=g.player('b')!,corpse=body(g);Object.assign(a,{x:corpse.x,y:0,z:corpse.z+.5});assert.ok(g.interact('a',`corpse:carry:${corpse.id}`));const tent=g.state.aidTents.find(t=>t.team==='de')!;Object.assign(a,{x:tent.x,y:tent.y,z:tent.z+1});advance(g,500);assert.ok(g.interact('a',`tent:deposit:${tent.id}`));g.operation.damage(a,'',0,100,'head',[a.x,1.6,a.z]);advance(g,2000);assert.equal(g.state.phase,'playing');advance(g,6001);assert.equal(b.hp,100);assert.equal(g.state.phase,'playing');
});
test('old-life or enemy corpses cannot be used to revive a living or newer-life coop player',()=>{
 const g=setup(true),a=g.player('a')!,b=g.player('b')!,corpse=body(g);Object.assign(a,{x:corpse.x,y:0,z:corpse.z+.5});assert.ok(g.interact('a',`corpse:carry:${corpse.id}`));const tent=g.state.aidTents.find(t=>t.team==='de')!;Object.assign(a,{x:tent.x,y:tent.y,z:tent.z+1});advance(g,500);b.life++;assert.equal(g.interact('a',`tent:deposit:${tent.id}`),false);b.life--;corpse.team='fr';assert.equal(g.interact('a',`tent:deposit:${tent.id}`),false);
});

test('thrown parts bounce off thin walls and fall instead of remaining suspended at the impact',()=>{
 const g=setup(),a=g.player('a')!,b=g.player('b')!;g.operation.damage(b,'a',0,45,'armL',[8,1.2,6]);const item=g.state.bodyParts[0];assert.ok(g.interact('a',`part:pickup:${item.id}`));advance(g,500);const base=g.world();g.world=()=>({...base,boxes:[...base.boxes,{x:8,y:1.5,z:7,w:3,h:3,d:.02,kind:'wall'}]});assert.ok(g.interact('a','throw'));advance(g,100);assert.equal(item.state,'flying');advance(g,4000);assert.equal(item.state,'ground');assert.ok(item.y<.2);assert.ok(item.z>7);
});

test('departing and rejoining preserves unique life identities for every retained corpse and limb',()=>{
 const g=setup();const lives:number[]=[];
 for(let n=0;n<3;n++){const p=g.player('b')!;p.protectedUntil=0;lives.push(p.life);g.operation.damage(p,'a',0,45,'armL',[p.x,1.2,p.z]);g.operation.damage(p,'a',0,100,'body',[p.x,1,p.z]);g.remove('b');g.add('b','Bruno');}
 assert.equal(new Set(lives).size,3);assert.equal(g.state.corpses.length,3);assert.equal(g.state.bodyParts.filter(part=>part.part==='armL').length,3);
});

test('departure immediately releases a carried body before a fresh player state replaces ownership',()=>{
 const g=setup(),corpse=body(g),p=g.player('a')!;assert.ok(g.interact(p.id,`corpse:carry:${corpse.id}`));const life=p.life;g.remove(p.id);assert.equal(corpse.carrierId,null);assert.equal(p.carriedCorpse,null);const rejoined=g.add(p.id,p.name);assert.equal(rejoined.life,life+1);assert.equal(rejoined.corpseShield,0);assert.equal(rejoined.treatment,undefined);
});

test('dropped remains stay on an upper floor, while a corpse dropped beyond its edge falls',()=>{
 const g=setup(),p=g.player('a')!,victim=g.player('b')!,base=g.world();g.world=()=>({...base,boxes:[...base.boxes,{x:8,y:3,z:8,w:8,h:.2,d:8,kind:'floor'}]});
 g.operation.damage(victim,'a',0,45,'armL',[8,1.2,6]);const part=g.state.bodyParts[0];p.heldPart=part.id;part.carrierId=p.id;part.state='held';p.y=3.1;g.operation.remains.dropPart(p);assert.equal(part.state,'ground');assert.ok(Math.abs(part.y-3.2)<1e-6);
 const corpse=body(g);p.carriedCorpse=corpse.id;corpse.carrierId=p.id;g.operation.remains.dropCorpse(p);assert.ok(Math.abs(corpse.y-3.1)<1e-6);
 p.x=20;p.carriedCorpse=corpse.id;corpse.carrierId=p.id;g.operation.remains.dropCorpse(p);assert.equal(corpse.y,3.1);g.operation.remains.update(.1);assert.ok(corpse.y>0&&corpse.y<3.1);for(let n=0;n<20;n++)g.operation.remains.update(.1);assert.equal(corpse.y,0);
});
