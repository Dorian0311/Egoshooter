import * as T from 'three';

/** Camera-facing quads use the same world sizing, depth and fog as Sprites. */
export function createCombatBillboards(texture:T.Texture,capacity:number,blending:T.Blending){
  const geometry=new T.InstancedBufferGeometry();
  const quad=new T.PlaneGeometry(1,1);
  geometry.setIndex(quad.index!.clone());
  geometry.setAttribute('position',quad.getAttribute('position').clone());
  geometry.setAttribute('uv',quad.getAttribute('uv').clone());
  quad.dispose();
  const centers=new T.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage);
  const appearance=new T.InstancedBufferAttribute(new Float32Array(capacity*2),2).setUsage(T.DynamicDrawUsage);
  const colors=new T.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('centerWorld',centers);
  geometry.setAttribute('sizeOpacity',appearance);
  geometry.setAttribute('particleColor',colors);
  geometry.instanceCount=0;

  const material=new T.ShaderMaterial({
    uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),glowMap:{value:texture}},
    transparent:true,depthWrite:false,fog:true,blending,
    vertexShader:`
      attribute vec3 centerWorld;
      attribute vec2 sizeOpacity;
      attribute vec3 particleColor;
      varying vec2 glowUv;
      varying vec4 glowTint;
      #include <common>
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      void main() {
        glowUv = uv;
        glowTint = vec4(particleColor, sizeOpacity.y);
        vec4 mvPosition = viewMatrix * vec4(centerWorld, 1.0);
        mvPosition.xy += position.xy * sizeOpacity.x;
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <fog_vertex>
      }
    `,
    fragmentShader:`
      uniform sampler2D glowMap;
      varying vec2 glowUv;
      varying vec4 glowTint;
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      void main() {
        gl_FragColor = texture2D(glowMap, glowUv) * glowTint;
        #include <logdepthbuf_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  const mesh=new T.Mesh(geometry,material);
  mesh.frustumCulled=false;
  mesh.visible=false;
  let count=0;
  return {
    mesh,
    add(position:T.Vector3,size:number,opacity:number,color:T.Color){
      centers.setXYZ(count,position.x,position.y,position.z);
      appearance.setXY(count,size,opacity);
      colors.setXYZ(count,color.r,color.g,color.b);
      count++;
    },
    flush(){
      mesh.visible=count>0;
      geometry.instanceCount=count;
      if(count>0){centers.needsUpdate=true;appearance.needsUpdate=true;colors.needsUpdate=true;}
      count=0;
    },
    dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();},
  };
}
