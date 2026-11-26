import {Box3, Matrix4, Vector3} from 'three';
import type {Box} from '../shared/world';

/** Keep a margin for beveled corners and the world camera's near plane. */
export function opaqueWallCores(boxes:readonly Box[],inset=.085){
 return boxes.filter(b=>b.kind==='wall'&&Math.min(b.w,b.h,b.d)>2*inset).map(b=>new Box3(
  new Vector3(b.x-b.w/2+inset,b.y-b.h/2+inset,b.z-b.d/2+inset),
  new Vector3(b.x+b.w/2-inset,b.y+b.h/2-inset,b.z+b.d/2-inset),
 ));
}

/** A part is redundant only if every placed copy is fully inside one opaque wall. */
export function facadePartIsBuried(bounds:Box3,partMatrix:Matrix4,placements:readonly Matrix4[],walls:readonly Box3[]){
 const transform=new Matrix4(),placed=new Box3();
 return placements.length>0&&placements.every(placement=>{
  placed.copy(bounds).applyMatrix4(transform.multiplyMatrices(placement,partMatrix));
  return walls.some(wall=>wall.containsBox(placed));
 });
}
