import * as T from 'three';
import {loadHuman,createHuman} from './humanoid';
import {makePlayer} from '../shared/game';
import {wandererPose} from '../shared/wanderers';
import type {MapId} from '../shared/world';

export function createWanderers(scene:T.Scene,map:MapId){
 if(map==='storm'||map==='frontline')return {update(_time:number,_dt:number){},dispose(){}};
 const root=new T.Group();root.name='ambient-city-residents';scene.add(root);
 const people:{human:ReturnType<typeof createHuman>;player:ReturnType<typeof makePlayer>}[]=[];
 let disposed=false;
 const colors=[0x51483d,0x38413c,0x63554c,0x474451];
 void loadHuman('de-field',true).then(data=>{
  if(disposed)return;
  for(let n=0;n<4;n++){
   const clothing=new T.MeshStandardMaterial({color:colors[n],roughness:1});
   const human=createHuman(data,'de',map,clothing,'de-field',true);clothing.dispose();
   const player=makePlayer(`resident-${n}`,'Stadtbewohner','de');
   human.group.name=player.id;
   player.kind='resident';
   root.add(human.group);people.push({human,player});
  }
 }).catch(error=>console.warn('Stadtbewohner konnten nicht geladen werden',error));
 return {update(time:number,dt:number){people.forEach(({human,player},index)=>{
  const pose=wandererPose(index,time/1000);Object.assign(player,pose,{pitch:.14});
  human.group.position.set(pose.x,0,pose.z);human.group.rotation.y=pose.yaw;
  human.update(player,time,dt);
 });},dispose(){disposed=true;people.forEach(p=>p.human.dispose());root.removeFromParent();}};
}
