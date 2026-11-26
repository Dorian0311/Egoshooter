import {ShaderChunk} from 'three';

// Three unrolls point-light loops, so each iteration needs its own local scope.
// Its attenuation reaches exactly zero at the finite radius; distance=0 is unlimited.
const lookup = 'getPointLightInfo( pointLight, geometryPosition, directLight );';
const direct = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
const pointBlock = /(#pragma unroll_loop_start\s+for \( int i = 0; i < NUM_POINT_LIGHTS; i \+\+ \) \{)([\s\S]*?)(\n\s*\}\s*#pragma unroll_loop_end)/;

export function installPointLightCutoff() {
  ShaderChunk.lights_fragment_begin = ShaderChunk.lights_fragment_begin.replace(pointBlock, (source, open, body: string, close) => {
    if (body.includes('pointOffset') || !body.includes(lookup) || !body.includes(direct)) return source;
    const guarded = body.replace(lookup, `{
      vec3 pointOffset = pointLight.position - geometryPosition;
      if (any(notEqual(pointLight.color, vec3(0.0))) &&
          (pointLight.distance <= 0.0 || dot(pointOffset, pointOffset) < pointLight.distance * pointLight.distance)) {
        ${lookup}`).replace(direct, `${direct}
      }
    }`);
    return open + guarded + close;
  });
}
