import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';
import type {Box} from '../shared/world.ts';
import {instanceStaticModel} from './scenery.ts';
function disposeObject(root:T.Object3D){root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value instanceof T.Texture)value.dispose();m.dispose();}}});}
export function loadSceneAssets(scene:T.Scene,renderer:T.WebGLRenderer,covers:{box:Box;mesh:T.Mesh}[]){
 let disposed=false;let sky:T.DataTexture|undefined,environment:T.WebGLRenderTarget|undefined;
 const loader=new GLTFLoader();
 const loadedModels:T.Object3D[]=[];
 new RGBELoader().load('/shooter/environment/sky.hdr',texture=>{
  if(disposed){texture.dispose();return;}sky=texture;texture.mapping=T.EquirectangularReflectionMapping;
  const generator=new T.PMREMGenerator(renderer);environment=generator.fromEquirectangular(texture);generator.dispose();
  scene.environment=environment.texture;scene.environmentIntensity=.65;scene.background=texture;scene.backgroundIntensity=.65;scene.backgroundBlurriness=.025;
 },undefined,()=>console.warn('Sky asset unavailable'));
 loader.load('/shooter/models/wooden_military_crate/asset.gltf',gltf=>{
  if(disposed){disposeObject(gltf.scene);return;}
  loadedModels.push(gltf.scene);
  const bounds=new T.Box3().setFromObject(gltf.scene),size=bounds.getSize(new T.Vector3());
  const placements:T.Matrix4[]=[],placement=new T.Object3D();
  for(const {box,mesh} of covers){
   mesh.visible=false;
   for(let x=0;x<3;x++)for(let z=0;z<2;z++)for(let y=0;y<2;y++){
    placement.scale.set(1/size.x,.8/size.y,1/size.z);
    placement.position.set(box.x-1.5+x-bounds.min.x/size.x, y*.8-bounds.min.y*.8/size.y,box.z-1+z-bounds.min.z/size.z);
    placement.updateMatrix();placements.push(placement.matrix.clone());
   }
  }
  instanceStaticModel(scene,gltf.scene,placements);
 },undefined,()=>console.warn('Crate asset unavailable'));
 // These are dressing outside walking lanes, so their geometry cannot disagree with movement collision.
 loader.load('/shooter/models/barrel_03/asset.gltf',gltf=>{
  if(disposed){disposeObject(gltf.scene);return;}
  loadedModels.push(gltf.scene);
  const bounds=new T.Box3().setFromObject(gltf.scene),size=bounds.getSize(new T.Vector3()),scale=1.1/size.y;
  for(const [x,z]of [[-71,-50],[-71,50],[71,-50],[71,50]]){const barrel=gltf.scene.clone(true);barrel.scale.setScalar(scale);barrel.position.set(x-bounds.min.x*scale,-bounds.min.y*scale,z-bounds.min.z*scale);barrel.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(barrel);}
 },undefined,()=>console.warn('Barrel asset unavailable'));
 return ()=>{disposed=true;sky?.dispose();environment?.dispose();loadedModels.forEach(disposeObject);};
}
