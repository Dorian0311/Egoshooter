import * as T from 'three';
import type {InteriorState} from '../shared/interiors';

export type InteriorLamp={x:number;y:number;z:number;building:number};

/** Two stable world-light slots; the viewmodel has its own render-state cache. */
export function createInteriorLighting(root:T.Group,lamps:readonly InteriorLamp[]){
 const lights=[new T.PointLight(0xffd59b,0,14,2),new T.PointLight(0xffd59b,0,14,2)] as const;
 for(const light of lights)root.add(light);
 return {
  lights,
  update(position:{x:number;y:number;z:number},time:number,state:InteriorState){
   let first=-1,second=-1,firstDistance=Infinity,secondDistance=Infinity;
   for(let i=0;i<lamps.length;i++){
    const lamp=lamps[i],distance=(lamp.x-position.x)**2+(lamp.y-position.y)**2+(lamp.z-position.z)**2;
    if(distance<firstDistance){second=first;secondDistance=firstDistance;first=i;firstDistance=distance;}
    else if(distance<secondDistance){second=i;secondDistance=distance;}
   }
   for(let slot=0;slot<2;slot++){
    const lamp=lamps[slot===0?first:second],light=lights[slot];
    if(!lamp){light.intensity=0;continue;}
    light.position.set(lamp.x,lamp.y,lamp.z);
    light.intensity=state.lights[`light-${lamp.building}`]===false?0:38*(1+.025*Math.sin(time*.014+lamp.building));
   }
  },
  dispose(){for(const light of lights)light.removeFromParent();},
 };
}
