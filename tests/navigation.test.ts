import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNavigation} from '../server/navigation';
import {Game,makePlayer} from '../shared/game';
import {getWorld,ground,mapIds} from '../shared/world';
import {initialInteriors} from '../shared/interiors';
import {safeNear,initialPickups} from '../shared/operations';
import {Bots} from '../server/bots';
for(const map of mapIds)test(`Recast ${map}: spawn routes, goals, pickups and door changes`,async()=>{
 const nav=await createNavigation(map),world=getWorld(map);
 try{
  const a=makePlayer('a','A','de',0,world),b=makePlayer('b','B','fr',0,world);nav.sync(initialInteriors(world));
  const route=nav.path(a,b);assert.ok(route.length>1,`${map}: no path between spawns`);
  assert.ok(nav.reachable(safeNear(world,24,12)),`${map}: mission target unreachable`);
  for(const pickup of initialPickups(world))assert.ok(nav.reachable(pickup),`${map}: pickup ${pickup.id} off navmesh`);
  if(map==='storm'){
   assert.ok(nav.reachable({x:-61,y:ground(-61,67,world),z:67}),'ground on the northwest hill must be on the dynamic navmesh');
   const boulder=world.boxes.find(b=>b.kind==='rock')!;
   assert.equal(nav.reachable({x:boulder.x,y:0,z:boulder.z}),false,'a bot must not route inside a coastal boulder');
  }
  if(map==='storm')for(const side of [-1,1])assert.ok(nav.path({x:side*18,y:0,z:0},{x:0,y:3,z:0}).some(p=>p.y>2.8),'radio platform stair connection missing');
  const interiors=initialInteriors(world),door=Object.keys(interiors.doors)[0];interiors.doors[door]=false;nav.sync(interiors);interiors.doors[door]=true;nav.sync(interiors);assert.ok(nav.path(a,b).length>1);
 }finally{nav.dispose();}
});
test('server bots travel using normal inputs without teleporting',async()=>{
 const nav=await createNavigation('cologne'),g=new Game('BOTQA',600000,'cologne',()=>.5,{kind:'solo',mode:'training'}),bots=new Bots(g,nav);
 try{g.add('a','A');g.operation.configureBots();for(const p of g.state.players)g.ready(p.id,true,1000);g.tick(4000);const target=g.state.players.find(p=>p.kind==='bot')!,initial={x:target.x,z:target.z};let distance=0,maxExcursion=0;
  for(let frame=1;frame<=900;frame++){const x=target.x,z=target.z;bots.update(4000+frame*1000/30);g.tick(4000+frame*1000/30);const moved=Math.hypot(target.x-x,target.z-z);assert.ok(moved<.22,'bot position jumped');distance+=moved;maxExcursion=Math.max(maxExcursion,Math.hypot(target.x-initial.x,target.z-initial.z));}
  assert.ok(distance>10,`bot travelled only ${distance}m`);assert.ok(maxExcursion>3);assert.equal(g.player('a')!.hp,100);
 }finally{bots.dispose();}
});
test('a bot opens a closed building entrance through normal interaction before entering',async()=>{
 const nav=await createNavigation('cologne'),g=new Game('DOORQA',600000,'cologne',()=>.5,{kind:'solo',mode:'training'}),bots=new Bots(g,nav),world=getWorld('cologne');
 try{g.add('a','A');g.operation.configureBots();for(const p of g.state.players)g.ready(p.id,true,1000);g.tick(4000);const building=world.buildings[0],bot=g.state.players.find(p=>p.kind==='bot')!,human=g.player('a')!;
  Object.assign(human,{x:building.x-14,z:building.z,y:0});Object.assign(bot,{x:building.x,z:building.z+building.d/2+2,y:0});g.state.interiors!.doors['door-0--1']=g.state.interiors!.doors['door-0-1']=false;
  let entered=false;
  for(let frame=1;frame<=900;frame++){bots.update(4000+frame*1000/30);g.tick(4000+frame*1000/30);if(Math.abs(bot.x-building.x)<building.w/2-1&&Math.abs(bot.z-building.z)<building.d/2-1){entered=true;break;}}
  assert.ok(g.state.interiors!.doors['door-0--1']||g.state.interiors!.doors['door-0-1'],'both doors stayed closed');assert.ok(entered,'bot never entered the building');
 }finally{bots.dispose();}
});
test('a bot follows a heard opponent onto an upper floor through the authored stairs',async()=>{
 const nav=await createNavigation('cologne'),g=new Game('STAIRQA',600000,'cologne',()=>.5,{kind:'solo',mode:'battle',battleStyle:'alone',enemies:1}),bots=new Bots(g,nav),building=getWorld('cologne').buildings.find(b=>b.upper)!;
 try{g.add('a','A');g.operation.configureBots();for(const p of g.state.players)g.ready(p.id,true,1000);g.tick(4000);const human=g.player('a')!,bot=g.state.players.find(p=>p.kind==='bot')!;
  Object.assign(human,{x:building.x-3,z:building.z-4,y:4.125,protectedUntil:Number.MAX_SAFE_INTEGER});Object.assign(bot,{x:building.x,z:building.z+building.d/2+2,y:0});
  nav.sync(g.state.interiors);const path=nav.path(bot,human);assert.ok(path.some(p=>p.y>3.8),'navmesh has no upper-floor connection');
  let reached=false;for(let frame=1;frame<=1200;frame++){if(frame%15===1)g.emit({type:'shot',id:'a',weapon:0,point:[human.x,human.y+1.6,human.z]});bots.update(4000+frame*1000/30);g.tick(4000+frame*1000/30);g.state.events=[];if(bot.y>3.8){reached=true;break;}}
  assert.ok(reached,`bot stayed at ${bot.x},${bot.y},${bot.z}`);
 }finally{bots.dispose();}
});
