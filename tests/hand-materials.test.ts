import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial} from 'three';
import {applyHandMaterials} from '../client/handMaterials.ts';
test('both hands share skin and both sleeves share cloth; shared source materials are retained',()=>{
 const root=new Group(),source=new MeshStandardMaterial(),geometry=new BoxGeometry();
 let disposed=0;source.addEventListener('dispose',()=>disposed++);
 const meshes=['hand-r','hand-l','view-sleeve-r','view-sleeve-l','weapon'].map(name=>{const mesh=new Mesh(geometry,source);mesh.name=name;root.add(mesh);return mesh;});
 const result=applyHandMaterials(root,0x292d30);
 assert.equal(meshes[0].material,meshes[1].material);assert.equal(meshes[2].material,meshes[3].material);
 assert.notEqual(result.skin,result.cloth);assert.equal(meshes[4].material,source);assert.equal(disposed,0);
 geometry.dispose();source.dispose();result.skin?.dispose();result.cloth?.dispose();
});
