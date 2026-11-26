import assert from 'node:assert/strict';
import test from 'node:test';
import { ShaderMaterial, type WebGLRenderer } from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { skipRedundantSmaaClears } from '../client/smaaClears';

test('SMAA clears only the edge attachment to zero and restores renderer state', () => {
  const edges = new ShaderMaterial(), weights = new ShaderMaterial(), blend = new ShaderMaterial();
  const quad = new FullScreenQuad(edges);
  const maskClears: number[][] = [];
  const gl = { COLOR: 0x1800, clearBufferfv: (type:number, index:number, value:Float32Array) => {
    maskClears.push([type, index, ...value]);
  } };
  const renderer = { autoClear: true, getContext: () => gl,
    state: {buffers: {color: {setMask: (value:boolean) => assert.equal(value, true)}}} } as unknown as WebGLRenderer;
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
  assert.deepEqual(clears, [false, false, false]);
  assert.deepEqual(maskClears, [[gl.COLOR, 0, 0, 0, 0, 0]]);
  fail = true;
  for (const value of [true, false]) {
    renderer.autoClear = value;
    assert.throws(() => quad.render(renderer), /interrupted draw/);
    assert.equal(renderer.autoClear, value);
  }
});
