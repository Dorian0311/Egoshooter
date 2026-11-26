import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Building } from '../shared/world.ts';
import {freezeStaticTransforms} from './staticTransforms';

export function instanceStaticModel(scene: T.Scene|T.Group, source: T.Object3D, placements: T.Matrix4[],castShadow=true,cellSize=Infinity,includePart?:(part:T.Mesh)=>boolean) {
  const cells=new Map<string,T.Matrix4[]>();
  for(const placement of placements){
    const key=Number.isFinite(cellSize)&&cellSize>0?`${Math.floor(placement.elements[12]/cellSize)},${Math.floor(placement.elements[14]/cellSize)}`:'all';
    const cell=cells.get(key)??[];cell.push(placement);cells.set(key,cell);
  }
  source.updateMatrixWorld(true);
  source.traverse(part => {
    if (!(part instanceof T.Mesh)||includePart&&!includePart(part)) return;
    for(const cell of cells.values()){
      const instances = new T.InstancedMesh(part.geometry, part.material, cell.length);
      const matrix = new T.Matrix4();
      cell.forEach((placement, index) => {
        instances.setMatrixAt(index, matrix.multiplyMatrices(placement, part.matrixWorld));
      });
      instances.castShadow = castShadow; instances.receiveShadow = true;
      instances.computeBoundingSphere(); scene.add(instances);freezeStaticTransforms(instances);
    }
  });
}

// One draw per material/cell, rather than per shutter/slat or a town-wide batch.
// Keep replaceable cover meshes and instances independent.
export function batchStaticMeshes(scene: T.Scene | T.Group, excluded: Set<T.Object3D>,cellSize=Infinity,tintable:ReadonlySet<T.Material>=new Set()) {
  const groups = new Map<string, T.Mesh<T.BufferGeometry, T.Material>[]>();
  for (const object of scene.children) {
    if (!(object instanceof T.Mesh) || object instanceof T.InstancedMesh ||
      Array.isArray(object.material) || excluded.has(object) || object.children.length) continue;
    const cell=Number.isFinite(cellSize)&&cellSize>0?`${Math.floor(object.position.x/cellSize)},${Math.floor(object.position.z/cellSize)}`:'all';
    const material=object.material;
    const tinted=tintable.has(material)&&material instanceof T.MeshStandardMaterial&&!material.vertexColors;
    const attributes=Object.keys(object.geometry.attributes).sort().join(',');
    const appearance=tinted?`tint:${material.roughness}:${material.metalness}:${material.side}:${material.emissive.getHex()}:${material.emissiveIntensity}:${attributes}`:material.uuid;
    const key = `${appearance}:${object.castShadow}:${object.receiveShadow}:${cell}`;
    const group = groups.get(key) ?? [];
    group.push(object); groups.set(key, group);
  }
  for (const [key,meshes] of groups) {
    if (meshes.length < 2){freezeStaticTransforms(meshes[0]);continue;}
    const mixedIndices=meshes.some(mesh=>!!mesh.geometry.index)&&meshes.some(mesh=>!mesh.geometry.index);
    const tinted=key.startsWith('tint:');
    const geometries = meshes.map(mesh => {
      mesh.updateMatrix();
      const geometry=(mixedIndices&&mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrix);
      if(tinted){
        const material=mesh.material as T.MeshStandardMaterial;
        const colors=new Float32Array(geometry.getAttribute('position').count*3);
        for(let index=0;index<colors.length;index+=3)material.color.toArray(colors,index);
        geometry.setAttribute('color',new T.BufferAttribute(colors,3));
      }
      return geometry;
    });
    const geometry = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (!geometry) continue;
    const material=tinted?(meshes[0].material as T.MeshStandardMaterial).clone():meshes[0].material;
    if(tinted&&material instanceof T.MeshStandardMaterial){material.color.setRGB(1,1,1);material.vertexColors=true;}
    const batch = new T.Mesh(geometry, material);
    batch.castShadow = meshes[0].castShadow;
    batch.receiveShadow = meshes[0].receiveShadow;
    geometry.computeBoundingSphere();
    for (const mesh of meshes) { scene.remove(mesh); mesh.geometry.dispose(); }
    scene.add(batch);freezeStaticTransforms(batch);
  }
}

export function createRiver(scene: T.Scene,width=60,depth=420,height=-4,color='#254a50',segments:readonly [number,number]=[40,128],receiveShadow=true) {
  const time = { value: 0 };
  const material = new T.MeshPhysicalMaterial({
    color, roughness: .22, metalness: .12,
    clearcoat: 1, clearcoatRoughness: .16, envMapIntensity: 1.15,
  });
  const waves = `
    uniform float riverTime;
    varying vec2 vRiverPosition;
    float wave(vec2 p) {
      return sin(dot(p, vec2(.31, .20)) - riverTime * .82) * .066
        + sin(dot(p, vec2(-.24, .36)) - riverTime * 1.03) * .037;
    }
  `;
  material.onBeforeCompile = shader => {
    shader.uniforms.riverTime = time;
    shader.vertexShader = waves + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
      vec2 slope = vec2(.31, .20) * .066 * cos(dot(position.xz, vec2(.31, .20)) - riverTime * .82)
        + vec2(-.24, .36) * .037 * cos(dot(position.xz, vec2(-.24, .36)) - riverTime * 1.03);
      vec3 objectNormal = normalize(vec3(-slope.x, 1., -slope.y));
    `).replace('#include <begin_vertex>', `
      vec3 transformed = position;
      transformed.y += wave(position.xz);
      vRiverPosition = position.xz;
    `);
    shader.uniforms.riverHalfWidth={value:width/2};
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float riverTime;
      uniform float riverHalfWidth;
      varying vec2 vRiverPosition;
    `).replace('#include <color_fragment>',`#include <color_fragment>
      float bank = smoothstep(riverHalfWidth - 5.0, riverHalfWidth, abs(vRiverPosition.x));
      diffuseColor.rgb *= mix(vec3(.90, 1.03, 1.06), vec3(1.32, 1.15, .84), bank);
    `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      // The fine current lives in the normal, so distant ripples do not need vertices.
      float rippleFade = 1.0 - smoothstep(30.0, 120.0, length(vViewPosition));
      float bend = sin(dot(vRiverPosition, vec2(.063, -.14)) + riverTime * .24);
      vec2 current = vec2(.054, .026) * sin(dot(vRiverPosition, vec2(1.12, 1.54)) - riverTime * 2.2 + bend * 1.7)
        + vec2(-.032, .047) * sin(dot(vRiverPosition, vec2(-1.28, 2.01)) - riverTime * 2.73 - bend * 1.1);
      normal = normalize(normal + mat3(viewMatrix) * vec3(current.x, 0.0, current.y) * rippleFade);
    `).replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
      #ifdef USE_CLEARCOAT
        clearcoatNormal = normal;
      #endif
    `);
  };
  material.customProgramCacheKey = () => 'river-waves-v2';
  const geometry = new T.PlaneGeometry(width, depth, ...segments);
  geometry.rotateX(-Math.PI / 2);
  const river = new T.Mesh(geometry, material);
  river.position.y = height;
  river.receiveShadow = receiveShadow;
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

export {addAlpineBackdrop} from './alpineBackdrop';
