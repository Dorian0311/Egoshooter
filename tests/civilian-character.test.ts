import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createCivilianCharacter,type CivilianCharacterData} from '../client/civilianCharacter';
import {createAnatomy} from '../client/anatomy';
import {makePlayer} from '../shared/game';

async function actualAsset(){
 const bytes=await readFile('public/shooter/characters/civilian/civilian-male.glb'),length=bytes.readUInt32LE(12),document=JSON.parse(bytes.subarray(20,20+length).toString());
 // Node checks the unchanged rig/geometry; independent browser QA loads the textures.
 const original=document.materials;document.materials=original.map((m:{name:string})=>({name:m.name}));
 const encoded=Buffer.from(JSON.stringify(document)),json=Buffer.concat([encoded,Buffer.alloc((4-encoded.length%4)%4,32)]),binary=bytes.subarray(20+length),header=Buffer.alloc(20);
 header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(20+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.write('JSON',16);
 const glb=Buffer.concat([header,json,binary]),{scene}=await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
 return {bytes,document,original,data:{civilian:true,entry:{root:scene,refs:0}} as CivilianCharacterData};
}
const meshes=(root:T.Group)=>{const result:T.SkinnedMesh[]=[];root.traverse(o=>{if(o instanceof T.SkinnedMesh)result.push(o);});return result;};

test('shipped civilian keeps the verified Rocketbox skin, textures and all triangles in three material groups',async()=>{
 const {bytes,document,original,data}=await actualAsset(),manifest=JSON.parse(await readFile('public/shooter/characters/civilian/manifest.json','utf8'));
 assert.equal(manifest.license,'MIT');assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.runtimeAsset.sha256);
 assert.equal(document.meshes.flatMap((m:{primitives:unknown[]})=>m.primitives).length,3);assert.equal(original.length,3);assert.equal(document.images.length,5);
 const sourceMeshes=meshes(data.entry.root);assert.equal(sourceMeshes.reduce((n,m)=>n+(m.geometry.index?.count??0)/3,0),7200);
 for(const mesh of sourceMeshes){assert.equal(mesh.skeleton.bones.length,80);const weights=mesh.geometry.getAttribute('skinWeight'),indices=mesh.geometry.getAttribute('skinIndex');for(let i=0;i<weights.count;i++){let total=0;for(let k=0;k<4;k++){total+=weights.getComponent(i,k);assert.ok(indices.getComponent(i,k)<80);}assert.ok(Math.abs(total-1)<.0001);}}
});

test('native civilian walks, gestures and severs independently without corrupting shared source or another resident',async()=>{
 const {data}=await actualAsset(),first=createCivilianCharacter(data),second=createCivilianCharacter(data),player=makePlayer('resident','Resident','de');
 player.kind='resident';assert.equal(first.group.userData.civilianSource,'Microsoft Rocketbox Male_Adult_03');assert.equal(data.entry.refs,2);
 const firstMesh=meshes(first.group)[0],secondMesh=meshes(second.group)[0];assert.notEqual(firstMesh.geometry,secondMesh.geometry);assert.notEqual(firstMesh.material,secondMesh.material);
 first.group.updateMatrixWorld(true);assert.ok(first.group.getObjectByName('Bip01_L_UpperArm')!.getWorldPosition(new T.Vector3()).x<0,'native model must face the game forward axis');
 const left=first.group.getObjectByName('Bip01_L_Thigh')!,right=first.group.getObjectByName('Bip01_R_Thigh')!,rest=left.quaternion.clone(),feet=['Bip01_L_Foot','Bip01_R_Foot'].map(name=>first.group.getObjectByName(name)!);
 const lowest=()=>Math.min(...feet.map(foot=>foot.getWorldPosition(new T.Vector3()).y)),standingFoot=lowest();first.update(player,0,1/60);
 for(let i=1;i<45;i++){player.z-=.8/60;first.update(player,i*1000/60,1/60);}
 assert.ok(left.quaternion.angleTo(rest)>.015);assert.ok(left.quaternion.angleTo(right.quaternion)>.1);
 first.group.updateMatrixWorld(true);assert.ok(Math.abs(lowest()-standingFoot)<.003,'walking at actual resident speed must keep the standing ankle grounded');
 for(const side of ['L','R']){const middle=first.group.getObjectByName(`Bip01_${side}_Finger2`)!.getWorldPosition(new T.Vector3()),next=first.group.getObjectByName(`Bip01_${side}_Finger21`)!.getWorldPosition(new T.Vector3());assert.ok(next.sub(middle).normalize().y<-.98,'relaxed native hand must point down instead of bending up at the wrist');}
 player.gestureUntil=5000;first.update(player,1000,1/60,1000);first.group.updateMatrixWorld(true);
 const middle=first.group.getObjectByName('Bip01_L_Finger2')!.getWorldPosition(new T.Vector3()),tip=first.group.getObjectByName('Bip01_L_Finger21')!.getWorldPosition(new T.Vector3());assert.ok(tip.sub(middle).normalize().y>.98,'middle finger must point up in the native rig');
 const anatomy=createAnatomy(first.group);anatomy.setLost(0);const count=firstMesh.geometry.drawRange.count,other=secondMesh.geometry.index!.count;
 for(const part of ['head','armL','armR','legL','legR'] as const){const detached=anatomy.detach(part);assert.ok(detached,part+' must retain original textured geometry');detached.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}});}
 anatomy.setLost(2);assert.ok(firstMesh.geometry.drawRange.count<count);assert.equal(secondMesh.geometry.index!.count,other);anatomy.setLost(0);assert.equal(firstMesh.geometry.drawRange.count,count);
 first.setHeadVisible(false);assert.ok(first.group.getObjectByName('Bip01_Head')!.scale.x<.01);first.setHeadVisible(true);assert.ok(first.group.getObjectByName('Bip01_Head')!.scale.x>.9);
 anatomy.dispose();first.dispose();first.dispose();second.dispose();assert.equal(data.entry.refs,0);
});
