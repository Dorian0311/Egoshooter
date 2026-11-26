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
  const map=new T.CanvasTexture(canvas);map.anisotropy=4;return map;
}

export function alpinePassGround(world:World,snow:T.MeshStandardMaterial,road:T.MeshStandardMaterial,rock:T.MeshStandardMaterial){
  const mask=snowControl(world),positions:number[]=[],uv:number[]=[],indices:number[]=[];
  const rows=[-88.5,-74,-60,-45,-30,-20,-14,-10.3,-8.9,-8.1,-7.45,-6.8,-6.1,-4.8,-2.4,0,2.4,4.8,6.1,6.8,7.45,8.1,8.9,10.3,14,20,30,45,60,74,88.5];
  const cols=72;
  for(const [j,z] of rows.entries())for(let i=0;i<=cols;i++){
    const x=(i/cols-.5)*extent,side=Math.sign(z);
    const edge=7.66+.59*Math.sin(x*.18+side)+.37*Math.sin(x*.49-side);
    const bank=Math.max(0,1-Math.abs(Math.abs(z)-edge)/1.65);
    const turnoff=Math.min(1,Math.abs(Math.abs(x)-48)/3.4,Math.abs(x-10.6)/3.4);
    const h=.019+bank*bank*(.105+.044*Math.sin(x*.37))*turnoff;
    positions.push(x,h,z);uv.push(x/4.2,z/4.2);
    if(j&&i){const a=j*(cols+1)+i;indices.push(a-cols-2,a-1,a,a-cols-2,a,a-cols-1);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new T.MeshStandardMaterial({map:snow.map,normalMap:snow.normalMap,roughness:.93});
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
  const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;mesh.name='Alpine pass – ploughed road and barracks approaches';return mesh;
}
