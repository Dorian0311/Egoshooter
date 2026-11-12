import * as T from 'three';
import type {GameEvent} from '../shared/game.ts';

export function createHitEffects(scene:T.Scene){
 const particles:{mesh:T.Mesh;velocity:T.Vector3;life:number}[]=[];
 const geometry=new T.IcosahedronGeometry(.018,0);
 const blood=new T.MeshStandardMaterial({color:'#6f0810',roughness:.65});
 const fragment=new T.MeshStandardMaterial({color:'#80352c',roughness:.85});
 function emit(event:GameEvent){
  if(!event.point)return;
  const burst=event.type==='kill'&&event.hitZone==='head';
  if(event.type!=='hit'&&!burst)return;
  for(let i=0;i<(burst?48:16);i++){
   if(particles.length>=256)break;
   const mesh=new T.Mesh(geometry,burst&&i%4===0?fragment:blood);
   mesh.position.set(...event.point);mesh.scale.setScalar(burst?1+Math.random()*2:.4+Math.random());
   scene.add(mesh);
   particles.push({mesh,velocity:new T.Vector3((Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3),life:burst?1.3:.65});
  }
 }
 function update(dt:number){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);continue;}p.velocity.y-=9.8*dt;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.rotation.x+=dt*4;p.mesh.scale.multiplyScalar(Math.exp(-dt*.5));}}
 function dispose(){for(const p of particles)scene.remove(p.mesh);particles.length=0;geometry.dispose();blood.dispose();fragment.dispose();}
 return {emit,update,dispose};
}
