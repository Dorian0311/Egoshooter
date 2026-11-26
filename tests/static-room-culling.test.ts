import assert from 'node:assert/strict';
import test from 'node:test';
import {BoxGeometry, Frustum, Group, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene} from 'three';
import {createStaticRoomCulling, registerFixedRoom} from '../client/staticRoomCulling';

test('room culling preserves offscreen casters for the world pass and restores only its own changes', () => {
  const scene = new Scene(), camera = new PerspectiveCamera(60, 1, .1, 100);
  const geometry = new BoxGeometry(2, 2, 2), material = new MeshBasicMaterial();
  function room(x: number, z: number) {
    const group = new Group();
    group.add(new Mesh(geometry, material));
    group.position.set(x, 0, z);
    scene.add(group);
    registerFixedRoom(scene, group);
    return group;
  }
  const front = room(0, -10), caster = room(0, 10), outside = room(100, 0), alreadyHidden = room(100, 10);
  const movable = new Group(); scene.add(movable);
  alreadyHidden.visible = false;
  const shadows = camera.clone();
  shadows.rotation.y = Math.PI;
  shadows.updateMatrixWorld();
  const lightFrustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(shadows.projectionMatrix, shadows.matrixWorldInverse));
  const culling = createStaticRoomCulling(scene);
  culling.begin(camera, lightFrustum);
  assert.deepEqual([front.visible, caster.visible, outside.visible, alreadyHidden.visible, movable.visible], [true, true, false, false, true]);
  culling.afterWorld();
  assert.deepEqual([front.visible, caster.visible, outside.visible], [true, false, false]);
  culling.restore();
  assert.deepEqual([caster.visible, outside.visible, alreadyHidden.visible], [true, true, false]);
  culling.begin(shadows);
  assert.deepEqual([front.visible, caster.visible, outside.visible], [false, true, false]);
  // Interrupted world draw, before the normal pass.
  culling.restore();
  assert.deepEqual([front.visible, caster.visible, outside.visible, alreadyHidden.visible], [true, true, true, false]);
  geometry.dispose(); material.dispose();
});
