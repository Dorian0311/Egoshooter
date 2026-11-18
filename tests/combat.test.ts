import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HitReport,receivedHit} from '../client/HitReport';
import {Game,hitPlayer,makePlayer,neutral} from '../shared/game.ts';
function duel(){const game=new Game('ABC234',600000,'cologne',()=>.5);game.add('a','Anna');game.add('b','Bruno');game.ready('a',true,1000);game.ready('b',true,1000);game.tick(4000);const a=game.player('a')!,b=game.player('b')!;Object.assign(a,{x:8,z:8,yaw:0,pitch:0,protectedUntil:0});Object.assign(b,{x:8,z:0,yaw:0,protectedUntil:0});game.history=[];return {game,a,b};}
test('rifle headshot kills and records the hit zone',()=>{const {game,a,b}=duel();game.shoot(a,{...neutral(1),fire:true,time:4000},4000);assert.equal(b.hp,0);assert.equal(a.headshots,1);assert.equal(game.state.events.find(e=>e.type==='hit')?.hitZone,'head');assert.equal(game.state.events.find(e=>e.type==='hit')?.damage,130);});
test('pistol headshot kills; body and legs cause lower damage',()=>{let {game,a,b}=duel();a.weapon=1;a.ammo=8;game.shoot(a,{...neutral(1),fire:true,time:4000},4000);assert.equal(b.hp,0);assert.equal(game.state.events.find(e=>e.type==='hit')?.damage,112);
 ({game,a,b}=duel());a.pitch=-.07;game.shoot(a,{...neutral(1),fire:true,time:4000},4000);assert.equal(b.hp,35);assert.equal(a.headshots,0);
 ({game,a,b}=duel());a.x=8.1;a.pitch=-.145;game.shoot(a,{...neutral(1),fire:true,time:4000},4000);assert.equal(b.hp,52);assert.equal(game.state.events.find(e=>e.type==='hit')?.hitZone,'legs');});
test('horizontal and vertical aim determine authoritative hits',()=>{const {game,a,b}=duel();a.pitch=.4;game.shoot(a,{...neutral(1),fire:true,time:4000},4000);assert.equal(b.hp,100);a.fireAt=0;a.pitch=0;a.yaw=.2;game.shoot(a,{...neutral(2),fire:true,time:4000},4000);assert.equal(b.hp,100);a.fireAt=0;a.yaw=0;b.y=2;a.pitch=Math.atan2(2.04,8.1);game.shoot(a,{...neutral(3),fire:true,time:4000},4000);assert.equal(b.hp,0);});
test('head volume is smaller than the torso; crouching lowers it',()=>{const p=makePlayer('b','B','fr');p.x=p.z=0;p.yaw=0;assert.equal(hitPlayer([.24,1.64,8],[0,0,-1],p),null);assert.equal(hitPlayer([0,1.64,8],[0,0,-1],p)?.zone,'head');p.crouching=true;assert.equal(hitPlayer([0,1.64,8],[0,0,-1],p),null);assert.equal(hitPlayer([0,1.08,8],[0,0,-1],p)?.zone,'head');});
test('friendly bodies block a shot without taking damage',()=>{const {game,a,b}=duel();const friend=game.add('friend','Friendly');Object.assign(friend,{team:'de',x:8,z:4,protectedUntil:0});game.shoot(a,{...neutral(1),fire:true,time:4000},4000);assert.equal(friend.hp,100);assert.equal(b.hp,100);});
test('hit events preserve source direction and actual health lost when the shot overkills',()=>{
 const {game,a,b}=duel();
 b.hp=40;
 game.shoot(a,neutral(),4000);
 const hit=game.state.events.find(e=>e.type==='hit')!;
 a.z=-8;
 assert.equal(hit.damage,130);
 assert.equal(hit.healthLoss,40);
 assert.ok(Math.abs(hit.bearing!-Math.PI)<.00001);
 assert.equal(hit.bodyPart,'head');
});
test('the hit report shows actual damage, limb and camera-relative direction, then expires',()=>{
 const hits=[
  receivedHit({type:'hit',id:'a',bodyPart:'armL',damage:50,healthLoss:22,bearing:0},'second',2000),
  receivedHit({type:'hit',id:'a',bodyPart:'head',damage:65,bearing:Math.PI/2},'first',1900),
 ];
 const render=(now:number)=>renderToStaticMarkup(createElement(HitReport,{hits,now,yaw:-Math.PI/2}));
 assert.match(render(2100),/rotate\(-90deg\)/);
 assert.match(render(2100),/22 Schaden<\/strong><span>Linker Arm<\/span><span>Links/);
 assert.match(render(2100),/65 Schaden<\/strong><span>Kopf<\/span><span>Vorne/);
 assert.doesNotMatch(render(3000),/damage-direction/);
 assert.equal(render(6000),'');
});
