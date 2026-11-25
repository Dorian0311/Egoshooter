import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';
import type {Box} from '../shared/world.ts';
import {createCrateShadows} from './crateShadows';
import type {GraphicsQuality} from './graphicsSettings';
function disposeObject(root:T.Object3D){root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value instanceof T.Texture)value.dispose();m.dispose();}}});}
function createIslandSky(){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext('2d')!;
 const gradient=ctx.createLinearGradient(0,0,0,canvas.height);
 gradient.addColorStop(0,'#377dc2');gradient.addColorStop(.32,'#72bde5');
 gradient.addColorStop(.50,'#c2e4e4');gradient.addColorStop(1,'#a4cbd3');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);
 // Paint a seamless bank of cumulus into the sky once, using periodic noise.
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 const noise=new Float32Array(64*64);
 let seed=2917;
 for(let i=0;i<noise.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise[i]=seed/4294967296;}
 function sample(x:number,y:number){
  const ix=Math.floor(x),iy=Math.floor(y);
  let u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);
  const at=(dx:number,dy:number)=>noise[((iy+dy)&63)*64+((ix+dx)&15)];
  return T.MathUtils.lerp(T.MathUtils.lerp(at(0,0),at(1,0),u),T.MathUtils.lerp(at(0,1),at(1,1),u),v);
 }
 for(let y=38;y<256;y++){
  const elevation=(256-y)/218;
  const band=Math.min(1,elevation*8,(1-elevation)*5);
  for(let x=0;x<canvas.width;x++){
   const u=x/canvas.width*64,v=y/20;
   const field=.53*sample(u*.25,v*.44)+.28*sample(u*.5,v*.88)+.13*sample(u,v*1.76)+.06*sample(u*2,v*3.52);
   const density=T.MathUtils.smoothstep(field,.48,.69)*band;
   const top=T.MathUtils.smoothstep(field,.51,.66),offset=(y*canvas.width+x)*4;
   for(let c=0;c<3;c++)pixels.data[offset+c]=T.MathUtils.lerp(pixels.data[offset+c],[185,203,218][c]+[64,45,27][c]*top,density*.92);
  }
 }
 ctx.putImageData(pixels,0,0);
 const texture=new T.CanvasTexture(canvas);
 texture.mapping=T.EquirectangularReflectionMapping;texture.colorSpace=T.SRGBColorSpace;
 return texture;
}
export function loadSceneAssets(scene:T.Scene,renderer:T.WebGLRenderer,covers:{box:Box;mesh:T.Mesh}[],quality:GraphicsQuality,island=false){
 let disposed=false;let sky:T.DataTexture|undefined,environment:T.WebGLRenderTarget|undefined;
 const islandSky=island?createIslandSky():undefined;
 if(islandSky)scene.background=islandSky;
 const manager=new T.LoadingManager();
 const ready=new Promise<void>(resolve=>{manager.onLoad=resolve;});
 const loader=new GLTFLoader(manager);
 const compact=(value:GraphicsQuality)=>value==='auto'||value==='performance';
 const crateShadows=createCrateShadows(renderer,scene,compact(quality));
 const loadedModels:T.Object3D[]=[];
 new RGBELoader(manager).load('/shooter/environment/sky.hdr',texture=>{
  if(disposed){texture.dispose();return;}sky=texture;texture.mapping=T.EquirectangularReflectionMapping;
  const generator=new T.PMREMGenerator(renderer);environment=generator.fromEquirectangular(texture);generator.dispose();
  scene.environment=environment.texture;scene.environmentIntensity=.48;if(!islandSky && !(scene.background instanceof T.Color)){
   scene.background=texture;scene.backgroundIntensity=.65;scene.backgroundBlurriness=.025;
  }
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
  setQuality:(value:GraphicsQuality)=>crateShadows.setCompact(compact(value)),
  dispose(){disposed=true;crateShadows.dispose();sky?.dispose();islandSky?.dispose();environment?.dispose();loadedModels.forEach(disposeObject);},
 };
}
