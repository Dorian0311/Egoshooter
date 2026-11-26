import assert from 'node:assert/strict';
import test from 'node:test';
import {NearestFilter, PerspectiveCamera, Scene, UnsignedIntType, WebGLRenderTarget, type WebGLRenderer} from 'three';
import {setWorldDepthTexture, validateWorldDepthTexture} from '../client/depthReconstructedAO';
import {WorldOcclusionPass} from '../client/worldOcclusionPass';

test('world D24 attachment changes only on preset transitions and falls back on an incomplete framebuffer', () => {
  const target = new WebGLRenderTarget(12, 8), previous = new WebGLRenderTarget();
  let disposals = 0;
  target.addEventListener('dispose', () => disposals++);
  setWorldDepthTexture(target, true);
  const depth = target.depthTexture!;
  assert.equal(depth.type, UnsignedIntType);
  assert.equal(depth.minFilter, NearestFilter);
  assert.equal(depth.image.width, 12);
  setWorldDepthTexture(target, true);
  assert.equal(target.depthTexture, depth);
  assert.equal(disposals, 1);
  const bindings: unknown[][] = [];
  const renderer = {
    getRenderTarget: () => previous, getActiveCubeFace: () => 2, getActiveMipmapLevel: () => 1,
    getContext: () => ({FRAMEBUFFER:1, FRAMEBUFFER_COMPLETE:2, checkFramebufferStatus: () => 0}),
    setRenderTarget: (...args:unknown[]) => bindings.push(args)
  } as unknown as WebGLRenderer;
  validateWorldDepthTexture(renderer, target);
  assert.equal(target.depthTexture, null);
  assert.equal(disposals, 2);
  assert.deepEqual(bindings, [[target], [previous, 2, 1]]);
  setWorldDepthTexture(target, false);
  assert.equal(disposals, 2);
  target.dispose(); previous.dispose();
});

test('world depth supplies SSAO before the weapon pass and bindings survive an interrupted fullscreen draw', () => {
  const pass = new WorldOcclusionPass(new Scene(), new PerspectiveCamera(), 3, 3, 24);
  const read = new WebGLRenderTarget(6, 6), write = new WebGLRenderTarget(6, 6);
  setWorldDepthTexture(read, true);
  assert.equal(pass.prepareWorldDepth(), true);
  const source = pass.ssaoMaterial, originalDepth = source.uniforms.tDepth.value;
  const renderer = {info:{render:{frame:12}}, xr:{isPresenting:false}} as unknown as WebGLRenderer;
  pass.worldRendered(12);
  pass.renderPass = (_renderer, material) => {
    assert.equal(material, pass.ssaoMaterial);
    assert.notEqual(material, source);
    assert.equal(pass.ssaoMaterial.uniforms.tDepth.value, read.depthTexture);
    throw Error('interrupted fullscreen draw');
  };
  assert.throws(() => pass.render(renderer, write, read, 0, false), /interrupted fullscreen/);
  assert.equal(pass.ssaoMaterial, source);
  assert.equal(source.uniforms.tDepth.value, originalDepth);
  let fallback = 0;
  pass.renderOverride = () => {fallback++;};
  pass.renderPass = () => {};
  pass.render(renderer, write, read, 0, false);
  assert.equal(fallback, 1);
  setWorldDepthTexture(read, false);
  pass.worldRendered(12);
  pass.render(renderer, write, read, 0, false);
  assert.equal(fallback, 2);
  read.dispose(); write.dispose(); pass.dispose();
});
