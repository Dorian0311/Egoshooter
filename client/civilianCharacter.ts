import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import type {Player} from '../shared/game';
import {hasLost,isCrawling} from '../shared/injuries';
import {createActorEquipment,rigArm} from './actorEquipment';
import {residentSkinTone} from './residentBanter';
import {createResidentAppearance} from './residentAppearance';

type Entry={root:T.Group;refs:number};
export type CivilianCharacterData={civilian:true;entry:Entry};
let source:Promise<Entry>|undefined;
export async function loadCivilianCharacter():Promise<CivilianCharacterData>{
 source??=new GLTFLoader().loadAsync('/shooter/characters/civilian/civilian-male.glb?v=rocketbox-03-1').then(gltf=>({root:gltf.scene,refs:0})).catch(error=>{source=undefined;throw error;});
 return {civilian:true,entry:await source};
}

function styleSkinMaterial(material:T.MeshStandardMaterial,head:boolean){
 material.vertexColors=true;
 if(!head)material.map=null;
 material.needsUpdate=true;
}

/** Match the unskinned vertex-colour variant used by detached clothing. */
export function createCivilianBodyShaderProbe(data:CivilianCharacterData){
 let source:T.MeshStandardMaterial|undefined;
 data.entry.root.traverse(object=>{
  if(source||!(object instanceof T.SkinnedMesh))return;
  const materials=Array.isArray(object.material)?object.material:[object.material];
  source=materials.find((material):material is T.MeshStandardMaterial=>
   material instanceof T.MeshStandardMaterial&&material.name==='m004_body');
 });
 if(!source)return;
 const material=source.clone();
 styleSkinMaterial(material,false);
 const geometry=new T.PlaneGeometry(.01,.01);
 geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(12).fill(1),3));
 geometry.setDrawRange(0,0);
 const probe=new T.Mesh(geometry,material);
 probe.name='civilian-body-shader-warmup';
 probe.frustumCulled=false;
 return probe;
}

