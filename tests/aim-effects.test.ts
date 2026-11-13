import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {Game,neutral,validInput} from '../shared/game.ts';
test('center reticle ray matches authoritative yaw and pitch',()=>{
 for(const yaw of [-2,-.5,0,1,3])for(const pitch of [-1,.0,.8]){
  const camera=new PerspectiveCamera();camera.rotation.set(pitch,yaw,0,'YXZ');
  const direction=camera.getWorldDirection(new Vector3());
  const server=new Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  assert.ok(direction.distanceTo(server)<1e-12);
 }
});
test('SMG honors fire cadence and emits the actual confirmed impact position',()=>{
 const game=new Game('TEST12',600000,'cologne',()=>.5);const a=game.add('a','A'),b=game.add('b','B');
 Object.assign(a,{x:8,z:8,yaw:0,pitch:-.07,weapon:2,ammo:30,protectedUntil:0});
 Object.assign(b,{x:8,z:0,protectedUntil:0});game.history=[];
 const input={...neutral(1),weapon:2 as const,fire:true,time:4000};
 assert.ok(validInput(input));assert.equal(validInput({...input,weapon:5}),false);
 game.shoot(a,input,4000);assert.equal(b.hp,76);assert.equal(a.ammo,29);
 const hit=game.state.events.find(e=>e.type==='hit')!;
 assert.ok(hit.point);assert.ok(Math.abs(hit.point[0]-b.x)<.001);assert.ok(Math.abs(hit.point[2]-b.z)<.3);
 game.shoot(a,input,4050);assert.equal(a.ammo,29);
 game.shoot(a,input,4100);assert.equal(a.ammo,28);
});

test('G36 has authoritative damage, cadence and independent ammunition',()=>{
 const game=new Game('TEST36',600000,'cologne',()=>.5);const a=game.add('a','A'),b=game.add('b','B');
 Object.assign(a,{x:8,z:8,yaw:0,pitch:-.07,weapon:3,ammo:30,protectedUntil:0});
 Object.assign(b,{x:8,z:0,protectedUntil:0});game.history=[];
 const input={...neutral(1),weapon:3 as const,fire:true,time:4000};
 assert.ok(validInput(input));
 game.shoot(a,input,4000);assert.equal(b.hp,73);assert.equal(a.ammoByWeapon[3],29);
 assert.equal(a.ammoByWeapon[2],30);
 game.shoot(a,input,4050);assert.equal(a.ammo,29);
 game.shoot(a,input,4100);assert.equal(a.ammo,29);
 game.shoot(a,input,4130);assert.equal(a.ammo,28);
 assert.equal(game.state.events.find(e=>e.type==='shot')?.weapon,3);
});
