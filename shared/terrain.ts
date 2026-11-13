import type {World,Building} from './world';
type Zone={x:number;z:number;w:number;d:number};
const zones=new WeakMap<Building[],Zone[]>();
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function flatZones(world:World){
 let result=zones.get(world.buildings);if(result)return result;
 result=[...world.buildings,...world.boxes.filter(b=>b.y-b.h/2<.3&&['platform','container','cover','sandbags','truck','ruin','rock','tree'].includes(b.kind??''))];
 zones.set(world.buildings,result);return result;
}
/** The same height field drives the rendered mesh, server movement and prediction.
 * Entries, collision props and spawn/road corridors retain their existing level. */
export function terrainHeight(x:number,z:number,world:World){
 if(world.id!=='storm'&&world.id!=='frontline')return 0;
 let height=0;
 if(world.id==='storm'){
  for(const [cx,cz,r,h]of [[-62,62,25,3.8],[62,-62,25,3.8],[-63,-62,24,2.8],[63,63,24,3.1],[-22,42,15,1.45],[22,-42,15,1.45]]){
   const t=Math.max(0,1-Math.hypot(x-cx,z-cz)/r);height+=h*t*t*(3-2*t);
  }
  const road=Math.min(Math.abs(x),Math.abs(z),Math.abs(Math.abs(x)-43));height*=smooth(3.8,9,road);
 }else{
  for(const [cx,cz,r]of [[-23,-19,10],[24,26,11],[-20,48,9],[19,-45,10]]){
   const t=Math.max(0,1-Math.hypot(x-cx,z-cz)/r);height-=.65*t*t*(3-2*t);
  }
  height*=smooth(1.7,3.8,Math.min(Math.abs(z-12),Math.abs(z+12)));
 }
 for(const zone of flatZones(world)){
  const distance=Math.hypot(Math.max(0,Math.abs(x-zone.x)-zone.w/2),Math.max(0,Math.abs(z-zone.z)-zone.d/2));
  height*=smooth(3,10,distance);if(Math.abs(height)<.00001)break;
 }
 if(world.id==='storm')height=height*(1-smooth(98,112,Math.hypot(x,z)))-4.2*smooth(112,128,Math.hypot(x,z));
 return height;
}
