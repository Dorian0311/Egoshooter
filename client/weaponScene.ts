import * as T from 'three';

/** Separate render-state cache for the viewmodel. Reuse world lighting/shadows
 * without traversing the entire town or changing its light layout each pass. */
export function createWeaponScene(world:T.Scene,camera:T.PerspectiveCamera,weaponCamera:T.PerspectiveCamera){
 const scene=new T.Scene(),previousParent=camera.parent;
 scene.name='first-person-scene';scene.add(camera);
 const lights:{source:T.Light;copy:T.Light}[]=[];
 world.traverse(object=>{
  if(!(object instanceof T.Light)||!object.layers.test(weaponCamera.layers))return;
  const copy=object.clone(false);copy.matrixAutoUpdate=false;
  if(copy instanceof T.DirectionalLight&&object instanceof T.DirectionalLight){
   // Shadow maps are owned and refreshed only by the world render.
   copy.shadow=object.shadow;copy.target.matrixAutoUpdate=false;scene.add(copy.target);
  }
  scene.add(copy);lights.push({source:object,copy});
 });
 function sync(){
  scene.environment=world.environment;scene.environmentIntensity=world.environmentIntensity;
  for(const {source,copy}of lights){
   source.updateWorldMatrix(true,false);copy.matrix.copy(source.matrixWorld);
   copy.visible=source.visible;copy.color.copy(source.color);copy.intensity=source.intensity;
   if(copy instanceof T.HemisphereLight&&source instanceof T.HemisphereLight)copy.groundColor.copy(source.groundColor);
   if(copy instanceof T.DirectionalLight&&source instanceof T.DirectionalLight){source.target.updateWorldMatrix(true,false);copy.target.matrix.copy(source.target.matrixWorld);}
   if(copy instanceof T.PointLight&&source instanceof T.PointLight){copy.distance=source.distance;copy.decay=source.decay;}
  }
 }
 sync();
 return {scene,sync,dispose(){camera.removeFromParent();if(previousParent)previousParent.add(camera);scene.clear();}};
}
