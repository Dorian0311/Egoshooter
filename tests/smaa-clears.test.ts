import assert from 'node:assert/strict';
import test from 'node:test';
import { ShaderMaterial, type WebGLRenderer } from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { skipRedundantSmaaClears } from '../client/smaaClears';

test('SMAA keeps the edge clear and restores renderer state after each full write', () => {
  const edges = new ShaderMaterial(), weights = new ShaderMaterial(), blend = new ShaderMaterial();
  const quad = new FullScreenQuad(edges);
  const renderer = { autoClear: true } as WebGLRenderer;
  const clears: boolean[] = [];
  let fail = false;
  quad.render = r => {
    clears.push(r.autoClear);
    if (fail) throw Error('interrupted draw');
  };
  skipRedundantSmaaClears({ fsQuad: quad, materialWeights: weights, materialBlend: blend });
  for (const material of [edges, weights, blend]) {
    quad.material = material;
    quad.render(renderer);
    assert.equal(renderer.autoClear, true);
    assert.equal(material.depthTest, material === edges);
    assert.equal(material.depthWrite, material === edges);
  }
  assert.deepEqual(clears, [true, false, false]);
  fail = true;
  for (const value of [true, false]) {
    renderer.autoClear = value;
    assert.throws(() => quad.render(renderer), /interrupted draw/);
    assert.equal(renderer.autoClear, value);
  }
});
