import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Building } from '../shared/world.ts';

export function instanceStaticModel(scene: T.Scene|T.Group, source: T.Object3D, placements: T.Matrix4[]) {
  source.updateMatrixWorld(true);
  source.traverse(part => {
    if (!(part instanceof T.Mesh)) return;
    const instances = new T.InstancedMesh(part.geometry, part.material, placements.length);
    const matrix = new T.Matrix4();
    placements.forEach((placement, index) => {
      instances.setMatrixAt(index, matrix.multiplyMatrices(placement, part.matrixWorld));
    });
    instances.castShadow = true; instances.receiveShadow = true;
    instances.computeBoundingSphere(); scene.add(instances);
  });
}

// Static world geometry needs one draw per material, not one draw per shutter/slat.
// Keep replaceable cover meshes and instances independent.
export function batchStaticMeshes(scene: T.Scene | T.Group, excluded: Set<T.Object3D>) {
  const groups = new Map<string, T.Mesh<T.BufferGeometry, T.Material>[]>();
  for (const object of scene.children) {
    if (!(object instanceof T.Mesh) || object instanceof T.InstancedMesh ||
      Array.isArray(object.material) || excluded.has(object) || object.children.length) continue;
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    const group = groups.get(key) ?? [];
    group.push(object); groups.set(key, group);
  }
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const mixedIndices=meshes.some(mesh=>!!mesh.geometry.index)&&meshes.some(mesh=>!mesh.geometry.index);
    const geometries = meshes.map(mesh => {
      mesh.updateMatrix();
      return (mixedIndices&&mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrix);
    });
    const geometry = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (!geometry) continue;
    const batch = new T.Mesh(geometry, meshes[0].material);
    batch.castShadow = meshes[0].castShadow;
    batch.receiveShadow = meshes[0].receiveShadow;
    geometry.computeBoundingSphere();
    for (const mesh of meshes) { scene.remove(mesh); mesh.geometry.dispose(); }
    scene.add(batch);
  }
}

