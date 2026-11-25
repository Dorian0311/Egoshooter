import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createCharacterMotion,type MotionLibrary} from '../client/characterMotion';
import {makePlayer} from '../shared/game';

test('a planted foot resists body movement briefly after a stop and releases when airborne',()=>{
 const root=new T.Group(),hip=new T.Bone(),bones=new Map<string,T.Bone>();
 root.add(hip);bones.set('root',hip);
 for(const side of ['L','R']){
  const upper=new T.Bone(),lower=new T.Bone(),foot=new T.Bone();
  upper.position.set(side==='L'?.13:-.13,0,0);
  lower.position.set(0,-.43,-.12);
  foot.position.set(0,-.43,.1);
  hip.add(upper);upper.add(lower);lower.add(foot);
  bones.set(`upperleg01.${side}`,upper);bones.set(`lowerleg01.${side}`,lower);bones.set(`foot.${side}`,foot);
 }
 const clip={duration:1,times:[0,1],rotations:{},rootPositions:[0,1,0,0,1,0]};
 const clips={idle:clip,walk:clip,jog:clip,sprint:clip,crouchIdle:clip,crouchWalk:clip,air:clip,land:clip};
 const motion=createCharacterMotion(root,bones,{version:1,fps:30,clips} satisfies MotionLibrary);
 const player=makePlayer('avatar','Avatar','de');
 player.x=player.z=player.yaw=0;
 for(let i=0;i<20;i++){
  player.z-=.055;root.position.z=player.z;motion.update(player,player,1/60);
 }
 motion.update(player,player,1/60);
 const feet=[bones.get('foot.L')!,bones.get('foot.R')!];
 const before=feet.map(foot=>foot.getWorldPosition(new T.Vector3()));
 const displacement=()=>feet.map((foot,index)=>foot.getWorldPosition(new T.Vector3()).distanceTo(before[index]));
 root.position.x=.08;motion.update(player,player,1/60);
 assert.ok(Math.min(...displacement())<.016);
 player.grounded=false;motion.update(player,player,1/60);
 assert.ok(Math.min(...displacement())>.06);
 motion.dispose();
});
