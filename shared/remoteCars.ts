import {nearbyBoxes} from './boxIndex';
import {ground,withinPlayArea,type World} from './world';

export type RemoteCar={
  id:string; x:number; y:number; z:number; yaw:number; speed:number;
  driver?:string; driverLife?:number; spent?:boolean; detonateAt?:number; armedBy?:string;
};
export const CAR_WARNING_MS=850;
export type CarCourse={
  carId:string;
  gates:{x:number;y:number;z:number}[];
  next:number;
  startedAt:number;
  elapsedMs?:number;
  bestMs?:number;
};

export function createCarCourse(world:World,cars:RemoteCar[]):CarCourse|undefined{
  const [spawnX,spawnZ]=world.spawns.de[0];
  const car=cars.reduce<RemoteCar|undefined>((closest,candidate)=>{
    const distance=(point:RemoteCar)=>Math.hypot(point.x-spawnX,point.z-spawnZ);
    return !closest||distance(candidate)<distance(closest)?candidate:closest;
  },undefined);
  if(!car)return undefined;
  const building=world.buildings[cars.indexOf(car)];
  const gates=[-2.4,-5, -building.d/2-.65,-building.d/2+2.8].map(offset=>{
    const z=car.z+offset;
    return {x:car.x,y:ground(car.x,z,world),z};
  });
  return {carId:car.id,gates,next:0,startedAt:0};
}

export function parkedCars(world:World):RemoteCar[]{
  return world.buildings.map((building,index)=>({
    id:`car:${index}`,x:building.x,y:ground(building.x,building.z,world),z:building.z,
    yaw:0,speed:0,
  }));
}

/** Low, short steps keep the car on the ground and prevent tunnelling past doors. */
export function driveCar(car:RemoteCar, throttle:number, steering:number, seconds:number, world:World){
  const dt=Math.min(.05,Math.max(0,seconds));
  const target=throttle*(throttle<0?2.4:5.5);
  const change=Math.max(-12*dt,Math.min(12*dt,target-car.speed));
  car.speed+=change;
  const turn=steering*2.8*dt*Math.min(1,Math.abs(car.speed)/1.2)*Math.sign(car.speed);
  car.yaw=Math.atan2(Math.sin(car.yaw-turn),Math.cos(car.yaw-turn));
  const dx=-Math.sin(car.yaw)*car.speed*dt,dz=-Math.cos(car.yaw)*car.speed*dt;
  function step(x:number,z:number){
    const y=ground(x,z,world),r=.24;
    if(y<-2||Math.abs(y-car.y)>.25||!withinPlayArea(x,z,world))return false;
    const blocked=nearbyBoxes(world.boxes,x-r,z-r,x+r,z+r).some(box=>
      y+.30>box.y-box.h/2+.02&&y<box.y+box.h/2-.025&&
      Math.abs(x-box.x)<box.w/2+r&&Math.abs(z-box.z)<box.d/2+r);
    if(blocked)return false;
    car.x=x;car.y=y;car.z=z;
    return true;
  }
  const xClear=step(car.x+dx,car.z),zClear=step(car.x,car.z+dz);
  if((!xClear&&Math.abs(dz)<.01)||(!zClear&&Math.abs(dx)<.01)||(!xClear&&!zClear))car.speed*=.25;
}
