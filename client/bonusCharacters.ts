import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import type {Player} from '../shared/game';

export const bonusIds=['deadpool','harley','rocket','homer','leatherface','commander'] as const;
export type BonusId=typeof bonusIds[number];
export function isBonusId(value:string):value is BonusId{return (bonusIds as readonly string[]).includes(value);}
type Entry={root:T.Group;refs:number};
export type BonusCharacterData={character:BonusId;entry:Entry};
const cache=new Map<BonusId,Promise<Entry>>();
export async function loadBonusCharacter(character:BonusId):Promise<BonusCharacterData>{
 let pending=cache.get(character);
 if(!pending){pending=new GLTFLoader().loadAsync(`/shooter/characters/bonus/${character}.glb`).then(gltf=>({root:gltf.scene,refs:0})).catch(error=>{cache.delete(character);throw error;});cache.set(character,pending);}
 return {character,entry:await pending};
}

const joints:Record<BonusId,{upper:string[];lower:string[];arms:string[];head:string}>= {
 deadpool:{upper:['UN_j_L__Leg_00','UN_j_R__Leg_00'],lower:['UN_j_L__Leg_05','UN_j_R__Leg_05'],arms:['UN_j_L__Arm_00','UN_j_R__Arm_00'],head:'UN_j_Neck_01'},
 harley:{upper:['thigh_stretchl','thigh_stretchr'],lower:['leg_stretchl','leg_stretchr'],arms:['arm_stretchl','arm_stretchr'],head:'headx'},
 rocket:{upper:['Bip001-L-Thigh','Bip001-R-Thigh'],lower:['Bip001-L-Calf','Bip001-R-Calf'],arms:['Bip001-L-UpperArm','Bip001-R-UpperArm'],head:'Bip001-Head'},
 commander:{upper:[],lower:[],arms:[],head:''},
 leatherface:{upper:[],lower:[],arms:[],head:''},
 homer:{upper:['Hip_L','Hip_R'],lower:['Knee_L','Knee_R'],arms:['Shoulder_L','Shoulder_R'],head:'Head'},
};

