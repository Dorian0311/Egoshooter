import {buildM40Helmet} from '../research/muster-src/src/assets/germany/gear/helmet.ts';
import {gripHand} from '../research/muster-src/src/assets/shared/human/hands.ts';
import {MeshStandardMaterial,Vector3,Mesh,CylinderGeometry} from 'three';
import {buildInfantry} from '../research/muster-src/src/assets/germany/infantry/soldier.ts';
import {buildUSSoldier} from '../research/muster-src/src/assets/usa/infantry/soldier.ts';
import {writeFile,mkdir} from 'node:fs/promises';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {buildKar98k} from '../research/muster-src/src/assets/germany/weapons/kar98k.model.ts';
import {buildMp40} from '../research/muster-src/src/assets/germany/weapons/mp40.model.ts';
import {buildM1Garand} from '../research/muster-src/src/assets/usa/weapons/m1-garand.model.ts';
import {buildThompsonM1A1} from '../research/muster-src/src/assets/usa/weapons/thompson-m1a1.model.ts';
import type {Object3D,Mesh,Material} from 'three';
// GLTFExporter uses FileReader for binary buffers; no browser/canvas is needed for these meshes.
(globalThis as any).FileReader=class {result:unknown;onloadend?:()=>void;async readAsArrayBuffer(b:Blob){this.result=await b.arrayBuffer();this.onloadend?.();}async readAsDataURL(b:Blob){this.result='data:application/octet-stream;base64,'+Buffer.from(await b.arrayBuffer()).toString('base64');this.onloadend?.();}};
await mkdir('public/shooter/models',{recursive:true});
async function save(id:string,object:Object3D){
 let triangles=0;const mats=new Set<Material>();
 object.traverse(o=>{const m=o as Mesh;if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>mats.add(x));});
 for(const m of mats){const p=m.userData.surface?.params;m.userData=p?{surfaceParams:p}:{};}
 const binary=await new GLTFExporter().parseAsync(object,{binary:true});
 await writeFile('public/shooter/models/'+id+'.glb',Buffer.from(binary as ArrayBuffer));
 console.log(id,Math.round(triangles),'triangles', (binary as ArrayBuffer).byteLength,'bytes');
}
const helmet=buildM40Helmet({chinstrap:'none',detail:'high'});await save('m40-helmet',helmet.object);
