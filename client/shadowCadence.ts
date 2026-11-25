import type {GraphicsQuality} from './graphicsSettings';

/** Stable 30 Hz ceiling with at least one cached frame between refreshes.
 * Low FPS must never turn into a shadow redraw on every already-slow frame. */
export class ShadowCadence {
 private elapsed=0;
 private frames=0;
 private forced=true;
 reset(){this.elapsed=0;this.frames=0;this.forced=true;}
 update(dt:number,quality:GraphicsQuality,underLoad=false){
  if(quality==='high'||quality==='ultra'||this.forced){this.forced=false;this.elapsed=0;this.frames=0;return true;}
  this.frames++;if(Number.isFinite(dt)&&dt>0)this.elapsed+=Math.min(dt,.1);
  const interval=1/(underLoad?15:30);
  if(this.frames<(underLoad?3:2)||this.elapsed+.0001<interval)return false;
  this.frames=0;this.elapsed=Math.max(0,this.elapsed-interval)%interval;
  return true;
 }
}
