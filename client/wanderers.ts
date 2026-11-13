import * as T from 'three';
import {loadHuman,createHuman} from './humanoid';
import {makePlayer} from '../shared/game';
import {wandererPose} from '../shared/wanderers';
import type {MapId} from '../shared/world';

export function createWanderers(scene:T.Scene,map:MapId){
 if(map==='storm'||map==='frontline')return {update(_time:number,_dt:number){},dispose(){}};
 const root=new T.Group();root.name='ambient-city-residents';scene.add(root);
 const people:{human:ReturnType<typeof createHuman>;player:ReturnType<typeof makePlayer>}[]=[];
 const resources:T.Material[]=[],geometries:T.BufferGeometry[]=[];
 let disposed=false;
 const colors=[0x51483d,0x38413c,0x63554c,0x474451];
 void loadHuman('de-field').then(data=>{
  if(disposed)return;
  for(let n=0;n<4;n++){
   const clothing=new T.MeshStandardMaterial({color:colors[n],roughness:1});
   const human=createHuman(data,'de',map,clothing,'de-field',true);clothing.dispose();
   const player=makePlayer(`resident-${n}`,'Stadtbewohner','de');
   human.group.name=player.id;
   const cloth=new T.MeshStandardMaterial({color:[0x302e28,0x4d4539,0x383633,0x73634d][n],roughness:1});resources.push(cloth);
   const patch=(x:number,y:number,z:number,w:number,h:number,d:number)=>{const geometry=new T.BoxGeometry(w,h,d);geometries.push(geometry);const mesh=new T.Mesh(geometry,cloth);mesh.position.set(x,y,z);human.group.add(mesh);return mesh;};
   patch(-.09,1.18,-.15,.10,.13,.018).rotation.z=.16;
   patch(.07,1.02,-.15,.08,.09,.018).rotation.z=-.12;
   // Worn shoulder bag and a patched shirt, without faction equipment or weapons.
   patch(.21,.96,.12,.16,.23,.14);patch(.11,1.29,.15,.045,.48,.025).rotation.z=-.3;
   const head=human.group.getObjectByName('head');
   if(head){const hairGeo=new T.SphereGeometry(.105,12,8,0,Math.PI*2,0,Math.PI*.55);geometries.push(hairGeo);const hair=new T.Mesh(hairGeo,cloth);hair.position.set(0,.07,0);hair.scale.set(1,.7,1);head.add(hair);}
   root.add(human.group);people.push({human,player});
  }
 }).catch(error=>console.warn('Stadtbewohner konnten nicht geladen werden',error));
 return {update(time:number,dt:number){people.forEach(({human,player},index)=>{
  const pose=wandererPose(index,time/1000);Object.assign(player,pose,{pitch:.14});
  human.group.position.set(pose.x,0,pose.z);human.group.rotation.y=pose.yaw;
  human.update(player,time,dt);
 });},dispose(){disposed=true;people.forEach(p=>p.human.dispose());resources.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());root.removeFromParent();}};
}
