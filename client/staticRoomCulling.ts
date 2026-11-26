import {Box3, Frustum, Matrix4, type Camera, type Object3D, type Scene} from 'three';

type FixedRoom = {object: Object3D; bounds: Box3};
const roomsByScene = new WeakMap<Scene, FixedRoom[]>();
export function fixedRooms(scene: Scene): readonly FixedRoom[] {
  return roomsByScene.get(scene) ?? [];
}

/** Register only furnishings whose geometry and world placement are fixed for the map's lifetime. */
export function registerFixedRoom(scene: Scene, object: Object3D) {
  const bounds = new Box3().setFromObject(object);
  if (bounds.isEmpty()) return;
  const rooms = roomsByScene.get(scene);
  if (rooms) rooms.push({object, bounds});
  else roomsByScene.set(scene, [{object, bounds}]);
}

export function createStaticRoomCulling(scene: Scene) {
  const cameraFrustum = new Frustum(), projection = new Matrix4();
  const hidden: Object3D[] = [], shadowOnly: Object3D[] = [];
  return {
    begin(camera: Camera, shadowFrustum?: Frustum) {
      const rooms = roomsByScene.get(scene);
      if (!rooms) return;
      cameraFrustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for (const {object, bounds} of rooms) {
        if (!object.visible || cameraFrustum.intersectsBox(bounds)) continue;
        if (shadowFrustum?.intersectsBox(bounds)) {
          shadowOnly.push(object);
        } else {
          object.visible = false;
          hidden.push(object);
        }
      }
    },
    afterWorld() {
      for (const room of shadowOnly) {
        room.visible = false;
        hidden.push(room);
      }
      shadowOnly.length = 0;
    },
    restore() {
      for (const room of hidden) room.visible = true;
      hidden.length = 0;
      shadowOnly.length = 0;
    }
  };
}
