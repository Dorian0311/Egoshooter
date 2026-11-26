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

/** Two continuous rail beds and the loading spur share a single material per half-yard.
 * The nearly flush timbers receive building shadows, with their fastenings baked into the grain. */
export function freightTracks(loadingSpur:boolean){
  const lines=[{z:-12,first:-117,last:143,gauge:.8},{z:12,first:-117,last:143,gauge:.8}];
  if(loadingSpur)lines.push({z:-22,first:46,last:76,gauge:.72});
  return trackwork('Freight yard trackwork',lines,[[-117,0],[0,143]],true);
}

export function cologneBridgeTracks(){
  const lines=[{z:-5,first:-31,last:31,gauge:.8},{z:5,first:-31,last:31,gauge:.8}];
  return trackwork('Cologne bridge trackwork',lines,[[-31,31]]);
}

function trackwork(name:string,lines:{z:number;first:number;last:number;gauge:number}[],sections:[number,number][],eastBank=false){
  const root=new T.Group();
  root.name=name;
  const atlas=new T.TextureLoader().load('/shooter/environment/freight-track.webp');
  atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=4;
  const material=new T.MeshStandardMaterial({map:atlas,vertexColors:true,roughness:.78});
  for(const [sectionStart,sectionEnd] of sections){
    const positions:number[]=[],colors:number[]=[],uv:number[]=[],indices:number[]=[];
    const tint=new T.Color();
    type Vertex=readonly [number,number,number];
    const blank=[.5,.028,.5,.028,.5,.028,.5,.028];
    function quad(a:Vertex,b:Vertex,c:Vertex,d:Vertex,tone:string,coords=blank){
      const start=positions.length/3;
      positions.push(...a,...b,...c,...d);uv.push(...coords);tint.set(tone);
      for(let i=0;i<4;i++)colors.push(tint.r,tint.g,tint.b);
      indices.push(start,start+1,start+2,start,start+2,start+3);
    }
    if(eastBank&&sectionEnd>117){
      // The old yard surface drops one metre outside the playable map. Carry
      // a cinder service lane down this lip and around the water tower.
      const lanes=[-17,-15,-13,-11,-9,-7,-5,-3,-1.05,-.67,.65,1.03,3,5,7,9,11,13,15,17];
      function grade(x:number,offset:number):Vertex{
        const bend=1.4*Math.sin((x-119)*.16)-.8;
        const rim=Math.abs(offset)===17||x>=149;
        const apron=-.035-.92*Math.min(1,(x-119)/3.4);
        const worn=Math.abs(offset)<1.06?.012:0;
        const ragged=Math.abs(offset)>15?.49*Math.sin(.91*x+offset):0;
        return [x,rim?-1.014:apron-worn,bend+offset+ragged];
      }
      for(let x=119;x<149;x+=2)for(let band=0;band<lanes.length-1;band++){
        const low=lanes[band],high=lanes[band+1];
        // Use the existing ballast grain at a finer scale for compacted cinders.
        const v=.004+Math.min(1,(high-low)/2)*.992;
        const reverse=(band+Math.floor((x-119)/2))%2!==0;
        const u0=reverse?1.498:1.002,u1=reverse?1.002:1.498;
        const tone=low===-1.05||low===.65?'#bcb1a0':Math.abs(low)>15?'#b8aa93':'#e5dbc9';
        quad(grade(x,low),grade(x,high),grade(x+2,high),grade(x+2,low),tone,[u0,.004,u0,v,u1,v,u1,.004]);
      }
    }
    for(const {z,first,last,gauge} of lines){
      const left=Math.max(first,sectionStart),right=Math.min(last,sectionEnd);
      if(left>=right)continue;
      if(eastBank&&right>117){
        // The original sleeper strip spans the first 512 atlas pixels. Gravel
        // occupies the appended tile and wraps at physical, metre-scale intervals.
        const gravel=[1.002,.003,1.002,.997,1.498,.997,1.498,.003];
        const profile=[[-2.6,-1.08],[-1.43,-.008],[1.43,-.008],[2.6,-1.08]];
        for(let x=117;x<right;x+=2){
          const end=Math.min(x+2,right);
          for(let band=0;band<3;band++){
            const [a,h]=profile[band],[b,k]=profile[band+1];
            quad([x,h,z+a],[x,k,z+b],[end,k,z+b],[end,h,z+a],'#ffffff',gravel);
          }
        }
        quad([right,-1.08,z+2.6],[right,-1.08,z-2.6],[right,-.008,z-1.43],[right,-.008,z+1.43],'#d5cfc4',gravel);
      }
      const span=gauge/.615;
      const tones=['#e4d9cb','#fff4e4','#d3cbbe','#eee6db'];
      for(let i=0;first+.40+i*.82<last-.1;i++){
        const x=first+.40+i*.82;if(x<left||x>=right)continue;
        const shift=Math.sin(i*4.27+z)*.026;
        const near=z-span+shift,far=z+span+shift,a=x-.12,b=x+.12;
        const top=.055,v=1-((i%3)*80+3)/256,w=v-73/256;
        quad([a,top,near],[a,top,far],[b,top,far],[b,top,near],tones[i%4],[.002,v,.998,v,.998,w,.002,w]);
        quad([a,.001,near],[a,.001,far],[a,top,far],[a,top,near],'#59493d');
        quad([b,.001,far],[b,.001,near],[b,top,near],[b,top,far],'#615044');
      }
      // Cross-section from one rail foot to the other. The iron web is rust-dark,
      // while the running face catches the skylight at a low viewing angle.
      const profile=[[ -.071,.057],[-.071,.072],[-.014,.087],[-.014,.143],[-.036,.148],[-.036,.168],
        [.036,.168],[.036,.148],[.014,.143],[.014,.087],[.071,.072],[.071,.057]];
      const iron=['#665648','#827060','#695342','#776352','#9c9180','#c6c1af','#9c9180','#776352','#695342','#827060','#665648'];
      for(const side of [-1,1])for(let i=0;i<profile.length-1;i++){
        const [p,h]=profile[i],[q,k]=profile[i+1],center=z+side*gauge;
        quad([left,h,center+p],[left,k,center+q],[right,k,center+q],[right,h,center+p],iron[i]);
      }
    }
    const geometry=new T.BufferGeometry();geometry.setIndex(indices);
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    for(let i=0;i<uv.length;i+=2)uv[i]*=512/768;
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const tracks=new T.Mesh(geometry,material);tracks.receiveShadow=true;root.add(tracks);
  }
  return root;
}
