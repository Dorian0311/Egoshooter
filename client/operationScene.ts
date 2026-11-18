import * as T from 'three';
import {createGadgetModels} from './remoteCarModels';
import type {Snapshot,Player} from '../shared/game';
import {eyePosition} from '../shared/injuries';
import {throwingStarQuaternion} from './projectileMotion';
import {createMedicalCrates} from './medicalCrate';
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
 const giftMaterial=new T.MeshStandardMaterial({color:'#7a1924',roughness:.65}),ribbonMaterial=new T.MeshStandardMaterial({color:'#d5ba6d',metalness:.4,roughness:.4}),metal=new T.MeshStandardMaterial({color:'#acb2b7',metalness:.9,roughness:.25});
 const box=new T.BoxGeometry(.55,.45,.55),ribbonA=new T.BoxGeometry(.57,.47,.07),ribbonB=new T.BoxGeometry(.07,.47,.57),star=createThrowingStarGeometry();
 const medicalCrates=createMedicalCrates(),gadgets=createGadgetModels();
 const pickups=new Map<string,T.Group>(),projectiles=new Map<string,T.Object3D>(),cars=new Map<string,T.Group>();let snapshot:Snapshot|null=null,received=0;
 const blastGeometry=new T.SphereGeometry(1,12,8);
 const warningGeometry=new T.SphereGeometry(.045,8,6),warningMaterial=new T.MeshBasicMaterial({color:'#ff422d'});
 const gateGeometry=new T.TorusGeometry(.62,.035,6,24);
 const gateActive=new T.MeshBasicMaterial({color:'#f6dc64'}),gateWaiting=new T.MeshBasicMaterial({color:'#779c92'});
 const gates:T.Mesh[]=[];
 const blasts:{mesh:T.Mesh<T.SphereGeometry,T.MeshBasicMaterial>;started:number;radius:number}[]=[];
 const velocity=new T.Vector3(),rocketAxis=new T.Vector3(0,0,1);
 function setCar(group:T.Group,car:{x:number;y:number;z:number;yaw:number}){
  group.position.set(car.x,car.y,car.z);group.rotation.y=car.yaw;
 }
 const marker=new T.Mesh(new T.TorusGeometry(1.1,.05,6,40),new T.MeshBasicMaterial({color:'#d2df87',transparent:true,opacity:.8}));marker.rotation.x=Math.PI/2;marker.visible=false;root.add(marker);
 const missionProps=new T.Group(),radio=new T.Group(),documents=new T.Group(),flag=new T.Group(),propGeometries:T.BufferGeometry[]=[],propMaterials:T.Material[]=[];root.add(missionProps);missionProps.add(radio,documents,flag);
 const prop=(parent:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const geometry=new T.BoxGeometry(w,h,d),material=new T.MeshStandardMaterial({color,roughness:.75});propGeometries.push(geometry);propMaterials.push(material);const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;};
 prop(radio,0,.3,0,.8,.6,.4,'#3c4936');prop(radio,0,.36,-.21,.66,.23,.025,'#171e18');for(let n=0;n<3;n++)prop(radio,-.22+n*.22,.12,-.23,.08,.08,.04,'#b9b7a1');prop(radio,.29,1,0,.016,1.2,.016,'#555e54');
 prop(documents,0,.12,0,.65,.22,.45,'#604b32');prop(documents,0,.25,0,.48,.025,.33,'#e9e1bd');prop(documents,-.18,.27,0,.025,.02,.35,'#909872');
 prop(flag,0,1,0,.025,2,.025,'#b8c0b5');prop(flag,.35,1.7,0,.7,.4,.025,'#a4b568');
 return {
  sync(s:Snapshot){snapshot=s;received=performance.now();for(const p of s.pickups){let group=pickups.get(p.id);if(!group){group=p.kind==='gift'?new T.Group():p.kind==='rocket'?gadgets.rocket():medicalCrates.create();if(p.kind==='gift'){group.add(new T.Mesh(box,giftMaterial));group.add(new T.Mesh(ribbonA,ribbonMaterial),new T.Mesh(ribbonB,ribbonMaterial));}root.add(group);pickups.set(p.id,group);}group.position.set(p.x,p.y+(p.kind==='rocket'?.09:.25),p.z);group.visible=!p.taken;}
   for(const [id,group]of pickups)if(!s.pickups.some(p=>p.id===id)){root.remove(group);pickups.delete(id);}
   for(const p of s.projectiles){if(!projectiles.has(p.id)){const mesh=p.kind==='rocket'?gadgets.rocket():new T.Mesh(star,metal);root.add(mesh);projectiles.set(p.id,mesh);}}
   for(const [id,mesh]of projectiles)if(!s.projectiles.some(p=>p.id===id)){root.remove(mesh);projectiles.delete(id);}
   for(const car of s.remoteCars??[]){
    let group=cars.get(car.id);
    if(!group){
     group=gadgets.car();root.add(group);cars.set(car.id,group);setCar(group,car);
     const warning=new T.Mesh(warningGeometry,warningMaterial);
     warning.position.set(0,.35,-.04);warning.name='arming-light';warning.visible=false;group.add(warning);
    }
    group.visible=!car.spent;
   }
   for(const [id,group] of cars)if(!s.remoteCars?.some(car=>car.id===id)){group.removeFromParent();cars.delete(id);}
   const course=s.carCourse;
   for(const [index,point] of (course?.gates??[]).entries()){
    let gate=gates[index];
    if(!gate){gate=new T.Mesh(gateGeometry,gateWaiting);root.add(gate);gates.push(gate);}
    gate.position.set(point.x,point.y+.68,point.z);
    gate.material=index===course!.next?gateActive:gateWaiting;
    gate.visible=s.phase==='playing'&&index>=course!.next;
   }
   for(let index=course?.gates.length??0;index<gates.length;index++)gates[index].visible=false;
   const o=s.operation.objective;marker.visible=s.operation.config.mode==='mission'&&s.phase==='playing'&&o.stage!=='complete';const point=o.stage==='extract'?o.extract:o.point;marker.position.set(point.x,point.y+.06,point.z);
   missionProps.position.set(o.point.x,o.point.y,o.point.z);missionProps.visible=marker.visible;radio.visible=s.operation.config.mission==='sabotage';documents.visible=s.operation.config.mission==='documents'&&o.stage==='target';flag.visible=s.operation.config.mission==='hold';
  },
  interaction(p:Player,yaw:number){if(!snapshot||!p.hp)return undefined;const eye=eyePosition(p),candidates:{id:string;label:string;x:number;y:number;z:number}[]=[];
   for(const q of snapshot.pickups)if(!q.taken)candidates.push({...q,label:q.kind==='gift'?'Geschenk öffnen · 3 Wurfsterne':q.kind==='rocket'?'Stielrakete aufnehmen':'Medkit aufnehmen · +50 LP'});
   for(const car of snapshot.remoteCars??[])if(!car.spent&&!car.driver&&car.detonateAt===undefined)candidates.push({...car,label:car.id===snapshot.carCourse?.carId?'Rennwagen-Parcours starten':'Spreng-Rennwagen steuern'});
   if(snapshot.operation.config.kind==='coop')for(const q of snapshot.players)if(q.downedUntil)candidates.push({...q,id:`revive:${q.id}`,label:`${q.name} wiederbeleben`});
   if(p.bandages>0)for(const q of snapshot.players)if(q.id!==p.id&&q.team===p.team&&q.hp>0&&q.connected&&!q.departed&&(q.hp<100||q.injuries.bleeding))candidates.push({...q,id:`heal:${q.id}`,label:`${q.name} behandeln · +50 LP · 1 Medkit`});
   const o=snapshot.operation;if(o.config.mode==='mission'&&o.objective.stage==='target'&&o.config.mission!=='hold')candidates.push({...o.objective.point,id:'objective',label:o.config.mission==='documents'?'Dokumente bergen':'Funkstation sabotieren'});
   return candidates.map(q=>({q,distance:Math.hypot(q.x-eye.x,q.y+.5-eye.y,q.z-eye.z),dot:(q.x-eye.x)*-Math.sin(yaw)+(q.z-eye.z)*-Math.cos(yaw)})).filter(q=>q.distance<2.7&&q.dot>-.1).sort((a,b)=>a.distance-b.distance)[0]?.q;
  },
  explosion(point:[number,number,number],radius:number,time:number){
   if(blasts.length>=12){const oldest=blasts.shift()!;oldest.mesh.removeFromParent();oldest.mesh.material.dispose();}
   const mesh=new T.Mesh(blastGeometry,new T.MeshBasicMaterial({color:'#ffd078',transparent:true,depthWrite:false,opacity:.9,blending:T.AdditiveBlending}));
   mesh.position.set(...point);root.add(mesh);blasts.push({mesh,started:time,radius});
  },
  update(time:number,frameSeconds:number){
   if(!snapshot)return;
   const dt=Math.max(0,Math.min(.1,(time-received)/1000));
   for(const p of snapshot.projectiles){
    const mesh=projectiles.get(p.id)!;mesh.position.set(p.x+p.vx*dt,p.y+p.vy*dt-4.9*dt*dt,p.z+p.vz*dt);
    if(p.kind==='rocket')mesh.quaternion.setFromUnitVectors(rocketAxis,velocity.set(p.vx,p.vy-9.8*dt,p.vz).normalize());
    else throwingStarQuaternion({...p,vy:p.vy-9.8*dt},Math.max(0,(snapshot.now-p.spawnedAt)/1000+dt),mesh.quaternion);
   }
   const blend=1-Math.exp(-frameSeconds*18);
   for(const car of snapshot.remoteCars??[]){
    const group=cars.get(car.id)!;
    group.getObjectByName('arming-light')!.visible=car.detonateAt!==undefined&&Math.floor(time/90)%2===0;
    if(group.position.distanceToSquared(velocity.set(car.x,car.y,car.z))>16){setCar(group,car);continue;}
    group.position.lerp(velocity,blend);
    const turn=car.yaw-group.rotation.y;
    group.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*blend;
   }
   for(let n=blasts.length-1;n>=0;n--){
    const {mesh,started,radius}=blasts[n],age=Math.max(0,(time-started)/390);
    if(age>=1){mesh.removeFromParent();mesh.material.dispose();blasts.splice(n,1);continue;}
    mesh.scale.setScalar((.13+Math.sqrt(age)*.46)*radius);mesh.material.opacity=.95*(1-age)**2;
   }
   marker.material.opacity=.5+.25*Math.sin(time*.004);
  },
  carPose:(id:string)=>cars.get(id),
  dispose(){root.removeFromParent();gadgets.dispose();medicalCrates.dispose();box.dispose();ribbonA.dispose();ribbonB.dispose();star.dispose();blastGeometry.dispose();gateGeometry.dispose();warningGeometry.dispose();for(const {mesh} of blasts)mesh.material.dispose();marker.geometry.dispose();marker.material.dispose();for(const g of propGeometries)g.dispose();for(const m of [...propMaterials,giftMaterial,ribbonMaterial,metal,gateActive,gateWaiting,warningMaterial])m.dispose();},
 };
}
