import * as T from 'three';
import type {GameEvent} from '../shared/game.ts';

type Particle={object:T.Mesh|T.Sprite;velocity:T.Vector3;spin:T.Vector3;life:number;total:number;slowRemaining:number;floor:number;size:number;mist:boolean;fragment:boolean;landed:boolean};

/** Cosmetic slowdown: combat and movement keep their normal clock. */
export function headshotStep(dt:number,slowRemaining:number){
 const slow=Math.min(dt,slowRemaining);
 return dt-slow+slow*.18;
}

export function createHitEffects(scene:T.Scene){
 const particles:Particle[]=[];
 const geometry=new T.IcosahedronGeometry(.018,0);
 const blood=new T.MeshStandardMaterial({color:'#8e0b19',roughness:.35});
 const fragment=new T.MeshStandardMaterial({color:'#d6bd94',roughness:.85,side:T.DoubleSide});
 const skullGeometry=new T.SphereGeometry(.09,4,3,0,Math.PI*.45,Math.PI*.18,Math.PI*.48);
 // Locally generated blood mist: no external image or asset subscription.
 const size=32,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const radius=Math.hypot((x+.5-size/2)/(size/2),(y+.5-size/2)/(size/2));
  const at=(y*size+x)*4;data[at]=data[at+1]=data[at+2]=255;
  data[at+3]=Math.round(255*Math.pow(Math.max(0,1-radius),2)*(.8+.2*Math.sin(x*1.7+y*.9)));
 }
 const mistTexture=new T.DataTexture(data,size,size);mistTexture.needsUpdate=true;
 mistTexture.magFilter=mistTexture.minFilter=T.LinearFilter;
 function remove(index:number){const p=particles[index];p.object.removeFromParent();if(p.object instanceof T.Sprite)p.object.material.dispose();particles.splice(index,1);}
 function emit(event:GameEvent,slowMotion=false,direction=new T.Vector3(0,0,-1),floorY?:number){
  if(!event.point)return;
  const burst=event.type==='kill'&&event.hitZone==='head';
  if(event.type!=='hit'&&!burst)return;
  const forward=direction.clone();if(forward.lengthSq()<.0001)forward.set(0,0,-1);forward.normalize();
  const count=burst?72:16;
  // Reserve space for the newest confirmed impact during sustained multiplayer fire.
  while(particles.length+count>256)remove(0);
  for(let i=0;i<count;i++){
   const mist=burst&&i>=64,skull=burst&&!mist&&i%4===0;
   const object=mist?new T.Sprite(new T.SpriteMaterial({map:mistTexture,color:'#a40820',transparent:true,opacity:.28,depthWrite:false,rotation:Math.random()*Math.PI*2})):new T.Mesh(skull?skullGeometry:geometry,skull?fragment:blood);
   object.name=mist?'headshot-mist':skull?'headshot-fragment':'hit-droplet';
   object.position.set(...event.point).add(new T.Vector3((Math.random()-.5)*.09,(Math.random()-.5)*.09,(Math.random()-.5)*.09));
   object.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);
   const scale=mist?.28+Math.random()*.2:skull?.45+Math.random()*.7:burst?.8+Math.random()*1.8:.4+Math.random();
   object.scale.setScalar(scale);
   const spread=mist?.9:burst?3.6:1.8;
   const velocity=new T.Vector3((Math.random()-.5)*spread,Math.random()*(mist?.6:2.8),(Math.random()-.5)*spread).addScaledVector(forward,mist?.7:burst?2+Math.random()*3:.8);
   const total=mist?.75:burst?1.6:.65;
   scene.add(object);
   particles.push({object,velocity,spin:new T.Vector3((Math.random()-.5)*14,(Math.random()-.5)*12,(Math.random()-.5)*14),life:total,total,slowRemaining:burst&&slowMotion?.85:0,floor:(floorY??event.point[1]-1.65)+.018,size:scale,mist,fragment:skull,landed:false});
  }
 }
 function update(dt:number){
  if(!Number.isFinite(dt)||dt<=0)return;
  for(let i=particles.length-1;i>=0;i--){
   const p=particles[i],step=headshotStep(dt,p.slowRemaining);
   p.slowRemaining=Math.max(0,p.slowRemaining-dt);p.life-=step;
   if(p.life<=0){remove(i);continue;}
   if(p.mist){
    p.object.position.addScaledVector(p.velocity,step);p.velocity.multiplyScalar(Math.exp(-step*3));
    p.object.scale.setScalar(p.size+(1-p.life/p.total)*1.1);
    (p.object as T.Sprite).material.opacity=.28*Math.pow(p.life/p.total,1.5);
   }else{
    for(let remaining=step;remaining>0;){const sub=Math.min(remaining,1/60);remaining-=sub;
     if(!p.landed){p.velocity.y-=9.8*sub;p.object.position.addScaledVector(p.velocity,sub);
      if(p.object.position.y<=p.floor){p.object.position.y=p.floor;
       if(p.fragment&&p.velocity.y<-.8){p.velocity.y*=-.24;p.velocity.x*=.5;p.velocity.z*=.5;}
       else{p.landed=true;p.velocity.set(0,0,0);if(!p.fragment){p.object.scale.set(p.size*2.5,.15,p.size*2.5);p.object.rotation.set(0,p.object.rotation.y,0);}}
      }
     }
    }
    if(!p.landed){p.object.rotation.x+=p.spin.x*step;p.object.rotation.y+=p.spin.y*step;p.object.rotation.z+=p.spin.z*step;}
    if(p.life<.3)p.object.scale.multiplyScalar(Math.max(0,p.life/(p.life+step)));
   }
  }
 }
 function dispose(){while(particles.length)remove(0);geometry.dispose();skullGeometry.dispose();blood.dispose();fragment.dispose();mistTexture.dispose();}
 return {emit,update,dispose};
}
