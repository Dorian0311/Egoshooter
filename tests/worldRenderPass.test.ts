import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {Camera, Color, Scene, Texture, WebGLRenderTarget, type WebGLRenderer} from 'three';
import {WorldRenderPass} from '../client/worldRenderPass';

test('only the opaque texture sky replaces the world color clear', () => {
  const scene = new Scene();
  const pass = new WorldRenderPass(scene, new Camera());
  const target = new WebGLRenderTarget();
  const clears: boolean[][] = [];
  const renderer = {
    xr: {isPresenting: false}, autoClear: true, autoClearColor: true,
    autoClearDepth: true, autoClearStencil: true,
    clear: (...flags: boolean[]) => clears.push(flags),
    setRenderTarget() {}, render() {}
  };
  const draw = () => pass.render(renderer as unknown as WebGLRenderer, target, target, 0, false);
  scene.background = new Texture();
  draw();
  assert.equal(renderer.autoClearColor, true);
  renderer.xr.isPresenting = true;
  draw();
  renderer.xr.isPresenting = false;
  scene.background = null;
  draw();
  scene.background = new Color();
  draw();
  assert.deepEqual(clears, [[false,true,true], [true,true,true], [true,true,true], [true,true,true]]);
  target.dispose();
});
