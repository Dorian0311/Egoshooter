// Regenerate the distance indices without duplicating vertex positions, UVs or normals.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MeshoptSimplifier} from 'meshoptimizer';

const root=new URL('../public/shooter/models/wooden_military_crate/',import.meta.url);
const asset=JSON.parse(await fs.readFile(new URL('asset.gltf',root),'utf8'));
const binary=await fs.readFile(new URL(asset.buffers[0].uri,root));
function stream(index,Type,size){
 const a=asset.accessors[index],v=asset.bufferViews[a.bufferView];
 if(v.byteStride&&v.byteStride!==size*Type.BYTES_PER_ELEMENT)throw new Error('Unexpected vertex stride');
 return new Type(binary.buffer,binary.byteOffset+(v.byteOffset??0)+(a.byteOffset??0),a.count*size);
}
await MeshoptSimplifier.ready;
const meshes={};
for(const node of asset.nodes){
 const primitive=asset.meshes[node.mesh].primitives[0];
 const pos=stream(primitive.attributes.POSITION,Float32Array,3);
 const full=stream(primitive.indices,Uint16Array,1);
 const [reduced,error]=MeshoptSimplifier.simplify(Uint32Array.from(full),pos,3,Math.ceil(full.length*.037/3)*3,.012);
 meshes[node.name]={vertices:pos.length/3,full:full.length,indices:Array.from(reduced)};
 console.log(node.name,full.length/3,'to',reduced.length/3,'triangles; relative error',error.toFixed(5));
}
await fs.writeFile(new URL('distance-indices.json',root),JSON.stringify({sourceSha256:createHash('sha256').update(binary).digest('hex'),meshes})+'\n');
