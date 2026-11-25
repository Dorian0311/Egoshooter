import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,PerspectiveCamera,Vector3} from 'three';
import {createViewmodel,reloadEnvelope,projectWeaponMuzzle,type ViewmodelInput} from '../client/viewmodel.ts';
const input:ViewmodelInput={dt:1/60,now:0,weaponIndex:3,aim:false,yaw:0,pitch:0,moving:0,sprinting:false,grounded:true,reloadRemainingMs:0,reloadDurationMs:2600,muzzleY:-.17};

test('local flash and tracer origins match the independent weapon projection at all fields of view',()=>{
 for(const fov of [48,72,100])for(const weaponFov of [50,62]){
  const world=new PerspectiveCamera(fov,16/9,.08,350),weapon=new PerspectiveCamera(weaponFov,16/9,.025,8);
  world.position.set(20,1.7,-10);world.rotation.set(.2,.7,0);world.updateMatrixWorld();
  weapon.position.copy(world.position);weapon.quaternion.copy(world.quaternion);weapon.updateMatrixWorld();
  const point=world.localToWorld(new Vector3(.24,-.17,-1));
  const expected=point.clone().project(weapon),actual=projectWeaponMuzzle(point,world,weaponFov).project(world);
  assert.ok(Math.abs(expected.x-actual.x)<1e-6);assert.ok(Math.abs(expected.y-actual.y)<1e-6);
 }
});
test('reload motion returns to rest and stays bounded',()=>{
 assert.equal(reloadEnvelope(0),0);assert.equal(reloadEnvelope(1),0);
 for(let i=0;i<=100;i++){const e=reloadEnvelope(i/100);assert.ok(e>=0&&e<=1);}
});
test('viewmodel settles to aim and recoil returns to rest across frame rates',()=>{
 for(const rate of [30,60,144]){
  const parent=new Group(),vm=createViewmodel(parent);
  for(let i=0;i<rate*2;i++)vm.update({...input,dt:1/rate,aim:true});
  assert.ok(Math.abs(parent.position.x+.24)<1e-5);
  assert.ok(Math.abs(parent.position.y-.162)<1e-5);
  vm.shot(3);const first=vm.update({...input,dt:1/rate,aim:true});assert.ok(first.recoil>0);
  for(let i=0;i<rate;i++)vm.update({...input,dt:1/rate,aim:true});
  assert.ok(Math.abs(parent.position.z+.18)<1e-6);
  vm.dispose();assert.deepEqual(parent.position.toArray(),[0,0,0]);
 }
});
test('yaw wrapping and frame stalls cannot produce large weapon jumps',()=>{
 const parent=new Group(),vm=createViewmodel(parent);
 vm.update({...input,yaw:Math.PI-.001});vm.update({...input,yaw:-Math.PI+.001,dt:5});
 assert.ok(Math.abs(parent.position.x)<.035);assert.ok(parent.position.toArray().every(Number.isFinite));
 vm.dispose();vm.shot(0);vm.update(input);assert.deepEqual(parent.position.toArray(),[0,0,0]);
});

test('the same sustained mouse turn has the same sway at every refresh rate',()=>{
 const positions:number[][]=[];
 for(const rate of [30,60,120,144]){
  const parent=new Group(),vm=createViewmodel(parent);
  vm.update({...input,dt:0});
  for(let i=1;i<=rate;i++)vm.update({...input,dt:1/rate,yaw:i/rate*.6,pitch:i/rate*.3});
  positions.push(parent.position.toArray());vm.dispose();
 }
 for(const position of positions)for(const axis of [0,1])assert.ok(Math.abs(position[axis]-positions[0][axis])<1e-8);
});

test('aim immediately raises the sprinting weapon and retraces a continuous path on release',()=>{
 for(const rate of [30,60,144]){
  const parent=new Group(),vm=createViewmodel(parent);
  const run={...input,dt:1/rate,moving:1,sprinting:true};
  for(let i=0;i<rate;i++)vm.update(run);
  assert.ok(parent.position.y<-.025 && parent.rotation.z<-.1);
  const previous=parent.position.clone();
  let lastAim=0;
  for(let i=0;i<Math.ceil(rate*.28);i++){
   // The simulation can still report sprint for the first movement tick.
   const pose=vm.update({...run,aim:true,sprinting:i===0});
   assert.ok(pose.aimBlend>lastAim && pose.aimBlend<=1);
   assert.ok(parent.position.distanceTo(previous)<4/rate);
   lastAim=pose.aimBlend;previous.copy(parent.position);
  }
  assert.ok(lastAim>.98);
  for(let i=0;i<rate;i++)vm.update(run);
  assert.ok(parent.rotation.z<-.1);
  vm.reset();assert.equal(vm.update({...input,dt:0}).aimBlend,0);
 }
});
