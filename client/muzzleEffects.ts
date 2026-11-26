import * as T from 'three';
import {createCombatBillboards} from './combatBillboards';

const particleCapacity=96;
type ImpactSurface='metal'|'wood'|'stone'|'earth';
type Particle={
  position:T.Vector3;velocity:T.Vector3;size:number;life:number;total:number;
  color:T.Color;flash:boolean;fresh:boolean;
};

/** Short flashes, expanding smoke and tracers; bounded even with eight automatic weapons. */
export function createMuzzleEffects(scene:T.Scene){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d')!;
  const gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.3,'rgba(255,255,255,.65)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture=new T.CanvasTexture(canvas),group=new T.Group();
  group.name='muzzle-effects';scene.add(group);
  const flashBatch=createCombatBillboards(texture,particleCapacity,T.AdditiveBlending);
  const smokeBatch=createCombatBillboards(texture,particleCapacity,T.NormalBlending);
  group.add(flashBatch.mesh,smokeBatch.mesh);
  const colors=[0xfff1bc,0xff922e,0x969c99,0xfff3bd,0xffb957].map(color=>new T.Color(color));
  const dust={wood:new T.Color('#b38a5b'),stone:new T.Color('#a7a8a0'),earth:new T.Color('#9b805c')};
  const free:Particle[]=Array.from({length:particleCapacity},()=>({
    position:new T.Vector3(),velocity:new T.Vector3(),size:0,life:0,total:0,
    color:colors[0],flash:false,fresh:false,
  }));
  const particles:Particle[]=[];
  const beamGeometry=new T.CylinderGeometry(1,1,1,6,1,true);
  const beamCapacity=32;
  const beamOpacity=new T.InstancedBufferAttribute(new Float32Array(beamCapacity),1).setUsage(T.DynamicDrawUsage);
  beamGeometry.setAttribute('beamOpacity',beamOpacity);
  const beamMaterial=new T.MeshBasicMaterial({color:'#ffe2a3',transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
  beamMaterial.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float beamOpacity; varying float vBeamOpacity;\n'+shader.vertexShader
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvBeamOpacity=beamOpacity;');
    shader.fragmentShader='varying float vBeamOpacity;\n'+shader.fragmentShader
      .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vBeamOpacity;');
  };
  const tracerBatch=new T.InstancedMesh(beamGeometry,beamMaterial,beamCapacity);
  tracerBatch.name='instanced-tracers';tracerBatch.count=0;tracerBatch.visible=false;tracerBatch.frustumCulled=false;
  tracerBatch.instanceMatrix.setUsage(T.DynamicDrawUsage);
  group.add(tracerBatch);
  const beams=Array.from({length:beamCapacity},()=>({matrix:new T.Matrix4(),life:0}));
  const beamPose=new T.Object3D();
  const axis=new T.Vector3(0,1,0),offset=new T.Vector3();
  const beamDuration=.145;
  const light=new T.PointLight(0xffb64c,0,4,2);light.layers.enable(1);scene.add(light);let lightLife=0;
  function particle(flash:boolean,size:number,life:number,color:T.Color){
    const p=free.pop()??particles.shift()!;
    p.flash=flash;p.fresh=true;p.life=life;p.total=life;p.size=size;p.color=color;
    particles.push(p);return p;
  }
  return {
    group,texture,
    emit(position:T.Vector3,direction:T.Vector3,end?:T.Vector3,surface?:ImpactSurface){
      const length=end?offset.subVectors(end,position).length():0;
      if(length>.08&&offset.dot(direction)>0){
        const beam=beams.find(entry=>entry.life<=0);
        if(beam){
          beam.life=beamDuration;
          beamPose.position.copy(position).addScaledVector(offset,.5);
          beamPose.quaternion.setFromUnitVectors(axis,offset.multiplyScalar(1/length));
          const radius=Math.max(.012,Math.min(.025,length*.00055));
          beamPose.scale.set(radius,length,radius);
          beamPose.updateMatrix();
          beam.matrix.copy(beamPose.matrix);
        }
      }
      for(let i=0;i<5;i++){
        const flash=i<2;
        const p=particle(flash,i===0?.25:i===1?.32:.06,flash?.085:.35+i*.065,colors[Math.min(i,2)]);
        p.position.copy(position).addScaledVector(direction,i*.045);
        p.velocity.copy(direction).multiplyScalar(flash?0:.5);
        p.velocity.x+=(Math.random()-.5)*.12;p.velocity.y+=.16;
      }
      if(end&&surface){
        const metal=surface==='metal';
        for(let n=0;n<(metal?3:4);n++){
          const p=particle(metal,metal?(n===0?.15:.065):.065+n*.037,
            metal?.11+n*.031:.24+n*.065,metal?colors[n===0?3:4]:dust[surface]);
          const spray=(n%2===0?-1:1)*(.36+.29*n);
          p.position.copy(end).addScaledVector(direction,-.065);
          p.velocity.set(spray,.16+n*(metal?.38:.25),spray*.67).addScaledVector(direction,metal?-1.43:-.52);
        }
      }
      light.position.copy(position);light.intensity=2.5;lightLife=.055;
    },
    update(dt:number){
      lightLife-=dt;if(lightLife<=0)light.intensity=0;
      let activeBeams=0;
      for(const beam of beams){
        if(beam.life<=0)continue;
        beam.life=Math.max(0,beam.life-dt);
        if(beam.life===0)continue;
        tracerBatch.setMatrixAt(activeBeams,beam.matrix);
        beamOpacity.setX(activeBeams,.95*beam.life/beamDuration);
        activeBeams++;
      }
      tracerBatch.count=activeBeams;
      tracerBatch.visible=activeBeams>0;
      if(activeBeams){
        tracerBatch.instanceMatrix.needsUpdate=true;
        beamOpacity.needsUpdate=true;
      }
      let remaining=0;
      for(const p of particles){
        const fresh=p.fresh;p.fresh=false;
        if(!fresh){
          p.life-=dt;
          if(p.life<=0){free.push(p);continue;}
          p.position.addScaledVector(p.velocity,dt);
          if(!p.flash)p.size+=dt*.24;
        }
        const batch=p.flash?flashBatch:smokeBatch;
        batch.add(p.position,p.size,fresh?1:p.life/p.total*(p.flash?1:.24),p.color);
        particles[remaining++]=p;
      }
      particles.length=remaining;
      smokeBatch.flush();flashBatch.flush();
    },
    dispose(){
      smokeBatch.dispose();flashBatch.dispose();group.removeFromParent();
      tracerBatch.dispose();beamMaterial.dispose();
      beamGeometry.dispose();texture.dispose();light.removeFromParent();
    },
  };
}
