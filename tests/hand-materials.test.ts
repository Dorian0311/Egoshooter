import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,ShaderLib,ShaderChunk,type WebGLRenderer} from 'three';
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


test('opaque grip surfaces reuse the standard diffuse sample for spatial roughness',()=>{
 const root=new Group(),geometry=new BoxGeometry(),source=new MeshStandardMaterial();
 for(const name of ['hand-r','view-sleeve-r']){
  const mesh=new Mesh(geometry,source);mesh.name=name;root.add(mesh);
 }
 const {skin,cloth}=applyHandMaterials(root,0x444444);
 for(const material of [skin!,cloth!]){
  const shader={...ShaderLib.standard};
  material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0],{} as WebGLRenderer);
  assert.match(ShaderChunk.map_fragment,/vec4 sampledDiffuseColor = texture2D/);
  assert.ok(shader.fragmentShader.indexOf('#include <map_fragment>')<shader.fragmentShader.indexOf('roughnessFactor+sampledDiffuseColor.a'));
  assert.match(shader.fragmentShader,/diffuseColor.a=opacity/);
  assert.equal(shader.fragmentShader.split('texture2D(').length,ShaderLib.standard.fragmentShader.split('texture2D(').length);
  assert.equal(material.roughnessMap,null);
  assert.equal(material.transparent,false);
  material.dispose();
 }
 geometry.dispose();
});
