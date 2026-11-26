import * as T from 'three';
import type {Player} from '../shared/game';
import {isCrawling} from '../shared/injuries';
import {solveArm,type ArmChain} from './actorEquipment';
export type MotionName='idle'|'walk'|'jog'|'sprint'|'crouchIdle'|'crouchWalk'|'air'|'land';
type MotionClip={duration:number;times:number[];rotations:Record<string,number[]>;rootPositions:number[]};
export type MotionLibrary={version:number;fps:number;clips:Record<MotionName,MotionClip>};
let library:Promise<MotionLibrary|undefined>|undefined;
export function loadMotionLibrary(){return library??=fetch('/shooter/animations/locomotion.json').then(async response=>{if(!response.ok)throw Error('Character motion unavailable');return await response.json() as MotionLibrary;}).catch(error=>{console.warn('Motion asset unavailable; keeping fallback movement',error);return undefined;});}

/** Imported pose clips blended independently of authoritative movement/aim. */
export function createCharacterMotion(root:T.Group,bones:Map<string,T.Bone>,data:MotionLibrary,civilian=false,aimBones?:ReadonlySet<string>){
 const mixer=new T.AnimationMixer(root),actions=new Map<MotionName,T.AnimationAction>();
 for(const [name,clip]of Object.entries(data.clips) as [MotionName,MotionClip][]){
  const tracks:T.KeyframeTrack[]=[];
  for(const [boneName,values]of Object.entries(clip.rotations)){
   const bone=bones.get(boneName);if(!bone||aimBones?.has(boneName)||!civilian&&/^(clavicle|upperarm|lowerarm|wrist)/.test(boneName))continue;
   tracks.push(new T.QuaternionKeyframeTrack(bone.uuid+'.quaternion',clip.times,values));
  }
  const hip=bones.get('root');if(hip)tracks.push(new T.VectorKeyframeTrack(hip.uuid+'.position',clip.times,clip.rootPositions));
  const action=mixer.clipAction(new T.AnimationClip(name,clip.duration,tracks));action.enabled=true;action.setEffectiveWeight(1);
  if(name==='land'){action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;}
  actions.set(name,action);
 }
 const hips=bones.get('root'),authoredHips=hips?.quaternion.clone(),headingRotation=new T.Quaternion(),leanRotation=new T.Quaternion(),up=new T.Vector3(0,1,0),sideAxis=new T.Vector3(0,0,1),pitchAxis=new T.Vector3(1,0,0);
 const legs:ArmChain[]=[];
 for(const side of ['L','R']){
  const upper=bones.get(`upperleg01.${side}`),lower=bones.get(`lowerleg01.${side}`),hand=bones.get(`foot.${side}`);
  if(upper&&lower&&hand)legs.push({upper,lower,hand});
 }
 const anchor=new T.Vector3(),sole=new T.Vector3(),otherSole=new T.Vector3(),goal=new T.Vector3(),pole=new T.Vector3();
 const footRotation=new T.Quaternion(),inverseParent=new T.Quaternion();
 const authored=Array.from({length:3},()=>new T.Quaternion());
 let planted:ArmChain|undefined,corrected:ArmChain|undefined,contact=0;
 let current:MotionName='idle',speed=0,lastX=0,lastZ=0,initialized=false,wasGrounded=true,landing=0,heading=0,lean=0,braking=0,reverse=false;
 actions.get(current)?.play();
 return {update(player:Player,position:{x:number;z:number},dt:number){
  const step=Math.max(.001,Math.min(.1,dt)),dx=initialized?position.x-lastX:0,dz=initialized?position.z-lastZ:0;
  initialized=true;lastX=position.x;lastZ=position.z;
  const measured=Math.min(8,Math.hypot(dx,dz)/step),previousSpeed=speed;speed+=(measured-speed)*(1-Math.exp(-step*14));
  const touchedDown=!wasGrounded&&player.grounded;
  const stopping=previousSpeed>1.35&&measured<.18&&!planted;
  if(touchedDown)landing=.19;
  wasGrounded=player.grounded;landing=Math.max(0,landing-step);
  if(corrected){
   corrected.upper.quaternion.copy(authored[0]);corrected.lower.quaternion.copy(authored[1]);corrected.hand.quaternion.copy(authored[2]);
   corrected=undefined;
  }
  const moving=speed>.2;
  const groundFactor=player.grounded&&!player.crouching?1:0;
  const brakeTarget=groundFactor*T.MathUtils.clamp((previousSpeed-speed)/step*.007,0,.12);
  braking+=(brakeTarget-braking)*(1-Math.exp(-step*14));
  const next:MotionName=!player.grounded?'air':landing>0&&!moving?'land':player.crouching?(moving?'crouchWalk':'crouchIdle'):moving?(player.sprinting||speed>5.2?'sprint':speed>2.4?'jog':'walk'):'idle';
  if(next!==current){actions.get(current)?.fadeOut(.16);actions.get(next)!.reset().setEffectiveWeight(1).fadeIn(.16).play();current=next;}
  // Calibrated on the retargeted boot's ground-contact phase in metres per clip second.
  const action=actions.get(current)!,nominal=current==='walk'?.95:current==='jog'?4.8:current==='sprint'?6.2:current==='crouchWalk'?1.6:0;
  const forwardSpeed=(dx*-Math.sin(player.yaw)+dz*-Math.cos(player.yaw))/step;
  // Keep the current foot lead when a mostly sideways step drifts slightly
  // forward or back. A fixed speed threshold alone flips the hips at fast strafing speeds.
  const reverseThreshold=Math.max(.25,.30*measured);
  if(forwardSpeed < -reverseThreshold)reverse=true;
  else if(forwardSpeed > reverseThreshold||!moving)reverse=false;
  const travelling=Math.hypot(dx,dz)/step>.12;
  let direction=travelling?Math.atan2(-dx,-dz)-player.yaw:0;
  direction=Math.atan2(Math.sin(direction),Math.cos(direction));
  if(reverse&&travelling)direction-=Math.sign(direction||1)*Math.PI;
  const target=travelling?T.MathUtils.clamp(direction,-1.25,1.25):0;
  const turn=target-heading;
  heading+=turn*(1-Math.exp(-step*12));
  const leanTarget=groundFactor*T.MathUtils.clamp(turn*speed*.06,-.17,.17);
  lean+=(leanTarget-lean)*(1-Math.exp(-step*13));
  action.setEffectiveTimeScale(nominal?T.MathUtils.clamp(speed/nominal,.65,current==='walk'?1.85:1.6)*(reverse?-1:1):1);
  // Mixer bindings can skip unchanged keys: remove our previous additive turn
  // before sampling, otherwise an idle root rotation accumulates every frame.
  if(hips&&authoredHips)hips.quaternion.copy(authoredHips);
  mixer.update(step);
  // Turn the lower body into its travel direction; humanoid's upper-body
  // controller preserves the chest, gaze and weapon aim independently.
  if(hips&&authoredHips){authoredHips.copy(hips.quaternion);hips.quaternion.premultiply(headingRotation.setFromAxisAngle(up,heading));
   hips.quaternion.premultiply(leanRotation.setFromAxisAngle(sideAxis,lean));
   hips.quaternion.premultiply(leanRotation.setFromAxisAngle(pitchAxis,braking));}
  if(!groundFactor||isCrawling(player)||!player.hp||measured>2.7&&!touchedDown){planted=undefined;contact=0;return;}
  if((touchedDown||stopping)&&legs.length===2){
   legs[0].hand.getWorldPosition(sole);legs[1].hand.getWorldPosition(otherSole);
   planted=sole.y<=otherSole.y?legs[0]:legs[1];
   anchor.copy(planted===legs[0]?sole:otherSole);
   contact=.18;
  }
  if(planted&&contact>0){
   planted.hand.getWorldPosition(sole);
   if(sole.distanceToSquared(anchor)>.23**2){planted=undefined;contact=0;return;}
   authored[0].copy(planted.upper.quaternion);authored[1].copy(planted.lower.quaternion);authored[2].copy(planted.hand.quaternion);
   planted.hand.getWorldQuaternion(footRotation);
   goal.copy(sole).lerp(anchor,T.MathUtils.smoothstep(contact,0,.12));
   planted.lower.getWorldPosition(pole);
   solveArm(planted,goal,pole);
   planted.hand.parent?.getWorldQuaternion(inverseParent);
   planted.hand.quaternion.copy(inverseParent.invert().multiply(footRotation));
   corrected=planted;
   contact=Math.max(0,contact-step);
   if(contact===0)planted=undefined;
  }
 },dispose(){mixer.stopAllAction();mixer.uncacheRoot(root);},state:()=>current,groundYaw:()=>heading};
}
