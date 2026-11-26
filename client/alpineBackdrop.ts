import * as T from 'three';

const tau=Math.PI*2;
const primary=[68,40,44,27,49,43,56,31,26,43,38,65,48,33,50,46,32,57,72,51,29,44,33,52];
const outer=[67,91,59,76,52,62,86,68,88,58,73,53,84,57,67,83,72,55,66,88,57,75,48,80];
function crest(angle:number,samples:number[]){
  const p=((angle/tau%1+1)%1)*samples.length,i=Math.floor(p);
  return T.MathUtils.lerp(samples[i],samples[(i+1)%samples.length],p-i);
}
function flank(r:number,peak:number,toward:number,away:number){
  return Math.max(0,1-Math.abs(r-peak)/(r<peak?toward:away));
}
function height(a:number,r:number){
  const first=148+9*Math.sin(3*a)+5*Math.cos(7*a);
  const back=203+12*Math.sin(4*a+1.1);
  const gully=a+.046*Math.sin(r*.054+2*a);
  const flute=Math.abs(Math.sin(gully*29+1.4*Math.sin(gully*11)));
  const spur=Math.sin(gully*12+.8*Math.cos(gully*5));
  const inner=flank(r,first,53+8*spur,45);
  const outerFace=flank(r,back,52,36);
  const h1=inner*(crest(a+.025*Math.sin(a*7),primary)+6*spur+4*flute)
    -11*Math.sin(inner*Math.PI)*(1-flute);
  const h2=outerFace*(crest(a+.27,outer)+5*Math.cos(23*a)-4*Math.abs(Math.sin(38*a)));
  return Math.max(-.12,h1,h2)-.10;
}
function firGeometry(){
  const vertices:number[]=[],uv:number[]=[],normals:number[]=[],indices:number[]=[];
  // Narrow each section to the crown. Mirrored backs have their own upward
  // normals so the canopy keeps receiving skylight when the camera turns.
  for(let plane=0;plane<3;plane++){
    const angle=plane*Math.PI/3,dx=Math.cos(angle),dz=Math.sin(angle),cell=plane%2;
    for(const facing of [-1,1]){
      const start=vertices.length/3;
      for(const [y,extent] of [[0,.91],[.23,1],[.67,.58],[1,.06]]){
        for(const sign of [-1,1]){
          const lateral=sign*extent;
          vertices.push(dx*lateral*.33,y,dz*lateral*.33);
          uv.push((cell+.5+lateral*.496)/2,.002+.996*y);
          normals.push(-dz*facing*.50,.866,dx*facing*.50);
        }
      }
      for(let row=0;row<3;row++){
        const a=start+row*2;
        if(facing===1)indices.push(a,a+1,a+2,a+2,a+1,a+3);
        else indices.push(a,a+2,a+1,a+2,a+3,a+1);
      }
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);return g;
}

/** Twin ridges outside the square fort perimeter. Ground and snow cover share one draw. */
export function addAlpineBackdrop(scene:T.Scene,rock?:T.Texture,snow?:T.Texture){
  const segments=192,rings=24,positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let row=0;row<=rings+1;row++){
    const t=(row-1)/rings;
    for(let i=0;i<=segments;i++){
      const a=i*tau/segments;
      const axis=Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a)));
      const border=Math.max(88,74.4/axis);
      // Start below the pass floor so the ridges meet solid ground between peaks.
      const r=row===0?T.MathUtils.clamp(border-3,74.1/axis,87/axis):T.MathUtils.lerp(border,247,t);
      const y=row===0?-.20:height(a,r);
      positions.push(Math.cos(a)*r,y,Math.sin(a)*r);
      uv.push(i/segments*56,(r*.65+y*.95)/12);
      if(row<=rings&&i<segments){
        const v=row*(segments+1)+i,next=v+segments+1;
        if((row+i+1)%2)indices.push(v,v+1,next,next,v+1,next+1);
        else indices.push(v,v+1,next+1,v,next+1,next);
      }
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  const normals=geo.getAttribute('normal'),cover=new Float32Array(positions.length/3);
  for(let i=0;i<cover.length;i++){
    const x=positions[3*i],y=positions[3*i+1],z=positions[3*i+2];
    const grain=Math.sin(x*.27+y*.33+z*.11)*.09+Math.sin(z*.19-x*.07)*.08;
    // Drifts settle on benches and the leeward faces. Steep wind-scoured faces expose bedrock.
    cover[i]=T.MathUtils.clamp((normals.getY(i)-.65)*1.8+normals.getX(i)*.16+.36+Math.min(y/85,.65)*.35+grain,0,1);
  }
  geo.setAttribute('snowCover',new T.BufferAttribute(cover,1));
  const material=new T.MeshStandardMaterial({map:rock??null,roughness:.96});
  if(!rock||!snow){
    const tints=new Float32Array(cover.length*3),stoneTint=new T.Color('#788181'),snowTint=new T.Color('#e4edf0'),tint=new T.Color();
    cover.forEach((v,i)=>tint.copy(stoneTint).lerp(snowTint,v).toArray(tints,i*3));
    geo.setAttribute('color',new T.BufferAttribute(tints,3));material.vertexColors=true;
  }else material.onBeforeCompile=shader=>{
    shader.uniforms.alpSnow={value:snow};
    shader.vertexShader='attribute float snowCover; varying float vAlpSnow;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvAlpSnow=snowCover;');
    shader.fragmentShader='uniform sampler2D alpSnow; varying float vAlpSnow;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 cliff=texture2D(map,vMapUv).rgb;
      vec3 drift=texture2D(alpSnow,vMapUv*.68).rgb;
      float seams=sin(vMapUv.y*6.1+sin(vMapUv.x*1.9)*1.1);
      float rockLight=.82+.18*smoothstep(-.2,.7,seams);
      float snowLine=smoothstep(.31,.69,vAlpSnow+(cliff.g-.20)*.30);
      diffuseColor.rgb*=mix((cliff*vec3(.90,.94,.98)+vec3(.055))*rockLight,
                            mix(drift,vec3(.92,.96,.99),.33),snowLine);`);
  };
  const mountain=new T.Mesh(geo,material);mountain.name='Ubaye limestone ridges and snowfields';scene.add(mountain);
  const canopy=typeof document==='undefined'?null:new T.TextureLoader().load('/shooter/environment/alpine-firs.webp');
  if(canopy)canopy.colorSpace=T.SRGBColorSpace;
  const trees=new T.InstancedMesh(firGeometry(),new T.MeshStandardMaterial({
    map:canopy,color:canopy?'#ffffff':'#415b4b',alphaTest:.27,roughness:1,
  }),120);
  const object=new T.Object3D(),groundProbe=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
  const groundHits:T.Intersection[]=[];
  for(let i=0;i<trees.count;i++){
    const cluster=Math.floor(i/5),a=cluster*2.39996+Math.sin(i*3.5)*.080;
    const border=75/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a)));
    const r=border+11+(Math.sin(i*1.77)+1)*6;
    const h=4+1.9*(1+Math.sin(i*11.2));
    const x=r*Math.cos(a),z=r*Math.sin(a);
    groundProbe.ray.origin.set(x,120,z);
    groundHits.length=0;groundProbe.intersectObject(mountain,false,groundHits);
    const ridge=groundHits[0]?.point.y??0;
    const y=Math.max(ridge,Math.max(Math.abs(x),Math.abs(z))<=88.5?.02:-Infinity);
    object.position.set(x,y-.06,z);
    object.rotation.y=i*.83;object.scale.set(h*.90,h,h*.90);object.updateMatrix();trees.setMatrixAt(i,object.matrix);
  }
  trees.name='Subalpine fir stands';scene.add(trees);
}
