import {Box3, Vector3} from 'three';
import type {Box} from '../shared/world';

type Axis = 'x' | 'z';
type Rectangle = {left:number; right:number; bottom:number; top:number};
type Section = {axis:Axis; lateral:Axis; position:number; halfThickness:number; rectangles:Rectangle[]};

/** Inner rectangles of the actual opaque wall meshes, at their center plane.
 * The .09 inset exceeds the largest rounded edge (.085) used by the scene. */
export function islandWallSections(boxes:readonly Box[]) {
  const grouped=new Map<string,Section>();
  for(const box of boxes) {
    if(box.kind!=='wall'||Math.min(box.w,box.d)>.46)continue;
    const axis=box.w<box.d?'x':'z', lateral=axis==='x'?'z':'x';
    const width=axis==='x'?box.d:box.w;
    const key=axis+box[axis];
    let section=grouped.get(key);
    if(!section){section={axis,lateral,position:box[axis],halfThickness:0,rectangles:[]};grouped.set(key,section);}
    section.halfThickness=Math.max(section.halfThickness,Math.min(box.w,box.d)/2);
    section.rectangles.push({left:box[lateral]-width/2+.09,right:box[lateral]+width/2-.09,bottom:box.y-box.h/2+.09,top:box.y+box.h/2-.09});
  }
  return [...grouped.values()];
}

/** A complete projected AABB must fit within one solid rectangle between eye and mesh. */
export function behindIslandWall(box:Box3,eye:Vector3,nearRadius:number,sections:readonly Section[]) {
  for(const {axis,lateral,position,halfThickness,rectangles} of sections) {
    const d=position-eye[axis], a=box.min[axis]-eye[axis], b=box.max[axis]-eye[axis];
    if(Math.abs(d)<=nearRadius+halfThickness||!(d>0&&a>d+.005||d<0&&b<d-.005))continue;
    const s1=d/a, s2=d/b;
    const low=box.min[lateral]-eye[lateral], high=box.max[lateral]-eye[lateral];
    const left=eye[lateral]+Math.min(low*s1,low*s2), right=eye[lateral]+Math.max(high*s1,high*s2);
    const lower=box.min.y-eye.y, upper=box.max.y-eye.y;
    const bottom=eye.y+Math.min(lower*s1,lower*s2), top=eye.y+Math.max(upper*s1,upper*s2);
    for(const wall of rectangles){
      if(left>wall.left&&right<wall.right&&bottom>wall.bottom&&top<wall.top)return true;
    }
  }
  return false;
}
