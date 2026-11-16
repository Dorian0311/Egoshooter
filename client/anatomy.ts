import * as T from 'three';
import {limbBits,type BodyPart} from '../shared/injuries';
type Partition={mesh:T.Mesh;indices:Uint32Array;parts:BodyPart[];groups:{start:number;count:number;materialIndex:number}[]};
const severable:BodyPart[]=['head','armL','armR','legL','legR'];
const anchors:Record<string,[number,number,number]>={head:[0,1.53,0],armL:[-.23,1.4,0],armR:[.23,1.4,0],legL:[-.1,.86,0],legR:[.1,.86,0]};
const standardRoots={head:'head',armL:'upperarm01.L',armR:'upperarm01.R',legL:'upperleg01.L',legR:'upperleg01.R'};
/** Partition only this instance's triangles. Bone scales never collapse attached skin into spikes. */
export function createAnatomy(root:T.Group){
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),v=new T.Vector3(),partitions:Partition[]=[],caps=new Map<BodyPart,T.Group>();
 const roots={...standardRoots,...root.userData.limbRoots} as Record<string,string>;
 const bonePart=(bone:T.Bone|undefined):BodyPart|undefined=>{for(let b:T.Object3D|undefined=bone;b&&b!==root;b=b.parent??undefined)for(const part of severable)if(b.name===roots[part])return part;};
 const classify=(mesh:T.Mesh,index:number):BodyPart=>{
  if(mesh.userData.bodyPart)return mesh.userData.bodyPart as BodyPart;
  mesh.getVertexPosition(index,v);v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
  if(Math.abs(v.x)<.19&&v.y>.9&&v.y<1.5)return 'body';
  if(mesh instanceof T.SkinnedMesh){const skin=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');if(skin&&weights){const scores=new Map<BodyPart,number>();for(let n=0;n<4;n++){const part=bonePart(mesh.skeleton.bones[skin.getComponent(index,n)]);if(part)scores.set(part,(scores.get(part)??0)+weights.getComponent(index,n));}const best=[...scores].sort((a,b)=>b[1]-a[1])[0];if(best&&best[1]>.35)return best[0];}}
  mesh.getVertexPosition(index,v);v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
  for(let p:T.Object3D|null=mesh.parent;p&&p!==root;p=p.parent)if(p instanceof T.Bone){const part=bonePart(p);if(part)return part;}
  if(v.y>1.53)return 'head';if(Math.abs(v.x)>.25&&v.y>.65)return v.x<0?'armL':'armR';if(v.y<.86&&Math.abs(v.x)>.025)return v.x<0?'legL':'legR';return 'body';
 };
 root.traverse(o=>{if(!(o instanceof T.Mesh)||!o.geometry.getAttribute('position'))return;const geometry=o.geometry,source=geometry.index?.array??Array.from({length:geometry.getAttribute('position').count},(_,n)=>n),indices=Uint32Array.from(source),parts:BodyPart[]=[];
  for(let n=0;n<indices.length;n+=3){const labels=[0,1,2].map(i=>classify(o,indices[n+i]));parts.push(labels.find(part=>labels.filter(p=>p===part).length>=2)??'body');}
  partitions.push({mesh:o,indices,parts,groups:geometry.groups.length?geometry.groups.map((g:{start:number;count:number;materialIndex?:number})=>({start:g.start,count:g.count,materialIndex:g.materialIndex??0})):[{start:0,count:indices.length,materialIndex:0}]});
 });
 const woundMaterial=new T.MeshStandardMaterial({color:'#57101a',roughness:.55,side:T.DoubleSide}),boneMaterial=new T.MeshStandardMaterial({color:'#d7c6a7',roughness:.85}),capGeometry=new T.SphereGeometry(1,10,7),boneGeometry=new T.SphereGeometry(.025,6,4);
 for(const part of severable){const cap=new T.Group();cap.position.set(...anchors[part]);const joint=root.getObjectByName(roots[part]);if(joint)cap.position.copy(root.worldToLocal(joint.getWorldPosition(new T.Vector3())));const radius=part.startsWith('arm')?.075:part==='head'?.09:.085;const flesh=new T.Mesh(capGeometry,woundMaterial);flesh.scale.set(radius,.025,radius);cap.add(flesh);const bone=new T.Mesh(boneGeometry,boneMaterial);bone.position.y=.012;cap.add(bone);cap.visible=false;root.add(cap);caps.set(part,cap);}
 let mask=-1;
 return {
  setLost(next:number){if(next===mask)return;mask=next;for(const p of partitions){const kept:number[]=[];p.mesh.geometry.clearGroups();for(const group of p.groups){const start=kept.length;for(let n=group.start;n<group.start+group.count;n+=3)if(!(next&limbBits[p.parts[n/3]]))kept.push(p.indices[n],p.indices[n+1],p.indices[n+2]);p.mesh.geometry.addGroup(start,kept.length-start,group.materialIndex);}if(!p.mesh.geometry.index)p.mesh.geometry.setIndex(new T.BufferAttribute(p.indices.slice(),1));p.mesh.geometry.index!.array.set(kept);p.mesh.geometry.index!.needsUpdate=true;p.mesh.geometry.setDrawRange(0,kept.length);}for(const [part,cap]of caps)cap.visible=!!(next&limbBits[part]);},
  detach(part:BodyPart){
   root.updateWorldMatrix(true,true);const result=new T.Group(),center=new T.Vector3(),all:T.Vector3[]=[];
   for(const p of partitions){if(!p.parts.includes(part))continue;const position:number[]=[],uv:number[]=[],groups:{start:number;count:number;materialIndex:number}[]=[];const tex=p.mesh.geometry.getAttribute('uv');
    for(const sourceGroup of p.groups){const start=position.length/3;for(let n=sourceGroup.start;n<sourceGroup.start+sourceGroup.count;n+=3)if(p.parts[n/3]===part)for(let j=0;j<3;j++){const index=p.indices[n+j];p.mesh.getVertexPosition(index,v);v.applyMatrix4(p.mesh.matrixWorld);all.push(v.clone());position.push(v.x,v.y,v.z);uv.push(tex?.getX(index)??0,tex?.getY(index)??0);}groups.push({start,count:position.length/3-start,materialIndex:sourceGroup.materialIndex});}
    if(!position.length)continue;const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));for(const g of groups)geometry.addGroup(g.start,g.count,g.materialIndex);geometry.computeVertexNormals();const materials=Array.isArray(p.mesh.material)?p.mesh.material.map(m=>m.clone()):p.mesh.material.clone();const mesh=new T.Mesh(geometry,materials);mesh.castShadow=true;result.add(mesh);
   }
   if(!all.length)return undefined;for(const point of all)center.add(point);center.divideScalar(all.length);for(const child of result.children)(child as T.Mesh).geometry.translate(-center.x,-center.y,-center.z);result.position.copy(center);const sourceCap=caps.get(part);if(sourceCap){const cap=sourceCap.clone(true);cap.visible=true;cap.traverse(o=>{if(o instanceof T.Mesh){o.geometry=o.geometry.clone();o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}});const local=new T.Matrix4().makeTranslation(-center.x,-center.y,-center.z).multiply(sourceCap.matrixWorld);local.decompose(cap.position,cap.quaternion,cap.scale);result.add(cap);}result.name=`severed-${part}`;return result;
  },
  dispose(){for(const cap of caps.values())cap.removeFromParent();capGeometry.dispose();boneGeometry.dispose();woundMaterial.dispose();boneMaterial.dispose();},
 };
}
