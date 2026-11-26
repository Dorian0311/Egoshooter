import assert from 'node:assert/strict';
import test from 'node:test';
import {BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene, Vector3} from 'three';
import {registerFixedRoom} from '../client/staticRoomCulling';
import {createRoomNormalProxies} from '../client/roomNormalProxies';

test('the normal pass merges fixed furnishings while preserving world-space vertices and restoring source visibility', () => {
  const scene = new Scene(), room = new Group(), material = new MeshStandardMaterial();
  const geometry = new BoxGeometry(1, 1, 1);
  const first = new Mesh(geometry, material), second = new Mesh(geometry, material);
  first.position.set(3, 1, -1); second.position.set(-3, 0, 4);
  second.rotation.y = .6; second.scale.set(1, 2, .8);
  for (const mesh of [first, second]) {mesh.updateMatrix();mesh.matrixAutoUpdate = false;}
  room.position.set(18, 2, -9);room.add(first, second);scene.add(room);
  scene.updateMatrixWorld(true);registerFixedRoom(scene, room);
  const original = room.children, proxies = createRoomNormalProxies(scene);
  try {
    proxies.show();
    assert.equal(room.children.length, 1);
    const proxy = room.children[0] as Mesh;
    assert.equal(proxy.geometry.index!.count, 2 * geometry.index!.count);
    const pos = geometry.getAttribute('position'), merged = proxy.geometry.getAttribute('position');
    for (const [i, source] of [first, second].entries()) for (let j = 0; j < pos.count; j++) {
      const expected = new Vector3().fromBufferAttribute(pos, j).applyMatrix4(source.matrixWorld);
      const actual = new Vector3().fromBufferAttribute(merged, i * pos.count + j).applyMatrix4(proxy.matrixWorld);
      assert.ok(expected.distanceTo(actual) < 1e-6);
    }
    proxies.restore();
    assert.equal(room.children, original);
    first.visible = false;proxies.show();
    assert.equal(room.children, original);
    first.visible = true;room.add(new Group());proxies.show();
    assert.equal(room.children, original);
  } finally {
    proxies.restore();proxies.dispose();geometry.dispose();material.dispose();
  }
});
