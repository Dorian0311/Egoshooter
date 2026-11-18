import type {MeshStandardMaterial} from 'three';

/** Low-frequency weathering without extra textures, geometry or render passes. */
export function applySurfaceFinish(material:MeshStandardMaterial,wall:boolean){
 if(material.userData.surfaceFinish)return;
 material.userData.surfaceFinish=true;
 const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>cacheKey+`/weathering-v1/${wall}`;
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFinishPosition;')
   .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
    vec4 finishPosition=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     finishPosition=instanceMatrix*finishPosition;
    #endif
    vFinishPosition=(modelMatrix*finishPosition).xyz;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFinishPosition;')
   .replace('#include <color_fragment>',`#include <color_fragment>
    float finishVariation=sin(vFinishPosition.x*.23+vFinishPosition.z*.17)*sin(vFinishPosition.z*.31-vFinishPosition.x*.11);
    float finishDirt=${wall?'(1.0-smoothstep(.08,1.15,vFinishPosition.y))*(.12+.05*finishVariation)':'0.0'};
    diffuseColor.rgb*=1.0+finishVariation*.055-finishDirt;`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    roughnessFactor=clamp(roughnessFactor+finishVariation*.035+finishDirt*.2,.25,1.0);`);
 };
}
