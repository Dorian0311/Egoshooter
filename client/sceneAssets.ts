import type {CrateIndexAsset} from './crateColorLod';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';
import type {Box} from '../shared/world.ts';
import {createCrateShadows} from './crateShadows';
import {makeWeatherSky,type WeatherSky} from './weatherSky';
import type {GraphicsQuality} from './graphicsSettings';
function disposeObject(root:T.Object3D){root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value instanceof T.Texture)value.dispose();m.dispose();}}});}
export function loadSceneAssets(scene:T.Scene,renderer:T.WebGLRenderer,covers:{box:Box;mesh:T.Mesh}[],quality:GraphicsQuality,island=false){
 let disposed=false;let environment:T.WebGLRenderTarget|undefined;
 let weatherBackground:T.CubeTexture|null=null;
 const skies=new Map<WeatherSky,T.CubeTexture>();
 if(island){
  // The solar disc in the source panorama lies 34.3 degrees east of +X.
  const rotation=T.MathUtils.degToRad(34.3)-Math.atan2(55,-70);
  scene.environmentRotation.y=rotation;scene.backgroundRotation.y=rotation;
 }
 scene.backgroundIntensity=island?1:.65;
 scene.backgroundBlurriness=island?0:.025;
 const manager=new T.LoadingManager();
 const ready=new Promise<void>(resolve=>{manager.onLoad=resolve;});
 const loader=new GLTFLoader(manager);
 const crateShadows=createCrateShadows(renderer,scene,quality);
 const loadedModels:T.Object3D[]=[];
 new RGBELoader(manager).load(island?'/shooter/environment/island-daylight.hdr':'/shooter/environment/sky.hdr',texture=>{
  if(disposed){texture.dispose();return;}texture.mapping=T.EquirectangularReflectionMapping;
  const generator=new T.PMREMGenerator(renderer);
  try{environment=generator.fromEquirectangular(texture);}
  finally{generator.dispose();texture.dispose();}
  // Share the full-resolution radiance level with the background, and its roughness mips with PBR materials.
  scene.environment=environment.texture;
  scene.background=weatherBackground??environment.texture;
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
  crateShadows.load(gltf.scene,placements);
  if(placements.length)new T.FileLoader(manager).setResponseType('json').load('/shooter/models/wooden_military_crate/distance-indices.json',data=>{
   if(!disposed)crateShadows.setColorLod(gltf.scene,data as unknown as CrateIndexAsset);
  },undefined,()=>console.warn('Crate distance indices unavailable'));
 },undefined,()=>console.warn('Crate asset unavailable'));
 // These are dressing outside walking lanes, so their geometry cannot disagree with movement collision.
 loader.load('/shooter/models/barrel_03/asset.gltf',gltf=>{
  if(disposed){disposeObject(gltf.scene);return;}
  loadedModels.push(gltf.scene);
  const bounds=new T.Box3().setFromObject(gltf.scene),size=bounds.getSize(new T.Vector3()),scale=1.1/size.y;
  for(const [x,z]of [[-71,-50],[-71,50],[71,-50],[71,50]]){const barrel=gltf.scene.clone(true);barrel.scale.setScalar(scale);barrel.position.set(x-bounds.min.x*scale,-bounds.min.y*scale,z-bounds.min.z*scale);barrel.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(barrel);}
 },undefined,()=>console.warn('Barrel asset unavailable'));
 return {
  ready,
  updateCrates:crateShadows.updateColor,
  setWeatherBackground(weather:WeatherSky|null){
   if(weather&&!skies.has(weather))skies.set(weather,makeWeatherSky(weather));
   weatherBackground=weather?skies.get(weather)!:null;
   scene.background=weatherBackground??environment?.texture??null;
   scene.backgroundIntensity=weather||island?1:.65;
   scene.backgroundBlurriness=weather||island?0:.025;
   scene.backgroundRotation.y=weather?0:scene.environmentRotation.y;
  },
  setQuality:crateShadows.setQuality,
  dispose(){disposed=true;crateShadows.dispose();for(const sky of skies.values())sky.dispose();environment?.dispose();loadedModels.forEach(disposeObject);},
 };
}
