import * as T from 'three';
import type {GameEvent} from '../shared/game.ts';

type Particle={position:T.Vector3;rotation:T.Euler;scale:T.Vector3;velocity:T.Vector3;spin:T.Vector3;life:number;total:number;slowRemaining:number;floor:number;size:number;mist:boolean;fragment:boolean;landed:boolean};

/** Cosmetic slowdown: combat and movement keep their normal clock. */
export function headshotStep(dt:number,slowRemaining:number){
 const slow=Math.min(dt,slowRemaining);
 return dt-slow+slow*.18;
}

export function createHitEffects(scene:T.Scene){
 const particles:Particle[]=[];
 const geometry=new T.SphereGeometry(.009,6,4);
 const blood=new T.MeshStandardMaterial({color:'#8e0b19',roughness:.35});
 const fragment=new T.MeshStandardMaterial({color:'#d6bd94',roughness:.85,side:T.DoubleSide});
 const skullGeometry=new T.SphereGeometry(.035,6,4,0,Math.PI*.45,Math.PI*.18,Math.PI*.48);
 // Clamp apparent size in view space. A nearby impact must not turn a small
 // droplet into a screen-filling polygon, including when a head is held close.
 for(const [material,radius]of [[blood,.009],[fragment,.035]] as const){
  material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   #ifdef USE_INSTANCING
    vec4 particleCenter=modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);
    float particleDepth=-particleCenter.z;
    float particleExtent=${radius.toFixed(3)}*max(length(instanceMatrix[0].xyz),max(length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz)));
    float particleScale=smoothstep(0.12,0.5,particleDepth)*min(1.0,max(0.0,particleDepth)*0.018/max(0.0001,particleExtent));
    transformed*=particleScale;
   #endif
   #include <project_vertex>`);};
  material.customProgramCacheKey=()=>`bounded-impact-${radius}`;
 }
 // Three bounded GPU batches replace up to 256 individual render objects.
 const droplets=new T.InstancedMesh(geometry,blood,256),skulls=new T.InstancedMesh(skullGeometry,fragment,256);
 droplets.name='hit-droplet';skulls.name='headshot-fragment';
 for(const mesh of [droplets,skulls]){mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);}
 const mistGeometry=new T.BufferGeometry(),mistPositions=new T.Float32BufferAttribute(new Float32Array(256*3),3),mistSizes=new T.Float32BufferAttribute(new Float32Array(256),1),mistOpacity=new T.Float32BufferAttribute(new Float32Array(256),1);
 mistGeometry.setAttribute('position',mistPositions);mistGeometry.setAttribute('particleSize',mistSizes);mistGeometry.setAttribute('opacity',mistOpacity);
 const mistMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:'attribute float particleSize;attribute float opacity;varying float alpha;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(particleSize*300.0/max(.1,-p.z),1.0,96.0);alpha=opacity;}',fragmentShader:'varying float alpha;void main(){float r=length(gl_PointCoord*2.0-1.0);gl_FragColor=vec4(.55,.025,.08,alpha*pow(max(0.0,1.0-r),2.0));}'});
 const mist=new T.Points(mistGeometry,mistMaterial);mist.name='headshot-mist';mist.frustumCulled=false;mist.visible=false;scene.add(mist);
 const matrix=new T.Object3D();
 function uploadVisible(attribute:T.BufferAttribute,count:number){
  if(!count)return;
  attribute.clearUpdateRanges();attribute.addUpdateRange(0,count*attribute.itemSize);attribute.needsUpdate=true;
 }
 function sync(first=0){
  let drops=first?droplets.count:0,chunks=first?skulls.count:0,clouds=first?mistGeometry.drawRange.count:0;
  for(let i=first;i<particles.length;i++){
   const p=particles[i];
   if(p.mist){mistPositions.setXYZ(clouds,p.position.x,p.position.y,p.position.z);mistSizes.setX(clouds,p.scale.x);mistOpacity.setX(clouds,.28*Math.pow(p.life/p.total,1.5));clouds++;}
   else{matrix.position.copy(p.position);matrix.rotation.copy(p.rotation);matrix.scale.copy(p.scale);matrix.updateMatrix();(p.fragment?skulls:droplets).setMatrixAt(p.fragment?chunks++:drops++,matrix.matrix);}
  }
  droplets.count=drops;skulls.count=chunks;droplets.visible=!!drops;skulls.visible=!!chunks;mist.visible=!!clouds;mistGeometry.setDrawRange(0,clouds);
  uploadVisible(droplets.instanceMatrix,drops);uploadVisible(skulls.instanceMatrix,chunks);
  uploadVisible(mistPositions,clouds);uploadVisible(mistSizes,clouds);uploadVisible(mistOpacity,clouds);
 }
 function remove(index:number){particles.splice(index,1);}
 function emit(event:GameEvent,slowMotion=false,direction=new T.Vector3(0,0,-1),floorY?:number){
  if(!event.point)return;
  const burst=event.type==='sever'||event.type==='kill'&&event.hitZone==='head';
  if(event.type!=='hit'&&!burst)return;
  const forward=direction.clone();if(forward.lengthSq()<.0001)forward.set(0,0,-1);forward.normalize();
  const count=burst?72:16;
  // Reserve space for the newest confirmed impact during sustained multiplayer fire.
  const overflow=particles.length+count-256;
  const first=overflow>0?0:particles.length;
  if(overflow>0)particles.splice(0,overflow);
  for(let i=0;i<count;i++){
   const mist=burst&&i>=64,skull=burst&&!mist&&i%4===0;
   const position=new T.Vector3(...event.point).add(new T.Vector3((Math.random()-.5)*.09,(Math.random()-.5)*.09,(Math.random()-.5)*.09)),rotation=new T.Euler(Math.random()*6,Math.random()*6,Math.random()*6);
   const scale=mist?.28+Math.random()*.2:skull?.45+Math.random()*.7:burst?.8+Math.random()*1.8:.4+Math.random();

   const spread=mist?.9:burst?3.6:1.8;
   const velocity=new T.Vector3((Math.random()-.5)*spread,Math.random()*(mist?.6:2.8),(Math.random()-.5)*spread).addScaledVector(forward,mist?.7:burst?2+Math.random()*3:.8);
   const total=mist?.75:burst?1.6:.65;

   particles.push({position,rotation,scale:new T.Vector3(scale,scale,scale),velocity,spin:new T.Vector3((Math.random()-.5)*14,(Math.random()-.5)*12,(Math.random()-.5)*14),life:total,total,slowRemaining:burst&&slowMotion?.85:0,floor:(floorY??event.point[1]-1.65)+.018,size:scale,mist,fragment:skull,landed:false});
  }sync(first);
 }
 function update(dt:number){
  if(!particles.length||!Number.isFinite(dt)||dt<=0)return;
  for(let i=particles.length-1;i>=0;i--){
   const p=particles[i],step=headshotStep(dt,p.slowRemaining);
   p.slowRemaining=Math.max(0,p.slowRemaining-dt);p.life-=step;
   if(p.life<=0){remove(i);continue;}
   if(p.mist){
    p.position.addScaledVector(p.velocity,step);p.velocity.multiplyScalar(Math.exp(-step*3));
    p.scale.setScalar(p.size+(1-p.life/p.total)*1.1);

   }else{
    for(let remaining=step;remaining>0;){const sub=Math.min(remaining,1/60);remaining-=sub;
     if(!p.landed){p.velocity.y-=9.8*sub;p.position.addScaledVector(p.velocity,sub);
      if(p.position.y<=p.floor){p.position.y=p.floor;
       if(p.fragment&&p.velocity.y<-.8){p.velocity.y*=-.24;p.velocity.x*=.5;p.velocity.z*=.5;}
       else{p.landed=true;p.velocity.set(0,0,0);if(!p.fragment){p.scale.set(p.size*2.5,.15,p.size*2.5);p.rotation.set(0,p.rotation.y,0);}}
      }
     }
    }
    if(!p.landed){p.rotation.x+=p.spin.x*step;p.rotation.y+=p.spin.y*step;p.rotation.z+=p.spin.z*step;}
    if(p.life<.3)p.scale.multiplyScalar(Math.max(0,p.life/(p.life+step)));
   }
  }sync();
 }
 function dispose(){while(particles.length)remove(0);for(const mesh of [droplets,skulls]){mesh.removeFromParent();mesh.dispose();}mist.removeFromParent();mistGeometry.dispose();mistMaterial.dispose();geometry.dispose();skullGeometry.dispose();blood.dispose();fragment.dispose();}
 return {emit,update,dispose,stats:()=>({particles:particles.length,drawCalls:Number(droplets.visible)+Number(skulls.visible)+Number(mist.visible)}),clear(){particles.length=0;sync();}};
}
