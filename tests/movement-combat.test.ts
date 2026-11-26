import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {makePlayer} from '../shared/game';
import {getWorld} from '../shared/world';
import {initialInteriors,interiorWorld} from '../shared/interiors';
import {throwingStarQuaternion} from '../client/projectileMotion';
import {createCoatDynamics} from '../client/coatDynamics';
import {solveArm} from '../client/actorEquipment';
import {createAnatomy} from '../client/anatomy';
import {createGore} from '../client/gore';

test('star rotation stays in its flight plane while the blades spin, including vertical throws',()=>{
 for(const velocity of [{vx:0,vy:0,vz:-24},{vx:5,vy:-8,vz:20},{vx:0,vy:24,vz:0}]){
  const first=throwingStarQuaternion(velocity,0),next=throwingStarQuaternion(velocity,.07),normal=new T.Vector3(0,0,1).applyQuaternion(first),later=new T.Vector3(0,0,1).applyQuaternion(next),flight=new T.Vector3(velocity.vx,velocity.vy,velocity.vz).normalize();
  assert.ok(Math.abs(normal.dot(flight))<1e-6);assert.ok(normal.distanceTo(later)<1e-6);assert.ok(first.angleTo(next)>.2);assert.ok(next.toArray().every(Number.isFinite));
 }
});
test('two-bone weapon grips meet targets in a rotated parent space without stretching the arm',()=>{
 const root=new T.Group();root.rotation.y=.8;root.position.set(4,2,5);const upper=new T.Bone(),lower=new T.Bone(),hand=new T.Bone();root.add(upper);upper.add(lower);lower.add(hand);upper.position.set(.2,1.4,0);lower.position.set(.28,-.1,0);hand.position.set(.29,-.1,0);root.updateWorldMatrix(true,true);
 const target=root.localToWorld(new T.Vector3(.15,1.15,-.4)),pole=root.localToWorld(new T.Vector3(.55,.9,.1)),firstLength=lower.getWorldPosition(new T.Vector3()).distanceTo(upper.getWorldPosition(new T.Vector3()));solveArm({upper,lower,hand},target,pole);
 assert.ok(hand.getWorldPosition(new T.Vector3()).distanceTo(target)<.002);assert.ok(Math.abs(lower.getWorldPosition(new T.Vector3()).distanceTo(upper.getWorldPosition(new T.Vector3()))-firstLength)<1e-6);
});
test('coat hem follows movement and recoil, then settles; unpainted/non-coat vertices stay unchanged',()=>{
 const root=new T.Group(),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-.2,.2,0,.2,.2,0,0,1,0,0,1.5,0],3));geometry.setAttribute('uv',new T.Float32BufferAttribute([.1,.5,.1,.5,.1,.5,.1,.1],2));geometry.setAttribute('normal',new T.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1],3));root.add(new T.Mesh(geometry,new T.MeshStandardMaterial()));const coat=createCoatDynamics(root),p=makePlayer('coat','Coat','de');p.x=p.z=p.yaw=0;coat.update(p,1/60);
 for(let n=0;n<90;n++){p.z-=4/60;coat.update(p,1/60);}assert.ok(geometry.getAttribute('position').getZ(0)>.06);assert.equal(geometry.getAttribute('position').getZ(3),0);
 for(let n=0;n<240;n++)coat.update(p,1/60);assert.ok(Math.abs(geometry.getAttribute('position').getZ(0))<.003);coat.restore();assert.equal(geometry.getAttribute('position').getZ(0),0);geometry.dispose();
});
test('folded arms follow skin weights and torso-bound clothing does not disappear with a leg',()=>{
 const root=new T.Group(),torso=new T.Bone(),arm=new T.Bone();torso.name='torso';arm.name='upperarm01.L';arm.position.set(-.2,1.4,0);torso.add(arm);root.add(torso);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,1.1,0,.1,1.1,0,0,1.2,0,.3,.4,0,.4,.4,0,.3,.5,0],3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:24},(_,i)=>i%4===0?1:0),4));g.computeVertexNormals();const mesh=new T.SkinnedMesh(g,new T.MeshStandardMaterial());root.add(mesh);root.updateWorldMatrix(true,true);mesh.bind(new T.Skeleton([torso,arm]));const anatomy=createAnatomy(root);anatomy.setLost(16);assert.equal(g.drawRange.count,6);anatomy.setLost(2);assert.equal(g.drawRange.count,3);
 const wound=root.getObjectByName('wound-armL')!;const before=wound.getWorldPosition(new T.Vector3());arm.position.y+=.2;assert.ok(Math.abs(wound.getWorldPosition(new T.Vector3()).y-before.y-.2)<1e-6);anatomy.dispose();g.dispose();
});
test('collision layouts are reused until a door or pane changes, including in-place mutations',()=>{
 const world=getWorld('cologne'),state=initialInteriors(world),first=interiorWorld(world,state);assert.equal(interiorWorld(world,state),first);const door=Object.keys(state.doors)[0];state.doors[door]=!state.doors[door];const changed=interiorWorld(world,state);assert.notEqual(changed,first);assert.equal(interiorWorld(world,state),changed);state.broken.push('glass-extra');assert.notEqual(interiorWorld(world,state),changed);
});
test('detached parts settle with their actual bounds above the floor and expire without leaking objects',()=>{
 const scene=new T.Scene(),world={...getWorld('cologne'),boxes:[]},gore=createGore(scene,()=>world),piece=new T.Group();piece.add(new T.Mesh(new T.BoxGeometry(.15,.8,.15),new T.MeshStandardMaterial()));piece.position.set(8,2,0);gore.add(piece,new T.Vector3(1,.1,0),new T.Vector3(8,2.4,0));for(let i=0;i<480;i++)gore.update(1/60);assert.ok(new T.Box3().setFromObject(piece).min.y>=-.002);assert.equal(scene.children.length,1);gore.update(3);assert.equal(scene.children.length,0);gore.dispose();
});

test('IK reads current ancestor matrices across intermediate twist bones on consecutive poses',()=>{
 const parent=new T.Group(),upper=new T.Bone(),twist=new T.Bone(),lower=new T.Bone(),forearm=new T.Bone(),hand=new T.Bone();
 parent.add(upper);upper.add(twist);twist.add(lower);lower.add(forearm);forearm.add(hand);
 upper.position.set(.13,1.38,0);twist.position.x=.12;lower.position.x=.18;forearm.position.x=.14;hand.position.x=.16;
 for(const yaw of [.3,-.9,1.2]){
  parent.rotation.y=yaw;parent.position.set(yaw,2,4);twist.rotation.x=yaw*.2;forearm.rotation.x=-yaw*.1;
  const target=parent.localToWorld(new T.Vector3(.19,1.12,-.32));
  const pole=parent.localToWorld(new T.Vector3(.6,1,.1));
  solveArm({upper,lower,hand},target,pole);
  assert.ok(hand.getWorldPosition(new T.Vector3()).distanceTo(target)<.002);
 }
});
