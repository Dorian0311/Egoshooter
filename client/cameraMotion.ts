import {Vector3} from 'three';
type Position={x:number;y:number;z:number};

/** Interpolate the local 30 Hz prediction at display rate. Reconciliation errors
 * decay over a few frames; respawns and large teleports reset immediately. */
export class CameraMotion {
 private previous=new Vector3();
 private offset=new Vector3();
 private rendered=new Vector3();
 private initialized=false;
 reset(position:Position){this.previous.copy(position);this.offset.set(0,0,0);this.initialized=true;}
 beforeStep(position:Position){this.previous.copy(position);}
 reconcile(before:Position|undefined,after:Position,teleport=false){
  if(!before||teleport||Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z)>2){this.reset(after);return;}
  const dx=after.x-before.x,dy=after.y-before.y,dz=after.z-before.z;
  this.previous.x+=dx;this.previous.y+=dy;this.previous.z+=dz;
  this.offset.x-=dx;this.offset.y-=dy;this.offset.z-=dz;
 }
 sample(current:Position,alpha:number,dt:number){
  if(!this.initialized)this.reset(current);
  this.offset.multiplyScalar(Math.exp(-Math.max(0,dt)*14));
  return this.rendered.copy(this.previous).lerp(current,Math.max(0,Math.min(1,alpha))).add(this.offset);
 }
}
