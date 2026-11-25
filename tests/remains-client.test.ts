import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createHuman} from '../client/humanoid';
import {Game,makePlayer} from '../shared/game';
import {corpseQuaternion,freezeRemains,harvestAnimation,remainsInteraction} from '../client/remainsScene';
import type {Corpse,BodyPartItem} from '../shared/remains';

test('the settled-body template preserves every posed bone without building held weapon geometry',()=>{
 const data=JSON.parse(readFileSync('public/shooter/characters/humanoid.json','utf8'));
 const pose=makePlayer('body','Vorlage','fr');pose.hp=0;
 const material=new T.MeshStandardMaterial();
 const actor=createHuman(data,'fr','cologne',material,'us-field');
 const remains=createHuman(data,'fr','cologne',material,'us-field',false,pose.id,'remains');
 try{
  function bones(human:typeof actor){
   human.update(pose,0,1/60,0);human.group.updateWorldMatrix(true,true);
   const rows:number[][]=[];human.group.traverse(o=>{if(o instanceof T.Bone)rows.push(o.matrixWorld.toArray());});
   return rows;
  }
  const expected=bones(actor);assert.ok(expected.length>10);assert.deepEqual(bones(remains),expected);
  const star=remains.group.getObjectByName('held-throwing-star') as T.Mesh;
  assert.equal(star.geometry.hasAttribute('position'),false);
 }finally{actor.dispose();remains.dispose();material.dispose();}
});

function fixture(){const game=new Game('REMAINSUI',600000,'cologne',()=>.5,{kind:'coop',mode:'mission'}),p=game.add('carrier','Helfer');Object.assign(p,{x:8,y:0,z:8,yaw:0});const corpse:Corpse={id:'corpse:1',sourceId:'patient',sourceLife:1,name:'Partner',uniform:'kroenen',team:'de',kind:'human',x:8,y:0,z:6,yaw:0,pitch:0,crouching:false,createdAt:1000,lost:0,carrierId:null,shield:150,harvesterId:null,harvestUntil:0,medicalUntil:0,tentId:null};game.state.corpses=[corpse];return {game,p,corpse};}
test('corpse interactions expose carry and a distinct head-removal action; reserved heads cannot be stolen',()=>{
 const {game,p,corpse}=fixture(),target=remainsInteraction(game.state,p,0)!;assert.equal(target.id,'corpse:carry:corpse:1');assert.equal(target.alternateId,'corpse:harvest:corpse:1');corpse.lost=1;assert.equal(remainsInteraction(game.state,p,0)?.alternateId,undefined);corpse.harvesterId='other';assert.equal(remainsInteraction(game.state,p,0),undefined);
});
test('a carried teammate is deposited at the matching aid tent before any drop or item interaction',()=>{
 const {game,p,corpse}=fixture(),patient=game.add('patient','Partner');Object.assign(patient,{hp:0,life:1,team:'de'});corpse.carrierId=p.id;p.carriedCorpse=corpse.id;game.state.aidTents=[{id:'aid-de',x:8,y:0,z:6,team:'de'}];assert.equal(remainsInteraction(game.state,p,0)?.id,'tent:deposit:aid-de');patient.life=2;assert.equal(remainsInteraction(game.state,p,0)?.id,'corpse:drop');
});
test('loose original-character body parts are pickable only when resting and unowned',()=>{
 const {game,p}=fixture();game.state.corpses=[];const item:BodyPartItem={id:'arm:1',corpseId:null,sourceId:'victim',sourceLife:1,name:'Gegner',uniform:'kroenen',team:'fr',kind:'human',part:'armL',x:8,y:.1,z:6.5,yaw:0,pitch:0,roll:0,vx:0,vy:0,vz:0,spinX:0,spinY:0,spinZ:0,state:'ground',carrierId:null,throwerId:null,spawnedAt:0};game.state.bodyParts=[item];assert.equal(remainsInteraction(game.state,p,0)?.id,'part:pickup:arm:1');item.state='held';item.carrierId='other';assert.equal(remainsInteraction(game.state,p,0),undefined);
});
test('persistent corpse pose lies on the ground, while a carried shield remains upright',()=>{
 for(const yaw of [0,.6,Math.PI]){const head=new T.Vector3(0,1.5,0).applyQuaternion(corpseQuaternion(yaw));assert.ok(Math.abs(head.x-Math.sin(yaw)*1.5)<1e-6);assert.ok(Math.abs(head.z-Math.cos(yaw)*1.5)<1e-6);assert.ok(Math.abs(head.y)<1e-6);assert.ok(new T.Vector3(0,1,0).applyQuaternion(corpseQuaternion(yaw,true)).distanceTo(new T.Vector3(0,1,0))<1e-6);}
});
test('head removal has a visible reach, braced pull, twist and final release without unbounded motion',()=>{
 assert.equal(harvestAnimation(0).reach,0);assert.equal(harvestAnimation(.25).reach,1);assert.ok(harvestAnimation(.8).pull>.8);assert.ok(Math.abs(harvestAnimation(.6).twist)>.1);assert.equal(harvestAnimation(.91).jolt,1);assert.equal(harvestAnimation(1).pull,1);assert.equal(harvestAnimation(2).pull,1);
});
test('corpse freezing retains texture/material identity and bakes actual posed vertices without live bones',async()=>{
 const root=new T.Group(),bone=new T.Bone();root.add(bone);const geometry=new T.BoxGeometry(.3,.4,.2),count=geometry.getAttribute('position').count;geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(count*4),4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:count*4},(_,i)=>i%4===0?1:0),4));const material=new T.MeshStandardMaterial({color:'#614d43'}),mesh=new T.SkinnedMesh(geometry,material);root.add(mesh);root.updateWorldMatrix(true,true);mesh.bind(new T.Skeleton([bone]));bone.position.x=.2;root.updateWorldMatrix(true,true);mesh.skeleton.update();const source=geometry.getAttribute('position').getX(0),frozen=await freezeRemains(root);assert.equal(frozen.children.length,1);const baked=frozen.children[0] as T.Mesh;assert.ok(!(baked instanceof T.SkinnedMesh));assert.equal(baked.material,material);assert.ok(Math.abs(baked.geometry.getAttribute('position').getX(0)-source-.2)<1e-6);assert.equal(geometry.getAttribute('position').getX(0),source);baked.geometry.dispose();geometry.dispose();material.dispose();mesh.skeleton.dispose();
});

