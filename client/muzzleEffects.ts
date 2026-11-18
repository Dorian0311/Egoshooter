import * as T from 'three';

/** Short flashes, expanding smoke and tracers; bounded even with eight automatic weapons. */
export function createMuzzleEffects(scene:T.Scene){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d')!;
  const gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.3,'rgba(255,255,255,.65)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture=new T.CanvasTexture(canvas);
  const particles:Array<{sprite:T.Sprite;velocity:T.Vector3;life:number;total:number;flash:boolean;fresh:boolean}>=[];
  const beamGeometry=new T.CylinderGeometry(1,1,1,6,1,true);
  const beams:{mesh:T.Mesh<T.CylinderGeometry,T.MeshBasicMaterial>;life:number}[]=[];
  const axis=new T.Vector3(0,1,0),offset=new T.Vector3();
  const beamDuration=.145;
  const light=new T.PointLight(0xffb64c,0,4,2);light.layers.enable(1);scene.add(light);let lightLife=0;
  function remove(index:number){const p=particles[index];p.sprite.removeFromParent();p.sprite.material.dispose();particles.splice(index,1);}
  return {
    emit(position:T.Vector3,direction:T.Vector3,end?:T.Vector3,solidImpact=false){
      const length=end?offset.subVectors(end,position).length():0;
      if(length>.08&&offset.dot(direction)>0){
        let beam=beams.find(entry=>entry.life<=0);
        if(!beam&&beams.length<32){
          const material=new T.MeshBasicMaterial({color:'#ffe2a3',transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
          const mesh=new T.Mesh(beamGeometry,material);
          scene.add(mesh);beam={mesh,life:0};beams.push(beam);
        }
        if(beam){
          const {mesh}=beam;
          beam.life=beamDuration;mesh.visible=true;mesh.material.opacity=.95;
          mesh.position.copy(position).addScaledVector(offset,.5);
          mesh.quaternion.setFromUnitVectors(axis,offset.multiplyScalar(1/length));
          const radius=Math.max(.012,Math.min(.025,length*.00055));
          mesh.scale.set(radius,length,radius);
        }
      }
      for(let i=0;i<5;i++){
        if(particles.length>=96)remove(0);
        const flash=i<2;
        const material=new T.SpriteMaterial({map:texture,color:flash?(i===0?0xfff1bc:0xff922e):0x969c99,transparent:true,depthWrite:false,blending:flash?T.AdditiveBlending:T.NormalBlending});
        const sprite=new T.Sprite(material);sprite.position.copy(position).addScaledVector(direction,i*.045);
        const total=flash?.085:.35+i*.065;sprite.scale.setScalar(flash?(i===0?.25:.32):.06);scene.add(sprite);
        particles.push({sprite,flash,fresh:true,life:total,total,velocity:direction.clone().multiplyScalar(flash?0:.5).add(new T.Vector3((Math.random()-.5)*.12,.16,0))});
      }
      if(end&&solidImpact){
        for(let n=0;n<3;n++){
          if(particles.length>=96)remove(0);
          const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,color:n===0?0xfff3bd:0xffb957,depthWrite:false,transparent:true,blending:T.AdditiveBlending}));
          sprite.position.copy(end).addScaledVector(direction,-.07);
          sprite.scale.setScalar(n===0?.19:.085);scene.add(sprite);
          const total=n===0?.12:.18;
          particles.push({sprite,velocity:new T.Vector3((n-1)*.8,n*.45,(1-n)*.6).addScaledVector(direction,-1.1),life:total,total,flash:true,fresh:true});
        }
      }
      light.position.copy(position);light.intensity=2.5;lightLife=.055;
    },
    update(dt:number){
      lightLife-=dt;if(lightLife<=0)light.intensity=0;
      for(const beam of beams){
        if(beam.life<=0)continue;
        beam.life=Math.max(0,beam.life-dt);
        beam.mesh.visible=beam.life>0;
        beam.mesh.material.opacity=.95*(beam.life/beamDuration);
      }
      for(let i=particles.length-1;i>=0;i--){const p=particles[i];if(p.fresh){p.fresh=false;continue;}p.life-=dt;if(p.life<=0){remove(i);continue;}p.sprite.position.addScaledVector(p.velocity,dt);p.sprite.material.opacity=(p.life/p.total)*(p.flash?1:.24);if(!p.flash)p.sprite.scale.addScalar(dt*.24);}
    },
    dispose(){while(particles.length)remove(0);for(const {mesh} of beams){mesh.removeFromParent();mesh.material.dispose();}beamGeometry.dispose();texture.dispose();light.removeFromParent();}
  };
}
