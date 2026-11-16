import * as T from 'three';
import type {World} from '../shared/world';
import {ground} from '../shared/world';
import {rayBox} from '../shared/game';
type Fragment={group:T.Group;velocity:T.Vector3;spin:T.Vector3;age:number};
export function createGore(scene:T.Scene,world:()=>World){
 const fragments:Fragment[]=[];
 const remove=(index:number)=>{const f=fragments[index];f.group.removeFromParent();f.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});fragments.splice(index,1);};
 return {
  add(group:T.Group,direction:T.Vector3){while(fragments.length>=32)remove(0);scene.add(group);fragments.push({group,velocity:direction.clone().multiplyScalar(3.5).add(new T.Vector3(0,2.5,0)),spin:new T.Vector3(5,8,3),age:0});},
  update(dt:number){const collisionWorld=world();for(let n=fragments.length-1;n>=0;n--){const f=fragments[n];f.age+=dt;if(f.age>=10){remove(n);continue;}for(let remaining=Math.min(dt,.15);remaining>0;){const step=Math.min(remaining,1/60);remaining-=step;f.velocity.y-=9.8*step;const delta=f.velocity.clone().multiplyScalar(step),length=delta.length(),direction=delta.clone().normalize(),o=f.group.position.toArray();let hit=length;for(const b of collisionWorld.boxes){if(Math.abs(b.x-o[0])>b.w/2+length+.2||Math.abs(b.z-o[2])>b.d/2+length+.2)continue;hit=Math.min(hit,rayBox(o,direction.toArray(),[b.x-b.w/2-.07,b.y-b.h/2-.07,b.z-b.d/2-.07],[b.x+b.w/2+.07,b.y+b.h/2+.07,b.z+b.d/2+.07]));}f.group.position.addScaledVector(direction,Math.max(0,hit-.001));if(hit<length){f.velocity.multiplyScalar(-.2);f.spin.multiplyScalar(.5);}const floor=ground(f.group.position.x,f.group.position.z,collisionWorld)+.10;if(f.group.position.y<floor){f.group.position.y=floor;f.velocity.y=Math.abs(f.velocity.y)*.2;f.velocity.x*=.65;f.velocity.z*=.65;f.spin.multiplyScalar(.5);}f.group.rotation.x+=f.spin.x*step;f.group.rotation.y+=f.spin.y*step;f.group.rotation.z+=f.spin.z*step;}if(f.age>9.5)f.group.scale.setScalar((10-f.age)*2);}},
  dispose(){while(fragments.length)remove(0);},
 };
}