test('frozen weighted, morphed skin matches native Three positions and normals exactly',async()=>{
 const root=new T.Group(),a=new T.Bone(),b=new T.Bone();a.add(b);root.add(a);b.position.y=.7;
 const geometry=new T.BoxGeometry(.7,1,.3),position=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
 const morph=position.clone();for(let i=0;i<morph.count;i++)morph.setX(i,morph.getX(i)+i*.003);
 geometry.morphAttributes.position=[morph];
 const idx=new Uint16Array(position.count*4),weights=new Float32Array(idx.length);
 for(let i=0;i<position.count;i++){idx[i*4+1]=1;weights[i*4]=.3;weights[i*4+1]=.7;}
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(idx,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 const material=new T.MeshBasicMaterial(),mesh=new T.SkinnedMesh(geometry,material);root.add(mesh);
 mesh.position.set(.3,-.2,.1);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton([a,b]));
 mesh.morphTargetInfluences![0]=.2;a.rotation.x=.27;b.rotation.y=-.42;root.updateMatrixWorld(true);
 const frozen=await freezeRemains(root),baked=(frozen.children[0] as T.Mesh).geometry;
 const p=new T.Vector3(),n=new T.Vector3(),base=new T.Vector3(),normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
 for(let i=0;i<position.count;i++){
  mesh.getVertexPosition(i,p);n.fromBufferAttribute(normals,i).multiplyScalar(.001).add(base.fromBufferAttribute(position,i));
  mesh.applyBoneTransform(i,n).sub(p).applyNormalMatrix(normalMatrix).normalize();p.applyMatrix4(mesh.matrixWorld);
  assert.deepEqual(new T.Vector3().fromBufferAttribute(baked.getAttribute('position'),i).toArray(),p.toArray().map(Math.fround));
  assert.deepEqual(new T.Vector3().fromBufferAttribute(baked.getAttribute('normal'),i).toArray(),n.toArray().map(Math.fround));
 }
 geometry.dispose();baked.dispose();material.dispose();mesh.skeleton.dispose();
});