export function createBonusCharacter(data:BonusCharacterData){
 const group=new T.Group(),body=clone(data.entry.root);group.add(body);data.entry.refs++;
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),skeletons=new Set<T.Skeleton>();
 const clonedGeometry=new Map<T.BufferGeometry,T.BufferGeometry>(),clonedMaterial=new Map<T.Material,T.Material>();
 const bones:T.Bone[]=[];
 body.traverse(o=>{
  if(o instanceof T.Bone)bones.push(o);
  if(!(o instanceof T.Mesh))return;
  let geometry=clonedGeometry.get(o.geometry);if(!geometry){const copy:T.BufferGeometry=o.geometry.clone();clonedGeometry.set(o.geometry,copy);geometries.add(copy);geometry=copy;}o.geometry=geometry;
  const material=(m:T.Material)=>{let copy=clonedMaterial.get(m);if(!copy){copy=m.clone();clonedMaterial.set(m,copy);materials.add(copy);}return copy;};
  o.material=Array.isArray(o.material)?o.material.map(material):material(o.material);
  o.castShadow=true;o.receiveShadow=true;
  if(o instanceof T.SkinnedMesh){skeletons.add(o.skeleton);o.frustumCulled=false;}
 });
 group.updateMatrixWorld(true);
 if(data.character==='harley'){
  // FBX exported constraint-driven deform bones as siblings. Rebuild FK chains
  // while preserving bind-world transforms, so limbs move as coherent units.
  for(const side of ['l','r'])for(const [parent,child]of [
   ['arm_stretch','forearm_stretch'],['forearm_stretch','hand'],['arm_stretch','c_arm_twist_offset'],
   ['thigh_stretch','leg_stretch'],['leg_stretch','foot'],['thigh_stretch','thigh_twist']]){
   const p=bones.find(b=>b.name===parent+side),c=bones.find(b=>b.name===child+side);
   if(p&&c&&p!==c){p.attach(c);group.updateMatrixWorld(true);}
  }
 }
 const config=joints[data.character],parentQ=new T.Quaternion(),worldQ=new T.Quaternion(),delta=new T.Quaternion(),direction=new T.Vector3(),target=new T.Vector3();
 // Lower source T-pose arms into a neutral ready stance before recording rest rotations.
 for(const bone of bones){const side=config.arms.indexOf(bone.name);if(side<0)continue;
  const forearm=data.character==='rocket'?bones.find(b=>b.name===bone.name.replace('UpperArm','Forearm')):undefined;
  const child=forearm??bone.children.find(c=>c instanceof T.Bone);if(!child)continue;
  direction.copy(child.getWorldPosition(new T.Vector3())).sub(bone.getWorldPosition(new T.Vector3())).normalize();
  target.set(Math.sign(bone.getWorldPosition(new T.Vector3()).x)*.3,-.85,-.35).normalize();delta.setFromUnitVectors(direction,target);
  bone.getWorldQuaternion(worldQ);bone.parent!.getWorldQuaternion(parentQ).invert();
  bone.quaternion.copy(parentQ.multiply(delta).multiply(worldQ));group.updateMatrixWorld(true);
 }
 const animated=bones.filter(b=>config.upper.includes(b.name)||config.lower.includes(b.name)||b.name===config.head).map(b=>{
  b.getWorldQuaternion(worldQ).invert();return {bone:b,rest:b.quaternion.clone(),axis:new T.Vector3(1,0,0).applyQuaternion(worldQ).normalize(),upper:config.upper.indexOf(b.name),lower:config.lower.indexOf(b.name),head:b.name===config.head};
 });
 const heads=bones.filter(b=>b.name===config.head),rotation=new T.Quaternion();
 // Static bonus models have no head bone. Clip their upper head in model space.
 const headCut=new T.Plane(new T.Vector3(0,-1,0),1.44),worldHeadCut=new T.Plane();
 let headVisible=true;
 let disposed=false,initialized=false,previousX=0,previousZ=0,speed=0,phase=0;
 return {
  group,
  update(player:Player,_time:number,dt:number){
   if(disposed)return;
   if(!headVisible&&!heads.length){group.updateWorldMatrix(true,false);worldHeadCut.copy(headCut).applyMatrix4(group.matrixWorld);}
   const step=Math.min(.1,Math.max(.001,dt));
   const movement=initialized?Math.min(1,Math.hypot(player.x-previousX,player.z-previousZ)/step/4):0;
   initialized=true;previousX=player.x;previousZ=player.z;speed+=(movement-speed)*(1-Math.exp(-step*12));phase+=step*9*speed;
   const walk=Math.sin(phase)*.38*speed;
   if((data.character==='leatherface'||data.character==='commander')){body.position.y=Math.abs(Math.sin(phase))*.018*speed;body.rotation.z=Math.sin(phase)*.012*speed;}
   for(const part of animated){let angle=0;
    if(part.upper>=0)angle=walk*(part.upper===0?1:-1);
    if(part.lower>=0)angle=Math.max(0,-walk*(part.lower===0?1:-1))*.8;
    if(part.head)angle=-player.pitch*.35;
    part.bone.quaternion.copy(part.rest).multiply(rotation.setFromAxisAngle(part.axis,angle));
   }
  },
  setHeadVisible(visible:boolean){
   for(const head of heads)head.scale.setScalar(visible?1:.001);
   if(headVisible!==visible&&!heads.length){for(const material of materials){material.clippingPlanes=visible?null:[worldHeadCut];material.clipShadows=true;material.needsUpdate=true;}}
   headVisible=visible;
  },
  dispose(){
   if(disposed)return;disposed=true;group.remove(body);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());
   if(--data.entry.refs===0){
    cache.delete(data.character);const textures=new Set<T.Texture>(),sourceGeometry=new Set<T.BufferGeometry>(),sourceMaterials=new Set<T.Material>();
    data.entry.root.traverse(o=>{if(!(o instanceof T.Mesh))return;sourceGeometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){sourceMaterials.add(m);for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);}});
    textures.forEach(t=>t.dispose());sourceGeometry.forEach(g=>g.dispose());sourceMaterials.forEach(m=>m.dispose());
   }
  },
 };
}
