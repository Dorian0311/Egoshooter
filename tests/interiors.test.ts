import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,makePlayer,move,neutral} from '../shared/game';
import {getWorld} from '../shared/world';
import {initialInteriors,interiorFixtures,interiorWorld,furnitureFor} from '../shared/interiors';
import {difference,mergeSnapshot} from '../shared/protocol';
function started(){const g=new Game('ROOM12',600000,'cologne',()=>.5);g.add('a','A');g.add('b','B');g.ready('a',true,1000);g.ready('b',true,1000);g.tick(4000);return g;}
test('door and light interactions are authoritative, nearby, rate limited and replicated',()=>{
 const g=started(),p=g.player('a')!,b=getWorld().buildings[0];Object.assign(p,{x:b.x+1,z:b.z-6,y:0,yaw:0});
 const before=structuredClone(g.state);assert.equal(g.interact('a','door-0--1'),true);assert.equal(g.state.interiors!.doors['door-0--1'],false);
 assert.equal(g.interact('a','door-0--1'),false);assert.deepEqual(mergeSnapshot(before,difference(before,g.state)),g.state);
 g.state.now+=500;Object.assign(p,{x:b.x+2.6,z:b.z-6});assert.equal(g.interact('a','light-0'),true);assert.equal(g.state.interiors!.lights['light-0'],false);
 g.state.now+=500;p.x=0;assert.equal(g.interact('a','light-0'),false);assert.equal(g.interact('a','unknown'),false);
 p.hp=0;assert.equal(g.interact('a','door-0--1'),false);
});
test('closing doors cannot trap a player and open/closed collision is shared',()=>{
 const g=started(),p=g.player('a')!,q=g.player('b')!,b=getWorld().buildings[0];Object.assign(p,{x:b.x+1,z:b.z-6,y:0,yaw:0});Object.assign(q,{x:b.x,z:b.z-8,y:0});
 assert.equal(g.interact('a','door-0--1'),false);q.z=0;assert.equal(g.interact('a','door-0--1'),true);
 for(let n=0;n<30;n++)move(p,{...neutral(n),forward:1},1/30,g.world());assert.ok(p.z>b.z-8);
 g.state.now+=500;assert.equal(g.interact('a','door-0--1'),true);
 for(let n=0;n<30;n++)move(p,{...neutral(n),forward:1},1/30,g.world());assert.ok(p.z<b.z-8);
});
test('shots break only the nearest visible pane and changes survive snapshot reconstruction',()=>{
 const g=started(),p=g.player('a')!,b=getWorld().buildings[0];Object.assign(p,{x:b.x-12,z:b.z-3.25,y:0,yaw:-Math.PI/2,pitch:0,protectedUntil:0});
 const before=structuredClone(g.state);g.shoot(p,{...neutral(),fire:true},5000);
 assert.ok(g.state.interiors!.broken.includes('glass-0--1--3.25-0'));assert.equal(g.state.events.filter(e=>e.type==='glass').length,1);
 assert.deepEqual(mergeSnapshot(before,difference(before,g.state)),g.state);
});
test('both staircase routes and all central entrances remain traversable on all maps',()=>{
 for(const map of ['cologne','alpine','storm','frontline'] as const){const world=getWorld(map),state=initialInteriors(world),collision=interiorWorld(world,state);
  for(const b of world.buildings){
   assert.ok(furnitureFor(b,world.buildings.indexOf(b)).every(f=>Math.abs(f.box.x-b.x)-f.box.w/2>1.1));
   if(!b.upper)for(const side of [-1,1]){const p=makePlayer('p','P','de');Object.assign(p,{x:b.x+side*(b.w/2+1),z:b.z,y:0});for(let n=0;n<32;n++)move(p,{...neutral(n),forward:1,yaw:side*Math.PI/2},1/30,collision);assert.ok(Math.abs(p.x-b.x)<b.w/2-.5);}
   if(!b.upper)continue;
   for(const side of [-1,1]){const p=makePlayer('p','P','de');Object.assign(p,{x:b.x+side*7,z:b.z+side*7.3,y:0});for(let n=0;n<100;n++)move(p,{...neutral(n),forward:1,yaw:side===1?0:Math.PI},1/30,collision);assert.ok(p.y>3.5,`${map} ${b.name} stair ${side}: ${p.y}`);}
  }
 }
});
test('fresh rounds reset doors, lights and glass',()=>{
 const g=started();g.state.interiors!.broken.push('glass-0--1--3.25-0');g.state.interiors!.lights['light-0']=false;g.state.phase='finished';g.rematch('a');g.ready('a',true,6000);g.ready('b',true,6000);g.tick(9000);assert.deepEqual(g.state.interiors,initialInteriors(getWorld()));
 assert.ok(interiorFixtures(getWorld()).length>30);
});

