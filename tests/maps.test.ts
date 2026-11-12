import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,move,neutral,makePlayer,STEP} from '../shared/game.ts';
import {getWorld,mapIds,ground} from '../shared/world.ts';
test('only host changes a waiting room map, clearing readiness',()=>{
 const g=new Game('ABC234');g.add('a','Anna');g.add('b','Bruno');g.ready('b',true,1000);
 assert.equal(g.selectMap('b','alpine'),false);assert.equal(g.selectMap('a','invalid'),false);
 assert.equal(g.selectMap('a','alpine'),true);assert.equal(g.state.mapId,'alpine');assert.ok(g.state.players.every(p=>!p.ready));
 g.ready('a',true,1000);g.ready('b',true,1000);assert.equal(g.selectMap('a','cologne'),false);g.tick(4000);assert.equal(g.state.mapId,'alpine');
});
test('both maps have walkable distinct spawns and six accessible building entrances',()=>{
 for(const id of mapIds){const w=getWorld(id);assert.equal(w.buildings.length,6);for(const team of ['de','fr'] as const){assert.equal(new Set(w.spawns[team].map(p=>p.join(','))).size,4);for(let i=0;i<4;i++){const p=makePlayer('a','A',team,i,w);move(p,neutral(1),STEP,w);assert.equal(p.y,0);assert.ok(!w.boxes.some(b=>b.kind==='wall'&&Math.abs(p.x-b.x)<b.w/2+.34&&Math.abs(p.z-b.z)<b.d/2+.34));}}
 for(const b of w.buildings){const p=makePlayer('a','A','de',0,w);p.x=b.x;p.z=b.z+b.d/2+1;p.yaw=0;for(let i=0;i<150;i++)move(p,{...neutral(i),forward:1},STEP,w);assert.ok(p.z<b.z,`${id}/${b.name} entrance blocked`);}}
});
test('bridge deck crosses the Rhine; falling into the river triggers a respawn',()=>{
 const world=getWorld('cologne');assert.equal(ground(0,0,world),0);assert.equal(ground(0,20,world),-7);
 const g=new Game('ABC234');g.add('a','Anna');g.add('b','Bruno');g.ready('a',true,1000);g.ready('b',true,1000);g.tick(4000);
 const p=g.player('a')!;Object.assign(p,{x:0,z:20,y:-4.1});g.input('a',{...neutral(1),time:4000});g.tick(4033);assert.equal(p.hp,0);assert.equal(p.respawnAt,9033);g.tick(9033);assert.equal(p.hp,100);assert.equal(p.y,0);
});
test('opponent identity follows the map',()=>{assert.equal(getWorld('cologne').opponentCode,'US');assert.equal(getWorld('alpine').opponentCode,'FR');});
