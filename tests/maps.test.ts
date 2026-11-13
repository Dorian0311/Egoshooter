import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,move,neutral,makePlayer,STEP} from '../shared/game.ts';
import {getWorld,mapIds,ground,withinPlayArea} from '../shared/world.ts';
test('only host changes a waiting room map, clearing readiness',()=>{
 const g=new Game('ABC234');g.add('a','Anna');g.add('b','Bruno');g.ready('b',true,1000);
 assert.equal(g.selectMap('b','alpine'),false);assert.equal(g.selectMap('a','invalid'),false);
 assert.equal(g.selectMap('a','alpine'),true);assert.equal(g.state.mapId,'alpine');assert.ok(g.state.players.every(p=>!p.ready));
 g.ready('a',true,1000);g.ready('b',true,1000);assert.equal(g.selectMap('a','cologne'),false);g.tick(4000);assert.equal(g.state.mapId,'alpine');
});
test('all maps have walkable distinct spawns and accessible building entrances',()=>{
 for(const id of mapIds){const w=getWorld(id);assert.ok(w.buildings.length>=6);for(const team of ['de','fr'] as const){assert.equal(new Set(w.spawns[team].map(p=>p.join(','))).size,4);for(let i=0;i<4;i++){const p=makePlayer('a','A',team,i,w);move(p,neutral(1),STEP,w);assert.equal(p.y,0);assert.ok(!w.boxes.some(b=>b.kind==='wall'&&Math.abs(p.x-b.x)<b.w/2+.34&&Math.abs(p.z-b.z)<b.d/2+.34));}}
 for(const b of w.buildings){const p=makePlayer('a','A','de',0,w);p.x=b.x;p.z=b.z+b.d/2+1;p.yaw=0;for(let i=0;i<150;i++)move(p,{...neutral(i),forward:1},STEP,w);assert.ok(p.z<b.z,`${id}/${b.name} entrance blocked`);}}
});
test('bridge deck crosses the Rhine; falling into the river triggers a respawn',()=>{
 const world=getWorld('cologne');assert.equal(ground(0,0,world),0);assert.equal(ground(0,20,world),-7);
 const g=new Game('ABC234');g.add('a','Anna');g.add('b','Bruno');g.ready('a',true,1000);g.ready('b',true,1000);g.tick(4000);
 const p=g.player('a')!;Object.assign(p,{x:0,z:20,y:-4.1});g.input('a',{...neutral(1),time:4000});g.tick(4033);assert.equal(p.hp,0);assert.equal(p.respawnAt,9033);g.tick(9033);assert.equal(p.hp,100);assert.equal(p.y,0);
});
test('opponent identity follows the map',()=>{assert.equal(getWorld('cologne').opponentCode,'US');assert.equal(getWorld('alpine').opponentCode,'FR');});

test('new maps can be selected and reset players to their own military uniforms',()=>{
 const game=new Game('ABC234');game.add('a','Anna');game.add('b','Bruno');
 for(const map of ['storm','frontline'] as const){
  assert.equal(game.selectMap('a',map),true);assert.equal(game.state.mapId,map);
  assert.ok(game.state.players.every(p=>p.hp===100&&!p.ready));
 }
 game.selectMap('a','storm');
 assert.equal(game.player('a')!.uniform,'task-olive');assert.equal(game.player('b')!.uniform,'task-sand');
});

test('radio platform can be reached by both stair routes and has matching shared height',()=>{
 const world=getWorld('storm');
 for(const side of [-1,1]){
  const player=makePlayer('a','A','de',0,world);Object.assign(player,{x:side*19,z:0,yaw:side*Math.PI/2});
  for(let n=0;n<100;n++)move(player,{...neutral(n),forward:1,yaw:side*Math.PI/2},STEP,world);
  assert.ok(Math.abs(player.x)<9,JSON.stringify({side,x:player.x,y:player.y}));assert.ok(player.y>=3);
 }
});

test('new maps permit walking past the old limit and stop at their actual perimeter',()=>{
 assert.equal(getWorld('storm').buildings.length,14);assert.equal(getWorld('frontline').buildings.length,16);
 for(const map of ['storm','frontline'] as const){
  const world=getWorld(map),p=makePlayer('a','A','de',0,world);Object.assign(p,{x:70,z:0,y:0});
  for(let n=0;n<200;n++)move(p,{...neutral(n),forward:1,yaw:-Math.PI/2},STEP,world);
  assert.ok(p.x>95,`${map}: stopped at ${p.x}`);
  for(let n=200;n<600;n++)move(p,{...neutral(n),forward:1,yaw:-Math.PI/2},STEP,world);
  assert.ok(withinPlayArea(p.x,p.z,world));assert.ok(p.x>world.playArea!.halfSize-.3);
 }
 assert.equal(withinPlayArea(100,100,getWorld('storm')),false);
 assert.equal(withinPlayArea(80,80,getWorld('storm')),true);
 assert.equal(withinPlayArea(74,0,getWorld('cologne')),false);
});
