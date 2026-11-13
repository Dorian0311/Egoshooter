import type {Box,Building,World} from './world';
export type InteriorState={doors:Record<string,boolean>;lights:Record<string,boolean>;broken:string[]};
export type Fixture={id:string;type:'door'|'light'|'glass';box:Box;building:number};
export type Furnishing={box:Box;style:'desk'|'bench'|'cabinet'|'bed'|'stove'|'radio'|'sandbags'|'rubble';label?:string};
export const roomThemes=['Wohnung','Funkwache','Versorgung','Bahnhof','Kommandostelle','Unterkunft'];
export function furnitureColliders(f:Furnishing):Box[]{
 const q=f.box;
 return f.style==='bench'?[{...q,y:q.y-q.h/4,h:q.h/2},{...q,y:q.y+q.h/4,z:q.z-q.d/2+.05,h:q.h/2,d:.1}]:[q];
}
export function furnitureFor(b:Building,index:number):Furnishing[]{
 const result:Furnishing[]=[];
 const add=(style:Furnishing['style'],x:number,y:number,z:number,w:number,h:number,d:number,label?:string)=>result.push({style,label,box:{x:b.x+x,y,z:b.z+z,w,h,d,kind:'interior'}});
 const theme=index%6;
 if(theme===0){add('stove',4,.55,-4,1.4,1.1,1.1);add('desk',3,.48,3,2.3,.96,1.3);add('cabinet',-4,1.1,-5,1.4,2.2,.7);}
 if(theme===1||theme===4){add('desk',4,.48,-3,2.8,.96,1.2);add('radio',4,1.17,-3,.9,.42,.6);add('cabinet',-4,1.1,4,1.8,2.2,.7);}
 if(theme===2){add('cabinet',4,1.1,-4,2,2.2,.8);add('bench',-4,.5,3,2.4,1,1.1);add('bed',3,.35,4,1.2,.7,2.3);}
 if(theme===3){add('desk',4,.75,-3,3,1.5,1.1,'FAHRKARTEN');add('bench',-4,.5,-4,2.6,1,1);add('bench',-4,.5,3,2.6,1,1);}
 if(theme===5){add('bed',-3,.35,-4,1.2,.7,2.3);add('bed',3,.35,4,1.2,.7,2.3);add('stove',4,.6,-4,1,1.2,1);}
 add('sandbags',b.upper?3.5:b.w/2-1.6,.55,b.upper?5.7:3.5,1.5,1.1,2.1);
 add('rubble',-4,.16,5.7,1.5,.32,1.1);
 if(b.upper){add('desk',3,4.65,-3,2.4,1.05,1.2);add('radio',3,5.39,-3,.9,.42,.6);add('bed',-3,4.5,3,1.2,.75,2.2);add('sandbags',3,4.7,5.6,2.4,1.15,1);}
 return result;
}
const layouts=new WeakMap<World,Fixture[]>();
export function interiorFixtures(world:World):Fixture[]{
 let items=layouts.get(world);if(items)return items;items=[];
 world.buildings.forEach((b,n)=>{
  for(const side of [-1,1])items!.push({id:`door-${n}-${side}`,type:'door',building:n,box:{x:b.x,y:1.45,z:b.z+side*b.d/2,w:3.8,h:2.9,d:.16,kind:'door'}});
  items!.push({id:`light-${n}`,type:'light',building:n,box:{x:b.x+2.6,y:1.4,z:b.z-b.d/2+.4,w:.18,h:.28,d:.12}});
  for(const side of [-1,1])for(const dz of [-3.25,3.25])for(const level of b.upper?[0,4]:[0])items!.push({id:`glass-${n}-${side}-${dz}-${level}`,type:'glass',building:n,box:{x:b.x+side*b.w/2,y:level+1.98,z:b.z+dz,w:.06,h:1.48,d:3.15,kind:'glass'}});
 });layouts.set(world,items);return items;
}
export function initialInteriors(world:World):InteriorState{
 return {doors:Object.fromEntries(interiorFixtures(world).filter(f=>f.type==='door').map(f=>[f.id,true])),lights:Object.fromEntries(interiorFixtures(world).filter(f=>f.type==='light').map(f=>[f.id,true])),broken:interiorFixtures(world).filter(f=>f.type==='glass'&&f.building%3===2&&f.id.includes('--3.25-')).map(f=>f.id)};
}
export function doorBox(f:Fixture,open:boolean):Box{
 return open?{...f.box,x:f.box.x-f.box.w/2,z:f.box.z+(f.id.endsWith('--1')?1:-1)*f.box.w/2,w:f.box.d,d:f.box.w}:f.box;
}
export function interiorWorld(world:World,state:InteriorState|undefined):World{
 if(!state)return world;
 const boxes=interiorFixtures(world).flatMap(f=>f.type==='door'?[doorBox(f,!!state.doors[f.id])]:f.type==='glass'&&!state.broken.includes(f.id)?[f.box]:[]);
 return {...world,boxes:[...world.boxes,...boxes]};
}
export function insideBuilding(world:World,x:number,z:number){return world.buildings.findIndex(b=>Math.abs(x-b.x)<b.w/2-.25&&Math.abs(z-b.z)<b.d/2-.25);}
