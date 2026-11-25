// Ordered from the coastal turnout to the west stairs of the radar station.
export const islandRoute=[
 [-22,104],[-28,96],[-26,85],[-23,74],[-22,64],[-22,54],[-25,44],
 [-26,34],[-23,23],[-20,13],[-20,4],[-17,0],
] as const;

export const islandUnderpass={x:-22,z:59,clearance:3.45,width:5.8,depth:5} as const;
export const islandCourseRadius=1.25;

export function nearIslandRoute(x:number,z:number,radius:number){
 for(let i=1;i<islandRoute.length;i++){
  const [ax,az]=islandRoute[i-1],[bx,bz]=islandRoute[i];
  const dx=bx-ax,dz=bz-az;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
  if((x-ax-t*dx)**2+(z-az-t*dz)**2<radius*radius)return true;
 }
 return false;
}
