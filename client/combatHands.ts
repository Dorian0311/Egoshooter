import * as T from 'three';
export type CombatAction='swing'|'carry'|'interact'|'pickup';
type Clip={duration:number;frames:number;left:number[];right:number[]};
let library:Partial<Record<CombatAction,Clip>>|undefined,pending:Promise<void>|undefined;
export function loadCombatHands(){if(typeof window==='undefined')return Promise.resolve();return pending??=fetch('/shooter/animations/combat-hands.json').then(async response=>{if(!response.ok)throw Error('Combat motion unavailable');library=(await response.json()).clips;}).catch(()=>{pending=undefined;});}
export function sampleCombatHands(action:CombatAction,progress:number):{left:T.Vector3;right:T.Vector3}|undefined{
 const clip=library?.[action];if(!clip)return undefined;const frame=T.MathUtils.clamp(progress,0,1)*(clip.frames-1),first=Math.floor(frame),next=Math.min(clip.frames-1,first+1),alpha=frame-first;
 const point=(values:number[])=>new T.Vector3(values[first*3],values[first*3+1],values[first*3+2]).lerp(new T.Vector3(values[next*3],values[next*3+1],values[next*3+2]),alpha);
 return {left:point(clip.left),right:point(clip.right)};
}
