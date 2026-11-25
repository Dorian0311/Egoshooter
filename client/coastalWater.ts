import * as T from 'three';
import {terrainHeight} from '../shared/terrain';
import type {World} from '../shared/world';

const seaLevel=-3.4;

function createWaterGeometry(world:World){
  // Follow the terrain's polar grid along the beach. The inner disc is entirely buried.
  const radii=[118,120,122,124,126,128,130,133,136,140,145,152,164,180,205,245,300,410,560];
  const segments=128, positions:number[]=[], depths:number[]=[], indices:number[]=[];
  for(const [ring,r] of radii.entries()){
    const depth=seaLevel-terrainHeight(r,0,world)+Math.max(0,r-128)*.16;
    for(let i=0;i<segments;i++){
      const angle=2*Math.PI*i/segments;
      positions.push(Math.cos(angle)*r,0,Math.sin(angle)*r);
      depths.push(depth);
      if(ring===0)continue;
      const a=(ring-1)*segments+i,b=(ring-1)*segments+(i+1)%segments;
      indices.push(a,b,a+segments,b,b+segments,a+segments);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('waterDepth',new T.Float32BufferAttribute(depths,1));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

export function createCoastalWater(scene:T.Scene,world:World){
  const time={value:0},ripples=new T.TextureLoader().load('/shooter/environment/ocean-ripple.png');
  ripples.wrapS=ripples.wrapT=T.RepeatWrapping;
  const material=new T.MeshPhysicalMaterial({roughness:.21,ior:1.333,metalness:0});
  material.onBeforeCompile=shader=>{
    shader.uniforms.oceanTime=time;
    shader.uniforms.oceanRipples={value:ripples};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform float oceanTime;
      attribute float waterDepth;
      varying vec2 vOceanXZ;
      varying float vDepth;
    `).replace('#include <begin_vertex>',`#include <begin_vertex>
      vOceanXZ=position.xz;
      float swell=.12*sin(dot(position.xz,vec2(.17,.09))+oceanTime*.81)
                 +.06*sin(dot(position.xz,vec2(-.08,.24))-oceanTime*1.12);
      transformed.y+=swell;
      vDepth=waterDepth+swell;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float oceanTime;
      uniform sampler2D oceanRipples;
      varying vec2 vOceanXZ;
      varying float vDepth;
    `).replace('#include <color_fragment>',`#include <color_fragment>
      mat2 crosswind=mat2(.80,.60,-.60,.80);
      vec3 longRipples=texture2D(oceanRipples,vOceanXZ*.057+vec2(-.016,.004)*oceanTime).rgb;
      vec3 shortRipples=texture2D(oceanRipples,crosswind*vOceanXZ*.137+vec2(.014,.009)*oceanTime).rgb;
      // Shoaling water takes on the colour of the sand underneath; the outer sea is less transmissive.
      float deep=smoothstep(.1,4.2,vDepth);
      vec3 seabed=mix(vec3(.085,.34,.285),vec3(.012,.085,.105),deep);
      float breaker=.5+.5*sin(6.*vDepth-1.25*oceanTime+3.*longRipples.g);
      float wash=(1.-smoothstep(.10,.75,vDepth))*.76 + (1.-smoothstep(.6,1.7,vDepth))*smoothstep(.84,1.,breaker)*.47;
      float foam=clamp(wash*(.16+.84*smoothstep(.16,.72,longRipples.b+.32*shortRipples.b)),0.,1.);
      diffuseColor.rgb=mix(seabed,vec3(.73,.84,.81),foam);
    `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor+=.40*foam;
    `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec2 slope=.32*(longRipples.rg-.5)+.19*((shortRipples.rg-.5)*crosswind);
      slope+=vec2(.020,.011)*cos(dot(vOceanXZ,vec2(.17,.09))+oceanTime*.81)
            +vec2(-.005,.014)*cos(dot(vOceanXZ,vec2(-.08,.24))-oceanTime*1.12);
      normal=normalize(mat3(viewMatrix)*vec3(-slope.x,1.,-slope.y));
    `);
  };
  material.customProgramCacheKey=()=>'island-coastal-water-v1';
  const water=new T.Mesh(createWaterGeometry(world),material);
  water.name='Island coastal water';water.position.y=seaLevel;scene.add(water);
  return {update(seconds:number){time.value=seconds;},dispose(){ripples.dispose();}};
}
