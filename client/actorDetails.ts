import * as T from 'three';
import {createDistanceBody} from './bodyDistance';

type DistanceBody=NonNullable<ReturnType<typeof createDistanceBody>>;
const distanceBodies=new WeakMap<T.Group,DistanceBody[]>();

/** Expose both index buffers only during the renderer's offscreen colour upload.
 * The active LOD, injury visibility and layers are unchanged after the draw. */
export function withBodyDistanceUpload(roots:readonly T.Group[],draw:()=>void){
 const restore:(()=>void)[]=[];
 for(const root of roots)for(const body of distanceBodies.get(root)??[])restore.push(body.showBothForUpload());
 try{draw();}finally{for(const reset of restore)reset();}
}

/** Keep full silhouettes/skinning; omit only subpixel rigid accessories. Uses
 * layer 0 so animation/injury visibility remains owned by the character rig. */
export function createActorDetails(root:T.Group){
 const details:{mesh:T.Mesh;radius:number;hidden:boolean;shadow:boolean}[]=[];
 const skins:{mesh:T.SkinnedMesh;culled:boolean;sphere:T.SkinnedMesh['boundingSphere']}[]=[];
 root.updateWorldMatrix(true,true);
 // Same conservative envelope as the actor-level visibility test. Convert it
 // to each mesh's local coordinates so all animation poses remain enclosed.
 const envelope=new T.Sphere(new T.Vector3().setFromMatrixPosition(root.matrixWorld).add(new T.Vector3(0,1,0)),3.5);
 const inverse=new T.Matrix4();
 root.traverse(object=>{
  if(!(object instanceof T.Mesh)||!object.layers.isEnabled(0))return;
  if(object instanceof T.SkinnedMesh){
   skins.push({mesh:object,culled:object.frustumCulled,sphere:object.boundingSphere});
   object.boundingSphere=envelope.clone().applyMatrix4(inverse.copy(object.matrixWorld).invert());
   object.frustumCulled=true;return;
  }
  if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();
  const radius=(object.geometry.boundingSphere?.radius??Infinity)*object.matrixWorld.getMaxScaleOnAxis();
  if(radius<=0||radius>.12)return;
  details.push({mesh:object,radius,hidden:false,shadow:object.castShadow});
 });
 const bodies=skins.flatMap(({mesh})=>{
  if(!mesh.userData.bodyDistance)return [];
  const body=createDistanceBody(mesh,mesh.userData.bodyDistance);
  return body?[body]:[];
 });
 if(bodies.length)distanceBodies.set(root,bodies);
 return {
  update(distance:number,height:number,fov:number){
   const pixelsPerMetre=height/(2*Math.tan(T.MathUtils.degToRad(fov/2))*Math.max(.1,distance));
   for(const body of bodies)body.update(pixelsPerMetre,fov<45);
   let hidden=0;
   for(const detail of details){
    const pixels=detail.radius*2*pixelsPerMetre;
    const next=distance>8&&(detail.hidden?pixels<2.6:pixels<2);
    if(next!==detail.hidden){detail.hidden=next;if(next)detail.mesh.layers.disable(0);else detail.mesh.layers.enable(0);}
    if(detail.hidden)hidden++;
   }
   return hidden;
  },
  dispose(){distanceBodies.delete(root);for(const body of bodies)body.dispose();for(const detail of details){if(detail.hidden)detail.mesh.layers.enable(0);detail.mesh.castShadow=detail.shadow;}for(const skin of skins){skin.mesh.frustumCulled=skin.culled;skin.mesh.boundingSphere=skin.sphere;}details.length=skins.length=0;},
 };
}
