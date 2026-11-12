import * as T from 'three';

export type ViewmodelInput = {
  dt:number; now:number; weaponIndex:number; aim:boolean; yaw:number; pitch:number;
  moving:number; sprinting:boolean; grounded:boolean;
  reloadRemainingMs:number; reloadDurationMs:number;
  /** Camera-local muzzle height before this controller transforms the parent. */
  muzzleY:number;
};
export type ViewmodelPose = {aimBlend:number;reloadProgress:number;reloadBlend:number;recoil:number};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const smooth=(v:number)=>{v=clamp(v,0,1);return v*v*(3-2*v);};
export function reloadEnvelope(progress:number){
  return smooth(progress/.18)*(1-smooth((progress-.78)/.22));
}

/** Cosmetic only: never changes camera aim, simulation inputs, cadence or damage.
 * Owns the weapon parent's position and rotation; call after weaponModels.update.
 * All time inputs are milliseconds except dt (seconds). No per-frame allocations.
 */
export function createViewmodel(parent:T.Group){
  const restPosition=parent.position.clone(),restRotation=parent.rotation.clone();
  const pose:ViewmodelPose={aimBlend:0,reloadProgress:0,reloadBlend:0,recoil:0};
  let recoil=0,velocity=0,phase=0,swayX=0,swayY=0,lastYaw=0,lastPitch=0;
  let initialized=false,lastWeapon=-1,equip=0,disposed=false;
  return {
    /** Call once for each server-confirmed local shot, never from mouse-down. */
    shot(weaponIndex:number){if(!disposed)velocity+=weaponIndex===0?1.7:weaponIndex===1?1.1:.65;},
    update(input:ViewmodelInput):Readonly<ViewmodelPose>{
      if(disposed)return pose;
      const dt=clamp(Number.isFinite(input.dt)?input.dt:0,0,.05);
      if(!initialized){lastYaw=input.yaw;lastPitch=input.pitch;initialized=true;}
      if(lastWeapon!==input.weaponIndex){lastWeapon=input.weaponIndex;equip=1;recoil=velocity=0;}
      const reloading=input.reloadRemainingMs>0&&input.reloadDurationMs>0;
      pose.reloadProgress=reloading?clamp(1-input.reloadRemainingMs/input.reloadDurationMs,0,1):0;
      pose.reloadBlend=reloading?reloadEnvelope(pose.reloadProgress):0;
      pose.aimBlend+=(Number(input.aim&&!reloading&&!input.sprinting)-pose.aimBlend)*(1-Math.exp(-dt*16));
      equip*=Math.exp(-dt*12);
      // Stable, critically damped recoil spring (exact solution for constant timestep).
      const omega=23,e=Math.exp(-omega*dt),c=velocity+omega*recoil;
      recoil=(recoil+c*dt)*e;velocity=(velocity-omega*c*dt)*e;
      pose.recoil=recoil;
      const yawDelta=Math.atan2(Math.sin(input.yaw-lastYaw),Math.cos(input.yaw-lastYaw));
      const pitchDelta=input.pitch-lastPitch;lastYaw=input.yaw;lastPitch=input.pitch;
      const follow=1-Math.exp(-dt*12);
      swayX+=(clamp(-yawDelta*1.6,-.035,.035)-swayX)*follow;
      swayY+=(clamp(pitchDelta*1.4,-.025,.025)-swayY)*follow;
      const movement=clamp(input.moving,0,1)*Number(input.grounded);
      phase+=dt*(input.sprinting?13:9)*movement;
      const hip=1-pose.aimBlend,bob=movement*hip*(input.sprinting?.012:.006);
      parent.position.set(restPosition.x-.24*pose.aimBlend+swayX*hip+Math.sin(phase)*bob,
        restPosition.y+(-input.muzzleY-.012)*pose.aimBlend+swayY*hip+Math.cos(phase*2)*bob*.6-pose.reloadBlend*.13-equip*.18,
        restPosition.z+recoil+equip*.10);
      parent.rotation.set(restRotation.x-recoil*.8-pose.reloadBlend*.48+equip*.25,
        restRotation.y+swayX*.6,restRotation.z+pose.reloadBlend*.32-Math.sin(phase)*bob*.6);
      return pose;
    },
    reset(){initialized=false;lastWeapon=-1;recoil=velocity=swayX=swayY=phase=0;pose.aimBlend=0;},
    dispose(){disposed=true;parent.position.copy(restPosition);parent.rotation.copy(restRotation);},
  };
}
