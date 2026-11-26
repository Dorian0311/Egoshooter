import assert from 'node:assert/strict';
import test from 'node:test';
import {Group, Mesh, Scene, type WebGLRenderer} from 'three';
import {WorldNormalSelection} from '../client/worldNormalSelection';

test('the normal pass retains world material groups and reprojects room proxies with normal scene visibility', () => {
  const scene = new Scene(), rooms = new Group(), room = new Group(), hidden = new Group();
  const world = new Mesh(), oldFurniture = new Mesh(), hiddenMesh = new Mesh(), sky = new Mesh();
  scene.add(world, rooms, hidden); rooms.add(room); room.add(oldFurniture); hidden.add(hiddenMesh);
  hidden.visible = false;
  const item = (object: Mesh, index: number) => ({object, material: {visible: true}, group: {materialIndex:index}});
  const group0 = item(world, 0), group1 = item(world, 1);
  const children = scene.children;
  let finished = 0;
  const init = () => { throw new Error('would clear the original pool'); };
  const finish = () => { assert.equal(scene.children, children); finished++; };
  const list = {init, finish, opaque:[group0,item(sky,0),item(oldFurniture,0),item(hiddenMesh,0),group1], transparent:[], transmissive:[]};
  const selection = new WorldNormalSelection(scene, [{object:room}]);
  const use = () => selection.use(list as unknown as ReturnType<WebGLRenderer['renderLists']['get']>);
  use(); list.init();
  assert.deepEqual(list.opaque, [group0,group1]);
  assert.deepEqual(scene.children, [rooms]);
  list.finish(); selection.restore();
  assert.equal(finished, 1); assert.equal(list.init, init); assert.equal(list.finish, finish);
  use(); list.init(); selection.restore();
  assert.equal(scene.children, children); assert.equal(list.init, init);
});
