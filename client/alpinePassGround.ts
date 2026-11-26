import * as T from 'three';
import type {World} from '../shared/world';

const extent=177;
type Point=[number,number];

function snowControl(world:World){
  // Three linear masks encode paving, scattered grit and compaction. Drawing these once keeps all
  // six approaches and the carriage ruts out of the frame loop; movement never updates the map.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='black';ctx.fillRect(0,0,1024,1024);
  const scale=canvas.width/extent;
  ctx.setTransform(scale,0,0,-scale,canvas.width/2,canvas.height/2);
  let seed=21601;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function stroke(points:Point[],w:number,color:string){
    ctx.beginPath();ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=w;ctx.strokeStyle=color;
    points.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));ctx.stroke();
  }
  function dab(x:number,z:number,w:number,d:number,angle:number,color:string){
    ctx.beginPath();ctx.ellipse(x,z,w,d,angle,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  }
  const roadEdge=(x:number,side:number)=>side*(6.04+.47*Math.sin(x*.14+side)+.25*Math.sin(x*.49-side));
  ctx.beginPath();
  for(const side of [-1,1])for(let i=0;i<=140;i++){
    const x=side===-1?i-70:70-i,z=roadEdge(x,side)+rnd()*.24;
    if(side===-1&&i===0)ctx.moveTo(x,z);else ctx.lineTo(x,z);
  }
  ctx.closePath();ctx.fillStyle='#ee0000';ctx.fill();
  // Wind leaves broken tongues of snow over the margins and between the vehicle tracks.
  ctx.globalCompositeOperation='destination-out';
  for(let i=0;i<1050;i++){
    const x=rnd()*140-70,side=rnd()<.5?-1:1;
    dab(x,roadEdge(x,side)-side*rnd()*.85,.20+rnd()*2.4,.08+rnd()*.35,(rnd()-.5)*.25,'rgba(0,0,0,.58)');
  }
  for(let i=0;i<160;i++)dab(rnd()*140-70,(rnd()-.5)*1.12,.29+rnd()*2.0,.07+rnd()*.31,rnd()*.15,'rgba(0,0,0,.35)');
  ctx.globalCompositeOperation='destination-over';ctx.fillStyle='black';ctx.fillRect(-extent/2,-extent/2,extent,extent);
  ctx.globalCompositeOperation='lighter';
  for(const side of [-1,1]){
    const rut:Point[]=[],verge:Point[]=[];
    for(let i=0;i<=70;i++){
      const x=-70+i*2;
      rut.push([x,side*1.10+.24*Math.sin(x*.103)+.13*Math.sin(x*.22)]);
      verge.push([x,roadEdge(x,side)+side*.58]);
    }
    stroke(rut,1.15,'#001633');stroke(rut,.53,'#001d53');
    stroke(verge,.62,'#00281b');
    for(let i=0;i<950;i++){
      const x=rnd()*140-70,z=roadEdge(x,side)+side*(rnd()-.2)*1.6;
      dab(x,z,.055+rnd()*.24,.045+rnd()*.14,rnd()*Math.PI,'#004419');
    }
  }
  for(const b of world.buildings){
    const side=Math.sign(b.z),door=b.z-side*(b.d/2+.2);
    // The two central trails bend around the boulders at z=±20.
    const bend=b.x===0?10.6:side*2.5,joinX=b.x+bend;
    const center=(t:number):Point=>[b.x+bend*(b.x===0?Math.min(1,Math.sin((1-t)*Math.PI/2)*1.8):1-t)+.45*Math.sin(2*Math.PI*t),
      side*5.5+(door-side*5.5)*t];
    const path=Array.from({length:37},(_,i)=>center(i/36));
    stroke(path,3.20,'#000e32');stroke(path,1.86,'#001f43');stroke(path,.93,'#00231d');
    dab(b.x,door,.94,1.35,0,'#002f3c');dab(joinX,side*7.35,2.45,1.3,.15,'#002834');
    for(let i=0;i<75;i++){
      const [px,pz]=center(rnd());
      dab(px+(rnd()-.5)*2.3,pz+(rnd()-.5)*.60,.07+rnd()*.20,.055+rnd()*.13,rnd()*Math.PI,'#002d1e');
    }
    // Intermittent boot impressions follow the final packed metres to the threshold.
    for(let i=0;i<12;i++){
      const [px,pz]=center(1-i*.58/Math.abs(door-side*5.5));
      dab(px+(i%2?.18:-.18),pz,.11,.22,i%2?-.14:.14,'#003c49');
    }
  }
  const fort=world.buildings.find(b=>b.name==='ROCHE-LA-CROIX');
  if(fort){
    // Two broken tongues of wind-scoured grit below the crests. The existing
    // green mask reveals the same local stone as the roadside verges.
    for(const side of [-1,1]){
      const front=fort.z+fort.d/2;
      for(let i=0;i<38;i++){
        const t=i/37,x=3.7+t*5.8;
        const z=front+1.47+.26*Math.sin(x*1.8+side)+.16*(rnd()-.5);
        if(Math.sin(t*16+side)>-.26)dab(fort.x+side*x,z,.12+rnd()*.23,.06+rnd()*.10,side*.28,'#004526');
      }
      for(let i=0;i<26;i++){
        const z=front-.20-i*.18,x=fort.w/2+.75+.19*Math.sin(i*.47+side);
        dab(fort.x+side*x,z,.08+rnd()*.13,.10+rnd()*.18,-side*.20,'#003425');
      }
    }
  }
  const map=new T.CanvasTexture(canvas);map.anisotropy=4;return map;
}

