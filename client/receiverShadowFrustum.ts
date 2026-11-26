import { Camera, Frustum, Vector3, Vector4 } from 'three';

/** Narrow only the four light-space side planes. Occluders at any light depth can still cast. */
export function createReceiverShadowFrustum() {
  const clipped = new Frustum(), point = new Vector3();
  const distances = new Float64Array(4);
  function include(camera: Camera, light: Frustum) {
    for (let x = -1; x <= 1; x += 2) for (let y = -1; y <= 1; y += 2) for (let z = -1; z <= 1; z += 2) {
      point.set(x, y, z).unproject(camera);
      for (let side = 0; side < 4; side++) {
        distances[side] = Math.min(distances[side], light.planes[side].distanceToPoint(point));
      }
    }
  }
  return (light: Frustum, camera: Camera, weapon: Camera | undefined, padding: number) => {
    clipped.copy(light);
    distances.fill(Infinity);
    include(camera, light);
    if (weapon) include(weapon, light);
    for (let side = 0; side < 4; side++) clipped.planes[side].constant -= Math.max(0, distances[side] - padding);
    return clipped;
  };
}

/** Convert the four orthographic side-plane insets to an outward-rounded WebGL scissor. */
export function setReceiverShadowScissor(rect:Vector4, full:Frustum, clipped:Frustum, width:number, height:number, span:number){
  const inset=(side:number)=>full.planes[side].constant-clipped.planes[side].constant;
  const x=Math.max(0,Math.min(width-1,Math.floor(inset(1)*width/span)));
  const y=Math.max(0,Math.min(height-1,Math.floor(inset(2)*height/span)));
  const right=Math.min(width,Math.ceil(width-inset(0)*width/span));
  const top=Math.min(height,Math.ceil(height-inset(3)*height/span));
  rect.set(x,y,Math.max(1,right-x),Math.max(1,top-y));
}
