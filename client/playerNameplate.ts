import * as T from 'three';
import type {Box} from '../shared/world';
import './playerLabels.css';
type Position={x:number;y:number;z:number};

/** Segment/box visibility, evaluated at 10 Hz per nearby player. No allocations. */
export function nameplateOccluded(eye:Position,head:Position,boxes:readonly Box[]){
 for(const box of boxes){
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
export function createPlayerNameplate(parent:HTMLElement,name:string,friendly:boolean){
 const anchor=new T.Object3D();anchor.position.y=2.06;
 const element=document.createElement('div'),label=document.createElement('span');
 element.className='player-label';element.append(label);parent.append(element);
 const projected=new T.Vector3();let previous='',disposed=false;
 function update(nextName:string,isFriendly:boolean){
  const key=`${isFriendly}:${nextName}`;if(key===previous)return;previous=key;
  label.textContent=nextName;element.classList.toggle('is-enemy',!isFriendly);
  element.setAttribute('aria-label',`${isFriendly?'Verbündeter':'Gegner'}: ${nextName}`);
 }
 update(name,friendly);
 return {anchor,update,render(camera:T.Camera,width:number,height:number,visible:boolean,opacity:number){
  if(disposed)return;
  anchor.getWorldPosition(projected);projected.project(camera);
  const show=visible&&projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1.1&&Math.abs(projected.y)<1.1;
  element.style.display=show?'block':'none';
  if(show){element.style.left=`${(projected.x+1)*.5*width}px`;element.style.top=`${(1-projected.y)*.5*height}px`;element.style.opacity=String(opacity);}
 },dispose(){if(disposed)return;disposed=true;element.remove();anchor.removeFromParent();}};
}
