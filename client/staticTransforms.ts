import type {Object3D} from 'three';

/** Cache immutable local transforms. Parent transforms can still move the tree. */
export function freezeStaticTransforms(root:Object3D){
 root.updateWorldMatrix(true,true);
 root.traverse(object=>{object.matrixAutoUpdate=false;object.matrixWorldNeedsUpdate=false;});
}
