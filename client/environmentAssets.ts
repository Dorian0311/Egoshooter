import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {World} from '../shared/world';
import {islandRoute,islandUnderpass,nearIslandRoute} from '../shared/islandRoute';
import {inIslandStreet} from '../shared/islandStreet';
import {terrainHeight} from '../shared/terrain';
import {instanceStaticModel} from './scenery';
import type {GraphicsQuality} from './graphicsSettings';
import {scannedCliffFaces} from './coastalHeadland';
import {createPeriodQuarter} from './periodQuarter';
import {createPeriodArchitecture} from './periodArchitecture';
import {createCoastalArchitecture} from './coastalArchitecture';
import {applySurfaceFinish} from './surfaceFinish';

function disposeSource(root:T.Object3D){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
 root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
 for(const material of materials){for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);material.dispose();}
 geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());
}

/** Real PBR facade modules are placed only on existing solid front wall spans.
 * Entrances, side firing windows, doors, stairs and their collision stay open. */
export function loadEnvironmentUpgrade(scene:T.Scene,world:World,renderer:T.WebGLRenderer){
 const loader=new GLTFLoader(),sources:T.Group[]=[],root=new T.Group();root.name='imported-environment';root.matrixAutoUpdate=false;scene.add(root);let disposed=false;
 const architecture=world.id==='storm'?createCoastalArchitecture(world.buildings):createPeriodArchitecture(world);
 if(world.id==='cologne'||world.id==='frontline')architecture.add(createPeriodQuarter(world.id));
 root.add(architecture);sources.push(architecture);
 const distantDetails:T.InstancedMesh[]=[];
 const markDetails=(from:number)=>{
  if(world.id!=='storm')return;
  for(let i=from;i<root.children.length;i++){
   const object=root.children[i];
   if(object instanceof T.InstancedMesh)distantDetails.push(object);
  }
 };
 const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const configure=(model:T.Group,foliage=false)=>model.traverse(o=>{if(o instanceof T.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material]){
  for(const texture of Object.values(material))if(texture instanceof T.Texture)texture.anisotropy=anisotropy;
  if(!foliage&&material instanceof T.MeshStandardMaterial)applySurfaceFinish(material,true);
  // Cutout leaves sort correctly across instances and cast leaf-shaped shadows.
  if(foliage&&material.transparent){material.transparent=false;material.alphaTest=.4;material.depthWrite=true;material.needsUpdate=true;}
 }});
 const loading:Promise<unknown>[]=[];
 if(world.id==='storm'){
  loading.push(loader.loadAsync('/shooter/environment/coastal-cliff.glb').then(({scene:model})=>{
   if(disposed){disposeSource(model);return;}
   const face=model.getObjectByProperty('isMesh',true) as T.Mesh|undefined;
   if(!face){disposeSource(model);return;}
   sources.push(model);const scan=face.geometry;
   face.geometry=scannedCliffFaces(scan);scan.dispose();
   face.name='Photogrammetric coastal cliff faces';face.castShadow=false;face.receiveShadow=false;
   root.add(model);
  }).catch(error=>console.warn('Coastal cliff scan unavailable:',error)));
 }
 const packs=world.id==='storm'?['modular_factory_facade']:world.id==='frontline'?['modular_factory_facade','modular_urban_apartments_facade']:['modular_urban_apartments_facade'];
 for(const pack of packs){
  loading.push(loader.loadAsync('/shooter/models/'+pack+'/runtime.gltf').then(({scene:model})=>{
   if(disposed){disposeSource(model);return;}sources.push(model);configure(model);
   const placements=new Map<string,T.Matrix4[]>();
   for(const [index,b]of world.buildings.entries()){
    const factory=world.id==='storm'||world.id==='frontline'&&index%3===1;
    if(factory!==(pack==='modular_factory_facade'))continue;
    for(const side of [-1,1])for(let row=0;row<(b.upper?2:1);row++)for(const [col,x]of [-7.25,-3.75,3.75,7.25].entries()){
     const variant=(index+col+row)%4===0?'solid':(index+col)%2?'small':'large';
     const placement=new T.Object3D();placement.position.set(b.x+x,row*4,b.z+side*(b.d/2+.24));placement.rotation.y=side>0?0:Math.PI;placement.scale.set(3.5/3,4/3,1);placement.updateMatrix();
     const list=placements.get(variant)??[];list.push(placement.matrix.clone());placements.set(variant,list);
    }
   }
   // The solid building already casts its silhouette. Avoid rendering dense
   // facade dressing a second time into the shadow map; keep received shadows.
   const first=root.children.length;
   for(const [variant,matrices]of placements){const part=model.getObjectByName(variant);if(part)instanceStaticModel(root,part,matrices,false,48);}
   markDetails(first);
  }).catch(error=>console.warn('Facade detail unavailable:',pack,error)));
 }
 if(world.id==='storm'||world.id==='frontline')for(const name of ['rock_moss_set_01','grass_medium_01','wild_rooibos_bush']){
  loading.push(loader.loadAsync('/shooter/models/'+name+'/asset.gltf').then(({scene:model})=>{
   if(disposed){disposeSource(model);return;}sources.push(model);configure(model,name!=='rock_moss_set_01');
   // Use one authored clump/rock, not the whole catalogue arrangement.
   const choices:T.Mesh[]=[];model.updateMatrixWorld(true);model.traverse(o=>{if(o instanceof T.Mesh)choices.push(o);});
   const triangles=(part:T.Mesh)=>(part.geometry.index?.count??part.geometry.getAttribute('position').count)/3;
   choices.sort((a,b)=>triangles(a)-triangles(b));
   const part=name==='wild_rooibos_bush'?model.getObjectByName('wild_rooibos_bush_a'):name==='grass_medium_01'?(choices.find(p=>p.name.includes('mid_c'))??choices[0]):choices[0];if(!part)return;
   const clone=part.clone();part.matrixWorld.decompose(clone.position,clone.quaternion,clone.scale);
   const sample=new T.Group();sample.add(clone);sample.updateMatrixWorld(true);
   const bounds=new T.Box3().setFromObject(sample),size=bounds.getSize(new T.Vector3()),placements:T.Matrix4[]=[];
   sample.position.set(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);
   const count=name==='grass_medium_01'?(world.id==='storm'?64:148):name==='wild_rooibos_bush'?42:10;
   for(let n=0;n<count;n++){
    let x=Math.sin(n*27.31+4)*103,z=Math.cos(n*19.17+1)*103;
    if(name==='rock_moss_set_01'){const angle=n/count*Math.PI*2;x=Math.cos(angle)*125;z=Math.sin(angle)*125;}
    else if(world.id==='storm'&&(nearIslandRoute(x,z,3)||inIslandStreet(x,z))||Math.hypot(x,z)>108||Math.abs(x)<8||Math.abs(z)<7||Math.abs(Math.abs(x)-43)<5||world.boxes.some(b=>Math.abs(x-b.x)<b.w/2+2&&Math.abs(z-b.z)<b.d/2+2))continue;
    const height=name==='grass_medium_01'?.24+(n%3)*.10:name==='wild_rooibos_bush'?.85+(n%3)*.15:2.5+(n%3);
    if(world.id==='frontline'&&name==='rock_moss_set_01')continue;
    const placement=new T.Object3D(),scale=height/Math.max(.01,size.y);placement.scale.setScalar(scale);placement.rotation.y=n*2.39996;
    placement.position.set(x,terrainHeight(x,z,world),z);placement.updateMatrix();placements.push(placement.matrix.clone());
   }
   if(name==='wild_rooibos_bush'&&world.id==='storm'){
    // The road verge uses the smallest actual scanned mesh, spatially instanced.
    const shrub=model.getObjectByName('wild_rooibos_bush_e')??part,low=shrub.clone();
    shrub.matrixWorld.decompose(low.position,low.quaternion,low.scale);
    const plant=new T.Group();plant.add(low);plant.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(plant),dimensions=bounds.getSize(new T.Vector3());
    plant.position.set(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);
    const road=new T.CatmullRomCurve3(islandRoute.map(([x,z])=>new T.Vector3(x,0,z)));
    const verge:T.Matrix4[]=[],pose=new T.Object3D();
    for(let i=0;i<30;i++){
      const t=(i+.35)/30,point=road.getPointAt(t),direction=road.getTangentAt(t);
      for(const side of [-1,1]){
        const offset=side*(3.45+(i%4)*.43),x=point.x+direction.z*offset,z=point.z-direction.x*offset;
        if(inIslandStreet(x,z)||Math.abs(z-islandUnderpass.z)<4)continue;
        pose.scale.setScalar((.56+((i*7+side+1)%9)*.065)/Math.max(.01,dimensions.y));
        pose.rotation.y=i*2.4+side;pose.position.set(x,terrainHeight(x,z,world)-.05,z);
        pose.updateMatrix();verge.push(pose.matrix.clone());
      }
    }
    const first=root.children.length;instanceStaticModel(root,plant,verge,false,24);markDetails(first);
   }
   if(placements.length){
    const first=root.children.length;
    instanceStaticModel(root,sample,placements,name==='rock_moss_set_01',48);
    markDetails(first);
   }
  }).catch(error=>console.warn('Natural detail unavailable:',name,error)));
 }
 return {
  ready:Promise.all(loading),
  update(position:T.Vector3,quality:GraphicsQuality){
   const limit=quality==='auto'||quality==='performance'?45:Infinity;
   for(const item of distantDetails){
    const bounds=item.boundingSphere;
    if(bounds)item.visible=bounds.center.distanceToSquared(position)<(limit+bounds.radius)**2;
   }
  },
  dispose(){disposed=true;root.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose();});sources.forEach(disposeSource);root.removeFromParent();},
 };
}
