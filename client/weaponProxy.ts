import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Distant actor proxies use one draw; first-person meshes keep their full materials. */
export function batchWeaponProxy(root:T.Group){
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(),matrix=new T.Matrix4();
  const meshes:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[]=[];
  root.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.SkinnedMesh)&&o.material instanceof T.MeshStandardMaterial)meshes.push(o);});
  if(!meshes.length)return;
  const copies=meshes.map(mesh=>{
    const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
    geometry.applyMatrix4(matrix.multiplyMatrices(inverse,mesh.matrixWorld));
    const colors=new Float32Array(geometry.getAttribute('position').count*3),color=mesh.material.color;
    for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
    geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    // Proxy geometry needs positions, lighting normals and baked material colors.
    for(const name of Object.keys(geometry.attributes))if(!['position','normal','color'].includes(name))geometry.deleteAttribute(name);
    return geometry;
  });
  const merged=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());
  if(!merged)throw Error('Weapon proxy geometry could not be merged');
  const material=new T.MeshStandardMaterial({vertexColors:true,metalness:.45,roughness:.56});
  material.name='actor-weapon-proxy';
  const proxy=new T.Mesh(merged,material);proxy.name='batched-weapon-proxy';proxy.castShadow=proxy.receiveShadow=true;
  const originals=new Set(meshes.map(mesh=>mesh.geometry));
  for(const mesh of meshes)mesh.removeFromParent();
  originals.forEach(g=>g.dispose());merged.computeBoundingSphere();root.add(proxy);
}
