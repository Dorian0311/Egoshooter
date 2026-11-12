import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Bake only rigid weapon pieces. Hand/sleeve and magazine nodes remain addressable. */
export function batchWeaponMeshes(root:T.Group){
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(),matrix=new T.Matrix4();
  const groups=new Map<string,T.Mesh<T.BufferGeometry,T.Material>[]>();
  root.traverse(o=>{
    if(!(o instanceof T.Mesh)||o instanceof T.SkinnedMesh||Array.isArray(o.material)||o.morphTargetInfluences)return;
    for(let p:T.Object3D|null=o;p&&p!==root;p=p.parent){
      if(/^(hand-|view-sleeve-)/.test(p.name)||/g36[_ ]30rd[_ ]magazine/.test(p.name))return;
    }
    const attributes=Object.keys(o.geometry.attributes).sort().map(k=>`${k}:${o.geometry.attributes[k].itemSize}:${o.geometry.attributes[k].normalized}`).join(',');
    const key=o.material.uuid+'|'+attributes+'|'+o.castShadow+'|'+o.receiveShadow;
    const group=groups.get(key)??[];group.push(o);groups.set(key,group);
  });
  const removed=new Set<T.BufferGeometry>();let before=0,after=0;
  for(const meshes of groups.values()){
    before+=meshes.length;after++;
    if(meshes.length<2)continue;
    const copies=meshes.map(mesh=>{
      const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      matrix.multiplyMatrices(inverse,mesh.matrixWorld);geometry.applyMatrix4(matrix);
      // Preserve front-face winding when mirrored authored parts lose their transform.
      if(matrix.determinant()<0)for(const attribute of Object.values(geometry.attributes)){
        for(let i=0;i<attribute.count;i+=3)for(let k=0;k<attribute.itemSize;k++){
          const value=attribute.getComponent(i+1,k);
          attribute.setComponent(i+1,k,attribute.getComponent(i+2,k));attribute.setComponent(i+2,k,value);
        }
      }
      return geometry;
    });
    const merged=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());
    if(!merged){after+=meshes.length-1;continue;}
    const result=new T.Mesh(merged,meshes[0].material);result.name='batched-rigid-weapon';
    result.castShadow=meshes[0].castShadow;result.receiveShadow=meshes[0].receiveShadow;
    for(const mesh of meshes){removed.add(mesh.geometry);mesh.removeFromParent();}
    merged.computeBoundingSphere();root.add(result);
  }
  root.traverse(o=>{if(o instanceof T.Mesh)removed.delete(o.geometry);});
  removed.forEach(g=>g.dispose());
  return {before,after};
}
