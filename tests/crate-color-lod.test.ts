import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {crateColorLod,type CrateIndexAsset} from '../client/crateColorLod';
import {instanceStaticModel} from '../client/scenery';

test('scanned crate LOD uses the recorded original vertex streams and shader materials, per visible stack',()=>{
 const base=new URL('../public/shooter/models/wooden_military_crate/',import.meta.url);
 const spec=JSON.parse(readFileSync(new URL('asset.gltf',base),'utf8'));
 const bytes=readFileSync(new URL(spec.buffers[0].uri,base));
 const asset=JSON.parse(readFileSync(new URL('distance-indices.json',base),'utf8')) as CrateIndexAsset&{sourceSha256:string};
 assert.equal(asset.sourceSha256,createHash('sha256').update(bytes).digest('hex'));
 const source=new T.Group(),color=new T.Group(),material=new T.MeshStandardMaterial(),lod=crateColorLod();
 let fullTriangles=0,distantTriangles=0;
 for(const node of spec.nodes){
  const primitive=spec.meshes[node.mesh].primitives[0],g=new T.BufferGeometry();
  for(const [glName,threeName,size] of [['POSITION','position',3],['NORMAL','normal',3],['TEXCOORD_0','uv',2]] as const){
   const a=spec.accessors[primitive.attributes[glName]],v=spec.bufferViews[a.bufferView];
   g.setAttribute(threeName,new T.BufferAttribute(new Float32Array(bytes.buffer,bytes.byteOffset+(v.byteOffset??0)+(a.byteOffset??0),a.count*size),size));
  }
  const a=spec.accessors[primitive.indices],v=spec.bufferViews[a.bufferView];
  g.setIndex(new T.BufferAttribute(new Uint16Array(bytes.buffer,bytes.byteOffset+(v.byteOffset??0)+(a.byteOffset??0),a.count),1));
  const part=new T.Mesh(g,material);part.name=node.name;source.add(part);
  fullTriangles+=g.index!.count/3;distantTriangles+=asset.meshes[node.name].indices.length/3;
 }
 assert.equal(fullTriangles,22986);assert.ok(distantTriangles<fullTriangles*.19);
 for(const x of [0,50]){
  const first=color.children.length;
  instanceStaticModel(color,source,[new T.Matrix4().makeTranslation(x,0,0)]);
  lod.register(color.children.slice(first));
 }
 const camera=new T.PerspectiveCamera(),meshes=color.children as T.InstancedMesh[],original=meshes.map(m=>m.geometry);
 lod.load(source,asset);camera.updateMatrixWorld();lod.update(camera,true,false);
 for(const [i,m] of meshes.entries()){
  assert.equal(m.material,material);assert.equal(m.geometry.getAttribute('uv'),original[i].getAttribute('uv'));
  assert.equal(m.geometry.getAttribute('normal'),original[i].getAttribute('normal'));
  assert.equal(m.geometry.getAttribute('position'),original[i].getAttribute('position'));
  if(i<3)assert.equal(m.geometry,original[i]);else assert.ok(m.geometry.index!.count<original[i].index!.count);
 }
 for(const [compact,aimed] of [[true,true],[false,false]]){
  lod.update(camera,compact,aimed);meshes.forEach((m,i)=>assert.equal(m.geometry,original[i]));
 }
 lod.dispose();meshes.forEach(m=>m.dispose());source.children.forEach(m=>(m as T.Mesh).geometry.dispose());material.dispose();
});
