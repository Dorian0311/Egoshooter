import * as T from 'three';
import type {Player} from '../shared/game';
export type MotionName='idle'|'walk'|'jog'|'sprint'|'crouchIdle'|'crouchWalk'|'air'|'land';
type MotionClip={duration:number;times:number[];rotations:Record<string,number[]>;rootPositions:number[]};
export type MotionLibrary={version:number;fps:number;clips:Record<MotionName,MotionClip>};
let library:Promise<MotionLibrary|undefined>|undefined;
export function loadMotionLibrary(){return library??=fetch('/shooter/animations/locomotion.json').then(async response=>{if(!response.ok)throw Error('Character motion unavailable');return await response.json() as MotionLibrary;}).catch(error=>{console.warn('Motion asset unavailable; keeping fallback movement',error);return undefined;});}

/** Imported pose clips blended independently of authoritative movement/aim. */
export function createCharacterMotion(root:T.Group,bones:Map<string,T.Bone>,data:MotionLibrary,civilian=false){
 const mixer=new T.AnimationMixer(root),actions=new Map<MotionName,T.AnimationAction>();
 for(const [name,clip]of Object.entries(data.clips) as [MotionName,MotionClip][]){
  const tracks:T.KeyframeTrack[]=[];
  for(const [boneName,values]of Object.entries(clip.rotations)){
   const bone=bones.get(boneName);if(!bone||!civilian&&/^(clavicle|upperarm|lowerarm|wrist)/.test(boneName))continue;
   tracks.push(new T.QuaternionKeyframeTrack(bone.uuid+'.quaternion',clip.times,values));
  }
  const hip=bones.get('root');if(hip)tracks.push(new T.VectorKeyframeTrack(hip.uuid+'.position',clip.times,clip.rootPositions));
  const action=mixer.clipAction(new T.AnimationClip(name,clip.duration,tracks));action.enabled=true;action.setEffectiveWeight(1);
  if(name==='land'){action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;}
  actions.set(name,action);
 }
 let current:MotionName='idle',speed=0,lastX=0,lastZ=0,initialized=false,wasGrounded=true,landing=0;
 actions.get(current)?.play();
 return {update(player:Player,position:{x:number;z:number},dt:number){
  const step=Math.max(.001,Math.min(.1,dt)),dx=initialized?position.x-lastX:0,dz=initialized?position.z-lastZ:0;
  initialized=true;lastX=position.x;lastZ=position.z;
  const measured=Math.min(8,Math.hypot(dx,dz)/step);speed+=(measured-speed)*(1-Math.exp(-step*14));
  if(!wasGrounded&&player.grounded)landing=.14;wasGrounded=player.grounded;landing=Math.max(0,landing-step);
  const moving=speed>.2;
  const next:MotionName=!player.grounded?'air':landing>0&&!moving?'land':player.crouching?(moving?'crouchWalk':'crouchIdle'):moving?(player.sprinting||speed>5.2?'sprint':speed>2.4?'jog':'walk'):'idle';
  if(next!==current){actions.get(current)?.fadeOut(.16);actions.get(next)!.reset().setEffectiveWeight(1).fadeIn(.16).play();current=next;}
  const action=actions.get(current)!,nominal=current==='walk'?1.65:current==='jog'?3.6:current==='sprint'?6.2:current==='crouchWalk'?1.6:0;
  const backwards=dx*-Math.sin(player.yaw)+dz*-Math.cos(player.yaw)<-.002;
  action.setEffectiveTimeScale(nominal?T.MathUtils.clamp(speed/nominal,.65,1.6)*(backwards?-1:1):1);mixer.update(step);
 },dispose(){mixer.stopAllAction();mixer.uncacheRoot(root);},state:()=>current};
}
