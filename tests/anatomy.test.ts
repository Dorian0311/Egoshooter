import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createHuman} from '../client/humanoid';
import {createAnatomy} from '../client/anatomy';
import {createThrowingStarGeometry} from '../client/operationScene';
import {createStaticActorRig} from '../client/staticActorRig';
import {makePlayer} from '../shared/game';
test('limb partitions detach actual posed triangles, restore the full mesh, and stay instance-local',()=>{
 const data=JSON.parse(readFileSync('public/shooter/characters/humanoid.json','utf8'));
 const human=createHuman(data,'fr','cologne',new T.MeshStandardMaterial(),'us-field'),other=createHuman(data,'fr','cologne',new T.MeshStandardMaterial(),'us-field');
 const counts=(root:T.Group)=>{let total=0;root.traverse(o=>{if(o instanceof T.Mesh)total+=Math.min(o.geometry.drawRange.count,o.geometry.index?.count??o.geometry.getAttribute('position').count);});return total;};
 const original=counts(human.group),otherOriginal=counts(other.group),anatomy=createAnatomy(human.group);
 const baseline=counts(human.group);const arm=anatomy.detach('armL');assert.ok(arm);assert.ok(counts(arm)>30);anatomy.setLost(2);assert.ok(counts(human.group)<baseline);assert.equal(counts(other.group),otherOriginal);
 anatomy.setLost(0);assert.equal(counts(human.group),baseline);assert.ok(original>10000);
 arm.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});anatomy.dispose();human.dispose();other.dispose();
});
test('gift throwing-star geometry is finite, closed in depth and suitable for sharing across projectiles',()=>{
 const geometry=createThrowingStarGeometry();geometry.computeBoundingBox();const size=geometry.boundingBox!.getSize(new T.Vector3());assert.ok(size.x>.25&&size.x<.4);assert.ok(size.y>.25&&size.y<.4);assert.ok(size.z>0);assert.ok(Array.from(geometry.getAttribute('position').array).every(Number.isFinite));geometry.dispose();
});
test('static figures gain articulated limbs without shifting their original bounds or reallocating index buffers',()=>{
 const root=new T.Group();root.position.set(10,0,3);const material=new T.MeshStandardMaterial(),owned=new Set<T.BufferGeometry>();
 for(const [x,y,w,h]of [[0,1.1,.35,.6],[-.32,1.1,.12,.55],[.32,1.1,.12,.55],[-.1,.4,.12,.8],[.1,.4,.12,.8],[0,1.65,.24,.24]]){const geometry=new T.BoxGeometry(w,h,.16);owned.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,0);root.add(mesh);}
 const before=new T.Box3().setFromObject(root),rig=createStaticActorRig(root,owned),after=new T.Box3().setFromObject(root);assert.ok(before.min.distanceTo(after.min)<1e-6);assert.ok(before.max.distanceTo(after.max)<1e-6);
 rig.update(makePlayer('a','A','de'),Math.PI/2,1);assert.ok(Math.abs(rig.parts.legL.rotation.x)>.1);
 const anatomy=createAnatomy(root);anatomy.setLost(0);const mesh=rig.parts.armL.children[0] as T.Mesh,index=mesh.geometry.index;anatomy.setLost(2);assert.equal(mesh.geometry.drawRange.count,0);anatomy.setLost(0);assert.equal(mesh.geometry.index,index);assert.ok(mesh.geometry.drawRange.count>0);anatomy.dispose();for(const geometry of owned)geometry.dispose();material.dispose();
});
