import * as T from 'three';
import {ConvexGeometry} from 'three/examples/jsm/geometries/ConvexGeometry.js';
import {crateColorLod,type CrateIndexAsset} from './crateColorLod';
import {instanceStaticModel} from './scenery';
import type {GraphicsQuality} from './graphicsSettings';

/** The closed crate body, lid and latch each retain their own outer hull.
 * Fine bevels are below one shadow texel in the standard and High light footprints. */
function createCrateShadowSource(source:T.Object3D){
 const hulls=new T.Group(),material=new T.MeshBasicMaterial();
 source.updateWorldMatrix(true,true);
 try{
  source.traverse(part=>{
   if(!(part instanceof T.Mesh))return;
   const position=part.geometry.getAttribute('position');
   if(!position||position.count<4)throw new Error('Crate part has no closed hull');
   const points=Array.from({length:position.count},(_,index)=>
    new T.Vector3().fromBufferAttribute(position,index).applyMatrix4(part.matrixWorld));
   const hull=new ConvexGeometry(points);
   hulls.add(new T.Mesh(hull,material));
  });
  if(!hulls.children.length)throw new Error('Crate has no meshes');
 }catch(error){
  for(const child of hulls.children)if(child instanceof T.Mesh)child.geometry.dispose();
  material.dispose();
  throw error;
 }
 return hulls;
}

/** Three checks the world camera's layers for shadow casters. A separate
 * visibility scope keeps the proxy meshes out of the ordinary color pass. */
export function createCrateShadows(renderer:T.WebGLRenderer,world:T.Scene,quality:GraphicsQuality){
 let compactColor=quality==='auto'||quality==='performance';
 const lod=crateColorLod();
 const color=new T.Group(),depth=new T.Group();
 color.name='cover-crates';depth.name='cover-crate-shadow-hulls';
 color.matrixAutoUpdate=depth.matrixAutoUpdate=false;
 depth.visible=false;world.add(color,depth);
 let proxySource:T.Group|undefined;
 const positions:T.Vector3[]=[],cameraPosition=new T.Vector3();
 const shadowMap=renderer.shadowMap,render=shadowMap.render;
 function setDetailedCastShadow(value:boolean){
  for(const child of color.children)child.castShadow=value;
 }
 const renderWithCrates:typeof shadowMap.render=function(lights,scene,camera){
  if(quality==='ultra'||!proxySource||scene!==world||!(shadowMap.autoUpdate||shadowMap.needsUpdate)){
   render.call(shadowMap,lights,scene,camera);return;
  }
  // A nearby stack or a narrower scope makes its fine shadow detail visible.
  cameraPosition.setFromMatrixPosition(camera.matrixWorld);
  const fov=camera instanceof T.PerspectiveCamera?camera.getEffectiveFOV():72;
  const distance=14*Math.tan(T.MathUtils.degToRad(36))/Math.tan(T.MathUtils.degToRad(fov/2));
  const radiusSquared=distance*distance;
  const nearby=positions.some(point=>point.distanceToSquared(cameraPosition)<radiusSquared);
  if(nearby)setDetailedCastShadow(true);
  else depth.visible=true;
  try{render.call(shadowMap,lights,scene,camera);}
  finally{depth.visible=false;if(nearby)setDetailedCastShadow(false);}
 };
 shadowMap.render=renderWithCrates;
 function setQuality(value:GraphicsQuality){
  quality=value;compactColor=value==='auto'||value==='performance';
  if(!compactColor)lod.restore();
  setDetailedCastShadow(quality==='ultra'||!proxySource);
 }
 return {
  load(source:T.Object3D,placements:T.Matrix4[]){
   for(const placement of placements)positions.push(new T.Vector3().setFromMatrixPosition(placement));
   try{
    const hulls=createCrateShadowSource(source);
    proxySource=hulls;
   }catch{/* The full original shadow caster is available if hull generation fails. */}
   // Keep one visible color mesh per original part and spatial cell. A cell
   // swaps only its index buffers; it cannot draw or cast both color LODs.
   const cells=new Map<string,T.Matrix4[]>();
   for(const placement of placements){
    const {elements:e}=placement,key=Math.floor(e[12]/32)+','+Math.floor(e[14]/32);
    const cell=cells.get(key);if(cell)cell.push(placement);else cells.set(key,[placement]);
   }
   for(const cell of cells.values()){
    const first=color.children.length;instanceStaticModel(color,source,cell,quality==='ultra'||!proxySource);
    lod.register(color.children.slice(first));
   }
   if(proxySource)instanceStaticModel(depth,proxySource,placements,true,32);
  },
  setQuality,
  setColorLod:(source:T.Object3D,asset:CrateIndexAsset)=>lod.load(source,asset),
  updateColor:(camera:T.Camera,aimed:boolean)=>lod.update(camera,compactColor,aimed),
  dispose(){
   lod.dispose();
   if(shadowMap.render===renderWithCrates)shadowMap.render=render;
   for(const group of [color,depth])for(const mesh of group.children)if(mesh instanceof T.InstancedMesh)mesh.dispose();
   const materials=new Set<T.Material>();
   proxySource?.traverse(mesh=>{if(mesh instanceof T.Mesh){mesh.geometry.dispose();materials.add(mesh.material as T.Material);}});
   materials.forEach(material=>material.dispose());
   world.remove(color,depth);
  },
 };
}
