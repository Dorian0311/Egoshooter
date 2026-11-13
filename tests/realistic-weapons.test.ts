import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {prepareRealisticWeapon,realisticWeapons,type RealisticWeapon} from '../client/realisticWeapons';

test('downloaded weapons are self-contained, attributed and match recorded hashes',async()=>{
 const folder='public/shooter/models/realistic/';
 const records=JSON.parse(await readFile(folder+'provenance.json','utf8'));
 assert.equal(records.length,Object.keys(realisticWeapons).length);
 for(const record of records){
  const data=await readFile(folder+record.file);
  assert.equal(createHash('sha256').update(data).digest('hex'),record.sha256,record.file);
  assert.equal(record.license,'CC-BY-4.0');assert.ok(record.author&&record.source&&record.modifications);
  assert.equal(data.readUInt32LE(8),data.length);
  const doc=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
  assert.ok(doc.images.length>0,record.file);
  assert.ok(doc.images.every((image:{bufferView?:number;uri?:string})=>Number.isInteger(image.bufferView)&&!image.uri));
  assert.ok(doc.buffers.every((buffer:{uri?:string})=>!buffer.uri));
 }
});

test('all five imported weapons mount at metre scale, forward and at their muzzle socket',async()=>{
 for(const name of Object.keys(realisticWeapons) as RealisticWeapon[]){
  const data=await readFile('public/shooter/models/realistic/'+name+'.glb');
  const originalLength=data.readUInt32LE(12),doc=JSON.parse(data.subarray(20,20+originalLength).toString());
  // Geometry QA in Node: omit image references without changing any accessors,
  // source transforms or geometry. Browser QA separately exercises real textures.
  doc.materials=doc.materials.map((m:{name:string})=>({name:m.name}));
  const json=Buffer.from(JSON.stringify(doc)),padding=Buffer.alloc((4-json.length%4)%4,32);
  const jsonChunk=Buffer.concat([json,padding]),binaryChunk=data.subarray(20+originalLength);
  const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(20+jsonChunk.length+binaryChunk.length,8);header.writeUInt32LE(jsonChunk.length,12);header.write('JSON',16);
  const glb=Buffer.concat([header,jsonChunk,binaryChunk]);
  const {scene}=await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
  const mount=prepareRealisticWeapon(scene,name),bounds=new T.Box3().setFromObject(mount),config=realisticWeapons[name];
  mount.traverse(object=>assert.ok(!(object instanceof T.SkinnedMesh),name+' must follow the camera as a rigid weapon'));
  assert.ok(Math.abs(bounds.max.z-bounds.min.z-config.length)<1e-5,name+' length');
  assert.ok(Math.abs(bounds.max.z-config.muzzle[2])<1e-5,name+' muzzle');
  assert.ok(Math.abs(bounds.max.y-config.top)<1e-5,name+' height');
  assert.ok(Math.abs((bounds.min.x+bounds.max.x)/2)<1e-5,name+' centering');
  if(name==='kar98k')assert.equal(mount.getObjectByName('Object_6'),undefined);
 }
});
