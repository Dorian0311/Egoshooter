import {BufferGeometry, Mesh, type Material, type Object3D, type Scene} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {fixedRooms} from './staticRoomCulling';

function fixedMesh(object: Object3D): object is Mesh<BufferGeometry, Material> {
  if (!(object instanceof Mesh) || object.children.length || object.matrixAutoUpdate ||
      'isInstancedMesh' in object || 'isBatchedMesh' in object || 'isSkinnedMesh' in object ||
      object.morphTargetInfluences || object.matrix.determinant() <= 0 || object.layers.mask !== 1) return false;
  const material = object.material, geometry = object.geometry;
  return !Array.isArray(material) && !material.transparent && !material.alphaTest && !material.alphaHash &&
    !material.wireframe && !material.displacementMap && material.depthWrite && material.colorWrite &&
    geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity &&
    !!geometry.attributes.position && !!geometry.attributes.normal;
}

/** Only the normal override sees these meshes; world materials, doors and shadows keep their original draws. */
export function createRoomNormalProxies(scene: Scene) {
  const entries = fixedRooms(scene).flatMap(({object: room}) => {
    const sources = room.children;
    if (sources.length < 2 || !sources.every(fixedMesh)) return [];
    const parts = sources.map(mesh => {
      const geometry = new BufferGeometry();
      for (const key of ['position', 'normal']) geometry.setAttribute(key, mesh.geometry.getAttribute(key).clone());
      if (mesh.geometry.index) geometry.setIndex(mesh.geometry.index);
      geometry.applyMatrix4(mesh.matrix);
      // Keep indexed merging consistent even for a mixture of authored geometries.
      if (!geometry.index) geometry.setIndex(Array.from({length:geometry.attributes.position.count}, (_, i) => i));
      return geometry;
    });
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    if (!geometry) return [];
    geometry.computeBoundingSphere();
    const proxy = new Mesh(geometry, sources[0].material);
    proxy.matrixAutoUpdate = false;
    const replacement: Object3D[] = [proxy];
    return [{room, sources, sourceCount:sources.length, proxy, replacement}];
  });
  return {
    show() {
      for (const {room, sources, sourceCount, proxy, replacement} of entries) {
        if (!room.visible || room.children !== sources || sources.length !== sourceCount ||
            !sources.every(mesh => mesh.visible && mesh.material.visible)) continue;
        proxy.matrixWorld.copy(room.matrixWorld);
        room.children = replacement;
      }
    },
    restore() {
      for (const {room, sources, replacement} of entries) if (room.children === replacement) room.children = sources;
    },
    dispose() { for (const {proxy} of entries) proxy.geometry.dispose(); }
  };
}
