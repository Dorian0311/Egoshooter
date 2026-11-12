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
  const light=new T.PointLight(0xffb64c,0,4,2);scene.add(light);let lightLife=0;
  function remove(index:number){const p=particles[index];p.sprite.removeFromParent();p.sprite.material.dispose();particles.splice(index,1);}
  return {
    emit(position:T.Vector3,direction:T.Vector3){
      for(let i=0;i<5;i++){
        if(particles.length>=96)remove(0);
        const flash=i<2;
        const material=new T.SpriteMaterial({map:texture,color:flash?(i===0?0xfff1bc:0xff922e):0x969c99,transparent:true,depthWrite:false,blending:flash?T.AdditiveBlending:T.NormalBlending});
        const sprite=new T.Sprite(material);sprite.position.copy(position).addScaledVector(direction,i*.045);
        const total=flash?.055:.35+i*.065;sprite.scale.setScalar(flash?.17:.06);scene.add(sprite);
        particles.push({sprite,flash,fresh:true,life:total,total,velocity:direction.clone().multiplyScalar(flash?0:.5).add(new T.Vector3((Math.random()-.5)*.12,.16,0))});
      }
      light.position.copy(position);light.intensity=2.5;lightLife=.055;
    },
    update(dt:number){
      lightLife-=dt;if(lightLife<=0)light.intensity=0;
      for(let i=particles.length-1;i>=0;i--){const p=particles[i];if(p.fresh){p.fresh=false;continue;}p.life-=dt;if(p.life<=0){remove(i);continue;}p.sprite.position.addScaledVector(p.velocity,dt);p.sprite.material.opacity=(p.life/p.total)*(p.flash?1:.24);if(!p.flash)p.sprite.scale.addScalar(dt*.24);}
    },
    dispose(){while(particles.length)remove(0);texture.dispose();light.removeFromParent();}
  };
}
