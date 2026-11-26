import {Box3, Frustum, Matrix4, Mesh, Vector3, type Camera, type Object3D, type Scene} from 'three';

import {behindIslandWall,islandWallSections} from './islandWallOcclusion';
import type {World} from '../shared/world';

type FixedProp = {object:Mesh; bounds:Box3; revision:number; blocked:boolean};
type FixedRoom = {object: Object3D; bounds: Box3; props?:FixedProp[]};
const wallSections=new WeakMap<Scene,ReturnType<typeof islandWallSections>>();
const roomsByScene = new WeakMap<Scene, FixedRoom[]>();
export function fixedRooms(scene: Scene): readonly FixedRoom[] {
  return roomsByScene.get(scene) ?? [];
}

/** Register only furnishings whose geometry and world placement are fixed for the map's lifetime. */
export function registerFixedRoom(scene: Scene, object: Object3D, world?:World) {
  const bounds = new Box3().setFromObject(object);
  if (bounds.isEmpty()) return;
  const room:FixedRoom={object,bounds};
  if(world?.id==='storm'){
    if(!wallSections.has(scene))wallSections.set(scene,islandWallSections(world.boxes));
    room.props=object.children.filter((child):child is Mesh=>child instanceof Mesh)
      .map(child=>({object:child,bounds:new Box3().setFromObject(child),revision:-1,blocked:false}));
  }
  const rooms = roomsByScene.get(scene);
  if (rooms) rooms.push(room);
  else roomsByScene.set(scene, [room]);
}

export function createStaticRoomCulling(scene: Scene) {
  const cameraFrustum = new Frustum(), projection = new Matrix4();
  const hidden: Object3D[] = [], shadowOnly: Object3D[] = [];
  const eye=new Vector3(), lastEye=new Vector3(Infinity,Infinity,Infinity), nearCorner=new Vector3();
  let revision=0,lastRadius=-1;
  return {
    begin(camera: Camera, shadowFrustum?: Frustum, checkWalls=false) {
      const rooms = roomsByScene.get(scene);
      if (!rooms) return;
      cameraFrustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const sections=checkWalls?wallSections.get(scene):undefined;
      let nearRadius=0;
      if(sections){
        eye.setFromMatrixPosition(camera.matrixWorld);
        // Cover all four near-plane corners, including asymmetric projections.
        for(const x of [-1,1])for(const y of [-1,1])nearRadius=Math.max(nearRadius,nearCorner.set(x,y,-1).applyMatrix4(camera.projectionMatrixInverse).length());
        if(!lastEye.equals(eye)||nearRadius!==lastRadius){lastEye.copy(eye);lastRadius=nearRadius;revision++;}
      }
      for (const {object, bounds, props} of rooms) {
        if (!object.visible) continue;
        if(cameraFrustum.intersectsBox(bounds)){
          if(sections&&props)for(const prop of props){
            if(!prop.object.visible||!cameraFrustum.intersectsBox(prop.bounds)||
              (prop.object.castShadow&&shadowFrustum?.intersectsBox(prop.bounds)))continue;
            if(prop.revision!==revision){
              prop.blocked=behindIslandWall(prop.bounds,eye,nearRadius,sections);prop.revision=revision;
            }
            if(prop.blocked){prop.object.visible=false;hidden.push(prop.object);}
          }
          continue;
        }
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
