import * as T from 'three';
import type {Box} from '../shared/world';
import {nearbyBoxes} from '../shared/boxIndex';
type Position={x:number;y:number;z:number};

/** Test line of sight against solid boxes along the segment. */
export function nameplateOccluded(eye:Position,head:Position,boxes:readonly Box[]){
 for(const box of nearbyBoxes(boxes,Math.min(eye.x,head.x),Math.min(eye.z,head.z),Math.max(eye.x,head.x),Math.max(eye.z,head.z))){
  if(box.kind==='glass')continue;
  let near=0,far=.98,hit=true;
  for(let axis=0;axis<3;axis++){
   const start=axis===0?eye.x:axis===1?eye.y:eye.z;
   const delta=(axis===0?head.x:axis===1?head.y:head.z)-start;
   const center=axis===0?box.x:axis===1?box.y:box.z,half=(axis===0?box.w:axis===1?box.h:box.d)/2;
   if(Math.abs(delta)<1e-8){if(start<center-half||start>center+half){hit=false;break;}}
   else{const a=(center-half-start)/delta,b=(center+half-start)/delta;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far){hit=false;break;}}
  }
  if(hit)return true;
 }
 return false;
}

/** HTML stays at screen resolution even when adaptive 3D rendering is reduced. */
export function createPlayerNameplate(parent:HTMLElement,name:string,friendly:boolean,residentBiography?:string){
 const anchor=new T.Object3D();anchor.position.y=2.06;
 const document=parent.ownerDocument;
 const element=document.createElement('div'),label=document.createElement('span'),speech=document.createElement('span');
 element.className='player-label';speech.className='resident-banter';speech.hidden=true;element.append(label,speech);parent.append(element);
 if(residentBiography){element.setAttribute('aria-description',residentBiography);element.title=residentBiography;element.classList.add('is-resident');}
 const projected=new T.Vector3();let previous='',disposed=false,speechUntil=0,displayed=false,lastTransform='',lastOpacity='';
 element.style.left='0';element.style.top='0';
 function update(nextName:string,isFriendly:boolean){
  const key=`${isFriendly}:${nextName}`;if(key===previous)return;previous=key;
  label.textContent=nextName;element.classList.toggle('is-enemy',!residentBiography&&!isFriendly);
  element.setAttribute('aria-label',`${residentBiography?'Stadtbewohner':isFriendly?'Verbündeter':'Gegner'}: ${nextName}`);
 }
 update(name,friendly);
 const worldPosition=new T.Vector3();
 let onScreen=false,occluded=false,lastSightCheck=-Infinity;
 function visibility(camera:T.Camera,eye:Position,boxes:readonly Box[],nearby:boolean,checkOffscreen:boolean,now:number){
  const previouslyOnScreen=onScreen;onScreen=false;
  if(!nearby)return false;
  anchor.getWorldPosition(worldPosition);projected.copy(worldPosition).project(camera);
  onScreen=projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1.1&&Math.abs(projected.y)<1.1;
  if(!onScreen&&!checkOffscreen)return false;
  if((onScreen&&!previouslyOnScreen)||now-lastSightCheck>100){
   occluded=nameplateOccluded(eye,worldPosition,boxes);lastSightCheck=now;
  }
  return !occluded;
 }
 function hide(){
  onScreen=false;
  if(displayed){displayed=false;element.style.display='none';}
 }
 return {anchor,update,visibility,hide,say(text:string,until:number){speech.textContent=text;speechUntil=until;},render(width:number,height:number,visible:boolean,opacity:number,now=performance.now()){
  if(disposed)return;
  const hidden=now>=speechUntil;
  if(speech.hidden!==hidden)speech.hidden=hidden;
  const show=visible&&onScreen;
  if(show!==displayed){displayed=show;element.style.display=show?'block':'none';}
  if(show){
   const transform=`translate(${(projected.x+1)*.5*width}px, ${(1-projected.y)*.5*height}px) translate(-50%, -100%)`;
   if(transform!==lastTransform){lastTransform=transform;element.style.transform=transform;}
   const alpha=String(opacity);
   if(alpha!==lastOpacity){lastOpacity=alpha;element.style.opacity=alpha;}
  }
 },dispose(){if(disposed)return;disposed=true;element.remove();anchor.removeFromParent();}};
}
