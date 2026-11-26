import * as T from 'three';
import {freezeStaticTransforms} from './staticTransforms';

type Placement = {part:T.Object3D;matrices:T.Matrix4[]};
type MaterialGroup = {material:T.Material;parts:{mesh:T.Mesh;matrices:T.Matrix4[]}[]};

/** Group compatible opaque facade parts across modules while retaining per-part frustum tests. */
export function createFacadeBatches(root:T.Group,placements:Placement[]){
 const groups=new Map<string,MaterialGroup>();
 for(const {part,matrices} of placements){
  part.updateWorldMatrix(true,true);
  part.traverse(mesh=>{
   if(!(mesh instanceof T.Mesh)||Array.isArray(mesh.material)||mesh.material.transparent)return;
   const geometry:T.BufferGeometry=mesh.geometry;
   const layout=Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b))
    .map(([name,attribute])=>[name,attribute.itemSize,attribute.normalized,attribute.array.constructor.name].join(':')).join('|');
   const key=mesh.material.uuid+(geometry.index?'|indexed|':'|flat|')+layout;
   const group:MaterialGroup=groups.get(key)??{material:mesh.material,parts:[]};
   group.parts.push({mesh,matrices});groups.set(key,group);
  });
 }
 const replaced=new Set<T.Material>(),meshes:T.BatchedMesh[]=[];
 const used=new Map<T.Material,number>();
 for(const {material} of groups.values())used.set(material,(used.get(material)??0)+1);
 const matrix=new T.Matrix4();
 for(const {material,parts} of groups.values()){
  if(parts.length<2||used.get(material)!==1)continue;
  const geometryIds=new Map<T.BufferGeometry,number>();
  const geometries=[...new Set(parts.map(({mesh})=>mesh.geometry))];
  const instances=parts.reduce((sum,{matrices})=>sum+matrices.length,0);
  const vertices=geometries.reduce((sum,geometry)=>sum+geometry.attributes.position.count,0);
  const indices=geometries.reduce((sum,geometry)=>sum+(geometry.index?.count??0),0);
  const batch=new T.BatchedMesh(instances,vertices,indices,material);
  batch.name='Opaque facade batch';
  batch.receiveShadow=true;batch.sortObjects=false;
  for(const {mesh,matrices} of parts){
   let geometryId=geometryIds.get(mesh.geometry);
   if(geometryId===undefined){geometryId=batch.addGeometry(mesh.geometry);geometryIds.set(mesh.geometry,geometryId);}
   for(const placement of matrices)batch.setMatrixAt(batch.addInstance(geometryId),matrix.multiplyMatrices(placement,mesh.matrixWorld));
  }
  batch.computeBoundingSphere();root.add(batch);freezeStaticTransforms(batch);
  replaced.add(material);meshes.push(batch);
 }
 return {replaced,meshes};
}
