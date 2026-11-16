import * as T from 'three';
import type {Snapshot,Player} from '../shared/game';
import {eyePosition} from '../shared/injuries';
import {throwingStarQuaternion} from './projectileMotion';
export function createThrowingStarGeometry(){
 const cells=new Set<string>(['0,0']);for(let r=0;r<4;r++)for(const [x,y]of [[0,1],[0,2],[1,2],[2,2]]){let a=x,b=y;for(let n=0;n<r;n++)[a,b]=[b,-a];cells.add(`${a},${b}`);}
 const edges=new Map<string,[[number,number],[number,number]]>();
 for(const cell of cells){const [x,y]=cell.split(',').map(Number),v:[[number,number],[number,number],[number,number],[number,number]]=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];for(let n=0;n<4;n++){const a=v[n],b=v[(n+1)%4],key=`${a}:${b}`,reverse=`${b}:${a}`;if(edges.has(reverse))edges.delete(reverse);else edges.set(key,[a,b]);}}
 const outline=[...edges.values()],start=outline[0][0],points:T.Vector2[]=[];let current=start;
 for(let n=0;n<=outline.length;n++){points.push(new T.Vector2((current[0]-.5)*.055,(current[1]-.5)*.055));const edge=outline.find(e=>e[0][0]===current[0]&&e[0][1]===current[1]);if(!edge)break;current=edge[1];if(current[0]===start[0]&&current[1]===start[1])break;}
 const shape=new T.Shape(points),geometry=new T.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:true,bevelSize:.0015,bevelThickness:.0005,bevelSegments:1,steps:1});geometry.center();return geometry;
}
export function createOperationScene(scene:T.Scene){
 const root=new T.Group();root.name='operation-items';scene.add(root);
 const giftMaterial=new T.MeshStandardMaterial({color:'#7a1924',roughness:.65}),ribbonMaterial=new T.MeshStandardMaterial({color:'#d5ba6d',metalness:.4,roughness:.4}),medicalMaterial=new T.MeshStandardMaterial({color:'#e0d9b7',roughness:.9}),crossMaterial=new T.MeshStandardMaterial({color:'#338b69'}),metal=new T.MeshStandardMaterial({color:'#acb2b7',metalness:.9,roughness:.25});
 const box=new T.BoxGeometry(.55,.45,.55),ribbonA=new T.BoxGeometry(.57,.47,.07),ribbonB=new T.BoxGeometry(.07,.47,.57),star=createThrowingStarGeometry();
 const pickups=new Map<string,T.Group>(),projectiles=new Map<string,T.Mesh>();let snapshot:Snapshot|null=null,received=0;
 const marker=new T.Mesh(new T.TorusGeometry(1.1,.05,6,40),new T.MeshBasicMaterial({color:'#d2df87',transparent:true,opacity:.8}));marker.rotation.x=Math.PI/2;marker.visible=false;root.add(marker);
 const missionProps=new T.Group(),radio=new T.Group(),documents=new T.Group(),flag=new T.Group(),propGeometries:T.BufferGeometry[]=[],propMaterials:T.Material[]=[];root.add(missionProps);missionProps.add(radio,documents,flag);
 const prop=(parent:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const geometry=new T.BoxGeometry(w,h,d),material=new T.MeshStandardMaterial({color,roughness:.75});propGeometries.push(geometry);propMaterials.push(material);const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;};
 prop(radio,0,.3,0,.8,.6,.4,'#3c4936');prop(radio,0,.36,-.21,.66,.23,.025,'#171e18');for(let n=0;n<3;n++)prop(radio,-.22+n*.22,.12,-.23,.08,.08,.04,'#b9b7a1');prop(radio,.29,1,0,.016,1.2,.016,'#555e54');
 prop(documents,0,.12,0,.65,.22,.45,'#604b32');prop(documents,0,.25,0,.48,.025,.33,'#e9e1bd');prop(documents,-.18,.27,0,.025,.02,.35,'#909872');
 prop(flag,0,1,0,.025,2,.025,'#b8c0b5');prop(flag,.35,1.7,0,.7,.4,.025,'#a4b568');
 return {
  sync(s:Snapshot){snapshot=s;received=performance.now();for(const p of s.pickups){let group=pickups.get(p.id);if(!group){group=new T.Group();group.add(new T.Mesh(box,p.kind==='gift'?giftMaterial:medicalMaterial));group.add(new T.Mesh(ribbonA,p.kind==='gift'?ribbonMaterial:crossMaterial),new T.Mesh(ribbonB,p.kind==='gift'?ribbonMaterial:crossMaterial));root.add(group);pickups.set(p.id,group);}group.position.set(p.x,p.y+.25,p.z);group.visible=!p.taken;}
   for(const [id,group]of pickups)if(!s.pickups.some(p=>p.id===id)){root.remove(group);pickups.delete(id);}
   for(const p of s.projectiles){if(!projectiles.has(p.id)){const mesh=new T.Mesh(star,metal);root.add(mesh);projectiles.set(p.id,mesh);}}
   for(const [id,mesh]of projectiles)if(!s.projectiles.some(p=>p.id===id)){root.remove(mesh);projectiles.delete(id);}
   const o=s.operation.objective;marker.visible=s.operation.config.mode==='mission'&&s.phase==='playing'&&o.stage!=='complete';const point=o.stage==='extract'?o.extract:o.point;marker.position.set(point.x,point.y+.06,point.z);
   missionProps.position.set(o.point.x,o.point.y,o.point.z);missionProps.visible=marker.visible;radio.visible=s.operation.config.mission==='sabotage';documents.visible=s.operation.config.mission==='documents'&&o.stage==='target';flag.visible=s.operation.config.mission==='hold';
  },
  interaction(p:Player,yaw:number){if(!snapshot||!p.hp)return undefined;const eye=eyePosition(p),candidates:{id:string;label:string;x:number;y:number;z:number}[]=[];
   for(const q of snapshot.pickups)if(!q.taken)candidates.push({...q,label:q.kind==='gift'?'Geschenk öffnen · 3 Wurfsterne':'Medkit aufnehmen · +50 LP'});
   if(snapshot.operation.config.kind==='coop')for(const q of snapshot.players)if(q.downedUntil)candidates.push({...q,id:`revive:${q.id}`,label:`${q.name} wiederbeleben`});
   if(p.bandages>0)for(const q of snapshot.players)if(q.id!==p.id&&q.team===p.team&&q.hp>0&&q.connected&&!q.departed&&(q.hp<100||q.injuries.bleeding))candidates.push({...q,id:`heal:${q.id}`,label:`${q.name} behandeln · +50 LP · 1 Medkit`});
   const o=snapshot.operation;if(o.config.mode==='mission'&&o.objective.stage==='target'&&o.config.mission!=='hold')candidates.push({...o.objective.point,id:'objective',label:o.config.mission==='documents'?'Dokumente bergen':'Funkstation sabotieren'});
   return candidates.map(q=>({q,distance:Math.hypot(q.x-eye.x,q.y+.5-eye.y,q.z-eye.z),dot:(q.x-eye.x)*-Math.sin(yaw)+(q.z-eye.z)*-Math.cos(yaw)})).filter(q=>q.distance<2.7&&q.dot>-.1).sort((a,b)=>a.distance-b.distance)[0]?.q;
  },
  update(time:number){if(!snapshot)return;const dt=Math.max(0,Math.min(.1,(time-received)/1000));for(const p of snapshot.projectiles){const mesh=projectiles.get(p.id)!;mesh.position.set(p.x+p.vx*dt,p.y+p.vy*dt-4.9*dt*dt,p.z+p.vz*dt);throwingStarQuaternion({...p,vy:p.vy-9.8*dt},Math.max(0,(snapshot.now-p.spawnedAt)/1000+dt),mesh.quaternion);}marker.material.opacity=.5+.25*Math.sin(time*.004);},
  dispose(){root.removeFromParent();box.dispose();ribbonA.dispose();ribbonB.dispose();star.dispose();marker.geometry.dispose();marker.material.dispose();for(const g of propGeometries)g.dispose();for(const m of [...propMaterials,giftMaterial,ribbonMaterial,medicalMaterial,crossMaterial,metal])m.dispose();},
 };
}
