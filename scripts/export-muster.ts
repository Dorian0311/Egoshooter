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
for(const [id,build] of [['kar98k',buildKar98k],['mp40',buildMp40],['m1-garand',buildM1Garand],['thompson',buildThompsonM1A1]] as const){const w=build();const skin=new MeshStandardMaterial({color:0xb29680,roughness:.83});for(const side of ['r','l'] as const){const grip=side==='r'?w.grips.trigger:w.grips.support;const direction=new Vector3(side==='r'?-.2:.2,-.5,-1).normalize();const hand=gripHand(grip,side,skin,{forearm:direction,index:side==='r'?'trigger':'wrap'});w.object.add(hand.mesh);const sleeve=new Mesh(new CylinderGeometry(.06,.034,.5,20,6),new MeshStandardMaterial({color:id==='kar98k'||id==='mp40'?0x292d30:0x62624b,roughness:.95}));sleeve.quaternion.setFromUnitVectors(new Vector3(0,1,0),direction);sleeve.position.copy(hand.frame.o).addScaledVector(direction,.29);sleeve.name='view-sleeve-'+side;w.object.add(sleeve);}w.object.userData={muzzle:w.muzzle.toArray(),support:w.grips.support.position.toArray()};await save(id,w.object);}

if(process.argv.includes("--figures")){await save("de-m40",buildInfantry("squad-leader",{headgear:"helmet",pack:false,gasmask:true,breadbag:true,shovel:true,grenade:false}).object);await save("us-m41",buildUSSoldier("squad-leader",{haversack:false},{detail:"high"}));}
