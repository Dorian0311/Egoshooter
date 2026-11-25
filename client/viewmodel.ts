import * as T from 'three';

export type ViewmodelInput = {
  dt:number; now:number; weaponIndex:number; aim:boolean; yaw:number; pitch:number;
  moving:number; sprinting:boolean; grounded:boolean;
  reloadRemainingMs:number; reloadDurationMs:number;
  /** Camera-local muzzle height before this controller transforms the parent. */
  muzzleY:number;
  /** Camera-local iron-sight / optic height, when the loaded weapon provides it. */
  sightY?:number;
};
export type ViewmodelPose = {aimBlend:number;reloadProgress:number;reloadBlend:number;recoil:number};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const smooth=(v:number)=>{v=clamp(v,0,1);return v*v*(3-2*v);};
export function reloadEnvelope(progress:number){
  return smooth(progress/.18)*(1-smooth((progress-.78)/.22));
}

/** Match world-space flash/tracer origins to the independently projected gun. */
export function projectWeaponMuzzle(point:T.Vector3,camera:T.PerspectiveCamera,weaponFov:number){
  const local=camera.worldToLocal(point.clone());
  const factor=Math.tan(T.MathUtils.degToRad(camera.fov/2))/Math.tan(T.MathUtils.degToRad(weaponFov/2));
  local.x*=factor;local.y*=factor;
  return camera.localToWorld(local);
}

/** Cosmetic only: never changes camera aim, simulation inputs, cadence or damage.
 * Owns the weapon parent's position and rotation; call after weaponModels.update.
 * All time inputs are milliseconds except dt (seconds). No per-frame allocations.
 */
export function createViewmodel(parent:T.Group){
  const restPosition=parent.position.clone(),restRotation=parent.rotation.clone();
  const pose:ViewmodelPose={aimBlend:0,reloadProgress:0,reloadBlend:0,recoil:0};
  let recoil=0,velocity=0,phase=0,swayX=0,swayY=0,lastYaw=0,lastPitch=0,movementBlend=0;
  let aimVelocity=0,sprintBlend=0,sprintVelocity=0;
  let initialized=false,lastWeapon=-1,equip=0,disposed=false;
  return {
    /** Call once for each server-confirmed local shot, never from mouse-down. */
    shot(weaponIndex:number,stability=1){if(!disposed)velocity+=(weaponIndex===0||weaponIndex===13?1.7:weaponIndex===1?1.1:.65)*stability;},
    update(input:ViewmodelInput):Readonly<ViewmodelPose>{
      if(disposed)return pose;
      const dt=clamp(Number.isFinite(input.dt)?input.dt:0,0,.05);
      if(!initialized){lastYaw=input.yaw;lastPitch=input.pitch;initialized=true;}
      if(lastWeapon!==input.weaponIndex){lastWeapon=input.weaponIndex;equip=1;recoil=velocity=0;}
      const reloading=input.reloadRemainingMs>0&&input.reloadDurationMs>0;
      pose.reloadProgress=reloading?clamp(1-input.reloadRemainingMs/input.reloadDurationMs,0,1):0;
      pose.reloadBlend=reloading?reloadEnvelope(pose.reloadProgress):0;
      // Both carry and sighting retain velocity when the player reverses input.
      // Aim takes priority immediately, including between two movement ticks.
      const aimTarget=Number(input.aim&&!reloading);
      const aimError=pose.aimBlend-aimTarget,aimRate=24,aimDecay=Math.exp(-aimRate*dt);
      const aimStep=aimVelocity+aimRate*aimError;
      pose.aimBlend=aimTarget+(aimError+aimStep*dt)*aimDecay;
      aimVelocity=(aimVelocity-aimRate*aimStep*dt)*aimDecay;
      const sprintTarget=Number(input.sprinting&&!input.aim&&!reloading);
      const sprintError=sprintBlend-sprintTarget,sprintRate=19,sprintDecay=Math.exp(-sprintRate*dt);
      const sprintStep=sprintVelocity+sprintRate*sprintError;
      sprintBlend=sprintTarget+(sprintError+sprintStep*dt)*sprintDecay;
      sprintVelocity=(sprintVelocity-sprintRate*sprintStep*dt)*sprintDecay;
      equip*=Math.exp(-dt*12);
      // Stable, critically damped recoil spring (exact solution for constant timestep).
      const omega=23,e=Math.exp(-omega*dt),c=velocity+omega*recoil;
      recoil=(recoil+c*dt)*e;velocity=(velocity-omega*c*dt)*e;
      pose.recoil=recoil;
      const yawDelta=Math.atan2(Math.sin(input.yaw-lastYaw),Math.cos(input.yaw-lastYaw));
      const pitchDelta=input.pitch-lastPitch;lastYaw=input.yaw;lastPitch=input.pitch;
      const follow=1-Math.exp(-dt*12);
      // Normalize angular velocity to the former 60 Hz tuning. Per-frame deltas
      // made the same mouse turn sway twice as much at 30 Hz as at 60 Hz.
      const referenceFrames=dt>0?1/(dt*60):0;
      swayX+=(clamp(-yawDelta*referenceFrames*1.6,-.035,.035)-swayX)*follow;
      swayY+=(clamp(pitchDelta*referenceFrames*1.4,-.025,.025)-swayY)*follow;
      movementBlend+=(clamp(input.moving,0,1)*Number(input.grounded)-movementBlend)*(1-Math.exp(-dt*10));
      const movement=movementBlend;
      phase+=dt*(9+4*sprintBlend)*movement;
      const hip=1-pose.aimBlend,bob=movement*hip*.006*(1+sprintBlend);
      parent.position.set(restPosition.x-.065*sprintBlend-.24*pose.aimBlend+swayX*hip+Math.sin(phase)*bob,
        restPosition.y-.038*sprintBlend+(-(input.sightY??input.muzzleY)-.008)*pose.aimBlend+swayY*hip+Math.cos(phase*2)*bob*.6-pose.reloadBlend*.018-equip*.18,
        restPosition.z+.046*sprintBlend-.18*pose.aimBlend+recoil+equip*.10-pose.reloadBlend*.09);
      parent.rotation.set(restRotation.x-.085*sprintBlend-recoil*.8+pose.reloadBlend*.12+equip*.25,
        restRotation.y+.25*sprintBlend+swayX*.6*hip,restRotation.z-.13*sprintBlend+pose.reloadBlend*.28-Math.sin(phase)*bob*.6);
      return pose;
    },
    reset(){initialized=false;lastWeapon=-1;recoil=velocity=swayX=swayY=phase=movementBlend=aimVelocity=sprintVelocity=sprintBlend=0;pose.aimBlend=0;},
    dispose(){disposed=true;parent.position.copy(restPosition);parent.rotation.copy(restRotation);},
  };
}
