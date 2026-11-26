import {Box3, Vector3, type Camera, type Frustum} from 'three';
import {islandShops} from '../shared/islandStreet';

export const streetRooms=islandShops.map(shop=>{
 const front=shop.z+shop.front*shop.d/2;
 return {
  shop,
  opening:new Box3(new Vector3(shop.x-shop.w/2,0,front-.30),new Vector3(shop.x+shop.w/2,shop.h,front+.30)),
 };
});

/** Visibility through the facade depends on the view angles, not on last frame's far plane. */
export function shopOpeningInView(frustum:Frustum,opening:Box3){
 for(let side=0;side<6;side++){
  if(side===4)continue; // Three stores the far plane before the near plane.
  const {normal,constant}=frustum.planes[side];
  const x=normal.x>=0?opening.max.x:opening.min.x;
  const y=normal.y>=0?opening.max.y:opening.min.y;
  const z=normal.z>=0?opening.max.z:opening.min.z;
  if(normal.x*x+normal.y*y+normal.z*z+constant<0)return false;
 }
 return true;
}

/** Furthest room corner in view space with clearance for wall caps and trim. */
export function closedShopViewDepth(camera:Camera,shop:typeof islandShops[number]){
 const matrix=camera.matrixWorld.elements,x=matrix[8],y=matrix[9],z=matrix[10];
 const centerDepth=(matrix[12]-shop.x)*x+(matrix[13]-shop.h/2)*y+(matrix[14]-shop.z)*z;
 const radius=(Math.abs(x)*shop.w+Math.abs(y)*shop.h+Math.abs(z)*shop.d)*.5;
 return Math.ceil(centerDepth+radius+1);
}
