import {furnitureFor,furnitureColliders} from './interiors';
import {terrainHeight} from './terrain';
export type Box = {x:number;y:number;z:number;w:number;h:number;d:number;kind?:string};
export type Building={x:number;z:number;w:number;d:number;upper:boolean;name:string};
export type MapId='cologne'|'alpine'|'storm'|'frontline';
export type World={id:MapId;name:string;subtitle:string;ally?:string;allyCode?:string;opponent:string;opponentCode:string;playArea?:{halfSize:number;radius?:number};buildings:Building[];boxes:Box[];spawns:{de:number[][];fr:number[][]}};
const cologneBuildings:Building[]=[
{x:-48,z:-34,w:18,d:16,upper:true,name:'AM DOMHOF'},
{x:-48,z:0,w:18,d:16,upper:false,name:'BAHNWACHE'},
{x:-48,z:34,w:18,d:16,upper:true,name:'RHEINUFER'},
{x:48,z:-34,w:18,d:16,upper:false,name:'DEUTZER BAHNHOF'},
{x:48,z:0,w:18,d:16,upper:true,name:'BRÜCKENWACHE'},
{x:48,z:34,w:18,d:16,upper:false,name:'KÖLN-DEUTZ'}];
const alpineBuildings:Building[]=[
{x:-48,z:-30,w:18,d:16,upper:true,name:'POSTE DES ALPES'},
{x:-48,z:28,w:18,d:16,upper:false,name:'CASERNE'},
{x:48,z:-30,w:18,d:16,upper:true,name:'OBSERVATOIRE'},
{x:48,z:28,w:18,d:16,upper:false,name:'ABRI'},
{x:0,z:-46,w:18,d:16,upper:true,name:'ROCHE-LA-CROIX'},
{x:0,z:46,w:18,d:16,upper:false,name:'DÉPÔT'}];
const stormBuildings:Building[]=[
{x:-46,z:-40,w:18,d:16,upper:true,name:'NORDWACHT'},
{x:-46,z:36,w:18,d:16,upper:false,name:'VERSORGUNG'},
{x:46,z:-40,w:18,d:16,upper:false,name:'WERKSTATT'},
{x:46,z:36,w:18,d:16,upper:true,name:'SÜDWACHT'},
{x:0,z:-49,w:18,d:16,upper:false,name:'FUNKSTATION'},
{x:0,z:49,w:18,d:16,upper:false,name:'KÜSTENDEPOT'}];
for(const side of [-1,1])for(const direction of [-1,1]){
 stormBuildings.push({x:side*82,z:direction*38,w:18,d:16,upper:true,name:`KÜSTENWACHE ${side<0?'WEST':'OST'} ${direction<0?'NORD':'SÜD'}`});
 stormBuildings.push({x:side*38,z:direction*82,w:18,d:16,upper:false,name:`STRANDPOSTEN ${side<0?'WEST':'OST'} ${direction<0?'NORD':'SÜD'}`});
}
const frontlineBuildings:Building[]=[
{x:-46,z:-35,w:18,d:16,upper:true,name:'FELDPOST'},
{x:-46,z:35,w:18,d:16,upper:false,name:'SANITÄTSSTELLE'},
{x:46,z:-35,w:18,d:16,upper:false,name:'GÜTERBAHNHOF'},
{x:46,z:35,w:18,d:16,upper:true,name:'KOMMANDANTUR'},
{x:0,z:-51,w:18,d:16,upper:true,name:'ALTE MÜHLE'},
{x:0,z:51,w:18,d:16,upper:false,name:'LAGERHALLE'}];
for(const side of [-1,1])for(const [n,z]of [-62,-28,12,62].entries())frontlineBuildings.push({x:side*92,z,w:18,d:16,upper:n%2===1,name:['ARBEITERHAUS','MASCHINENHALLE','WERKSHOF','QUARTIER'][n]+(side<0?' WEST':' OST')});
frontlineBuildings.push({x:0,z:-88,w:18,d:16,upper:true,name:'NÖRDLICHE WACHE'},{x:0,z:88,w:18,d:16,upper:false,name:'SÜDLICHES DEPOT'});
function build(items:Building[]):Box[]{
 const boxes:Box[]=[];
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,kind='wall')=>boxes.push({x,y,z,w,h,d,kind});
 for(const b of items){const height=b.upper?8:4;
  for(const side of [-1,1]){const z=b.z+side*b.d/2;
   box(b.x-b.w/4-1,height/2,z,b.w/2-2,height,.45);box(b.x+b.w/4+1,height/2,z,b.w/2-2,height,.45);
   box(b.x,3.6,z,4,1,.45);if(b.upper)box(b.x,6,z,4,4,.45);
   const x=b.x+side*b.w/2;if(b.upper)box(x,.6,b.z,.45,1.2,b.d);else for(const dz of [-4.75,4.75])box(x,.6,b.z+dz,.45,1.2,6.5);box(x,3.25,b.z,.45,1.5,b.d);
   for(const dz of b.upper?[-6.5,0,6.5]:[-6.5,6.5])box(x,2,b.z+dz,.45,1.5,3);
   if(b.upper){box(x,4.6,b.z,.45,1.2,b.d);box(x,7.25,b.z,.45,1.5,b.d);for(const dz of [-6.5,0,6.5])box(x,6,b.z+dz,.45,1.5,3);}
  }
  if(b.upper){box(b.x,4,b.z,b.w-8,.25,b.d,'floor');box(b.x-7,4,b.z+6.7,4,.25,2.6,'floor');box(b.x+7,4,b.z-6.7,4,.25,2.6,'floor');for(let i=0;i<20;i++){box(b.x-7,(i+1)*.1,b.z-7+i*.65,3,(i+1)*.2,.7,'stair');box(b.x+7,(i+1)*.1,b.z+7-i*.65,3,(i+1)*.2,.7,'stair');}}
  box(b.x,height+.15,b.z,b.w+1,.3,b.d+1,'roof');boxes.push(...furnitureFor(b,items.indexOf(b)).flatMap(furnitureColliders));
 }
 return boxes;
}
const bridgeBoxes=build(cologneBuildings);
bridgeBoxes.push({x:0,y:-.2,z:0,w:62,h:.4,d:20,kind:'bridge'});
for(const side of [-1,1])bridgeBoxes.push({x:0,y:.65,z:side*9.8,w:61,h:1.3,d:.35,kind:'railing'});
for(const x of [-20,0,20])for(const z of [-8.8,8.8])bridgeBoxes.push({x,y:5,z,w:.7,h:10,d:.7,kind:'steel'});
for(const [x,z] of [[-18,-3],[0,4],[18,-3],[-29,7],[29,-7]])bridgeBoxes.push({x,y:.8,z,w:3,h:1.6,d:2,kind:'cover'});
bridgeBoxes.push({x:-5,y:1.4,z:-5,w:10,h:2.8,d:3,kind:'wagon'});
const alpineBoxes=build(alpineBuildings);
for(const [x,z,w,d]of [[-23,-6,12,9],[23,6,12,9],[0,20,11,7],[0,-20,11,7],[-64,50,14,10],[64,-50,14,10]])alpineBoxes.push({x,y:2,z,w,h:4,d,kind:'rock'});
for(const [x,z]of [[-14,5],[14,-5],[-31,22],[31,-22]])alpineBoxes.push({x,y:.8,z,w:3,h:1.6,d:2,kind:'cover'});
const stormBoxes=build(stormBuildings);
stormBoxes.push({x:0,y:1.5,z:0,w:18,h:3,d:18,kind:'platform'});
for(const side of [-1,1])for(let step=0;step<15;step++)stormBoxes.push({x:side*(16.25-step*.5),y:(step+1)*.1,z:0,w:.55,h:(step+1)*.2,d:5,kind:'stair'});
for(const side of [-1,1])for(const x of [-5.5,5.5])stormBoxes.push({x,y:3.55,z:side*8,w:4.8,h:1.1,d:.8,kind:'sandbags'});
for(const [x,z]of [[-25,-20],[25,20],[-25,21],[25,-21]])stormBoxes.push({x,y:1.3,z,w:7,h:2.6,d:2.7,kind:'container'});
for(const [x,z]of [[-16,34],[16,-34],[-33,-8],[33,8]])stormBoxes.push({x,y:.65,z,w:4,h:1.3,d:1.2,kind:'sandbags'});
for(const [x,z]of [[-65,-52],[65,52],[-32,57],[32,-57],[-62,51],[62,-51],[-26,-47],[26,47]])stormBoxes.push({x,y:2.5,z,w:.65,h:5,d:.65,kind:'tree'});
const frontlineBoxes=build(frontlineBuildings);
for(const [x,z,w,d]of [[-20,-16,6,1.2],[20,16,6,1.2],[-30,7,5,1.2],[30,-7,5,1.2],[0,-27,7,1.2],[0,27,7,1.2]])frontlineBoxes.push({x,y:.65,z,w,h:1.3,d,kind:'sandbags'});
frontlineBoxes.push({x:0,y:1.45,z:12,w:11,h:2.9,d:3.1,kind:'wagon'},{x:23,y:1.25,z:-26,w:5.8,h:2.5,d:2.4,kind:'truck'});
for(const [x,z]of [[-24,23],[24,-15],[-22,-34],[22,34]])frontlineBoxes.push({x,y:1.1,z,w:4.5,h:2.2,d:1.1,kind:'ruin'});
for(const [x,z]of [[-11,-10],[13,9],[-16,19],[16,-20]])frontlineBoxes.push({x,y:.8,z,w:3,h:1.6,d:2,kind:'cover'});
export const worlds:Record<MapId,World>={
 cologne:{id:'cologne',name:'Köln · Hohenzollernbrücke',subtitle:'Rheinübergang · März 1945 · historisch inspiriert',opponent:'USA',opponentCode:'US',buildings:cologneBuildings,boxes:bridgeBoxes,spawns:{de:[[-65,-19],[-65,-23],[-65,19],[-65,23]],fr:[[65,19],[65,23],[65,-19],[65,-23]]}},
 alpine:{id:'alpine',name:'Alpen · Roche-la-Croix',subtitle:'Ubaye · April 1945 · historisch inspiriert',opponent:'Frankreich',opponentCode:'FR',buildings:alpineBuildings,boxes:alpineBoxes,spawns:{de:[[-64,0],[-64,-8],[-64,8],[-60,16]],fr:[[64,0],[64,8],[64,-8],[60,-16]]}},
 storm:{id:'storm',name:'Sturmzone · Küstenwacht',subtitle:'Inselarena · Küstenwege · 14 begehbare Militärposten',ally:'Einheit Nord',allyCode:'NORD',opponent:'Einheit Süd',opponentCode:'SÜD',playArea:{halfSize:122,radius:122},buildings:stormBuildings,boxes:stormBoxes,spawns:{de:[[-65,0],[-65,-8],[-65,8],[-61,16]],fr:[[65,0],[65,8],[65,-8],[61,-16]]}},
 frontline:{id:'frontline',name:'Operation Abendrot',subtitle:'Güterviertel · 1944 · 16 begehbare Gebäude',opponent:'USA',opponentCode:'US',playArea:{halfSize:118},buildings:frontlineBuildings,boxes:frontlineBoxes,spawns:{de:[[-65,0],[-65,-8],[-65,8],[-61,16]],fr:[[65,0],[65,8],[65,-8],[61,-16]]}}
};
export const mapIds:MapId[]=['storm','frontline','cologne','alpine'];
export function validMap(id:unknown):id is MapId{return typeof id==='string'&&mapIds.includes(id as MapId);}
export function getWorld(id:MapId='cologne'){return worlds[id];}
export function withinPlayArea(x:number,z:number,world:World=getWorld()){
 const area=world.playArea,half=area?.halfSize??73;
 return Math.abs(x)<=half&&Math.abs(z)<=half&&(!area?.radius||x*x+z*z<=area.radius*area.radius);
}
export const buildings=cologneBuildings,boxes=bridgeBoxes,spawns=worlds.cologne.spawns;
export function ground(x:number,z:number,world:World=worlds.cologne):number{
 let height=world.id==='cologne'&&Math.abs(x)<30&&Math.abs(z)>10?-7:terrainHeight(x,z,world);
 for(const b of world.boxes)if(b.kind==='stair'&&Math.abs(x-b.x)<b.w/2+.3&&Math.abs(z-b.z)<b.d/2+.3)height=Math.max(height,b.y+b.h/2);
 return height;
}