/** Native Rocketbox skin: no rigid cuts or replacement mannequin. */
export function createCivilianCharacter(data:CivilianCharacterData,residentId='resident-0',purpose:'actor'|'remains'='actor'){
 const group=new T.Group(),body=clone(data.entry.root);body.rotation.y+=Math.PI;group.add(body);data.entry.refs++;
 group.name='civilian-rocketbox-male-adult-03';group.userData.civilianSource='Microsoft Rocketbox Male_Adult_03';group.userData.civilianModel='rocketbox-male-adult-03';
 group.userData.limbRoots={head:'Bip01_Head',armL:'Bip01_L_UpperArm',armR:'Bip01_R_UpperArm',legL:'Bip01_L_Thigh',legR:'Bip01_R_Thigh'};
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),skeletons=new Set<T.Skeleton>(),geometryCopies=new Map<T.BufferGeometry,T.BufferGeometry>(),materialCopies=new Map<T.Material,T.Material>();
 body.traverse(o=>{if(!(o instanceof T.Mesh))return;
  let geometry=geometryCopies.get(o.geometry);if(!geometry){const copy:T.BufferGeometry=o.geometry.clone();geometryCopies.set(o.geometry,copy);geometries.add(copy);geometry=copy;}o.geometry=geometry;
  const copyMaterial=(m:T.Material)=>{let copy=materialCopies.get(m);if(!copy){copy=m.clone();materialCopies.set(m,copy);materials.add(copy);}return copy;};
  o.material=Array.isArray(o.material)?o.material.map(copyMaterial):copyMaterial(o.material);o.castShadow=o.receiveShadow=true;
  // The original scalp is textured. Legacy opaque hair cards create black
  // zebra strips; omit only that overlay, also from severed-head extraction.
  if((Array.isArray(o.material)?o.material:[o.material]).every(m=>m.name==='m004_opacity')){o.userData.nonAnatomic=true;for(const m of Array.isArray(o.material)?o.material:[o.material])m.visible=false;}
  if(o instanceof T.SkinnedMesh){skeletons.add(o.skeleton);o.frustumCulled=false;}
 });
 const appearance=createResidentAppearance(group,body,residentId);
 group.updateMatrixWorld(true);
 const right=new T.Vector3(1,0,0),q=new T.Quaternion(),rotation=new T.Quaternion(),world=new T.Quaternion(),parent=new T.Quaternion(),from=new T.Vector3(),to=new T.Vector3();
 const animated=['Bip01_L_Thigh','Bip01_R_Thigh','Bip01_L_Calf','Bip01_R_Calf','Bip01_L_Foot','Bip01_R_Foot','Bip01_Head'].map(name=>{
  const bone=group.getObjectByName(name);if(!bone)return undefined;
  return {bone,rest:bone.quaternion.clone(),axis:right.clone().applyQuaternion(bone.getWorldQuaternion(q).invert()).normalize(),side:name.includes('_R_')?-1:1,kind:name.endsWith('Thigh')?'thigh':name.endsWith('Calf')?'calf':name.endsWith('Foot')?'foot':'head'};
 }).filter((part):part is NonNullable<typeof part>=>!!part);
 const head=group.getObjectByName('Bip01_Head'),headScale=head?.scale.clone(),baseY=body.position.y;
 const feet=['Bip01_L_Foot','Bip01_R_Foot'].map(name=>group.getObjectByName(name)).filter((foot):foot is T.Object3D=>!!foot),footGround=Math.min(...feet.map(foot=>group.worldToLocal(foot.getWorldPosition(new T.Vector3())).y));
 const arms={armL:rigArm(group,['Bip01_L_UpperArm','Bip01_L_Forearm','Bip01_L_Hand']),armR:rigArm(group,['Bip01_R_UpperArm','Bip01_R_Forearm','Bip01_R_Hand'])};
 const held=createActorEquipment(group,arms,true,false,purpose==='actor');
 const fingers:{bone:T.Object3D;relaxed:T.Quaternion;gesture:T.Quaternion;side:'armL'|'armR'}[]=[];
 for(const side of ['L','R'] as const){const index=group.getObjectByName(`Bip01_${side}_Finger1`),pinky=group.getObjectByName(`Bip01_${side}_Finger4`);if(!index||!pinky)continue;
  const across=index.getWorldPosition(new T.Vector3()).sub(pinky.getWorldPosition(new T.Vector3())).normalize();
  const fingerName=new RegExp(`^Bip01_${side}_Finger([0-4])([12]?)$`);
  group.traverse(bone=>{
   const match=bone.name.match(fingerName);if(!match)return;
   const digit=Number(match[1]),joint=Number(match[2]||0);
   const axis=across.clone().applyQuaternion(bone.getWorldQuaternion(q).invert()).normalize();
   const relaxedAngle=digit===0?.08:joint===0?.12:.18;
   const gestureAngle=digit===2?0:digit===0?.65:joint===1?1.3:.9;
   fingers.push({bone,side:side==='L'?'armL':'armR',
    relaxed:bone.quaternion.clone().multiply(rotation.setFromAxisAngle(axis,relaxedAngle)),
    gesture:bone.quaternion.clone().multiply(rotation.setFromAxisAngle(axis,gestureAngle))});
  });
 }
 function handJoints(suffix:'L'|'R'){
  const finger=(index:string)=>group.getObjectByName(`Bip01_${suffix}_Finger${index}`);
  const middle=finger('2'),next=finger('21');
  return {middle,next,index:finger('1'),pinky:finger('4'),straighten:[middle,next].map(bone=>({bone,child:bone?.children.find(o=>o instanceof T.Bone)}))};
 }
 const fingerJoints={armL:handJoints('L'),armR:handJoints('R')};
 const fingerTip=new T.Vector3(),fingerBase=new T.Vector3();
 function fingerDirection(base:T.Object3D,tip:T.Object3D){
  tip.getWorldPosition(fingerTip);
  // A direct child's world-position query has just updated its parent.
  if(tip.parent===base)fingerBase.setFromMatrixPosition(base.matrixWorld);
  else base.getWorldPosition(fingerBase);
  return from.subVectors(fingerTip,fingerBase);
 }
 const decompositionPosition=new T.Vector3(),decompositionScale=new T.Vector3();
 function rotateInWorld(bone:T.Object3D){
  bone.getWorldQuaternion(world); // Also updates every ancestor's matrixWorld.
  bone.parent!.matrixWorld.decompose(decompositionPosition,parent,decompositionScale);
  bone.quaternion.copy(parent.invert().multiply(rotation).multiply(world));
  bone.updateWorldMatrix(false,true);
 }
 function align(bone:T.Object3D,current:T.Vector3,desired:T.Vector3){if(current.lengthSq()<1e-9||desired.lengthSq()<1e-9)return;rotation.setFromUnitVectors(current.normalize(),desired.normalize());rotateInWorld(bone);}
 function gesture(side:'armL'|'armR'){
  const arm=arms[side];if(!arm)return;const {middle,next,index,pinky,straighten}=fingerJoints[side];if(!middle||!next||!index||!pinky)return;
  const up=new T.Vector3(0,1,0).applyQuaternion(group.getWorldQuaternion(q)),forward=new T.Vector3(0,0,-1).applyQuaternion(q);
  align(arm.hand,fingerDirection(middle,next),to.copy(up));
  const across=index.getWorldPosition(new T.Vector3()).sub(pinky.getWorldPosition(new T.Vector3())),normal=across.cross(up).normalize();
  if(side==='armR')normal.negate();const angle=Math.atan2(up.dot(normal.clone().cross(forward)),normal.dot(forward));rotation.setFromAxisAngle(up,angle);rotateInWorld(arm.hand);
  for(const {bone,child} of straighten){if(bone&&child)align(bone,fingerDirection(bone,child),to.copy(up));}
 }
 function relaxedHand(side:'armL'|'armR'){
  const arm=arms[side];if(!arm)return;const {middle,next}=fingerJoints[side];if(!middle||!next)return;
  to.set(0,-1,0).applyQuaternion(group.getWorldQuaternion(q));align(arm.hand,fingerDirection(middle,next),to);
 }
 const skinMeshes:{mesh:T.SkinnedMesh;weights:Float32Array;clothes:Uint8Array;head:boolean}[]=[];
 body.traverse(o=>{
  if(!(o instanceof T.SkinnedMesh))return;
  const meshMaterials=Array.isArray(o.material)?o.material:[o.material];
  if(!meshMaterials.some(m=>m.name==='m004_head'||m.name==='m004_body'))return;
  const indices=o.geometry.getAttribute('skinIndex'),influences=o.geometry.getAttribute('skinWeight'),weights=new Float32Array(indices.count),clothes=new Uint8Array(indices.count);
  const head=meshMaterials.some(m=>m.name==='m004_head');
  for(let i=0;i<weights.length;i++){
   if(head){weights[i]=1;continue;}
   let legs=0,feet=0;
   for(let k=0;k<4;k++){const name=o.skeleton.bones[indices.getComponent(i,k)]?.name??'',weight=influences.getComponent(i,k);if(/^Bip01_[LR]_(Hand|Finger)/.test(name))weights[i]+=weight;if(/(Thigh|Calf|Foot|Toe)/.test(name))legs+=weight;if(/(Foot|Toe)/.test(name))feet+=weight;}
   clothes[i]=feet>.5?2:legs>.5?1:0;
  }
  for(const material of meshMaterials)if(material instanceof T.MeshStandardMaterial)styleSkinMaterial(material,head);
  o.geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(weights.length*3).fill(1),3));skinMeshes.push({mesh:o,weights,clothes,head});
 });
 const skinColor=new T.Color(),handColor=new T.Color(),vertexColor=new T.Color(),baseSkin=new T.Color('#e2c2aa'),clothColors=[appearance.jacket,appearance.trousers,appearance.boots];let appearanceId='';
 function style(id:string){
  if(id===appearanceId)return;appearanceId=id;skinColor.set(residentSkinTone(id));handColor.copy(skinColor).multiply(baseSkin);
  for(const {mesh,weights,clothes,head}of skinMeshes){const colors=mesh.geometry.getAttribute('color');for(let i=0;i<weights.length;i++){if(head)vertexColor.copy(skinColor);else vertexColor.copy(clothColors[clothes[i]]).lerp(handColor,Math.min(1,weights[i]));colors.setXYZ(i,vertexColor.r,vertexColor.g,vertexColor.b);}colors.needsUpdate=true;}
 }
 style(residentId);
 const footPoint=new T.Vector3(),worldToRig=new T.Matrix4();
 let disposed=false,initialized=false,lastX=0,lastZ=0,speed=0,phase=0;
 return {group,
  update(player:Player,time:number,dt:number,now=time){
   if(disposed)return;style(player.id);const step=T.MathUtils.clamp(dt,.001,.1),distance=initialized?Math.hypot(player.x-lastX,player.z-lastZ):0;
   initialized=true;lastX=player.x;lastZ=player.z;const movement=player.hp>0?Math.min(1.4,distance/step/.9):0;speed+=(movement-speed)*(1-Math.exp(-step*12));phase+=step*6*speed;
   const walk=Math.sin(phase)*.36*speed;body.position.y=baseY+(player.hp>0?Math.abs(Math.sin(phase))*.012*speed:0);
   for(const part of animated){const angle=part.kind==='head'?-player.pitch*.35:part.kind==='thigh'?walk*part.side:part.kind==='calf'?-Math.max(0,-Math.sin(phase+part.side*Math.PI/2))*.55*speed:Math.sin(phase)*part.side*.07*speed;part.bone.quaternion.copy(part.rest).multiply(rotation.setFromAxisAngle(part.axis,angle));}
   if(player.hp>0&&!isCrawling(player)&&feet.length){
    // Both feet share the same rig transform. Each foot refreshes its animated leg chain.
    group.updateWorldMatrix(true,false);
    worldToRig.copy(group.matrixWorld).invert();
    let lowest=Infinity;
    for(const foot of feet)lowest=Math.min(lowest,foot.getWorldPosition(footPoint).applyMatrix4(worldToRig).y);
    // Hand posing refreshes the chains it reads. The render traversal updates the full rig.
    body.position.y+=footGround-lowest;
   }
   const gesturing=player.hp>0&&player.gestureUntil>now&&!isCrawling(player),gestureSide=hasLost(player,'armL')?'armR':'armL';
   for(const finger of fingers)finger.bone.quaternion.copy(gesturing&&finger.side===gestureSide?finger.gesture:finger.relaxed);
   held.update(player,time,now);for(const side of ['armL','armR'] as const)if(!hasLost(player,side)&&(!gesturing||side!==gestureSide))relaxedHand(side);if(gesturing&&!hasLost(player,gestureSide))gesture(gestureSide);
  },
  setHeadVisible(visible:boolean){if(head&&headScale)head.scale.copy(headScale).multiplyScalar(visible?1:.001);},
  dispose(){if(disposed)return;disposed=true;held.dispose();appearance.dispose();group.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());data.entry.refs--;},
 };
 // The single immutable source stays cached; all mutable instance geometry,
 // materials and skeletons above are released. Textures are shared by residents.
}
