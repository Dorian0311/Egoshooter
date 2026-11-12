export type Box = {x:number;y:number;z:number;w:number;h:number;d:number;kind?:string};
export type Building={x:number;z:number;w:number;d:number;upper:boolean;name:string};
export type MapId='cologne'|'alpine';
export type World={id:MapId;name:string;subtitle:string;opponent:string;opponentCode:string;buildings:Building[];boxes:Box[];spawns:{de:number[][];fr:number[][]}};
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
function build(items:Building[]):Box[]{
 const boxes:Box[]=[];
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,kind='wall')=>boxes.push({x,y,z,w,h,d,kind});
 for(const b of items){const height=b.upper?8:4;
  for(const side of [-1,1]){const z=b.z+side*b.d/2;
   box(b.x-b.w/4-1,height/2,z,b.w/2-2,height,.45);box(b.x+b.w/4+1,height/2,z,b.w/2-2,height,.45);
   box(b.x,3.6,z,4,1,.45);if(b.upper)box(b.x,6,z,4,4,.45);
   const x=b.x+side*b.w/2;box(x,.6,b.z,.45,1.2,b.d);box(x,3.25,b.z,.45,1.5,b.d);
   for(const dz of [-6.5,0,6.5])box(x,2,b.z+dz,.45,1.5,3);
   if(b.upper)box(x,6,b.z,.45,4,b.d);
  }
  if(b.upper){box(b.x+2,4,b.z,b.w-4,.25,b.d,'floor');for(let i=0;i<20;i++)box(b.x-7,(i+1)*.1,b.z-7+i*.65,3,(i+1)*.2,.7,'stair');}
  box(b.x,height+.15,b.z,b.w+1,.3,b.d+1,'roof');box(b.x+4,.6,b.z+3,3,1.2,1.5,'furniture');box(b.x+4,.4,b.z-3,2,.8,2,'furniture');
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
export const worlds:Record<MapId,World>={
 cologne:{id:'cologne',name:'Köln · Hohenzollernbrücke',subtitle:'Rheinübergang · März 1945 · historisch inspiriert',opponent:'USA',opponentCode:'US',buildings:cologneBuildings,boxes:bridgeBoxes,spawns:{de:[[-65,-19],[-65,-23],[-65,19],[-65,23]],fr:[[65,19],[65,23],[65,-19],[65,-23]]}},
 alpine:{id:'alpine',name:'Alpen · Roche-la-Croix',subtitle:'Ubaye · April 1945 · historisch inspiriert',opponent:'Frankreich',opponentCode:'FR',buildings:alpineBuildings,boxes:alpineBoxes,spawns:{de:[[-64,0],[-64,-8],[-64,8],[-60,16]],fr:[[64,0],[64,8],[64,-8],[60,-16]]}}
};
export const mapIds:MapId[]=['cologne','alpine'];
export function validMap(id:unknown):id is MapId{return id==='cologne'||id==='alpine';}
export function getWorld(id:MapId='cologne'){return worlds[id];}
export const buildings=cologneBuildings,boxes=bridgeBoxes,spawns=worlds.cologne.spawns;
export function ground(x:number,z:number,world:World=worlds.cologne):number{
 let height=world.id==='cologne'&&Math.abs(x)<30&&Math.abs(z)>10?-7:0;
 for(const b of world.boxes)if(b.kind==='stair'&&Math.abs(x-b.x)<b.w/2+.3&&Math.abs(z-b.z)<b.d/2+.3)height=Math.max(height,b.y+b.h/2);
 return height;
}
