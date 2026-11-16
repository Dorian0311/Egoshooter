import * as T from 'three';
import type {Player} from '../shared/game';
import {isCrawling} from '../shared/injuries';

/** Damped skirt panels follow inertia, gait, turning and recoil in the original skinned mesh. */
export function createCoatDynamics(root:T.Group){
 const panels:{mesh:T.Mesh;rest:Float32Array;normals:Float32Array;vertices:number[]}[]=[];
 root.traverse(o=>{if(!(o instanceof T.Mesh))return;const position=o.geometry.getAttribute('position'),uv=o.geometry.getAttribute('uv');if(!position||!uv)return;const vertices:number[]=[];
  for(let n=0;n<position.count;n++)if(position.getY(n)<1.12&&Math.floor(uv.getX(n)*1024/340)===0&&Math.floor(uv.getY(n)*1024/340)===1)vertices.push(n);
  if(vertices.length)panels.push({mesh:o,rest:Float32Array.from(position.array),normals:Float32Array.from(o.geometry.getAttribute('normal').array),vertices});
 });
 const displacement=[new T.Vector3(),new T.Vector3(),new T.Vector3()],velocity=displacement.map(()=>new T.Vector3()),target=new T.Vector3();
 let initialized=false,lastX=0,lastZ=0,lastYaw=0,lastFire=0,phase=0;const normal=new T.Vector3();
 return {update(p:Player,dt:number){
  const step=Math.max(.001,Math.min(.1,dt)),dx=initialized?p.x-lastX:0,dz=initialized?p.z-lastZ:0,turn=initialized?Math.atan2(Math.sin(p.yaw-lastYaw),Math.cos(p.yaw-lastYaw))/step:0;
  lastX=p.x;lastZ=p.z;lastYaw=p.yaw;initialized=true;const teleport=Math.hypot(dx,dz)>2;
  const vx=teleport?0:(dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw))/step,vz=teleport?0:(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))/step,speed=Math.min(7,Math.hypot(vx,vz));phase+=step*(p.sprinting?13:8)*Math.min(1,speed/2);
  for(let side=0;side<3;side++){if(teleport){displacement[side].set(0,0,0);velocity[side].set(0,0,0);}
   target.set(T.MathUtils.clamp(-vx*.025-turn*.018,-.16,.16)+Math.sin(phase+side*1.8)*speed*.004,0,T.MathUtils.clamp(-vz*.035,-.20,.24)+Math.sin(phase*1.4+side)*speed*.007);
   if(isCrawling(p)||!p.hp)target.multiplyScalar(.2);if(p.fireAt!==lastFire&&p.fireAt>0)velocity[side].z+=.24;
   for(let remaining=step;remaining>0;){const h=Math.min(remaining,1/120);remaining-=h;velocity[side].x+=(target.x-displacement[side].x)*h*85;velocity[side].y+=(target.y-displacement[side].y)*h*85;velocity[side].z+=(target.z-displacement[side].z)*h*85;velocity[side].multiplyScalar(Math.exp(-h*11));displacement[side].addScaledVector(velocity[side],h);}
  }lastFire=p.fireAt;
  for(const panel of panels){const attribute=panel.mesh.geometry.getAttribute('position'),normals=panel.mesh.geometry.getAttribute('normal');for(const index of panel.vertices){const x=panel.rest[index*3],y=panel.rest[index*3+1],z=panel.rest[index*3+2],weight=T.MathUtils.clamp((1.10-y)/.82,0,1)**2,band=x<-.08?0:x>.08?2:1,offset=displacement[band];
    const legClearance=Math.sin(phase+(x<0?0:Math.PI))*.032*Math.min(1,speed/2)*weight;attribute.setXYZ(index,x+offset.x*weight+Math.sign(x)*Math.abs(legClearance)*.35,y+Math.abs(offset.z)*weight*.06,z+offset.z*weight+legClearance);
    normal.fromArray(panel.normals,index*3);normal.y+=2*Math.sqrt(weight)/.82*(offset.x*normal.x+offset.z*normal.z);normal.normalize();normals.setXYZ(index,normal.x,normal.y,normal.z);
   }attribute.needsUpdate=true;normals.needsUpdate=true;}
 },restore(){for(const panel of panels){panel.mesh.geometry.getAttribute('position').array.set(panel.rest);panel.mesh.geometry.getAttribute('position').needsUpdate=true;panel.mesh.geometry.getAttribute('normal').array.set(panel.normals);panel.mesh.geometry.getAttribute('normal').needsUpdate=true;}}};
}
