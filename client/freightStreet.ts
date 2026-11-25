import * as T from 'three';
import type {World} from '../shared/world';
import {terrainHeight} from '../shared/terrain';

type Point=readonly [number,number];
/** Low street fabric between the cinema and the freight quay. The existing track and loading sill stay exposed. */
export function freightStreet(world:World,granite:T.Texture|null){
  const solid:number[]=[],stoneColor:number[]=[],stoneUV:number[]=[],wear:number[]=[],wearColor:number[]=[];
  const color=new T.Color(),cache=new Map<string,number>();
  let seed=2083;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  // The playable freight terrain is triangulated; sample its actual planes for flush decals.
  function y(x:number,z:number){
    const x0=Math.floor(x/2)*2,z0=Math.floor(z/2)*2,u=(x-x0)/2,v=(z-z0)/2;
    function at(a:number,b:number){
      const key=a+','+b;
      let h=cache.get(key);if(h===undefined){h=terrainHeight(a,b,world);cache.set(key,h);}return h;
    }
    const b=at(x0+2,z0),c=at(x0,z0+2);
    return u+v<=1?at(x0,z0)*(1-u-v)+b*u+c*v:at(x0+2,z0+2)*(u+v-1)+b*(1-v)+c*(1-u);
  }
  function face(points:Point[],lift:number,tone:string){
    color.set(tone);
    for(let i=1;i<points.length-1;i++)for(const [x,z] of [points[0],points[i],points[i+1]]){
      solid.push(x,y(x,z)+lift,z);stoneColor.push(color.r,color.g,color.b);stoneUV.push(x*.53,z*.53);
    }
  }
  function slab(x:number,z:number,w:number,d:number,h:number,tone:string){
    face([[x,z],[x,z+d],[x+w,z+d],[x+w,z]],h,tone);
  }
  const flags=['#b1aca2','#b8afa1','#b6b1a6','#a7a59c','#bbaea1'];
  // Three linked pavements, laid in staggered courses. Keep the cinema's centre runner and the
  // freight canopy's original platform/ramp intact.
  function pavement(x:number,z:number,length:number,width:number,across=false){
    const point=(l:number,w:number):Point=>across?[x+w,z+l]:[x+l,z+w];
    function flag(start:number,end:number,v:number,depth:number,lift:number,tone:string){
      const corners=[point(start,v),point(start,v+depth),point(end,v+depth),point(end,v)];
      face(across?corners.reverse():corners,lift,tone);
    }
    const courses=Math.max(2,Math.round((width-.28)/.85)),step=(width-.28)/courses;
    for(let row=0;row<courses;row++){
      let start=0;
      while(start<length){
        const end=Math.min(length,start+(start===0&&row%2?.56:1.02+random()*.56));
        if(end-start>.055)flag(start+.012,end-.012,row*step+.012,step-.024,.041+random()*.003,flags[Math.floor(random()*flags.length)]);
        start=end;
      }
    }
    for(let l=0;l<length;l+=1.35){
      const end=Math.min(l+1.33,length);
      flag(l,end,width-.25,.24,.054,'#908a7c');
      flag(l,end,width+.025,.18,.016,'#807d73');
    }
  }
  pavement(-16,-41.4,12.8,4.0);pavement(3.2,-41.4,28.6,4.0);
  pavement(-3.2,-38.20,6.4,.80);
  pavement(28.7,-37.35,10.65,3.1,true);
  pavement(28.7,-26.64,8.65,2.25);
  // A narrow gutter and jointed kerbs along the rail-facing edge of the loading quay.
  for(let x=37.4;x<60.2;x+=1.23)if(x+1.20<52.65||x>54.2)slab(x,-24.08,1.20,.24,.042,'#a29987');
  function grate(x:number,z:number){
    slab(x-.38,z-.22,.76,.44,.058,'#65665e');
    slab(x-.34,z-.18,.68,.36,.062,'#41453f');
    for(let j=0;j<7;j++)slab(x-.285+j*.094,z-.16,.038,.32,.065,'#888479');
  }
  grate(-8.82,-37.18);grate(22.68,-37.18);grate(42.25,-23.95);
  function cover(x:number,z:number,r:number){
    const disk=(s:number)=>Array.from({length:32},(_,i):Point=>[x+s*Math.cos(-i*Math.PI/16),z+s*Math.sin(-i*Math.PI/16)]);
    face(disk(r+.050),.020,'#817d70');face(disk(r),.024,'#4c514b');face(disk(r-.050),.028,'#76756c');
    for(let row=-2;row<=2;row++)for(let n=-2;n<=2;n++){
      const a=x+n*.118+(row%2)*.027,b=z+row*.116;
      if(Math.hypot(a-x,b-z)>r-.10)continue;
      face([[a-.027,b],[a,b+.033],[a+.027,b],[a,b-.033]],.031,'#555950');
    }
  }
  cover(-2.3,-32.4,.425);cover(38.6,-19.15,.47);
  // A sunken service trench was re-laid in small setts. Its irregular joint leads to the inspection cover.
  for(let n=0;n<25;n++){
    const t=n/25,x=-11.8+t*9.1,z=-34.0+t*1.55+Math.sin(n*.65)*.035;
    const w=.29+random()*.045,d=.14+random()*.07;
    face([[x,z],[x-.024,z+d],[x+w,z+d+.045],[x+w+.018,z+.06]],.020,n%4?'#77786f':'#979082');
  }
  function stain(x:number,z:number,w:number,d:number,tone:string,alpha:number){
    const n=12,edge:Point[]=[];
    for(let j=0;j<n;j++){
      const a=-j*Math.PI*2/n,r=.65+.35*random();
      edge.push([x+Math.cos(a)*w*r,z+Math.sin(a)*d*r]);
    }
    color.set(tone);
    for(let j=0;j<n;j++)for(const [px,pz,opacity] of [[x,z,alpha],[...edge[j],0],[...edge[(j+1)%n],0]]){
      wear.push(px,y(px,pz)+.015,pz);wearColor.push(color.r,color.g,color.b,opacity);
    }
  }
  // Wheel traffic accumulates grime in two interrupted, curving ruts near the loading ramp.
  for(let i=0;i<38;i++){
    const t=i/37,x=32+t*22,z=-18.85-t*3.2-.65*Math.sin(t*Math.PI);
    for(const side of [-1,1])if(random()>.18)stain(x,z+side*.75,.67,.18+random()*.13,'#3e3933',.31+random()*.18);
  }
  for(const [x,z] of [[-8,-36.8],[11,-37],[41,-23.5],[49,-23.3],[29,-26.2]]){
    stain(x,z,2.4,.72,'#4d463a',.48);
    for(let i=0;i<17;i++)stain(x+(random()-.5)*4,z+(random()-.5)*1.4,.08+random()*.15,.05+random()*.11,'#443e34',.52);
  }
  const paving=new T.BufferGeometry();
  paving.setAttribute('position',new T.Float32BufferAttribute(solid,3));paving.setAttribute('color',new T.Float32BufferAttribute(stoneColor,3));
  paving.setAttribute('uv',new T.Float32BufferAttribute(stoneUV,2));paving.computeVertexNormals();
  const pavingMaterial=new T.MeshStandardMaterial({vertexColors:true,map:granite,roughness:.94});
  if(granite)pavingMaterial.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','diffuseColor.rgb*=.66+.54*texture2D(map,vMapUv).rgb;');
  };
  const sidewalk=new T.Mesh(paving,pavingMaterial);sidewalk.name='Goods yard flagstone walks and drains';sidewalk.receiveShadow=true;
  const decals=new T.BufferGeometry();
  decals.setAttribute('position',new T.Float32BufferAttribute(wear,3));decals.setAttribute('color',new T.Float32BufferAttribute(wearColor,4));
  const grime=new T.Mesh(decals,new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  grime.name='Loading yard cart ruts and coal dust';grime.renderOrder=1;
  const group=new T.Group();group.name='Freight quarter streets';group.add(sidewalk,grime);return group;
}
