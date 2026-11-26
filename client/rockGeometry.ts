import * as T from 'three';
import {rockHull,type RockBounds} from '../shared/rocks.ts';

export function createRockGeometry(bounds:RockBounds,smoothEdges=false) {
  const hull=rockHull(bounds),positions:number[]=[],uvs:number[]=[],colors:number[]=[],snowCover:number[]=[];
  const color=new T.Color(),vertexIds:number[]=[];
  const stone=new T.Color('#a1a5a1'),frost=new T.Color('#f4f5f0');
  const salt=new T.Color('#f6f2e8'),damp=new T.Color('#a0a99c');
  const average=hull.vertices.map(()=>new T.Vector3());
  for(const face of hull.faces){
    const a=new T.Vector3(...hull.vertices[face[0]]),b=new T.Vector3(...hull.vertices[face[1]]),c=new T.Vector3(...hull.vertices[face[2]]);
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    for(const index of face)average[index].add(normal);
    const axis=Math.abs(normal.y)>.6?'top':Math.abs(normal.x)>Math.abs(normal.z)?'side':'front';
    for(let i=1;i<face.length-1;i++)for(const index of [face[0],face[i],face[i+1]]){
      const [x,y,z]=hull.vertices[index];positions.push(x,y,z);vertexIds.push(index);
      if(smoothEdges){
        // Preserve gravity on bedding planes. Scan the side along the local tangent
        // so diagonal facets keep the same grain scale as the flat faces.
        const top=axis==='top',horizontal=Math.hypot(normal.x,normal.z);
        const u=top?x:(normal.z*x-normal.x*z)/horizontal;
        uvs.push(u/4.8+bounds.x*.31,(top?z:y)/4.8+bounds.z*.27);
      }else uvs.push((axis==='side'?z:x)/2.8,(axis==='top'?z:y)/2.8);
      if(smoothEdges)color.copy(damp).lerp(salt,T.MathUtils.smoothstep(y/bounds.h,-.45,.22));
      else{
        const shoulder=T.MathUtils.smoothstep(y/bounds.h,-.03,.43);
        const wind=.08*normal.x+.11*Math.sin((x+bounds.x)*.43+(z+bounds.z)*.36);
        const snow=T.MathUtils.clamp(.91*T.MathUtils.smoothstep(normal.y,.28,.9)*shoulder+.23*shoulder+wind,0,1);
        color.copy(stone).lerp(frost,snow);
        snowCover.push(snow);
      }
      colors.push(color.r,color.g,color.b);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  if(!smoothEdges)geometry.setAttribute('boulderSnow',new T.Float32BufferAttribute(snowCover,1));
  geometry.computeVertexNormals();
  const normals=geometry.getAttribute('normal'),blended=new T.Vector3();
  average.forEach(normal=>normal.normalize());
  for(let i=0;i<vertexIds.length;i++){
    blended.fromBufferAttribute(normals,i).lerp(average[vertexIds[i]],smoothEdges?.42:.27).normalize();
    normals.setXYZ(i,blended.x,blended.y,blended.z);
  }
  geometry.computeBoundingSphere();
  return geometry;
}

export function alpineBoulderMaterial(stone:T.MeshStandardMaterial,snow:T.MeshStandardMaterial,limestone:T.Texture){
  const material=stone.clone();
  material.map=limestone;
  material.onBeforeCompile=shader=>{
    shader.uniforms.boulderSnowMap={value:snow.map};
    shader.vertexShader='attribute float boulderSnow; varying float vBoulderSnow;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBoulderSnow=boulderSnow;');
    shader.fragmentShader='uniform sampler2D boulderSnowMap; varying float vBoulderSnow;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 stoneGrain=texture2D(map,vMapUv).rgb;
      vec3 settledSnow=texture2D(boulderSnowMap,vMapUv*1.19).rgb;
      float drift=smoothstep(.37,.71,vBoulderSnow+(stoneGrain.g-.22)*.45);
      vec3 limestone=stoneGrain*vec3(1.18,1.21,1.26)+vec3(.07,.08,.09);
      diffuseColor.rgb*=mix(limestone,mix(settledSnow,vec3(.94,.97,1.),.33),drift);`);
    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      '#include <normal_fragment_maps>\nnormal=normalize(mix(normal,normalize(vNormal),drift*.59));'
    );
    // Bright snow reflects the same skylight back into sheltered cliff faces.
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`
      #include <lights_fragment_end>
      #if NUM_HEMI_LIGHTS > 0
        reflectedLight.indirectDiffuse+=diffuseColor.rgb*hemisphereLights[0].skyColor*.21;
      #endif`);
  };
  return material;
}
