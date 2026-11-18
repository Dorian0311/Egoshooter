import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,neutral,STEP} from '../shared/game';
import {CAR_WARNING_MS,createCarCourse,driveCar,parkedCars} from '../shared/remoteCars';
import {getWorld,mapIds} from '../shared/world';
import {initialInteriors,interiorWorld} from '../shared/interiors';
import {REMOTE_CAR_ID,ROCKET_ID} from '../shared/weapons';
import {difference,mergeSnapshot} from '../shared/protocol';

function match(){
 const game=new Game('CARS'),driver=game.add('driver','Fahrer'),other=game.add('target','Testfigur');
 game.ready(driver.id,true,1000);game.ready(other.id,true,1000);game.tick(4000);
 driver.protectedUntil=other.protectedUntil=0;
 other.team=driver.team==='de'?'fr':'de';
 return {game,driver,other};
}

test('every building gets one car that can drive out through its open entrance',()=>{
 for(const id of mapIds){
  const world=getWorld(id),cars=parkedCars(world),collision=interiorWorld(world,initialInteriors(world));
  assert.equal(cars.length,world.buildings.length);
  assert.equal(new Set(cars.map(car=>car.id)).size,cars.length);
  for(const [index,car]of cars.entries()){
   const building=world.buildings[index];
   for(let i=0;i<68;i++)driveCar(car,1,0,STEP,collision);
   assert.ok(car.z<building.z-building.d/2,`${id}: ${building.name} car exit blocked at ${car.z}`);
  }
 }
});

test('car control keeps the player stationary, is exclusive, stops at closed doors, then detonates once',()=>{
 const {game,driver,other}=match(),car=game.state.remoteCars![1],world=getWorld(),building=world.buildings[1];
 Object.assign(driver,{x:car.x,y:car.y,z:car.z+1,yaw:0});
 Object.assign(other,{x:car.x,y:car.y,z:car.z+1.6});
 const before=structuredClone(game.state);
 assert.equal(game.interact(driver.id,car.id),true);
 assert.equal(game.interact(other.id,car.id),false);
 assert.equal(mergeSnapshot(before,difference(before,game.state))?.remoteCars?.[1].driver,driver.id);
 game.state.interiors!.doors['door-1--1']=false;
 const position=driver.z;
 for(let frame=1;frame<=68;frame++){
  const now=4000+frame*34;
  game.input(driver.id,{...neutral(frame),forward:1,fire:true,time:now});game.tick(now);
 }
 assert.equal(driver.z,position);
 assert.equal(driver.ammo,5);
 assert.ok(car.z>=building.z-building.d/2);
 Object.assign(other,{x:car.x,y:car.y,z:car.z+1.2});
 assert.equal(game.interact(driver.id,'car:explode'),true);
 const armedAt=game.state.now;
 assert.equal(car.detonateAt,armedAt+CAR_WARNING_MS);
 assert.equal(game.state.events.filter(event=>event.type==='car-warning').length,1);
 assert.equal(game.interact(driver.id,'car:explode'),false);
 game.tick(armedAt+CAR_WARNING_MS-1);
 assert.equal(car.spent,undefined);
 assert.equal(other.hp,100);
 game.tick(armedAt+CAR_WARNING_MS);
 assert.ok(other.hp<100);
 assert.equal(car.driver,undefined);assert.equal(car.spent,true);
 assert.equal(game.interact(driver.id,'car:explode'),false);
 assert.equal(game.state.events.filter(event=>event.type==='explosion'&&event.weapon===REMOTE_CAR_ID).length,1);
});

test('training course orders checkpoints, records a best time and resets its car after a safe test blast',()=>{
 const game=new Game('COURSE',600000,'cologne',()=>.5,{kind:'solo',mode:'training'});
 const driver=game.add('driver','Fahrer');
 game.operation.configureBots();game.ready(driver.id,true,1000);game.tick(4000);
 const course=game.state.carCourse!,car=game.state.remoteCars!.find(item=>item.id===course.carId)!;
 const start={x:car.x,y:car.y,z:car.z};
 Object.assign(driver,{x:car.x,y:car.y,z:car.z+1,yaw:0});
 assert.equal(game.interact(driver.id,car.id),true);
 let sequence=0;
 for(let frame=0;frame<150&&course.elapsedMs===undefined;frame++){
  const now=game.state.now+34;
  game.input(driver.id,{...neutral(++sequence),forward:course.next<3?1:-1,time:now});
  game.tick(now);
 }
 assert.equal(course.next,course.gates.length);
 assert.ok(course.elapsedMs&&course.elapsedMs>0);
 assert.equal(course.bestMs,course.elapsedMs);
 assert.equal(game.interact(driver.id,'car:explode'),true);
 game.tick(game.state.now+CAR_WARNING_MS);
 assert.equal(car.driver,undefined);
 assert.equal(car.spent,undefined);
 assert.deepEqual({x:car.x,y:car.y,z:car.z},start);
 assert.equal(driver.hp,100);
 assert.equal(game.interact(driver.id,car.id),true);
 assert.equal(course.next,0);
 assert.equal(course.elapsedMs,undefined);
 assert.ok(course.bestMs);
});

test('the marked training route can be driven forward and in reverse on every map',()=>{
 for(const id of mapIds){
  const world=getWorld(id),cars=parkedCars(world),course=createCarCourse(world,cars)!;
  const car=cars.find(item=>item.id===course.carId)!;
  const collision=interiorWorld(world,initialInteriors(world));
  let gate=0;
  for(let frame=0;frame<150&&gate<course.gates.length;frame++){
   driveCar(car,gate<3?1:-1,0,STEP,collision);
   const target=course.gates[gate];
   if(Math.hypot(car.x-target.x,car.z-target.z)<.66)gate++;
  }
  assert.equal(gate,course.gates.length,id);
 }
});

test('car detaches on exit and disconnect, and a collected rocket explodes on impact',()=>{
 const {game,driver}=match(),car=game.state.remoteCars![1];
 Object.assign(driver,{x:car.x,y:car.y,z:car.z+.9,yaw:0});
 assert.equal(game.interact(driver.id,car.id),true);
 assert.equal(game.interact(driver.id,'car:exit'),true);
 game.tick(4500);assert.equal(game.interact(driver.id,car.id),true);
 driver.connected=false;game.tick(4534);assert.equal(car.driver,undefined);
 driver.connected=true;
 const pickup=game.state.pickups.find(item=>item.id==='pickup-rocket-1')!;
 Object.assign(driver,{x:pickup.x,y:pickup.y,z:pickup.z+.9,yaw:0,pitch:-.6});
 game.tick(5000);
 assert.equal(game.interact(driver.id,pickup.id),true);assert.equal(driver.rockets,1);
 game.tick(5500);assert.equal(game.interact(driver.id,'rocket'),true);assert.equal(driver.rockets,0);
 let exploded=false;
 for(let n=1;n<=20;n++){
  game.tick(5500+n*34);
  exploded||=game.state.events.some(event=>event.type==='explosion'&&event.weapon===ROCKET_ID);
 }
 assert.ok(exploded);assert.equal(game.state.projectiles.length,0);
});
