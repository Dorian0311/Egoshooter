import * as T from 'three';
import type {World} from '../shared/world';
import {ground} from '../shared/world';
import {rayBox} from '../shared/game';

type Fragment={group:T.Group;velocity:T.Vector3;spin:T.Vector3;radius:number;age:number;sleeping:boolean};
export function createGore(scene:T.Scene,world:()=>World){
 const fragments:Fragment[]=[],bounds=new T.Box3(),delta=new T.Vector3(),direction=new T.Vector3(),normal=new T.Vector3(),axis=new T.Vector3(),rotation=new T.Quaternion();
 const remove=(index:number)=>{const f=fragments[index];f.group.removeFromParent();f.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});fragments.splice(index,1);};
 return {
  add(group:T.Group,impulse:T.Vector3,contact?:T.Vector3,weapon=0){
   while(fragments.length>=32)remove(0);scene.add(group);bounds.setFromObject(group);const size=bounds.getSize(new T.Vector3()),radius=T.MathUtils.clamp(Math.min(size.x,size.y,size.z)*.5,.04,.16),mass=T.MathUtils.clamp(size.length()*2,.4,2);
   const seed=group.position.x*1.71+group.position.y*8.31+group.position.z*3.19,force=weapon===4?2.8:weapon===5?3.4:5.2;
   const velocity=impulse.clone().normalize().multiplyScalar(force/Math.sqrt(mass));velocity.y+=1.4+Math.abs(Math.sin(seed))*.8;
   const lever=(contact??group.position).clone().sub(bounds.getCenter(new T.Vector3())),spin=lever.cross(velocity).multiplyScalar(3/mass).add(new T.Vector3(Math.sin(seed)*4,Math.cos(seed*1.7)*5,Math.sin(seed*.7)*3));if(spin.length()>12)spin.setLength(12);
   fragments.push({group,velocity,spin,radius,age:0,sleeping:false});
  },
  update(dt:number){const collisionWorld=world();for(let n=fragments.length-1;n>=0;n--){const f=fragments[n];f.age+=dt;if(f.age>=10){remove(n);continue;}
   if(!f.sleeping)for(let remaining=Math.min(dt,.15);remaining>0;){const step=Math.min(remaining,1/120);remaining-=step;f.velocity.y-=9.8*step;delta.copy(f.velocity).multiplyScalar(step);const length=delta.length();direction.copy(delta).normalize();const origin=f.group.position;let hit=length;normal.set(0,0,0);
    for(const b of collisionWorld.boxes){if(Math.abs(b.x-origin.x)>b.w/2+length+f.radius||Math.abs(b.z-origin.z)>b.d/2+length+f.radius)continue;
     const lo=[b.x-b.w/2-f.radius,b.y-b.h/2-f.radius,b.z-b.d/2-f.radius],hi=[b.x+b.w/2+f.radius,b.y+b.h/2+f.radius,b.z+b.d/2+f.radius],distance=rayBox(origin.toArray(),direction.toArray(),lo,hi);
     if(distance>=hit)continue;hit=distance;const point=origin.clone().addScaledVector(direction,hit),faces=[Math.abs(point.x-lo[0]),Math.abs(point.x-hi[0]),Math.abs(point.y-lo[1]),Math.abs(point.y-hi[1]),Math.abs(point.z-lo[2]),Math.abs(point.z-hi[2])],face=faces.indexOf(Math.min(...faces));normal.set(0,0,0).setComponent(Math.floor(face/2),face%2?1:-1);
    }
    f.group.position.addScaledVector(direction,Math.max(0,hit));if(hit<length){f.group.position.addScaledVector(normal,.006);const incoming=f.velocity.dot(normal);if(incoming<0)f.velocity.addScaledVector(normal,-1.22*incoming);f.velocity.multiplyScalar(.75);f.spin.multiplyScalar(.65);}
    const angular=f.spin.length();if(angular>.0001){axis.copy(f.spin).multiplyScalar(1/angular);rotation.setFromAxisAngle(axis,angular*step);f.group.quaternion.premultiply(rotation);}
    bounds.setFromObject(f.group);const floor=ground(f.group.position.x,f.group.position.z,collisionWorld)+.008;
    if(bounds.min.y<floor){f.group.position.y+=floor-bounds.min.y;if(f.velocity.y<0)f.velocity.y=-f.velocity.y*.18;f.velocity.x*=Math.exp(-step*8);f.velocity.z*=Math.exp(-step*8);f.spin.multiplyScalar(Math.exp(-step*7));if(f.age>.6&&f.velocity.length()<.18&&f.spin.length()<.7){f.velocity.set(0,0,0);f.spin.set(0,0,0);f.sleeping=true;}}
   }
   if(f.age>9.5)f.group.scale.setScalar((10-f.age)*2);
  }},
  dispose(){while(fragments.length)remove(0);},
 };
}
