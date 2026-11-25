import {nearbyBoxes} from '../shared/boxIndex';
import type {Box} from '../shared/world';

type Position={x:number;y:number;z:number};

/** A single opaque wall must cover the entire projected actor box. Door and window
 * openings are separate collider spans, so partial silhouettes always remain visible. */
export function actorBehindWall(eye:Position,feet:Position,walls:readonly Box[]){
  const radius=1.55,bottom=feet.y-.5,top=feet.y+2.7;
  const dx=feet.x-eye.x,dz=feet.z-eye.z;
  if(dx*dx+dz*dz<64)return false;
  for(const wall of nearbyBoxes(walls,Math.min(eye.x,feet.x)-radius,Math.min(eye.z,feet.z)-radius,
    Math.max(eye.x,feet.x)+radius,Math.max(eye.z,feet.z)+radius)){
    const alongX=wall.w<wall.d;
    const forward=alongX?dx:dz,across=alongX?dz:dx;
    if(Math.abs(forward)<=radius)continue;
    const plane=(alongX?wall.x-eye.x:wall.z-eye.z);
    const a=plane/(forward-radius),b=plane/(forward+radius);
    const near=Math.min(a,b),far=Math.max(a,b);
    if(near<=0||far>=1)continue;
    const span=alongX?wall.d:wall.w;
    const wallOffset=alongX?wall.z-eye.z:wall.x-eye.x;
    // Bound the projection at both depths; inflate for the horizontal weapon and poses.
    const x0=Math.min(near*across,far*across)-far*radius;
    const x1=Math.max(near*across,far*across)+far*radius;
    if(x0<wallOffset-span/2||x1>wallOffset+span/2)continue;
    const y0=bottom-eye.y,y1=top-eye.y;
    if(Math.min(near*y0,far*y0)+eye.y>=wall.y-wall.h/2&&
       Math.max(near*y1,far*y1)+eye.y<=wall.y+wall.h/2)return true;
  }
  return false;
}
