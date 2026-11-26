import {Matrix4, Mesh, type BufferGeometry, type Object3D} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const frameMaterial='modular_factory_facade_windows';
const paneMaterial='modular_factory_facade_windows_glass';

/** Reuse the weathered pane atlas and the frame's draw on solid depot walls. */
export function addFactoryGlazing(module:Object3D){
  let frame:Mesh<BufferGeometry>|undefined;
  let glass:Mesh<BufferGeometry>|undefined;
  module.traverse(object=>{
    if(!(object instanceof Mesh)||Array.isArray(object.material))return;
    if(object.material.name===frameMaterial)frame=object;
    if(object.material.name===paneMaterial)glass=object;
  });
  if(!frame||!glass)return;

  module.updateWorldMatrix(true,true);
  const pane=glass.geometry.clone().applyMatrix4(new Matrix4().copy(frame.matrixWorld).invert().multiply(glass.matrixWorld));
  const positions=pane.getAttribute('position');
  // The front module is 24 cm off the wall centre, whose outer face is at 22.5 cm.
  // Set the panes just ahead of the masonry and behind the frame's raised edges.
  for(let i=0;i<positions.count;i++)positions.setZ(i,.006);
  const windowGeometry=mergeGeometries([frame.geometry,pane]);
  pane.dispose();
  if(!windowGeometry)return;
  frame.geometry.dispose();
  frame.geometry=windowGeometry;
  glass.visible=false;
}
