import * as T from 'three';

/** Separate render-state cache for the viewmodel. Reuse world lighting/shadows
 * without traversing the entire town or changing its light layout each pass. */
export function createWeaponScene(world:T.Scene,camera:T.PerspectiveCamera,weaponCamera:T.PerspectiveCamera){
 const scene=new T.Scene(),previousParent=camera.parent;
 scene.name='first-person-scene';scene.add(camera);
 const lights:{source:T.Light;copy:T.Light}[]=[],roomLights:T.PointLight[]=[];
 world.traverse(object=>{
  if(!(object instanceof T.Light))return;
  if(!object.layers.test(weaponCamera.layers)){
   if(object instanceof T.PointLight&&object.layers.isEnabled(0))roomLights.push(object);
   return;
  }
  const copy=object.clone(false);copy.matrixAutoUpdate=false;
  if(copy instanceof T.DirectionalLight&&object instanceof T.DirectionalLight){
   // Shadow maps are owned and refreshed only by the world render.
   copy.shadow=object.shadow;copy.target.matrixAutoUpdate=false;scene.add(copy.target);
  }
  scene.add(copy);lights.push({source:object,copy});
 });
 const sky=lights.find(({source})=>source instanceof T.HemisphereLight)?.source;
 // A broad bounce from the sky catches the grip and the underside of the
 // sleeves when the world sun is behind the player.
 const bounce=new T.DirectionalLight('#dce8ff',0);
 bounce.name='first-person-sky-bounce';
 bounce.layers.mask=weaponCamera.layers.mask;
 bounce.position.set(-1,.48,.25);
 bounce.target.position.set(0,-.27,-.75);
 camera.add(bounce,bounce.target);
 const skyDirection=bounce.position.clone().sub(bounce.target.position).normalize();
 const incoming=new T.Vector3(),direction=new T.Vector3(),radiance=new T.Color();
 function sync(){
  scene.environment=world.environment;scene.environmentIntensity=world.environmentIntensity;scene.environmentRotation.copy(world.environmentRotation);
  // Reconstruct the incident colour and direction at the grip using the existing
  // bounce slot. World-only room lamps otherwise illuminate the walls but leave
  // both sleeves and hands blue when a lamp switches on at night.
  const skyPower=sky?.visible?Math.min(.62,.67*sky.intensity):0;
  let power=skyPower;
  radiance.copy(sky?.color??bounce.color).multiplyScalar(skyPower);
  direction.copy(skyDirection).multiplyScalar(skyPower);
  camera.updateWorldMatrix(true,false);
  for(const lamp of roomLights){
   if(!lamp.visible||lamp.intensity<=0)continue;
   let parent=lamp.parent;
   while(parent&&parent!==world&&parent.visible)parent=parent.parent;
   if(parent!==world)continue;
   lamp.getWorldPosition(incoming).applyMatrix4(camera.matrixWorldInverse).sub(bounce.target.position);
   const distance=incoming.length();
   if(lamp.distance>0&&distance>=lamp.distance)continue;
   // Same inverse-power attenuation and smooth range cutoff as Three's point light.
   const cutoff=lamp.distance>0?1-(distance/lamp.distance)**4:1;
   const energy=lamp.intensity*cutoff*cutoff/Math.max(distance**lamp.decay,.01);
   radiance.r+=energy*lamp.color.r;radiance.g+=energy*lamp.color.g;radiance.b+=energy*lamp.color.b;
   direction.addScaledVector(incoming,energy/Math.max(.001,distance));power+=energy;
  }
  bounce.intensity=power;
  if(power>0){
   bounce.color.copy(radiance).multiplyScalar(1/power);
   if(direction.lengthSq()<1e-8)direction.copy(skyDirection);
   bounce.position.copy(direction.normalize()).add(bounce.target.position);
  }
  for(const {source,copy}of lights){
   source.updateWorldMatrix(true,false);copy.matrix.copy(source.matrixWorld);
   copy.visible=source.visible;copy.color.copy(source.color);copy.intensity=source.intensity;
   if(copy instanceof T.HemisphereLight&&source instanceof T.HemisphereLight)copy.groundColor.copy(source.groundColor);
   if(copy instanceof T.DirectionalLight&&source instanceof T.DirectionalLight){source.target.updateWorldMatrix(true,false);copy.target.matrix.copy(source.target.matrixWorld);}
   if(copy instanceof T.PointLight&&source instanceof T.PointLight){copy.distance=source.distance;copy.decay=source.decay;}
  }
 }
 sync();
 return {scene,sync,dispose(){camera.remove(bounce,bounce.target);bounce.dispose();camera.removeFromParent();if(previousParent)previousParent.add(camera);scene.clear();}};
}
