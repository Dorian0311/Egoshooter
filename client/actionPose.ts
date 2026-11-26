import * as T from 'three';
import type {Player} from '../shared/game';
import {isCrawling,hasLost} from '../shared/injuries';
type Pose={parts:{bone:T.Object3D;rest:T.Quaternion;side:0|1}[];active:boolean};
const poses=new WeakMap<T.Group,Pose>();
const right=new T.Vector3(),axis=new T.Vector3(),worldRotation=new T.Quaternion(),rotation=new T.Quaternion();
export function applyActionPose(root:T.Group,p:Player,time:number,now:number){
 let pose=poses.get(root);if(!pose){const names=root.userData.limbRoots??{armL:'upperarm01.L',armR:'upperarm01.R'},parts:Pose['parts']=[];for(const side of [0,1] as const){const bone=root.getObjectByName(names[side===0?'armL':'armR']);if(bone)parts.push({bone,rest:bone.quaternion.clone(),side});}pose={parts,active:false};poses.set(root,pose);}
 const crawl=isCrawling(p),throwing=p.throwAt>now&&p.throwAt-now<=750;
 if(!crawl&&!throwing){if(pose.active)for(const part of pose.parts)part.bone.quaternion.copy(part.rest);pose.active=false;return;}
 // getWorldQuaternion refreshes the requested chain, including its ancestors.
 right.set(1,0,0).applyQuaternion(root.getWorldQuaternion(worldRotation));
 for(const part of pose.parts){if(hasLost(p,part.side===0?'armL':'armR'))continue;const throwSide=hasLost(p,'armR')?0:1,angle=crawl?.85+Math.sin(time*.006+part.side*Math.PI)*.25:part.side===throwSide?Math.sin((750-(p.throwAt-now))/750*Math.PI)*1.7:0;
  axis.copy(right).applyQuaternion(part.bone.getWorldQuaternion(worldRotation).invert());
  part.bone.quaternion.copy(part.rest).multiply(rotation.setFromAxisAngle(axis,angle));}
 pose.active=true;
}
