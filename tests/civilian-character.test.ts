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

test('residents have distinct silhouettes and head accessories follow the rig and injury visibility',async()=>{
 const {data}=await actualAsset(),heights:number[]=[],widths:number[]=[],accessories=['resident-pompadour','resident-veteran-beard','resident-oversized-cap','resident-showman-hair'];
 for(let n=0;n<4;n++){
  const id=`resident-${n}`,human=createCivilianCharacter(data,id),player=makePlayer(id,'Bewohner','de');player.kind='resident';human.update(player,0,1/60,0);
  human.group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(human.group);heights.push(bounds.max.y-bounds.min.y);widths.push(bounds.max.x-bounds.min.x);
  assert.ok(human.group.userData.nameplateHeight>bounds.max.y,'labels must clear headgear');
  const accessory=human.group.getObjectByName(accessories[n]) as T.Mesh,head=human.group.getObjectByName('Bip01_Head')!;
  assert.ok(accessory);assert.equal(accessory.parent,head);
  const before=accessory.position.clone();player.pitch=.7;human.update(player,1000,1/60,1000);assert.ok(accessory.position.distanceTo(before)<1e-8,'head attachment must remain stable while looking around');
  const anatomy=createAnatomy(human.group);anatomy.setLost(1);assert.equal(accessory.geometry.drawRange.count,0,'headgear must disappear together with the head');
  anatomy.dispose();human.dispose();
 }
 assert.ok(Math.max(...heights)-Math.min(...heights)>.25,'the cast must have visibly different heights');
 assert.ok(Math.max(...widths)-Math.min(...widths)>.1,'the cast must have visibly different builds');
 assert.equal(data.entry.refs,0);
});

test('resident skin and outfit are isolated from the shared source and other instances',async()=>{
 const {data}=await actualAsset(),first=createCivilianCharacter(data,'resident-2'),second=createCivilianCharacter(data);
 const player=makePlayer('resident-2','Bewohner','de');player.kind='resident';first.update(player,0,1/60);
 const head=meshes(first.group).find(m=>(m.material as T.Material).name==='m004_head')!;
 const body=meshes(first.group).find(m=>(m.material as T.Material).name==='m004_body')!;
 assert.ok(head.geometry.getAttribute('color').getX(0)<.5,'darker face must receive its own skin tint');
 const colors=body.geometry.getAttribute('color'),palette=new Set<string>();
 for(let i=0;i<colors.count;i++)palette.add([colors.getX(i),colors.getY(i),colors.getZ(i)].map(v=>v.toFixed(3)).join(','));
 assert.ok(palette.size>3,'hands, jacket, trousers and boots must retain separate colors');
 assert.equal((body.material as T.MeshStandardMaterial).map,null,'the old plaid suit must not show through the new outfit');
 for(const mesh of meshes(data.entry.root))assert.equal(mesh.geometry.getAttribute('color'),undefined,'cached source must stay immutable');
 for(const mesh of meshes(second.group)){const colors=mesh.geometry.getAttribute('color');if(colors)assert.equal(colors.getX(0),1);}
 const anatomy=createAnatomy(first.group),detached=anatomy.detach('head');assert.ok(detached);
 let preserved=false;detached.traverse(o=>{if(o instanceof T.Mesh&&(o.material as T.Material).name==='m004_head')preserved=o.geometry.getAttribute('color').getX(0)<.5;});
 assert.ok(preserved,'detached geometry must retain the resident skin tint');
 detached.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}});
 anatomy.dispose();first.dispose();second.dispose();
});

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
