import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createViewmodel} from '../client/viewmodel';
import {createViewmodelArms} from '../client/viewmodelArms';

test('authored trigger sleeves stay in front of the eye during ADS without detaching from the wrist',async()=>{
 for(const name of ['kar98k','mp40','m1-garand','thompson','viewmodel-hands']){
  const bytes=await readFile(`public/shooter/models/${name}.glb`);
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const parent=new T.Group(),mount=new T.Group();parent.add(mount);mount.add(scene);
  mount.rotation.y=Math.PI;mount.position.set(.24,-.23,-.4);
  const sleeve=scene.getObjectByName('view-sleeve-r')!,rest=sleeve.position.clone(),rotation=sleeve.quaternion.clone();
  const arms=createViewmodelArms(mount),viewmodel=createViewmodel(parent);
  for(let i=0;i<180;i++){
   const pose=viewmodel.update({dt:1/60,now:i*1000/60,weaponIndex:0,aim:true,yaw:0,pitch:0,moving:0,sprinting:false,grounded:true,reloadRemainingMs:0,reloadDurationMs:2600,muzzleY:-.18,sightY:-.127});
   arms.update(pose.aimBlend);
  }
  parent.updateMatrixWorld(true);
  const mesh=sleeve as T.Mesh,bounds=new T.Box3(),vertex=new T.Vector3();
  for(let i=0;i<mesh.geometry.getAttribute('position').count;i++){mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);bounds.expandByPoint(vertex);}
  assert.ok(bounds.max.z<-.2,`${name}: sleeve must not cross the eye (${bounds.max.z})`);
  assert.ok(Math.abs(parent.position.y-.119)<1e-6,'align the sight instead of raising the barrel to the eye');
  assert.ok(sleeve.position.distanceTo(rest)<1e-10);assert.ok(sleeve.quaternion.angleTo(rotation)<1e-7);
  arms.update(0);assert.equal(mesh.morphTargetInfluences![0],0);
  viewmodel.dispose();
 }
});
