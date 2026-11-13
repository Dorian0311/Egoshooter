import * as T from 'three';

/** Bend the forearms below the eye while preserving the authored finger/grip pose. */
export function createViewmodelArms(root:T.Group){
 const meshes:{mesh:T.Mesh;index:number}[]=[];
 root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert();
 for(const side of ['r','l']){
  const sleeve=root.getObjectByName('view-sleeve-'+side);
  if(!(sleeve instanceof T.Mesh))continue;
  const transform=new T.Matrix4().multiplyMatrices(inverse,sleeve.matrixWorld);
  const direction=new T.Vector3(0,1,0).transformDirection(transform);
  if(direction.z>0)direction.negate();
  sleeve.geometry.computeBoundingBox();
  const length=sleeve.geometry.boundingBox!.getSize(new T.Vector3()).y;
  const wrist=new T.Vector3().setFromMatrixPosition(transform).addScaledVector(direction,length<.49?-.25:-.29);
  const turn=new T.Quaternion().setFromUnitVectors(direction,new T.Vector3(side==='r'?-.65:.65,-1,-.4).normalize());
  for(const name of ['hand-','view-sleeve-']){
   const mesh=root.getObjectByName(name+side);
   if(!(mesh instanceof T.Mesh))continue;
   // Each asset owns its geometry. Existing reload transforms remain independent.
   const geometry=mesh.geometry,positions=geometry.getAttribute('position'),target=positions.clone();
   const toRoot=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),toLocal=toRoot.clone().invert();
   const vertex=new T.Vector3(),relative=new T.Vector3(),rotation=new T.Quaternion();
   for(let i=0;i<positions.count;i++){
    vertex.fromBufferAttribute(positions,i).applyMatrix4(toRoot);relative.copy(vertex).sub(wrist);
    const distance=T.MathUtils.clamp(relative.dot(direction)/.08,0,1),blend=distance*distance*(3-2*distance);
    rotation.identity().slerp(turn,blend);vertex.copy(relative).applyQuaternion(rotation).add(wrist).applyMatrix4(toLocal);
    target.setXYZ(i,vertex.x,vertex.y,vertex.z);
   }
   const targets=geometry.morphAttributes.position??=[];const index=targets.length;targets.push(target);
   geometry.morphTargetsRelative=false;mesh.updateMorphTargets();geometry.computeBoundingSphere();
   meshes.push({mesh,index});
  }
 }
 return {update(aimBlend:number){for(const {mesh,index} of meshes)mesh.morphTargetInfluences![index]=T.MathUtils.clamp(aimBlend,0,1);}};
}
