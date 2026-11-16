import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,neutral,move,hitPlayer} from '../shared/game';
import {parseOperation} from '../shared/operationConfig';
import {safePoints,walkable} from '../shared/operations';
import {getWorld,mapIds} from '../shared/world';
import {armCount,isCrawling} from '../shared/injuries';
function start(mode='battle',kind='multiplayer'){
 const g=new Game('SOLOQA',600000,'cologne',()=>.5,{mode,kind});
 g.add('a','Anna');if(kind!=='solo')g.add('b','Bruno');if(kind!=='multiplayer')g.operation.configureBots();
 for(const p of g.state.players)g.ready(p.id,true,1000);g.tick(4000);
 for(const p of g.operation.actors())p.protectedUntil=0;
 return g;
}
test('operation configuration rejects invalid or incompatible options',()=>{
 assert.equal(parseOperation(undefined).kind,'multiplayer');assert.equal(parseOperation({kind:'solo',mode:'battle',battleStyle:'team',enemies:2}).enemies,4);
 for(const c of [{kind:'coop',mode:'training'},{enemies:Infinity},{mode:'__proto__'},{difficulty:'impossible'},null])assert.throws(()=>parseOperation(c));
});
test('every map has standable pickup points and exactly eight gifts plus four bandages',()=>{
 for(const map of mapIds){const g=new Game('MAPQA',600000,map);g.add('a','A');g.add('b','B');g.ready('a',true,0);g.ready('b',true,0);g.tick(3000);assert.equal(g.state.pickups.filter(p=>p.kind==='gift').length,8);assert.equal(g.state.pickups.filter(p=>p.kind==='bandage').length,4);for(const p of g.state.pickups)assert.ok(walkable(getWorld(map),p.x,p.y,p.z));assert.ok(safePoints(getWorld(map)).length>12);}
});
test('one human starts solo; asymmetric battle and ally bot counts respect eight actors',()=>{
 const g=start('battle','solo');assert.equal(g.state.phase,'playing');assert.equal(g.state.players.filter(p=>p.kind==='human').length,1);assert.equal(g.count('de'),4);assert.equal(g.count('fr'),4);assert.equal(g.state.persistence,'practice');
 const alone=new Game('ALONE',600000,'storm',()=>.5,{kind:'solo',mode:'battle',battleStyle:'alone',enemies:3});alone.add('a','A');alone.operation.configureBots();for(const p of alone.state.players)alone.ready(p.id,true,0);alone.tick(3000);assert.equal(alone.count('de'),1);assert.equal(alone.count('fr'),3);
});
test('training is unlimited and a defeated target respawns',()=>{
 const g=start('training','solo'),bot=g.state.players.find(p=>p.kind==='bot')!;assert.equal(g.state.endsAt,0);g.operation.damage(bot,'a',0,100,'head',[bot.x,1.6,bot.z]);g.tick(9000);assert.equal(bot.hp,100);assert.equal(bot.injuries.lost,0);assert.equal(g.state.phase,'playing');
});
test('limb damage severs only the struck side, missing limbs stop receiving hits, respawn clears injuries',()=>{
 const g=start(),p=g.player('b')!;g.operation.damage(p,'a',1,28,'armL',[0,1,0]);g.operation.damage(p,'a',1,28,'armL',[0,1,0]);assert.equal(armCount(p),1);assert.equal(p.injuries.lost,2);assert.equal(g.operation.damage(p,'a',1,28,'armL',[0,1,0]),false);assert.equal(p.hp,44);
 p.stars=3;g.operation.damage(p,'a',0,100,'body',[0,1,0]);g.tick(9000);assert.equal(p.injuries.lost,0);assert.equal(p.stars,3);assert.equal(p.life,3);
});
test('leg loss makes movement and hit volumes crawl; jump and sprint cannot bypass it',()=>{
 const g=start(),p=g.player('b')!;Object.assign(p,{x:8,y:0,z:8});g.operation.damage(p,'a',4,38,'legL',[8,.5,8],true);assert.ok(isCrawling(p));const before=p.z;for(let n=0;n<30;n++)move(p,{...neutral(n),forward:1,jump:true,sprint:true,time:4000+n*33});assert.ok(Math.abs(p.z-before)<=1.30);assert.equal(p.sprinting,false);assert.equal(p.y,0);assert.equal(hitPlayer([p.x,1.6,p.z+4],[0,0,-1],p),null);assert.ok(hitPlayer([p.x,.4,p.z+4],[0,0,-1],p));
});
test('bleeding kills once and awards the originating attacker',()=>{
 const g=start(),p=g.player('b')!;g.operation.damage(p,'a',4,38,'armL',[0,1,0],true);p.hp=.2;g.tick(4100);assert.equal(p.hp,0);assert.equal(g.player('a')!.kills,1);g.tick(4200);assert.equal(g.player('a')!.kills,1);assert.equal(p.deaths,1);
});
test('medkits restore health and stop bleeding without restoring limbs; movement cancels treatment',()=>{
 const g=start(),p=g.player('a')!;p.bandages=2;p.injuries.lost=p.injuries.bleeding=2;p.hp=60;assert.ok(g.interact('a','bandage'));g.input('a',{...neutral(1),forward:1,time:4000});g.tick(4033);assert.equal(p.treatment,undefined);assert.equal(p.bandages,2);
 g.input('a',{...neutral(2),time:4033});g.tick(4500);assert.ok(g.interact('a','bandage'));for(let t=4533;t<=8533;t+=33)g.tick(t);assert.equal(p.bandages,1);assert.equal(p.injuries.bleeding,0);assert.equal(p.injuries.lost,2);assert.ok(p.hp>80&&p.hp<=100);
});
test('H heals non-bleeding wounds, caps health and does not consume a kit at full health',()=>{
 const g=start(),p=g.player('a')!;p.bandages=2;p.hp=80;assert.ok(g.interact('a','bandage'));for(let t=4033;t<=8033;t+=33)g.tick(t);assert.equal(p.hp,100);assert.equal(p.bandages,1);g.tick(9000);assert.equal(g.interact('a','bandage'),false);assert.equal(p.bandages,1);
});
test('teammate treatment uses the healer inventory, rejects enemies and cancels across lives or range',()=>{
 const g=start(),a=g.player('a')!,b=g.player('b')!;Object.assign(a,{x:8,y:0,z:8,bandages:2});Object.assign(b,{x:8,y:0,z:9,hp:35});assert.equal(g.interact('a','heal:b'),false);b.team=a.team;assert.ok(g.interact('a','heal:b'));for(let t=4033;t<=8033;t+=33)g.tick(t);assert.equal(b.hp,85);assert.equal(a.bandages,1);assert.equal(b.bandages,0);
 g.tick(9000);assert.ok(g.interact('a','heal:b'));b.life++;g.tick(9033);assert.equal(a.treatment,undefined);assert.equal(a.bandages,1);g.tick(10000);b.x=30;assert.equal(g.interact('a','heal:b'),false);
});
test('taking damage or attacking cancels teammate healing without consuming a medkit',()=>{
 const g=start(),a=g.player('a')!,b=g.player('b')!;Object.assign(a,{x:8,y:0,z:8,bandages:1});Object.assign(b,{team:a.team,x:8,y:0,z:9,hp:50});assert.ok(g.interact('a','heal:b'));b.injuries.lastDamageAt=4010;g.tick(4033);assert.equal(a.treatment,undefined);assert.equal(a.bandages,1);g.tick(5000);assert.ok(g.interact('a','heal:b'));g.input('a',{...neutral(1),fire:true,time:5000});g.tick(5033);assert.equal(a.treatment,undefined);assert.equal(b.hp,50);
});
test('a gift can be claimed once globally and cannot be claimed from a distance',()=>{
 const g=start(),pickup=g.state.pickups[0],a=g.player('a')!,b=g.player('b')!;assert.equal(g.interact('a',pickup.id),false);Object.assign(a,{x:pickup.x,y:pickup.y,z:pickup.z+1});Object.assign(b,{x:pickup.x,y:pickup.y,z:pickup.z+1});assert.ok(g.interact('a',pickup.id));assert.equal(a.stars,3);assert.equal(g.interact('b',pickup.id),false);assert.equal(b.stars,0);
});
test('throwing consumes inventory and sweeps a projectile through a target between ticks',()=>{
 const g=start(),a=g.player('a')!,b=g.player('b')!;Object.assign(a,{x:8,y:0,z:8,yaw:0,pitch:-.15,stars:3});Object.assign(b,{x:8,y:0,z:6});assert.ok(g.interact('a','throw'));assert.equal(a.stars,2);assert.equal(g.interact('a','throw'),false);g.tick(4100);assert.ok(b.hp<100);assert.equal(g.state.projectiles.length,0);assert.equal(a.stars,2);
});
test('civilians are authoritative, killable, unranked and do not use player slots',()=>{
 const g=start(),p=g.state.npcs[0];assert.equal(g.state.npcs.length,4);g.operation.damage(p,'a',0,100,'head',[p.x,1.6,p.z]);assert.equal(p.hp,0);assert.equal(g.player('a')!.kills,0);g.tick(20000);assert.equal(p.hp,0);assert.equal(g.state.players.length,2);
});
test('nearby unarmed residents sometimes gesture and pause their route while doing so',()=>{
 const g=start(),npc=g.state.npcs[0],human=g.player('a')!;for(let now=4033;now<4300;now+=33)g.tick(now);Object.assign(human,{x:npc.x+2,y:npc.y,z:npc.z});g.tick(10001);assert.ok(npc.gestureUntil>g.state.now);const before=[npc.x,npc.z];g.tick(10100);assert.deepEqual([npc.x,npc.z],before);
});
test('survival uses finite reinforcements, no passive recovery and five winning waves',()=>{
 const g=start('survival','solo'),human=g.player('a')!;human.hp=73;human.injuries.lost=2;
 let clock=4000;
 for(let wave=1;wave<=5;wave++){
  assert.equal(g.state.operation.wave,wave);let budget=80;
  while(g.state.operation.remaining>0&&budget--){for(const bot of g.state.players.filter(p=>p.kind==='bot'&&p.hp>0)){bot.protectedUntil=0;g.operation.damage(bot,'a',0,100,'head',[bot.x,1.6,bot.z]);}g.tick(clock+=5100);}
  assert.ok(budget>0);assert.equal(g.state.operation.completedWaves,wave);
  if(wave<5){g.tick(clock+=10000);assert.equal(human.hp,73);assert.equal(human.injuries.lost,2);}
 }
 assert.equal(g.state.phase,'finished');assert.equal(g.state.operation.result,'success');
});
test('solo death ends survival without a respawn',()=>{
 const g=start('survival','solo'),p=g.player('a')!;g.operation.damage(p,'bot-0',0,100,'body',[0,1,0]);g.tick(4033);assert.equal(g.state.phase,'finished');assert.equal(g.state.operation.result,'failure');
});
test('coop revives preserve injury, expiry is terminal and all incapacitated ends the round',()=>{
 const g=start('survival','coop'),a=g.player('a')!,b=g.player('b')!;Object.assign(a,{x:8,y:0,z:8});Object.assign(b,{x:8,y:0,z:9});b.injuries.lost=8;g.operation.damage(b,'bot-0',0,100,'body',[8,1,9]);assert.ok(b.downedUntil);assert.ok(g.interact('a','revive:b'));for(let t=4033;t<=8033;t+=33)g.tick(t);assert.equal(b.hp,30);assert.equal(b.downedUntil,0);assert.equal(b.injuries.lost,8);
 b.protectedUntil=0;g.operation.damage(b,'bot-0',0,100,'head',[8,1,9]);assert.equal(b.downedUntil,0);g.operation.damage(a,'bot-0',0,100,'body',[8,1,8]);g.tick(8100);assert.equal(g.state.phase,'finished');
});
test('document and sabotage missions require interaction and extraction; hold and timeout finish correctly',()=>{
 for(const mission of ['documents','sabotage','hold'] as const){const g=new Game('MISSION',600000,'cologne',()=>.5,{kind:'solo',mode:'mission',mission});g.add('a','A');g.operation.configureBots();for(const p of g.state.players)g.ready(p.id,true,1000);g.tick(4000);const p=g.player('a')!,o=g.state.operation.objective;Object.assign(p,o.point);
  if(mission==='hold'){o.progress=89999;g.tick(4033);assert.equal(g.state.operation.result,'success');continue;}
  assert.ok(g.interact('a','objective'));if(mission==='sabotage')for(let t=4033;t<=9033;t+=33)g.tick(t);assert.equal(o.stage,'extract');Object.assign(p,o.extract);g.tick(10000);assert.equal(g.state.operation.result,'success');}
 const g=start('mission','solo');g.tick(484001);assert.equal(g.state.operation.result,'failure');
});
