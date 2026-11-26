import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ShaderChunk} from 'three';
import {installDirectionalShadowCutoff} from '../client/directionalShadowCutoff';

test('only the directional shadow lookup gains the physical base and clearcoat normal guard', () => {
  const original = ShaderChunk.lights_fragment_begin;
  try {
    installDirectionalShadowCutoff();
    const updated = ShaderChunk.lights_fragment_begin;
    const guard = /\( directLight\.visible && receiveShadow\s+#ifdef STANDARD\s+&& \( dot\( geometryNormal, directLight\.direction \) > 0\.0\s+#ifdef USE_CLEARCOAT\s+\|\| dot\( geometryClearcoatNormal, directLight\.direction \) > 0\.0\s+#endif\s+\)\s+#endif\s+\) \? getShadow\( directionalShadowMap/;
    assert.match(updated, guard);
    assert.equal(updated.replace(guard, '( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap'), original);
    installDirectionalShadowCutoff();
    assert.equal(ShaderChunk.lights_fragment_begin, updated);
  } finally {
    ShaderChunk.lights_fragment_begin = original;
  }
});
