import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createHuman} from '../client/humanoid';
import {createAnatomy} from '../client/anatomy';
import {createThrowingStarGeometry} from '../client/operationScene';
import {createStaticActorRig} from '../client/staticActorRig';
import {makePlayer} from '../shared/game';
import {acquireWoundMaterial,createWoundGeometry,createWoundMaterial} from '../client/woundSurfaces';
import {freezeRemains} from '../client/remainsScene';
test('late frozen remains use the warmed material until the last owner releases it',async()=>{
 const warmup=acquireWoundMaterial(),root=new T.Group(),template=createAnatomy(root);
 let disposals=0;
 warmup.material.addEventListener('dispose',()=>disposals++);
 template.setLost(4);
 const corpse=await freezeRemains(root),arm=corpse.getObjectByName('tissue-armR') as T.Mesh;
 assert.equal(arm.material,warmup.material);
 assert.equal(arm.receiveShadow,true);
 assert.deepEqual(Object.keys(arm.geometry.attributes).sort(),['color','normal','position','uv']);
 template.dispose();
 assert.equal(disposals,0);
 arm.geometry.dispose();
 warmup.release();warmup.release();
 assert.equal(disposals,1);
 const next=acquireWoundMaterial();assert.notEqual(next.material,warmup.material);next.release();
});
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
 const anatomy=createAnatomy(root);anatomy.setLost(0);const mesh=rig.meshes[1],index=mesh.geometry.index,originalCount=mesh.geometry.drawRange.count;anatomy.setLost(2);assert.ok(mesh.geometry.drawRange.count<originalCount);anatomy.setLost(0);assert.equal(mesh.geometry.index,index);assert.equal(mesh.geometry.drawRange.count,originalCount);anatomy.dispose();rig.skeleton.dispose();for(const geometry of owned)geometry.dispose();material.dispose();
});

test('wound surfaces close the cut, retain detail in one draw and point outward on a detached part',()=>{
 const geometry=createWoundGeometry('armL',.075),position=geometry.getAttribute('position'),color=geometry.getAttribute('color');assert.ok(position.count<4500&&color.count===position.count);assert.ok(Array.from(position.array).every(Number.isFinite));assert.ok(geometry.getAttribute('normal').getY(0)>.9,'cut surface normals face outwards');
 const edges=new Map<string,number>(),key=(index:number)=>[position.getX(index),position.getY(index),position.getZ(index)].map(n=>Math.round(n*1e6)).join(',');
 for(let i=0;i<position.count;i+=3){const vertices=[key(i),key(i+1),key(i+2)];if(new Set(vertices).size<3)continue;for(let n=0;n<3;n++){const edge=[vertices[n],vertices[(n+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);}}
 assert.ok([...edges.values()].every(count=>count===2),'wound geometry has an open boundary');const material=createWoundMaterial();assert.equal(material.vertexColors,true);assert.ok(material.bumpMap);geometry.dispose();material.dispose();
 const data=JSON.parse(readFileSync('public/shooter/characters/humanoid.json','utf8')),human=createHuman(data,'fr','cologne',new T.MeshStandardMaterial(),'us-field'),anatomy=createAnatomy(human.group);anatomy.setLost(2);const source=human.group.getObjectByName('wound-armL')!,part=anatomy.detach('armL')!,cap=part.getObjectByName('wound-armL')!;
 assert.equal(source.children.filter(o=>o instanceof T.Mesh).length,1);const a=new T.Vector3(0,1,0).applyQuaternion(source.getWorldQuaternion(new T.Quaternion())),b=new T.Vector3(0,1,0).applyQuaternion(cap.getWorldQuaternion(new T.Quaternion()));assert.ok(a.dot(b)<-.99);
 part.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});anatomy.dispose();human.dispose();
});

test('neck closures stay within neck proportions instead of forming a wide plate or long bone blocks',()=>{
 const geometry=createWoundGeometry('head',.055);geometry.computeBoundingBox();const size=geometry.boundingBox!.getSize(new T.Vector3());
 assert.ok(size.x<.12&&size.z<.12,'neck cut must remain narrower than a human head');assert.ok(size.y<.025,'tissue depth and vertebra stub must not resemble a board or long post');geometry.dispose();
 const data=JSON.parse(readFileSync('public/shooter/characters/humanoid.json','utf8')),human=createHuman(data,'fr','cologne',new T.MeshStandardMaterial(),'us-field'),anatomy=createAnatomy(human.group),cap=human.group.getObjectByName('wound-head')!;
 assert.ok(cap.userData.radius<=.072,'head accessories must not inflate the neck cut to collar width');anatomy.dispose();human.dispose();
});