export function createRiver(scene: T.Scene,width=60,depth=420,height=-4) {
  const time = { value: 0 };
  const material = new T.MeshPhysicalMaterial({
    color: '#254a50', roughness: .22, metalness: .12,
    clearcoat: 1, clearcoatRoughness: .16, envMapIntensity: 1.15,
  });
  const waves = `
    uniform float riverTime;
    float wave(vec2 p) {
      return sin(p.x * .8 + p.y * .42 + riverTime * .8) * .065
        + sin(p.y * 1.5 - p.x * .3 + riverTime * 1.1) * .025;
    }
  `;
  material.onBeforeCompile = shader => {
    shader.uniforms.riverTime = time;
    shader.vertexShader = waves + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
      float slopeX = (wave(position.xz + vec2(.08, 0.)) - wave(position.xz - vec2(.08, 0.))) / .16;
      float slopeZ = (wave(position.xz + vec2(0., .08)) - wave(position.xz - vec2(0., .08))) / .16;
      vec3 objectNormal = normalize(vec3(-slopeX, 1., -slopeZ));
    `).replace('#include <begin_vertex>', `
      vec3 transformed = position;
      transformed.y += wave(position.xz);
    `);
  };
  material.customProgramCacheKey = () => 'river-waves-v1';
  const geometry = new T.PlaneGeometry(width, depth, 96, 256);
  geometry.rotateX(-Math.PI / 2);
  const river = new T.Mesh(geometry, material);
  river.position.y = height;
  river.receiveShadow = true;
  scene.add(river);
  return { update(seconds: number) { time.value = seconds; } };
}

// Details stay on existing solid facades and roofs; openings and routes remain clear.
export function addFacadeDetails(scene: T.Scene, buildings: Building[],
  material: (color: string) => T.MeshStandardMaterial) {
  const pipeGeometry = new T.CylinderGeometry(.055, .055, 1, 8);
  const pipeMaterial = material('#414b46');
  const trimMaterial = material('#9d8b75');
  const ridgeGeometry = new T.CylinderGeometry(.17, .17, .44, 10, 1, true, 0, Math.PI);
  ridgeGeometry.rotateX(Math.PI / 2);
  const ridgeCount = buildings.reduce((total, b) => total + Math.ceil((b.d + 1) / .42), 0);
  const ridges = new T.InstancedMesh(ridgeGeometry, material('#68534a'), ridgeCount);
  const pipes = new T.InstancedMesh(pipeGeometry, pipeMaterial, buildings.length * 4);
  const trims = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), trimMaterial, buildings.length * 8);
  const transform = new T.Object3D();
  let ridgeIndex = 0, pipeIndex = 0, trimIndex = 0;
  for (const b of buildings) {
    const height = b.upper ? 8 : 4;
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        transform.position.set(b.x + end * (b.w / 2 - .18), height / 2, b.z + side * (b.d / 2 + .34));
        transform.scale.set(1, height, 1); transform.updateMatrix();
        pipes.setMatrixAt(pipeIndex++, transform.matrix);
      }
      for (const y of [.36, height - .18]) {
        transform.position.set(b.x + side * (b.w / 2 + .24), y, b.z);
        transform.scale.set(.12, .22, b.d + .35); transform.updateMatrix();
        trims.setMatrixAt(trimIndex++, transform.matrix);
        transform.position.set(b.x, y, b.z + side * (b.d / 2 + .26));
        transform.scale.set(b.w + .5, .22, .12); transform.updateMatrix();
        trims.setMatrixAt(trimIndex++, transform.matrix);
      }
    }
    transform.scale.set(1, 1, 1);
    for (let z = -b.d / 2 - .3; z < b.d / 2 + .5; z += .42) {
      transform.position.set(b.x, height + 2.7, b.z + z); transform.updateMatrix();
      ridges.setMatrixAt(ridgeIndex++, transform.matrix);
    }
  }
  ridges.count = ridgeIndex;
  for (const mesh of [ridges, pipes, trims]) {
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); scene.add(mesh);
  }
}

export function addAlpineBackdrop(scene: T.Scene) {
  // One continuous ridge with deterministic erosion and snow, instead of isolated cones.
  const segments = 192, rings = 24;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const rock = new T.Color('#59666b'), snow = new T.Color('#e4edf0'), color = new T.Color();
  for (let ring = 0; ring <= rings; ring++) {
    const distance = 88 + ring * 6;
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      const ridge = 34 + 17 * Math.sin(angle * 7 + .4) + 12 * Math.sin(angle * 13) + 6 * Math.sin(angle * 23);
      const envelope = Math.sin(Math.PI * ring / rings) ** .8;
      const erosion = Math.sin(angle * 47 + ring * .55) * 2.3 + Math.cos(angle * 31 - ring * .8) * 1.8;
      const y = Math.max(-2, (ridge + erosion) * envelope - 3);
      positions.push(Math.cos(angle) * distance, y, Math.sin(angle) * distance);
      const snowLine = T.MathUtils.smoothstep(y + erosion * 1.5, 19, 38);
      color.copy(rock).lerp(snow, snowLine).multiplyScalar(.92 + .08 * Math.sin(angle * 47 + ring));
      colors.push(color.r, color.g, color.b);
      if (ring < rings && i < segments) {
        const a = ring * (segments + 1) + i, b = a + segments + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const terrain = new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, roughness: .94 }));
  terrain.receiveShadow = true; scene.add(terrain);
  const trees = new T.InstancedMesh(new T.ConeGeometry(1, 1, 10),
    new T.MeshStandardMaterial({ color: '#2b443e', roughness: .94 }), 180);
  const transform = new T.Object3D();
  for (let i = 0; i < 60; i++) {
    const angle = i * 2.39996, radius = 78 + (i % 5) * 1.7, height = 6 + (i % 7) * .6;
    for (let layer = 0; layer < 3; layer++) {
      transform.position.set(Math.cos(angle) * radius, height * (.3 + layer * .22), Math.sin(angle) * radius);
      transform.scale.set(2.2 - layer * .5, height * .6, 2.2 - layer * .5);
      transform.updateMatrix(); trees.setMatrixAt(i * 3 + layer, transform.matrix);
    }
  }
  trees.castShadow = true; trees.receiveShadow = true; scene.add(trees);
}
