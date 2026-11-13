import {headshotStep} from './hitEffects';

/** Recoil and a grounded fall sampled independently of the network state. */
export function headshotPose(elapsedSeconds:number,slowMotion:boolean){
 const time=headshotStep(Math.max(0,elapsedSeconds),slowMotion?.85:0);
 const progress=Math.min(1,time/.72),fall=progress*progress*(3-2*progress);
 const recoil=Math.sin(Math.min(1,time/.22)*Math.PI)*.16;
 // Lift the final torso by its half thickness instead of burying it below the floor.
 return {fall,recoil,height:.14*fall};
}
