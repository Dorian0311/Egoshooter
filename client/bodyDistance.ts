import * as T from 'three';

export type BodyDistanceAsset={index:Uint16Array;maxVertex:number;groups:{start:number;count:number;original:number}[]};

export function decodeBodyDistance(buffer:ArrayBuffer):BodyDistanceAsset{
 const header=new DataView(buffer),groups=[];
 let start=0;
 for(let i=0;i<2;i++){
  const original=header.getUint32(32+i*8,true),count=header.getUint32(36+i*8,true);
  if(!count||count%3||count>original)throw Error('Invalid body distance group');
  groups.push({start,count,original});start+=count;
 }
 if(buffer.byteLength!==48+start*2)throw Error('Invalid body distance index count');
 const index=new Uint16Array(buffer,48);
 let maxVertex=0;
 for(const v of index)if(v>maxVertex)maxVertex=v;
 return {index,maxVertex,groups};
}

export async function matchingBodyDistance(source:ArrayBuffer,asset:ArrayBuffer){
 if(!globalThis.crypto?.subtle||asset.byteLength<48)return;
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',source));
 const expected=new Uint8Array(asset,0,32);
 if(digest.some((value,i)=>value!==expected[i]))return;
 return decodeBodyDistance(asset);
}

/** Both meshes read the same posed vertices. Only the intact distant body uses
 * the reduced indices; anatomy always owns the original mesh and its mutable index. */
export function createDistanceBody(full:T.SkinnedMesh,asset:BodyDistanceAsset){
 const source=full.geometry;
 if(!source.index||asset.maxVertex>=source.getAttribute('position').count||asset.groups.length!==2||asset.groups.some((g,i)=>g.original!==source.groups[i]?.count))return;
 const geometry=new T.BufferGeometry();
 for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
 geometry.setIndex(new T.BufferAttribute(asset.index,1));
 for(const [i,g] of asset.groups.entries())geometry.addGroup(g.start,g.count,i);
 const distant=new T.SkinnedMesh(geometry,full.material);
 distant.name='distance-body';distant.userData.nonAnatomic=true;
 distant.position.copy(full.position);distant.quaternion.copy(full.quaternion);distant.scale.copy(full.scale);
 distant.bind(full.skeleton,full.bindMatrix);distant.boundingSphere=full.boundingSphere;
 distant.castShadow=full.castShadow;distant.receiveShadow=full.receiveShadow;distant.visible=false;
 full.parent!.add(distant);
 return {
  update(pixelsPerMetre:number,zoom:boolean){
   const intact=source.drawRange.count>=source.index!.count;
   const far=!zoom&&intact&&pixelsPerMetre*1.8<(distant.visible?78:60);
   full.visible=!far;distant.visible=far;
  },
  dispose(){
   full.visible=true;distant.removeFromParent();
   // Full geometry retains ownership of the shared GPU vertex streams.
   for(const name of Object.keys(geometry.attributes))geometry.deleteAttribute(name);
   geometry.dispose();
  }
 };
}
