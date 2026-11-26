import {Box3, Vector3, type Camera, type Frustum} from 'three';
import {islandShops,shopParts} from '../shared/islandStreet';

export const streetRooms=islandShops.map(shop=>{
 const parts=shopParts(shop),sign=parts.find(part=>part.role==='sign')!;
 const top=sign.y-sign.h/2,padding=.015;
 const podium=parts.find(part=>part.role==='sill')!;
 const left=parts.find(part=>part.role==='post'&&part.x<shop.x)!;
 const right=parts.find(part=>part.role==='post'&&part.x>shop.x)!;
 const span=(min:number,max:number,bottom:number)=>new Box3(
  new Vector3(min-padding,bottom-padding,sign.z-sign.d/2-padding),
  new Vector3(max+padding,top+padding,sign.z+sign.d/2+padding),
 );
 const sillHeight=podium.y+podium.h/2;
 const front=shop.z+shop.front*shop.d/2;
 const facade=new Box3(new Vector3(shop.x-shop.w/2,0,front-.30),new Vector3(shop.x+shop.w/2,shop.h,front+.30));
 return {shop,facade,openings:[
  span(left.x+left.w/2,right.x-right.w/2,0),
  span(shop.x-shop.w/2+.24,left.x-left.w/2,sillHeight),
  span(right.x+right.w/2,shop.x+shop.w/2-.24,sillHeight),
 ]};
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
