import type {Box} from './world';

const cellSize=16;
const indices=new WeakMap<readonly Box[],{length:number;cells:Map<string,number[]>;queries:Map<string,readonly Box[]>}>();

/** Conservative XZ broad phase for immutable collision layouts. Results retain
 * source order so ceiling/floor resolution behaves exactly as a full scan. */
export function nearbyBoxes(boxes:readonly Box[],minX:number,minZ:number,maxX:number,maxZ:number):readonly Box[]{
 if(![minX,minZ,maxX,maxZ].every(Number.isFinite))return boxes;
 let index=indices.get(boxes);
 if(!index||index.length!==boxes.length){
  index={length:boxes.length,cells:new Map(),queries:new Map()};
  for(let n=0;n<boxes.length;n++){
   const box=boxes[n];
   for(let x=Math.floor((box.x-box.w/2)/cellSize);x<=Math.floor((box.x+box.w/2)/cellSize);x++)
    for(let z=Math.floor((box.z-box.d/2)/cellSize);z<=Math.floor((box.z+box.d/2)/cellSize);z++){
     const key=`${x},${z}`,cell=index.cells.get(key)??[];cell.push(n);index.cells.set(key,cell);
    }
  }
  indices.set(boxes,index);
 }
 const x0=Math.floor(minX/cellSize),x1=Math.floor(maxX/cellSize),z0=Math.floor(minZ/cellSize),z1=Math.floor(maxZ/cellSize);
 // Unusually large sweeps need no huge cell enumeration or cache entry.
 if((x1-x0+1)*(z1-z0+1)>64)return boxes;
 const key=`${x0},${z0},${x1},${z1}`,cached=index.queries.get(key);if(cached)return cached;
 const found=new Set<number>();
 for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const n of index.cells.get(`${x},${z}`)??[])found.add(n);
 const result=[...found].sort((a,b)=>a-b).map(n=>boxes[n]);
 if(index.queries.size>=512)index.queries.clear();index.queries.set(key,result);return result;
}
