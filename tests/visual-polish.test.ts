import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Game,makePlayer} from '../shared/game';
import {getWorld} from '../shared/world';
import {createOperationScene} from '../client/operationScene';
import {createContactShadows} from '../client/contactShadows';
import {createCharacterMotion,type MotionLibrary} from '../client/characterMotion';
import {refineViewmodelGeometry} from '../client/viewmodelGeometry';
import {instanceStaticModel} from '../client/scenery';

test('red-white medical crates share resources and still follow pickup/taken/removal state',()=>{
 const scene=new T.Scene(),items=createOperationScene(scene),game=new Game('MEDICAL',600000,'cologne');
 game.state.pickups=[{id:'med-a',kind:'bandage',x:0,y:0,z:-1,taken:false},{id:'med-b',kind:'bandage',x:2,y:0,z:-1,taken:false}];
 items.sync(game.state);
 const root=scene.getObjectByName('operation-items')!,crates=root.children.filter(o=>o.name==='red-white-medical-crate');
 assert.equal(crates.length,2);assert.equal(crates[0].children.length,2);
 const body=crates[0].children[0] as T.Mesh,second=crates[1].children[0] as T.Mesh;
 assert.equal(body.geometry,second.geometry);assert.equal(body.material,second.material);
 const material=body.material as T.MeshStandardMaterial;assert.ok(material.color.r>material.color.g*2);
 const white=(crates[0].children[1] as T.Mesh).material as T.MeshStandardMaterial;assert.ok(white.color.r>.85&&white.color.g>.85&&white.color.b>.75);
 const bounds=new T.Box3().setFromObject(crates[0]);assert.ok(bounds.min.y>=0&&bounds.max.y<.6);
 const player=makePlayer('med-player','Test','de');Object.assign(player,{x:0,y:0,z:0});
 assert.equal(items.interaction(player,0)?.id,'med-a');
 game.state.pickups[0].taken=true;items.sync(game.state);assert.equal(crates[0].visible,false);
 game.state.pickups=[];items.sync(game.state);assert.equal(root.getObjectByName('red-white-medical-crate'),undefined);
 items.dispose();assert.equal(scene.children.length,0);
});

test('grounding shadows have bounded instance storage and release their scene objects',()=>{
 const scene=new T.Scene(),shadows=createContactShadows(scene,getWorld('cologne').buildings);
 shadows.begin();for(let i=0;i<150;i++)shadows.actor(i,0,0);shadows.end();
 const actors=scene.getObjectByName('actor-contact-shadows') as T.InstancedMesh;
 assert.equal(actors.count,128);assert.equal(actors.instanceMatrix.count,128);
 shadows.begin();shadows.actor(1,4,2);shadows.end();const matrix=new T.Matrix4();actors.getMatrixAt(0,matrix);
 assert.equal(actors.count,1);assert.ok(Math.abs(new T.Vector3().setFromMatrixPosition(matrix).y-4.018)<1e-6);
 shadows.dispose();assert.equal(scene.children.length,0);
});

test('decorative facade instances can receive shadows without duplicating building shadow geometry',()=>{
 const source=new T.Group(),geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();source.add(new T.Mesh(geometry,material));
 const scene=new T.Scene();instanceStaticModel(scene,source,[new T.Matrix4()],false);
 const detail=scene.children[0] as T.InstancedMesh;assert.equal(detail.castShadow,false);assert.equal(detail.receiveShadow,true);assert.equal(detail.count,1);
 detail.dispose();geometry.dispose();material.dispose();
});

test('sideways leg heading is stable across refresh rates and returns to rest',()=>{
 const clip={duration:1,times:[0,1],rotations:{root:[0,0,0,1,0,0,0,1]},rootPositions:[0,0,0,0,0,0]};
 const library:MotionLibrary={version:1,fps:30,clips:{idle:clip,walk:clip,jog:clip,sprint:clip,crouchIdle:clip,crouchWalk:clip,air:clip,land:clip}};
 for(const rate of [30,60,144]){
  const root=new T.Group(),hips=new T.Bone();hips.name='root';root.add(hips);
  const motion=createCharacterMotion(root,new Map([['root',hips]]),library),p=makePlayer('legs','Test','de');Object.assign(p,{x:0,z:0,yaw:0,grounded:true});
  motion.update(p,p,1/rate);
  for(let i=0;i<rate*2;i++){p.x+=3/rate;motion.update(p,p,1/rate);}
  assert.ok(Math.abs(new T.Euler().setFromQuaternion(hips.quaternion).y+1.25)<.001,`${rate} Hz`);
  for(let i=0;i<rate*2;i++)motion.update(p,p,1/rate);
  assert.ok(hips.quaternion.angleTo(new T.Quaternion())<.001);motion.dispose();
 }
});

test('sleeve refinement rounds the silhouette once while retaining grip transforms',()=>{
 const root=new T.Group(),mesh=new T.Mesh(new T.CylinderGeometry(.079,.057,.48,10),new T.MeshStandardMaterial());mesh.name='view-sleeve-r';mesh.position.set(.2,-.2,-.5);root.add(mesh);
 const position=mesh.position.clone(),rotation=mesh.quaternion.clone(),oldCount=mesh.geometry.getAttribute('position').count;
 refineViewmodelGeometry(root);const refined=mesh.geometry;
 assert.ok(refined.getAttribute('position').count>oldCount);assert.ok(refined.getAttribute('position').count<1000);
 assert.ok(mesh.position.equals(position));assert.ok(mesh.quaternion.equals(rotation));
 refineViewmodelGeometry(root);assert.equal(mesh.geometry,refined);
 refined.dispose();(mesh.material as T.Material).dispose();
});
