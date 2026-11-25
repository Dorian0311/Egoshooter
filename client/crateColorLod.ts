import * as T from 'three';

export type CrateIndexAsset={
 meshes:Record<string,{vertices:number;full:number;indices:number[]}>;
};

type Cell={bounds:T.Box3;parts:{mesh:T.InstancedMesh;original:T.BufferGeometry}[];distant:boolean};

/** Switch the index buffer of each existing color instance. Vertex streams,
 * materials, per-instance transforms and the separate depth casters remain shared. */
export function crateColorLod(){
 const cells:Cell[]=[],reduced=new Map<T.BufferGeometry,T.BufferGeometry>();
 const eye=new T.Vector3();
 function select(cell:Cell,distant:boolean){
  if(cell.distant===distant)return;
  cell.distant=distant;
  for(const {mesh,original} of cell.parts)mesh.geometry=(distant?reduced.get(original):undefined)??original;
 }
 return {
  register(meshes:T.Object3D[]){
   const bounds=new T.Box3(),parts:Cell['parts']=[];
   for(const mesh of meshes)if(mesh instanceof T.InstancedMesh){
    mesh.computeBoundingBox();bounds.union(mesh.boundingBox!);parts.push({mesh,original:mesh.geometry});
   }
   if(parts.length)cells.push({bounds,parts,distant:false});
  },
  load(source:T.Object3D,asset:CrateIndexAsset){
   source.traverse(part=>{
    if(!(part instanceof T.Mesh))return;
    const geometry=part.geometry,entry=asset.meshes[part.name],vertices=geometry.getAttribute('position').count;
    if(reduced.has(geometry)||!entry||vertices!==entry.vertices||entry.full!==geometry.index?.count||
       entry.indices.length===0||entry.indices.length%3!==0||entry.indices.some(i=>!Number.isInteger(i)||i<0||i>=vertices))return;
    const lod=new T.BufferGeometry();
    for(const [name,attribute] of Object.entries(geometry.attributes))lod.setAttribute(name,attribute as T.BufferAttribute);
    lod.setIndex(entry.indices);reduced.set(geometry,lod);
   });
  },
  update(camera:T.Camera,compact:boolean,aimed:boolean){
   if(!reduced.size)return;
   eye.setFromMatrixPosition(camera.matrixWorld);
   for(const cell of cells){
    const distance=cell.bounds.distanceToPoint(eye);
    select(cell,compact&&!aimed&&distance>(cell.distant?10:14));
   }
  },
  restore(){for(const cell of cells)select(cell,false);},
  dispose(){for(const cell of cells)select(cell,false);for(const geometry of reduced.values())geometry.dispose();cells.length=0;reduced.clear();}
 };
}
