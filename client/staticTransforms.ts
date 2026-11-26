import type {Object3D} from 'three';

const frozenBranches=new WeakSet<Object3D>();

/** Cache immutable local transforms. Parent transforms can still move the tree. */
export function freezeStaticTransforms(root:Object3D){
 root.updateWorldMatrix(true,true);
 root.traverse(object=>{object.matrixAutoUpdate=false;object.matrixWorldNeedsUpdate=false;});
 if(root.children.length&&!frozenBranches.has(root)){
  frozenBranches.add(root);
  const updateMatrixWorld=root.updateMatrixWorld;
  // Skip the descendants until an ancestor changes or an explicit refresh is requested.
  root.updateMatrixWorld=function(force){
   if(force||this.matrixWorldNeedsUpdate)updateMatrixWorld.call(this,force);
  };
 }
}
