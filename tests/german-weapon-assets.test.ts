import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {realisticWeapons,realisticWeaponUrl} from '../client/realisticWeapons';

type Primitive={attributes:Record<string,number>;indices?:number};
test('five detailed German weapon assets retain verified attribution, geometry, UVs and PBR textures',()=>{
  const folder='public/shooter/models/realistic/german/';
  const records=JSON.parse(readFileSync(folder+'provenance.json','utf8')) as {file:string;sha256:string;author:string;license:string;source:string;bytes:number}[];
  assert.equal(records.length,5);
  for(const record of records){
    assert.equal(record.license,'CC-BY-4.0');assert.ok(record.author);assert.ok(record.source.startsWith('https://sketchfab.com/'));
    const data=readFileSync(folder+record.file);assert.equal(data.length,record.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),record.sha256);
    assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(8),data.length);
    const doc=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
    assert.ok(doc.images.length>=3);assert.ok(doc.materials.every((m:{pbrMetallicRoughness?:unknown})=>m.pbrMetallicRoughness));
    assert.ok(!doc.extensionsUsed?.includes('KHR_materials_pbrSpecularGlossiness'));
    const triangles=doc.meshes.flatMap((m:{primitives:Primitive[]})=>m.primitives).reduce((n:number,p:Primitive)=>n+(doc.accessors[p.indices??p.attributes.POSITION].count/3),0);
    assert.ok(triangles>2500&&triangles<60000,record.file);
    assert.ok(doc.meshes.every((m:{primitives:Primitive[]})=>m.primitives.every(p=>p.attributes.TEXCOORD_0!==undefined)));
    assert.ok(data.length<16_000_000,record.file);
    if(record.file==='p38.glb')for(const node of doc.nodes)if(node.mesh!==undefined)assert.ok(node.name.startsWith('P38_Mesh'));
    const name=record.file.replace('.glb','') as keyof typeof realisticWeapons;
    assert.equal(realisticWeaponUrl(name),'/shooter/models/realistic/german/'+record.file);
  }
});
