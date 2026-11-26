import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ShaderChunk} from 'three';
import {installPointLightCutoff} from '../client/pointLightCutoff';

test('point lights guard the complete unrolled lighting calculation and retain unlimited lights', () => {
  const original = ShaderChunk.lights_fragment_begin;
  try {
    installPointLightCutoff();
    const result = ShaderChunk.lights_fragment_begin;
    const start = result.indexOf('pointLight = pointLights[ i ]');
    const end = result.indexOf('#pragma unroll_loop_end', start);
    const point = result.slice(start, end);
    assert.match(point, /pointLight\.distance <= 0\.0 \|\| dot\(pointOffset, pointOffset\)/);
    assert.match(point, /if \(any\([\s\S]+getPointLightInfo\([\s\S]+getPointShadow\([\s\S]+RE_Direct\([^;]+;\s*\}\s*\}\s*\}/);
    assert.equal(result.slice(end), original.slice(original.indexOf('#pragma unroll_loop_end', start)));
    installPointLightCutoff();
    assert.equal(ShaderChunk.lights_fragment_begin, result);
  } finally {
    ShaderChunk.lights_fragment_begin = original;
  }
});
