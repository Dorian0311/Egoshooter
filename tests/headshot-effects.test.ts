import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createHitEffects} from '../client/hitEffects';
import {createBonusCharacter} from '../client/bonusCharacters';
import {makePlayer} from '../shared/game';
import {headshotPose} from '../client/headshotAnimation';
test('headshot fragments run slower locally and all resources are removed afterwards',()=>{
 const normalScene=new T.Scene(),slowScene=new T.Scene(),normal=createHitEffects(normalScene),slow=createHitEffects(slowScene);
 const event={type:'kill' as const,id:'a',target:'b',hitZone:'head' as const,point:[0,1.7,0] as [number,number,number]};
 normal.emit(event);slow.emit(event,true);assert.equal(slow.stats().particles,72);
 assert.ok(slowScene.children.some(mesh=>mesh instanceof T.InstancedMesh&&mesh.geometry.type==='SphereGeometry'));assert.equal(slow.stats().drawCalls,3);
 normal.update(1.7);slow.update(1.4);assert.equal(normal.stats().particles,0);assert.equal(slow.stats().particles,72);
 slow.update(2);assert.equal(slow.stats().particles,0);normal.dispose();slow.dispose();
});

test('lethal headshot sprays away from the shooter and debris stays above an elevated floor',()=>{
 const scene=new T.Scene(),effects=createHitEffects(scene);
 effects.emit({type:'kill',id:'a',hitZone:'head',point:[0,5.7,0]},false,new T.Vector3(1,0,0),4);
 assert.equal((scene.getObjectByName('headshot-mist') as T.Points).geometry.drawRange.count,8);
 effects.update(.1);
 const droplets=scene.getObjectByName('hit-droplet') as T.InstancedMesh,matrix=new T.Matrix4();
 for(let i=0;i<droplets.count;i++){droplets.getMatrixAt(i,matrix);assert.ok(matrix.elements[12]>0);}
 for(let i=0;i<12;i++)effects.update(.1);
 for(const mesh of scene.children)if(mesh instanceof T.InstancedMesh)for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);assert.ok(matrix.elements[13]>=4);}
 effects.dispose();assert.equal(scene.children.length,0);
});

test('ordinary hits stay small and fresh headshots survive the multiplayer particle cap',()=>{
 const scene=new T.Scene(),effects=createHitEffects(scene);
 effects.emit({type:'kill',id:'a',hitZone:'body',point:[0,1,0]});assert.equal(effects.stats().particles,0);
 effects.emit({type:'hit',id:'a',hitZone:'body',point:[0,1,0]});assert.equal(effects.stats().particles,16);
 for(let i=0;i<20;i++)effects.emit({type:'kill',id:'a',hitZone:'head',point:[i,1.7,0]});
 assert.equal(effects.stats().particles,256);assert.equal(scene.children.length,3);assert.equal(effects.stats().drawCalls,3);
 const droplets=scene.getObjectByName('hit-droplet') as T.InstancedMesh,matrix=new T.Matrix4();let newest=false;
 for(let i=0;i<droplets.count;i++){droplets.getMatrixAt(i,matrix);if(matrix.elements[12]>18.9)newest=true;}assert.ok(newest);
 let materialDisposed=false,geometryDisposed=false;const cloud=scene.getObjectByName('headshot-mist') as T.Points;
 (cloud.material as T.Material).addEventListener('dispose',()=>{materialDisposed=true;});cloud.geometry.addEventListener('dispose',()=>{geometryDisposed=true;});
 effects.dispose();assert.ok(materialDisposed&&geometryDisposed);assert.equal(scene.children.length,0);
});

test('headshot collapse follows the particle clock, finishes grounded and never replays',()=>{
 assert.deepEqual(headshotPose(0,false),{fall:0,recoil:0,height:0});
 assert.ok(headshotPose(.2,false).recoil>0);
 assert.ok(headshotPose(.5,true).fall<headshotPose(.5,false).fall);
 const final=headshotPose(3,true);assert.equal(final.fall,1);assert.equal(final.height,.14);assert.ok(Math.abs(final.recoil)<1e-12);
 assert.deepEqual(headshotPose(10,true),final);
});
test('articulated Leatherface head restores after respawn',()=>{
 const root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(1,1.8,1).translate(0,.9,0),new T.MeshStandardMaterial()));
 const character=createBonusCharacter({character:'leatherface',entry:{root,refs:0}}),head=character.group.getObjectByName('static-head')!;
 assert.ok(head instanceof T.Bone);
 character.setHeadVisible(false);character.update(makePlayer('a','A','de'),0,.016);
 assert.equal(head.scale.x,.001);
 character.setHeadVisible(true);assert.equal(head.scale.x,1);character.dispose();
});
