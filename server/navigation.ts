import {Raw,init,exportTileCache,importTileCache,exportNavMesh,importNavMesh,NavMeshQuery,type Obstacle} from '@recast-navigation/core';
import {generateTileCache,generateSoloNavMesh,createDefaultTileCacheMeshProcess} from '@recast-navigation/generators';
import {getWorld,withinPlayArea,type MapId} from '../shared/world';
import {terrainHeight} from '../shared/terrain';
import {rockHull} from '../shared/rocks';
import {interiorFixtures,doorBox,type InteriorState} from '../shared/interiors';
import type {Point} from '../shared/operations';
const caches=new Map<MapId,{dynamic:Uint8Array;static:Uint8Array}>();
const initializing=init();
export async function createNavigation(mapId:MapId){
 await initializing;let bytes=caches.get(mapId);
 if(!bytes){
  const world=getWorld(mapId),positions:number[]=[],indices:number[]=[],extent=world.playArea?.halfSize??73;
  const triangle=(a:number[],b:number[],c:number[])=>{const offset=positions.length/3;positions.push(...a,...b,...c);indices.push(offset,offset+1,offset+2);};
  const step=2;
  for(let x=-extent;x<extent;x+=step)for(let z=-extent;z<extent;z+=step){if(!withinPlayArea(x+1,z+1,world))continue;const p=(a:number,b:number)=>[a,world.id==='cologne'&&Math.abs(a)<30&&Math.abs(b)>10?-7:terrainHeight(a,b,world),b];triangle(p(x,z),p(x,z+step),p(x+step,z));triangle(p(x+step,z),p(x,z+step),p(x+step,z+step));}
  for(const b of world.boxes){
   if(b.kind==='stair')continue;
   if(b.kind==='rock'){
    const hull=rockHull(b),vertices=hull.vertices.map(([x,y,z])=>[b.x+x,b.y+y,b.z+z]);
    for(const face of hull.faces)for(let n=1;n+1<face.length;n++)triangle(vertices[face[0]],vertices[face[n]],vertices[face[n+1]]);
    // Recast rasterises triangles, not solid volumes. Over the terrain a tall
    // closed shell alone leaves a second navigable floor inside the boulder.
    // Downward-facing sections fill that cavity without changing the outer surface.
    for(let y=b.y-b.h/2+.75;y<b.y+b.h/2;y+=1.25){
     const section:number[][]=[];
     for(const face of hull.faces)for(let i=0;i<face.length;i++){
      const from=vertices[face[i]],to=vertices[face[(i+1)%face.length]];
      if(from[1]>y||to[1]<=y)continue;
      const t=(y-from[1])/(to[1]-from[1]);
      section.push([from[0]+(to[0]-from[0])*t,y,from[2]+(to[2]-from[2])*t]);
     }
     if(section.length<3)continue;
     const cx=section.reduce((sum,v)=>sum+v[0],0)/section.length,cz=section.reduce((sum,v)=>sum+v[2],0)/section.length;
     section.sort((a,c)=>Math.atan2(a[2]-cz,a[0]-cx)-Math.atan2(c[2]-cz,c[0]-cx));
     for(let i=1;i+1<section.length;i++)triangle(section[0],section[i],section[i+1]);
    }
    continue;
   }
   const v=Array.from({length:8},(_,n)=>[b.x+(n&1?1:-1)*b.w/2,b.y+(n&2?1:-1)*b.h/2,b.z+(n&4?1:-1)*b.d/2]);
   for(const f of [[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]]){triangle(v[f[0]],v[f[1]],v[f[2]]);triangle(v[f[0]],v[f[2]],v[f[3]]);}
  }
  // Rasterize authored stair runs as solid ramps. Fine stair risers otherwise erode
  // the entry away; actual actors still climb the unchanged shared step colliders.
  for(const building of world.buildings)if(building.upper)for(const side of [-1,1]){
   const x=building.x+side*7,start=building.z+side*7.3,end=building.z-side*5.7;
   const v=[[x-1.5,0,start],[x+1.5,0,start],[x-1.5,0,end],[x+1.5,0,end],[x-1.5,4.125,end],[x+1.5,4.125,end]];
   const top=side<0?[0,4,5,1]:[0,1,5,4];triangle(v[top[0]],v[top[1]],v[top[2]]);triangle(v[top[0]],v[top[2]],v[top[3]]);
   for(const f of [[0,2,4],[1,5,3],[2,3,5],[2,5,4],[0,1,3],[0,3,2]])triangle(v[f[0]],v[f[1]],v[f[2]]);
  }
  if(world.id==='storm')for(const side of [-1,1]){
   const start=side*16.55,end=side*8.9,v=[[start,0,-2.5],[start,0,2.5],[end,0,-2.5],[end,0,2.5],[end,3,-2.5],[end,3,2.5]],top=side>0?[0,4,5,1]:[0,1,5,4];
   triangle(v[top[0]],v[top[1]],v[top[2]]);triangle(v[top[0]],v[top[2]],v[top[3]]);
   for(const f of [[0,2,4],[1,5,3],[2,3,5],[2,5,4],[0,1,3],[0,3,2]])triangle(v[f[0]],v[f[1]],v[f[2]]);
  }
  // The dynamic tile mesh approximates height between its polygon boundaries.
  // Shorter spans preserve the Island hill crests within the query's vertical tolerance.
  const tileSize=world.id==='storm'?32:64;
  const generated=generateTileCache(positions,indices,{cs:.2,ch:.05,walkableHeight:35,walkableClimb:7,walkableRadius:2,walkableSlopeAngle:40,tileSize,maxObstacles:128,expectedLayersPerTile:4});
  if(!generated.success)throw Error(`Navigation ${mapId}: ${generated.error}`);
  // Heightfield layers can split a narrow stair connection inside a tile. Keep a full
  // watershed mesh for those routes; live movement and door interaction still gate entry.
  const full=generateSoloNavMesh(positions,indices,{cs:.2,ch:.05,walkableHeight:35,walkableClimb:7,walkableRadius:2,walkableSlopeAngle:40});
  if(!full.success){generated.tileCache.destroy();generated.navMesh.destroy();throw Error(`Navigation ${mapId}: ${full.error}`);}
  bytes={dynamic:exportTileCache(generated.navMesh,generated.tileCache),static:exportNavMesh(full.navMesh)};caches.set(mapId,bytes);generated.tileCache.destroy();generated.navMesh.destroy();full.navMesh.destroy();
 }
 const meshProcess=createDefaultTileCacheMeshProcess(),{navMesh,tileCache}=importTileCache(bytes.dynamic,meshProcess),query=new NavMeshQuery(navMesh),fullMesh=importNavMesh(bytes.static).navMesh,fullQuery=new NavMeshQuery(fullMesh);
 query.defaultQueryHalfExtents={x:2,y:.6,z:2};
 fullQuery.defaultQueryHalfExtents={x:2,y:.6,z:2};
 const obstacles=new Map<string,{open:boolean;obstacle:Obstacle}>();
 const flush=()=>{for(let n=0;n<12;n++)if(tileCache.update(navMesh).upToDate)break;};
 return {
  path(start:Point,end:Point){const result=query.computePath(start,end),last=result.path.at(-1);if(last&&Math.hypot(last.x-end.x,last.z-end.z)<.8&&Math.abs(last.y-end.y)<.6)return result.path;const fallback=fullQuery.computePath(start,end),finish=fallback.path.at(-1);if(finish&&Math.hypot(finish.x-end.x,finish.z-end.z)<.8&&Math.abs(finish.y-end.y)<.6)return fallback.path;return result.success?result.path:[];},
  reachable(point:Point){const result=query.findClosestPoint(point,{halfExtents:{x:1,y:.6,z:1}});return result.success&&Math.hypot(result.point.x-point.x,result.point.z-point.z)<.8;},
  sync(state:InteriorState|undefined){if(!state)return;let pending=0;for(const f of interiorFixtures(getWorld(mapId))){if(f.type!=='door')continue;const open=!!state.doors[f.id],old=obstacles.get(f.id);if(old?.open===open)continue;if(old)tileCache.removeObstacle(old.obstacle);const b=doorBox(f,open),added=tileCache.addBoxObstacle({x:b.x,y:b.y,z:b.z},{x:b.w/2,y:b.h/2,z:b.d/2},0);if(added.success)obstacles.set(f.id,{open,obstacle:added.obstacle});if(++pending%16===0)flush();}if(pending)flush();},
  dispose(){query.destroy();fullQuery.destroy();fullMesh.destroy();tileCache.destroy();navMesh.destroy();Raw.destroy(meshProcess.raw);},
 };
}
export type Navigation=Awaited<ReturnType<typeof createNavigation>>;
