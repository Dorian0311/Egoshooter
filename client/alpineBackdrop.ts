import * as T from 'three';
import type {Building} from '../shared/world';

const tau=Math.PI*2;

export function createAlpineFlurries(scene:T.Scene,buildings:readonly Building[]){
  const positions=new Float32Array(320*3);
  let seed=34851;
  for(let i=0;i<positions.length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    positions[i]=seed/4294967296;
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  const uniforms={
    eye:{value:new T.Vector3()},seconds:{value:0},opacity:{value:0},
    tint:{value:new T.Color('#eceff3')},pixelRatio:{value:1},
    shelters:{value:buildings.map(b=>new T.Vector4(b.x,b.z,b.w/2,b.d/2))},
    shelterTops:{value:buildings.map(b=>b.upper?8.3:4.3)}
  };
  const material=new T.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,
    vertexShader:`
      uniform vec3 eye;
      uniform float seconds, pixelRatio;
      uniform vec4 shelters[${buildings.length}];
      uniform float shelterTops[${buildings.length}];
      varying float vFade;
      void main(){
        vec3 span=vec3(38.0,12.0,38.0);
        vec3 drift=vec3(seconds*.72,-seconds*(.50+position.y*.52),seconds*.26);
        drift.x+=sin(seconds*1.26+position.z*24.0)*.31;
        vec3 offset=mod(position*span+drift-eye+span*.5,span)-span*.5;
        vec3 world=eye+offset;
        vec4 point=viewMatrix*vec4(world,1.0);
        float distanceToEye=length(offset);
        vFade=smoothstep(1.2,3.8,distanceToEye)*(1.0-smoothstep(10.0,18.0,distanceToEye));
        vFade*=1.0-smoothstep(4.6,6.0,abs(offset.y));
        // Shelter the ground and upper floors without hiding the snow seen through a window.
        for(int i=0;i<${buildings.length};i++){
          vec2 inset=shelters[i].zw-abs(world.xz-shelters[i].xy);
          float edge=min(min(inset.x,inset.y),shelterTops[i]-world.y);
          vFade*=1.0-smoothstep(-.15,.13,edge);
        }
        gl_PointSize=clamp(13.0/max(1.0,-point.z),1.15,3.1)*pixelRatio;
        gl_Position=projectionMatrix*point;
      }`,
    fragmentShader:`
      uniform vec3 tint;
      uniform float opacity;
      varying float vFade;
      void main(){
        vec2 p=(gl_PointCoord-.5)*2.0;
        float feather=1.0-smoothstep(.14,1.0,dot(p,p));
        gl_FragColor=vec4(tint,opacity*vFade*feather);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const snow=new T.Points(geometry,material);
  snow.name='Windblown Alpine flurries';snow.frustumCulled=false;snow.visible=false;
  scene.add(snow);
  return {
    update(eye:T.Vector3,time:number,dt:number,condition:string|undefined,pixelRatio:number){
      const target=condition==='fog'?.58:condition==='night'?.31:.39;
      uniforms.opacity.value+=(target-uniforms.opacity.value)*Math.min(1,dt*6);
      snow.visible=uniforms.opacity.value>.008;
      uniforms.eye.value.copy(eye);
      uniforms.seconds.value=time;
      uniforms.tint.value.set(condition==='night'?'#b0c6eb':'#f4f7fd');
      uniforms.pixelRatio.value=pixelRatio;
    },
    dispose(){snow.removeFromParent();geometry.dispose();material.dispose();}
  };
}

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

function applyFirSnow({data,width,height}:ImageData){
  const linear=Float32Array.from({length:256},(_,i)=>{
    const s=i/255;
    return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;
  });
  const encoded=Uint8Array.from({length:4096},(_,i)=>{
    const c=i/4095;
    return Math.round(255*(c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055));
  });
  const smooth=T.MathUtils.smoothstep;
  const highlights=linear.map(g=>smooth(g,.054,.104));
  const offsets=Float32Array.from({length:width},(_,x)=>{
    const u=(x+.5)/width,side=(u*2%1)*2-1;
    return -.12*side*side*6.5+.17*side+(u>=.5?.32:0);
  });
  for(let y=0;y<height;y++){
    const tier=(1-(y+.5)/height)*6.5;
    for(let x=0,i=y*width*4;x<width;x++,i+=4){
      const green=data[i+1];
      if(!data[i+3]||!highlights[green])continue;
      const t=tier+offsets[x],band=Math.abs(t-Math.floor(t)-.5);
      if(band>=.30)continue;
      const frost=(1-smooth(band,.07,.30))*highlights[green]*smooth(linear[green]-linear[data[i]],.003,.018);
      if(!frost)continue;
      data[i]=encoded[Math.min(4095,Math.round((linear[data[i]]+.19*frost)*4095))];
      data[i+1]=encoded[Math.min(4095,Math.round((linear[green]+.22*frost)*4095))];
      data[i+2]=encoded[Math.min(4095,Math.round((linear[data[i+2]]+.24*frost)*4095))];
    }
  }
}

function prepareFirAtlas(texture:T.Texture){
  const image=texture.image as HTMLImageElement;
  try{
    const canvas=document.createElement('canvas');
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)return;
    ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    applyFirSnow(pixels);ctx.putImageData(pixels,0,0);
    texture.image=canvas;
  }catch{
    // Keep the loaded atlas if the browser cannot read or allocate the canvas.
  }
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
      // Break up aligned repeats while keeping the closed ring seamless.
      uv.push(i/segments*42+.22*Math.sin(a*7)+.18*Math.sin(a*11+r*.047),
        (r*.65+y*.95)/12+.24*Math.sin(a*5+r*.06));
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
      float snowLine=smoothstep(.31,.69,vAlpSnow+(cliff.g-.20)*.30);
      diffuseColor.rgb*=mix(cliff*vec3(.85,.91,.98)+vec3(.042),
                            mix(drift,vec3(.92,.96,.99),.33),snowLine);`);
  };
  const mountain=new T.Mesh(geo,material);mountain.name='Ubaye limestone ridges and snowfields';scene.add(mountain);
  const canopy=typeof document==='undefined'?null:new T.TextureLoader().load('/shooter/environment/alpine-firs.webp',prepareFirAtlas);
  if(canopy)canopy.colorSpace=T.SRGBColorSpace;
  const firMaterial=new T.MeshStandardMaterial({
    map:canopy,color:canopy?'#ffffff':'#415b4b',alphaTest:.27,roughness:1,
  });
  const trees=new T.InstancedMesh(firGeometry(),firMaterial,120);
  const object=new T.Object3D(),groundRay=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0));
  const vertices=geo.getAttribute('position'),triangles=geo.getIndex()!;
  const v0=new T.Vector3(),v1=new T.Vector3(),v2=new T.Vector3(),hit=new T.Vector3();
  function ridgeAt(x:number,z:number){
    const sector=Math.floor(T.MathUtils.euclideanModulo(Math.atan2(z,x),tau)*segments/tau);
    groundRay.origin.set(x,120,z);
    let highest=-Infinity;
    // Each indexed quad stays inside its angular sector. Include both neighbours
    // for Float32 rounding on shared edges and wrap across the duplicated seam.
    for(let offset=-1;offset<=1;offset++){
      const column=(sector+offset+segments)%segments;
      for(let row=0;row<=rings;row++){
        const first=(row*segments+column)*6;
        for(let i=first;i<first+6;i+=3){
          v0.fromBufferAttribute(vertices,triangles.getX(i));
          v1.fromBufferAttribute(vertices,triangles.getX(i+1));
          v2.fromBufferAttribute(vertices,triangles.getX(i+2));
          if(groundRay.intersectTriangle(v0,v1,v2,true,hit))highest=Math.max(highest,hit.y);
        }
      }
    }
    return highest===-Infinity?0:highest;
  }
  for(let i=0;i<trees.count;i++){
    const cluster=Math.floor(i/5),a=cluster*2.39996+Math.sin(i*3.5)*.080;
    const border=75/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a)));
    const r=border+11+(Math.sin(i*1.77)+1)*6;
    const h=4+1.9*(1+Math.sin(i*11.2));
    const x=r*Math.cos(a),z=r*Math.sin(a);
    const ridge=ridgeAt(x,z);
    const y=Math.max(ridge,Math.max(Math.abs(x),Math.abs(z))<=88.5?.02:-Infinity);
    object.position.set(x,y-.06,z);
    object.rotation.y=i*.83;object.scale.set(h*.90,h,h*.90);object.updateMatrix();trees.setMatrixAt(i,object.matrix);
  }
  trees.name='Subalpine fir stands';scene.add(trees);
}
