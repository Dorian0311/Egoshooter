import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {createViewmodel,reloadEnvelope,type ViewmodelInput} from '../client/viewmodel.ts';
const input:ViewmodelInput={dt:1/60,now:0,weaponIndex:3,aim:false,yaw:0,pitch:0,moving:0,sprinting:false,grounded:true,reloadRemainingMs:0,reloadDurationMs:2600,muzzleY:-.17};
test('reload motion returns to rest and stays bounded',()=>{
 assert.equal(reloadEnvelope(0),0);assert.equal(reloadEnvelope(1),0);
 for(let i=0;i<=100;i++){const e=reloadEnvelope(i/100);assert.ok(e>=0&&e<=1);}
});
test('viewmodel settles to aim and recoil returns to rest across frame rates',()=>{
 for(const rate of [30,60,144]){
  const parent=new Group(),vm=createViewmodel(parent);
  for(let i=0;i<rate*2;i++)vm.update({...input,dt:1/rate,aim:true});
  assert.ok(Math.abs(parent.position.x+.24)<1e-5);
  assert.ok(Math.abs(parent.position.y-.158)<1e-5);
  vm.shot(3);const first=vm.update({...input,dt:1/rate,aim:true});assert.ok(first.recoil>0);
  for(let i=0;i<rate;i++)vm.update({...input,dt:1/rate,aim:true});
  assert.ok(Math.abs(parent.position.z)<1e-6);
  vm.dispose();assert.deepEqual(parent.position.toArray(),[0,0,0]);
 }
});
test('yaw wrapping and frame stalls cannot produce large weapon jumps',()=>{
 const parent=new Group(),vm=createViewmodel(parent);
 vm.update({...input,yaw:Math.PI-.001});vm.update({...input,yaw:-Math.PI+.001,dt:5});
 assert.ok(Math.abs(parent.position.x)<.035);assert.ok(parent.position.toArray().every(Number.isFinite));
 vm.dispose();vm.shot(0);vm.update(input);assert.deepEqual(parent.position.toArray(),[0,0,0]);
});