export function alpinePassGround(world:World,snow:T.MeshStandardMaterial,road:T.MeshStandardMaterial,rock:T.MeshStandardMaterial){
  const mask=snowControl(world),positions:number[]=[],uv:number[]=[],indices:number[]=[];
  const rows=[-88.5,-74,-60,-45,-30,-20,-14,-10.3,-8.9,-8.1,-7.45,-6.8,-6.1,-4.8,-2.4,0,2.4,4.8,6.1,6.8,7.45,8.1,8.9,10.3,14,20,30,45,60,74,88.5];
  const cols=72;
  const fort=world.buildings.find(b=>b.name==='ROCHE-LA-CROIX');
  for(const [j,z] of rows.entries())for(let i=0;i<=cols;i++){
    const x=(i/cols-.5)*extent,side=Math.sign(z);
    const edge=7.66+.59*Math.sin(x*.18+side)+.37*Math.sin(x*.49-side);
    const bank=Math.max(0,1-Math.abs(Math.abs(z)-edge)/1.65);
    const turnoff=Math.min(1,Math.abs(Math.abs(x)-48)/3.4,Math.abs(x-10.6)/3.4);
    const h=.019+bank*bank*(.105+.044*Math.sin(x*.37))*turnoff;
    positions.push(x,h,z);uv.push(x/4.2,z/4.2);
    const fortCell=fort&&z===-30&&Math.abs(x-extent/(2*cols))<12&&Math.abs(x-extent/(2*cols))>2.5;
    if(j&&i&&!fortCell){const a=j*(cols+1)+i;indices.push(a-cols-2,a-1,a,a-cols-2,a,a-cols-1);}
  }
  if(fort){
    // Replace the four flat ground cells on each flank. Their boundary vertices
    // remain at the original grade; the centre aisle keeps its original triangles.
    const front=fort.z+fort.d/2,wall=fort.w/2;
    const fade=(d:number)=>Math.max(0,1-d*d)**2;
    for(const side of [-1,1]){
      const xs=[extent/cols,3.5,4.7,6.0,7.3,8.5,9.02,9.28,10.32,extent*5/cols];
      const zs=[-45,-43.6,-41.7,-39.8,-38.35,-37.70,-37.22,-36.92,-36.42,-35.58,-30];
      const base=positions.length/3;
      for(const [j,z] of zs.entries())for(const [i,localX] of xs.entries()){
        const x=fort.x+side*localX;
        const frontCrest=front+.69+.11*Math.sin(localX*1.19+side);
        const face=fade((localX-(side>0?6.60:6.12))/3.42)*fade((z-frontCrest)/(z>frontCrest?1.16:.87));
        const edgeCrest=wall+.035+.10*Math.sin(z*1.23+side);
        const flank=fade((z-front+1.74)/5.06)*fade(Math.max(0,z-front-.30)/1.44)*
          fade((localX-edgeCrest)/(localX>edgeCrest?1.23:.85));
        // Keep the tall crest against the battered cheek and the side masonry.
        // The next transverse sample lies inside one player radius; beyond it
        // only shallow windblown snow remains over the unchanged walking plane.
        const taper=(gap:number)=>.16+.84*fade(Math.max(0,gap)/.26);
        const cheekGap=Math.max(z-front-.79,localX-8.92);
        const sideGap=Math.max(localX-wall,z-front);
        const height=Math.max(face*(side>0?.74:.56)*taper(cheekGap),flank*(side>0?.53:.64)*taper(sideGap))*
          (.86+.14*Math.cos(localX*.77+z*.83));
        const rim=i===0||j===0||i===xs.length-1||j===zs.length-1;
        positions.push(x,.019+(rim?0:height),z);uv.push(x/4.2,z/4.2);
        if(i&&j){
          const a=base+j*xs.length+i,b=a-xs.length-1;
          if(side>0)indices.push(b,a-1,a,b,a,a-xs.length);
          else indices.push(b,a,a-1,b,a-xs.length,a);
        }
      }
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new T.MeshStandardMaterial({map:snow.map,normalMap:snow.normalMap,roughness:.93,depthFunc:T.LessDepth});
  material.normalScale.setScalar(.58);
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{passControl:{value:mask},passSetts:{value:road.map},passStone:{value:rock.map},passSettsNormal:{value:road.normalMap}});
    shader.fragmentShader='uniform sampler2D passControl,passSetts,passStone,passSettsNormal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 layer=texture2D(passControl,vMapUv*(4.2/177.0)+.5).rgb;
      vec3 snowSample=texture2D(map,vMapUv).rgb;
      vec3 setts=texture2D(passSetts,vMapUv*1.48).rgb;
      vec3 grit=texture2D(passStone,vMapUv*2.7).rgb;
      float packed=smoothstep(.03,.78,layer.b);
      float gravel=smoothstep(.035,.72,layer.g+(grit.g-.28)*min(1.,layer.g*6.));
      float paving=smoothstep(.13,.82,layer.r+(snowSample.g-.45)*.22);
      vec3 ice=mix(snowSample*vec3(.95,.98,1.),snowSample*vec3(.60,.69,.72)+vec3(.034),packed);
      vec3 street=mix(setts*vec3(.79,.74,.66),setts*vec3(.58,.57,.53),packed*.68);
      diffuseColor.rgb*=mix(mix(ice,grit*.81+vec3(.065),gravel*.77),street,paving);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 micro=mix(texture2D(normalMap,vNormalMapUv).xyz,texture2D(passSettsNormal,vNormalMapUv*1.48).xyz,paving)*2.-1.;
      micro.xy*=normalScale*mix(1.,.62,packed);normal=normalize(tbn*micro);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor=roughness-packed*.23+gravel*.035;');
  };
  material.addEventListener('dispose',()=>mask.dispose());
  const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;mesh.name='Alpine pass – ploughed road and barracks approaches';
  // Let opaque buildings populate the depth buffer first. Equal-depth edging
  // and pavement retain priority over the ground drawn underneath them.
  mesh.renderOrder=1;
  return mesh;
}
