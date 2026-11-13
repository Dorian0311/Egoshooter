import * as T from 'three';
import type {World} from '../shared/world';
import {terrainHeight} from '../shared/terrain';

export function createTerrainGeometry(world:World){
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 const vertex=(x:number,z:number)=>{positions.push(x,terrainHeight(x,z,world),z);uv.push(x/6,z/6);};
 if(world.id==='storm'){
  const segments=128,rings=64;vertex(0,0);
  for(let ring=1;ring<=rings;ring++)for(let s=0;s<=segments;s++){const angle=s/segments*Math.PI*2,r=ring/rings*128;vertex(Math.cos(angle)*r,Math.sin(angle)*r);}
  for(let s=0;s<segments;s++)indices.push(0,s+2,s+1);
  for(let ring=0;ring<rings-1;ring++)for(let s=0;s<segments;s++){const a=1+ring*(segments+1)+s,b=a+1,c=a+segments+1,d=c+1;indices.push(a,b,c,b,d,c);}
 }else{
  const extent=(world.playArea?.halfSize??73)+2,segments=120;
  for(let z=0;z<=segments;z++)for(let x=0;x<=segments;x++)vertex(-extent+x/segments*extent*2,-extent+z/segments*extent*2);
  for(let z=0;z<segments;z++)for(let x=0;x<segments;x++){const a=z*(segments+1)+x,b=a+1,c=a+segments+1,d=c+1;indices.push(a,c,b,b,c,d);}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

export function createBattleTerrain(world:World,base:T.MeshStandardMaterial,soil:T.MeshStandardMaterial){
 const material=base.clone();material.color.set('#ffffff');material.normalScale.set(.8,.8);
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{battleSoil:{value:soil.map},battleSoilNormal:{value:soil.normalMap},battleSoilRough:{value:soil.roughnessMap},battleIsland:{value:world.id==='storm'?1:0}});
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBattleWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBattleWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vBattleWorld;
uniform sampler2D battleSoil,battleSoilNormal,battleSoilRough;
uniform float battleIsland;
float battleNoise(vec2 p){return .5+.25*sin(p.x*.37+sin(p.y*.23))+.25*sin(p.y*.41+cos(p.x*.19));}
`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
float battleN=battleNoise(vBattleWorld.xz);
float battleRoad=min(min(abs(vBattleWorld.x),abs(vBattleWorld.z)),abs(abs(vBattleWorld.x)-43.0));
float battleMask=battleIsland>.5?max(smoothstep(99.0,112.0,length(vBattleWorld.xz)+battleN*2.0),1.0-smoothstep(3.4,5.5,battleRoad+battleN*.6)):clamp(-vBattleWorld.y*2.0+(battleN-.35)*.48,0.0,.92);
vec4 battleBase=texture2D(map,vMapUv);
vec4 battleDirt=texture2D(battleSoil,vMapUv);
if(battleIsland<.5)battleDirt.rgb*=vec3(.50,.41,.32);
diffuseColor*=mix(battleBase,battleDirt,battleMask);
diffuseColor.rgb*=mix(.88,1.05,battleN);
`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=roughness;roughnessFactor*=mix(texture2D(roughnessMap,vRoughnessMapUv).g,texture2D(battleSoilRough,vRoughnessMapUv).g,battleMask);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`vec3 battleNormal=mix(texture2D(normalMap,vNormalMapUv).xyz,texture2D(battleSoilNormal,vNormalMapUv).xyz,battleMask)*2.0-1.0;battleNormal.xy*=normalScale;normal=normalize(tbn*battleNormal);`);
 };
 material.customProgramCacheKey=()=>`battle-terrain-v1-${world.id}`;
 const mesh=new T.Mesh(createTerrainGeometry(world),material);mesh.name='shared-heightfield-'+world.id;mesh.receiveShadow=true;return {mesh,dispose(){material.dispose();}};
}
