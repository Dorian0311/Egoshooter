// Rebuild the skinned body distance indices with the project's meshoptimizer.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MeshoptSimplifier} from 'meshoptimizer';

const root=new URL('../public/shooter/characters/',import.meta.url);
const source=await fs.readFile(new URL('humanoid.json',root)),body=JSON.parse(source);
const positions=Float32Array.from(body.positions),groups=[new Map(),new Map()];
function dominantBone(vertex){
 let best=0;
 for(let slot=1;slot<4;slot++)if(body.skinWeight[vertex*4+slot]>body.skinWeight[vertex*4+best])best=slot;
 return body.skinIndex[vertex*4+best];
}
for(let i=0;i<body.indices.length;i+=3){
 const tri=body.indices.slice(i,i+3);
 const labels=tri.map(v=>body.categories[v]);
 const material=labels.filter(n=>n===1).length>=2?1:labels.filter(n=>n===2).length>=2?2:0;
 if(material===2)continue;
 // Pin all triangle boundaries between distinct dominant joints, including each
 // finger and eyelid, so a collapse cannot cross from one moving limb to another.
 const bones=tri.map(dominantBone).sort((a,b)=>a-b);
 const key=bones.join('/');
 if(!groups[material].has(key))groups[material].set(key,[]);
 groups[material].get(key).push(...tri);
}
await MeshoptSimplifier.ready;
const output=[];
for(const groupsByBone of groups){
 const indices=[];let original=0;
 for(const source of groupsByBone.values()){
  const index=Uint32Array.from(source);
  const [reduced]=MeshoptSimplifier.simplify(index,positions,3,Math.max(3,Math.ceil(index.length*.16/3)*3),.004,['LockBorder']);
  original+=index.length;indices.push(...reduced);
 }
 output.push({original,indices});
 console.log(original/3,'to',indices.length/3,'triangles');
}
// Source digest, four little-endian index counts, then the two Uint16 index lists.
const header=Buffer.alloc(48);
createHash('sha256').update(source).digest().copy(header);
const indices=Buffer.alloc(output.reduce((sum,g)=>sum+g.indices.length,0)*2);
let cursor=0;
for(const [i,g] of output.entries()){
 header.writeUInt32LE(g.original,32+i*8);header.writeUInt32LE(g.indices.length,36+i*8);
 for(const vertex of g.indices){if(vertex>65535)throw Error('Unexpected body vertex count');indices.writeUInt16LE(vertex,cursor);cursor+=2;}
}
await fs.writeFile(new URL('humanoid-distance.bin',root),Buffer.concat([header,indices]));
