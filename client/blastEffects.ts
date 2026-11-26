import * as T from 'three';
import {createCombatBillboards} from './combatBillboards';

const capacity=12,flashParts=3,smokeParts=5,duration=1680;
type Point=readonly [number,number,number];

function plumeTexture(soft:boolean){
  const side=64,pixels=new Uint8Array(side*side*4);
  for(let row=0;row<side;row++)for(let col=0;col<side;col++){
    const x=(col+.5)/side*2-1,y=(row+.5)/side*2-1;
    const noise=Math.sin(x*14+y*7)*Math.cos(y*12-x*6)*.12+Math.sin(x*26-y*21)*.06;
    const radius=Math.hypot(x,y);
    const alpha=Math.max(0,1-radius*radius)**(soft?1.72:3.2);
    const at=(row*side+col)*4;
    const tint=soft?Math.round(233+(noise-.06)*92):255;
    pixels[at]=pixels[at+1]=pixels[at+2]=tint;
    pixels[at+3]=Math.round(255*alpha*(soft? .78+noise:1));
  }
  const texture=new T.DataTexture(pixels,side,side);
  texture.magFilter=texture.minFilter=T.LinearFilter;texture.needsUpdate=true;
  return texture;
}

/** Fire and dispersing dust consume at most two batched draws. */
export function createBlastEffects(parent:T.Object3D){
  const group=new T.Group();group.name='explosion-effects';parent.add(group);
  const glow=plumeTexture(false),cloud=plumeTexture(true);
  const flashes=createCombatBillboards(glow,capacity*flashParts,T.AdditiveBlending);
  const smoke=createCombatBillboards(cloud,capacity*smokeParts,T.NormalBlending);
  group.add(flashes.mesh,smoke.mesh);
  const bursts=Array.from({length:capacity},()=>({
    point:new T.Vector3(),started:-Infinity,radius:0,phase:0,
  }));
  const hot=new T.Color('#fff1c6').multiplyScalar(1.85),fire=new T.Color('#ff9a45').multiplyScalar(1.35);
  const ash=new T.Color('#62574b'),dust=new T.Color('#a09685');
  const p=new T.Vector3(),tint=new T.Color();
  const plumes=Array.from({length:smokeParts},(_,i)=>[Math.cos(i*2.4),Math.sin(i*2.4),.84+(i%3)*.15] as const);
  let next=0;
  return {
    group,
    emit(point:Point,radius:number,time:number){
      const i=next++%capacity,burst=bursts[i];
      burst.point.set(...point);burst.radius=radius;burst.started=time;burst.phase=i*.84;
    },
    update(time:number){
      for(const burst of bursts){
        const elapsed=time-burst.started;
        if(elapsed<0||elapsed>=duration)continue;
        const age=elapsed/duration,radius=burst.radius;
        const flash=elapsed/250,cs=Math.cos(burst.phase),sn=Math.sin(burst.phase);
        if(flash<1){
          for(let i=0;i<flashParts;i++){
            const spread=(i-1)*radius*(.10+.13*flash);
            p.set(burst.point.x+spread*cs,burst.point.y+radius*(.09+i*.035+flash*.08),burst.point.z+spread*sn);
            flashes.add(p,radius*(.41+flash*.32-i*.06),(1-flash)**2*(i===0?.94:.67),i===0?hot:fire);
          }
        }
        if(elapsed===0)continue;
        const fade=Math.min(1,elapsed/110)*(1-age)**1.56;
        tint.copy(ash).lerp(dust,age);
        for(const [x,z,scale] of plumes){
          const spread=radius*(.15+.43*age);
          p.set(burst.point.x+(x*cs-z*sn)*spread,burst.point.y+radius*(.12+age*.47)*scale,
            burst.point.z+(x*sn+z*cs)*spread);
          smoke.add(p,radius*(.47+.46*age)*scale,fade*.52,tint);
        }
      }
      smoke.flush();flashes.flush();
    },
    dispose(){flashes.dispose();smoke.dispose();glow.dispose();cloud.dispose();group.removeFromParent();},
  };
}
