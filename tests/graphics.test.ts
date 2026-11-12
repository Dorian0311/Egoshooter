import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGraphicsQuality, renderPixelRatio,ResolutionGovernor } from '../client/graphicsSettings.ts';
import * as T from 'three';
import { addFacadeDetails, addAlpineBackdrop, createRiver, batchStaticMeshes, instanceStaticModel } from '../client/scenery.ts';
import { getWorld } from '../shared/world.ts';

test('graphics preferences tolerate old or corrupt storage values', () => {
  for (const value of [null, '', 'cinematic', '__proto__']) assert.equal(parseGraphicsQuality(value), 'auto');
  assert.equal(parseGraphicsQuality('performance'), 'performance');
  assert.equal(parseGraphicsQuality('high'), 'high');
});

test('adaptive resolution lowers cost under sustained load without chasing pauses',()=>{
  const governor=new ResolutionGovernor();
  for(let i=0;i<480;i++)governor.update(1/30);
  assert.equal(governor.scale,.55);
  for(let i=0;i<200;i++)governor.update(1/60,false);
  assert.equal(governor.scale,.55);
  for(let i=0;i<700;i++)governor.update(1/60);
  assert.ok(governor.scale>.55&&governor.scale<.7);
  governor.reset();for(let i=0;i<80;i++)governor.update(1);
  assert.equal(governor.scale,1);
});

test('resolution stays within the GPU pixel budget on high-DPI and 4K screens', () => {
  assert.equal(renderPixelRatio('ultra', 2, 1920, 1080), 2);
  assert.equal(renderPixelRatio('ultra', 2, 3840, 2160), 1);
  assert.equal(renderPixelRatio('performance', 2, 1920, 1080), 1);
  assert.equal(renderPixelRatio('auto', 2, 1920, 1080), 2/3);
  for (const quality of ['performance', 'high', 'ultra'] as const) {
    assert.ok(Number.isFinite(renderPixelRatio(quality, 1, 0, 0)));
    const ratio = renderPixelRatio(quality, 3, 7680, 4320);
    assert.ok(7680 * 4320 * ratio * ratio <= 8_294_401);
  }
});

test('facade instancing fits allocated buffers on both maps', () => {
  for (const id of ['cologne', 'alpine'] as const) {
    const scene = new T.Scene();
    addFacadeDetails(scene, getWorld(id).buildings, () => new T.MeshStandardMaterial());
    for (const child of scene.children) {
      const mesh = child as T.InstancedMesh;
      assert.ok(mesh.count > 0 && mesh.count <= mesh.instanceMatrix.count);
      assert.ok(mesh.boundingSphere && Number.isFinite(mesh.boundingSphere.radius));
    }
  }
});

test('alpine terrain faces upward and keeps the playable area clear', () => {
  const scene = new T.Scene();
  addAlpineBackdrop(scene);
  const mountain = scene.children[0] as T.Mesh;
  const positions = mountain.geometry.getAttribute('position');
  const normals = mountain.geometry.getAttribute('normal');
  for (let i = 0; i < positions.count; i++) {
    assert.ok(Math.hypot(positions.getX(i), positions.getZ(i)) >= 87.99);
    assert.ok(normals.getY(i) >= 0);
  }
});

test('river stays below the playable bridge and advances its animation uniform', () => {
  const scene = new T.Scene();
  const river = createRiver(scene);
  const mesh = scene.children[0] as T.Mesh<T.BufferGeometry, T.MeshPhysicalMaterial>;
  assert.equal(mesh.position.y, -4);
  const shader = { uniforms: {}, vertexShader: '#include <beginnormal_vertex>\n#include <begin_vertex>', fragmentShader: '' } as unknown as T.WebGLProgramParametersWithUniforms;
  mesh.material.onBeforeCompile(shader, {} as T.WebGLRenderer);
  river.update(12);
  assert.equal(shader.uniforms.riverTime.value, 12);
  assert.ok(shader.vertexShader.includes('vec3 objectNormal'));
});

test('static batching preserves world positions and replaceable cover meshes', () => {
  const scene = new T.Scene(), material = new T.MeshStandardMaterial();
  const left = new T.Mesh(new T.BoxGeometry(2, 2, 2), material);
  left.position.set(-10, 2, 0); left.castShadow = true;
  const right = new T.Mesh(new T.BoxGeometry(2, 2, 2), material);
  right.position.set(10, 2, 0); right.castShadow = true;
  const cover = new T.Mesh(new T.BoxGeometry(), material);
  scene.add(left, right, cover);
  batchStaticMeshes(scene, new Set([cover]));
  assert.equal(scene.children.length, 2);
  assert.equal(cover.parent, scene);
  const batch = scene.children.find(child => child !== cover) as T.Mesh;
  const bounds = new T.Box3().setFromObject(batch);
  assert.equal(bounds.min.x, -11); assert.equal(bounds.max.x, 11);
  assert.equal(bounds.min.y, 1); assert.equal(bounds.max.y, 3);
  assert.equal(batch.castShadow, true);
  assert.equal(batch.geometry.index?.count, 72);
});

test('model instancing preserves nested asset transforms and all placements', () => {
  const source = new T.Group(), nested = new T.Group();
  nested.position.set(1, 2, 3); source.add(nested);
  nested.add(new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()));
  const scene = new T.Scene();
  instanceStaticModel(scene, source, [new T.Matrix4().makeTranslation(10, 0, 0), new T.Matrix4().makeTranslation(-10, 0, 0)]);
  assert.equal(scene.children.length, 1);
  const mesh = scene.children[0] as T.InstancedMesh, matrix = new T.Matrix4();
  assert.equal(mesh.count, 2);
  mesh.getMatrixAt(0, matrix); assert.deepEqual(new T.Vector3().setFromMatrixPosition(matrix).toArray(), [11, 2, 3]);
  mesh.getMatrixAt(1, matrix); assert.deepEqual(new T.Vector3().setFromMatrixPosition(matrix).toArray(), [-9, 2, 3]);
});
