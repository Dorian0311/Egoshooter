import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, Group, LineSegments, Mesh, PerspectiveCamera, Points, Scene, type WebGLRenderer } from 'three';
import { WorldOcclusionPass } from '../client/worldOcclusionPass';

test('normal pass excludes visible point and line subtrees and restores scene visibility', () => {
  const scene = new Scene();
  const mesh = new Mesh(), dust = new Points(), wire = new LineSegments();
  const inactive = new Group(), inactiveDust = new Points(), wireChild = new Mesh();
  inactive.visible = false;
  inactive.add(inactiveDust);
  wire.add(wireChild);
  scene.add(mesh, dust, wire, inactive);
  const pass = new WorldOcclusionPass(scene, new PerspectiveCamera(), 1, 1, 4);
  try {
    for (const showDust of [true, false, true]) {
      dust.visible = showDust;
      pass.overrideVisibility();
      const drawList: string[] = [];
      scene.traverseVisible(object => { if (object !== scene) drawList.push(object.uuid); });
      assert.deepEqual(drawList, [mesh.uuid]);
      pass.restoreVisibility();
      assert.equal(dust.visible, showDust);
      assert.equal(wire.visible, true);
      assert.equal(wireChild.visible, true);
      assert.equal(inactive.visible, false);
      assert.equal(inactiveDust.visible, true);
    }
  } finally {
    pass.dispose();
  }
});

test('normal pass reuses world matrices and does not draw the sky', () => {
  const scene = new Scene(), sky = new Color('#6895c3');
  scene.background = sky;
  const pass = new WorldOcclusionPass(scene, new PerspectiveCamera(), 1, 1, 4);
  const renderer = {
    autoClear: true,
    getClearColor: (color: Color) => color.set(0),
    getClearAlpha: () => 1,
    setRenderTarget() {},
    setClearColor() {},
    setClearAlpha() {},
    clear() {},
    render(renderedScene: Scene) {
      assert.equal(renderedScene.background, null);
      assert.equal(renderedScene.matrixWorldAutoUpdate, false);
      assert.equal(renderedScene.overrideMaterial, pass.normalMaterial);
    },
  } as unknown as WebGLRenderer;
  try {
    pass.renderOverride(renderer, pass.normalMaterial, pass.normalRenderTarget, 0x7777ff, 1);
    assert.equal(scene.background, sky);
    assert.equal(scene.matrixWorldAutoUpdate, true);
    assert.equal(scene.overrideMaterial, null);
  } finally {
    pass.dispose();
  }
});
