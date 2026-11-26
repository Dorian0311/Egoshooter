import * as T from 'three';
import type {World} from '../shared/world';
import {terrainHeight} from '../shared/terrain';

const islandDiameter=256;

function createIslandSurfaceControl(){
 const size=512,data=new Uint8Array(size*size*4);
 const noise=(x:number,z:number)=>.5+.25*Math.sin(x*.37+Math.sin(z*.23))+.25*Math.sin(z*.41+Math.cos(x*.19));
 for(let row=0;row<size;row++)for(let col=0;col<size;col++){
  const x=islandDiameter*((col+.5)/size-.5),z=islandDiameter*((row+.5)/size-.5);
  const localNoise=noise(x,z),road=Math.min(Math.abs(x),Math.abs(z),Math.abs(Math.abs(x)-43));
  const sand=Math.max(T.MathUtils.smoothstep(Math.hypot(x,z)+localNoise*2,99,112),
    1-T.MathUtils.smoothstep(road+localNoise*.6,3.4,5.5));
  const offset=(row*size+col)*4;
  data[offset]=Math.round(sand*255);
  data[offset+1]=Math.round(localNoise*255);
  data[offset+2]=Math.round(noise(z*.22+7,x*.22+12)*255);
  data[offset+3]=255;
 }
 const texture=new T.DataTexture(data,size,size);
 texture.name='Island terrain surface control';
 texture.minFilter=texture.magFilter=T.LinearFilter;
 texture.needsUpdate=true;
 return texture;
}

export function createTerrainGeometry(world:World){
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 const vertex=(x:number,z:number)=>{positions.push(x,terrainHeight(x,z,world),z);uv.push(x/6,z/6);};
 if(world.id==='storm'){
  const segments=128,rings=64;vertex(0,0);
  for(let ring=1;ring<=rings;ring++)for(let s=0;s<=segments;s++){const angle=s/segments*Math.PI*2,r=ring/rings*islandDiameter/2;vertex(Math.cos(angle)*r,Math.sin(angle)*r);}
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
 const control=world.id==='storm'?createIslandSurfaceControl():undefined;
 const material=base.clone();material.color.set('#ffffff');material.normalScale.setScalar(control?.67:.65);
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{battleSoil:{value:soil.map},battleSoilNormal:{value:soil.normalMap},battleSoilRough:{value:soil.roughnessMap}});
  if(control)shader.uniforms.battleTerrainControl={value:control};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBattleWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBattleWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vBattleWorld;
uniform sampler2D battleSoil,battleSoilNormal,battleSoilRough;
${control?'uniform sampler2D battleTerrainControl;':'float battleNoise(vec2 p){return .5+.25*sin(p.x*.37+sin(p.y*.23))+.25*sin(p.y*.41+cos(p.x*.19));}'}
`);
  const surface=control?`
// Fields and beach transitions are fixed. Sample their baked weights once.
vec3 layers=texture2D(battleTerrainControl,vBattleWorld.xz/${islandDiameter}.0+.5).rgb;
float battleMask=layers.r;
float battleN=layers.g;
vec4 battleBase=texture2D(map,vMapUv);
vec4 battleDirt=texture2D(battleSoil,vMapUv);
battleBase.rgb*=mix(vec3(.85,.93,.72),vec3(1.16,1.04,.86),layers.b);
float tideline=smoothstep(-2.9,-1.0,vBattleWorld.y+battleN*.28);
battleDirt.rgb*=mix(vec3(.48,.52,.49),vec3(1.02,.97,.87),tideline);
`:`
float battleN=battleNoise(vBattleWorld.xz);
float battleMask=clamp(-vBattleWorld.y*2.0+(battleN-.35)*.48,0.0,.92);
float railDistance=abs(abs(vBattleWorld.z)-12.0);
float ballast=1.0-smoothstep(1.15,2.55,railDistance+(battleN-.5)*.9);
battleMask=max(battleMask,ballast);
vec4 battleBase=texture2D(map,vMapUv*2.4);
vec4 battleDirt=texture2D(battleSoil,vMapUv);
battleDirt.rgb*=mix(vec3(.50,.41,.32),vec3(.34,.33,.32),ballast);
`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`${surface}
diffuseColor*=mix(battleBase,battleDirt,battleMask);
diffuseColor.rgb*=mix(.88,1.05,battleN);
`);
  const terrainScale=control?'':'*2.4';
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=roughness;roughnessFactor*=mix(texture2D(roughnessMap,vRoughnessMapUv${terrainScale}).g,texture2D(battleSoilRough,vRoughnessMapUv).g,battleMask);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`vec3 battleNormal=mix(texture2D(normalMap,vNormalMapUv${terrainScale}).xyz,texture2D(battleSoilNormal,vNormalMapUv).xyz,battleMask)*2.0-1.0;battleNormal.xy*=normalScale;normal=normalize(tbn*battleNormal);`);
 };
 material.customProgramCacheKey=()=>`battle-terrain-v3-${world.id}`;
 const mesh=new T.Mesh(createTerrainGeometry(world),material);mesh.name='shared-heightfield-'+world.id;mesh.receiveShadow=true;return {mesh,dispose(){control?.dispose();material.dispose();}};
}
