import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Box3,Vector3,Group,Mesh,BoxGeometry,MeshStandardMaterial} from 'three';
import {batchWeaponMeshes} from '../client/batchWeaponMeshes.ts';
test('rigid batching preserves world bounds and independently moving parts',()=>{
 const root=new Group(),nested=new Group(),material=new MeshStandardMaterial();nested.position.set(2,1,0);root.add(nested);
 for(let i=0;i<4;i++){const mesh=new Mesh(new BoxGeometry(),material);mesh.position.x=i;nested.add(mesh);}
 const hand=new Mesh(new BoxGeometry(),material);hand.name='hand-l';root.add(hand);
 const bounds=new Box3().setFromObject(root);assert.deepEqual(batchWeaponMeshes(root),{before:4,after:1});
 assert.ok(new Box3().setFromObject(root).min.distanceTo(bounds.min)<1e-7);
 assert.ok(new Box3().setFromObject(root).max.distanceTo(bounds.max)<1e-7);
 assert.equal(hand.parent,root);hand.position.y=4;assert.equal(hand.position.y,4);
});
test('actual Kar98k rigid meshes batch below twenty draws without losing muzzle metadata',async()=>{
 const bytes=await readFile('public/shooter/models/kar98k.glb');
 const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const before=new Box3().setFromObject(scene),result=batchWeaponMeshes(scene);
 assert.ok(result.before>100);assert.ok(result.after<20,JSON.stringify(result));
 const after=new Box3().setFromObject(scene);assert.ok(before.min.distanceTo(after.min)<1e-5);assert.ok(before.max.distanceTo(after.max)<1e-5);
 assert.ok(scene.getObjectByName('hand-l'));assert.ok(scene.children.some(c=>Array.isArray(c.userData.muzzle)));
 console.log('Kar98k rigid draw groups:',result);
});
