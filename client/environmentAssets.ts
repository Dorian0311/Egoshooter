import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {World} from '../shared/world';
import {terrainHeight} from '../shared/terrain';
import {instanceStaticModel} from './scenery';

function disposeSource(root:T.Object3D){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
 root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
 for(const material of materials){for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);material.dispose();}
 geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());
}

/** Real PBR facade modules are placed only on existing solid front wall spans.
 * Entrances, side firing windows, doors, stairs and their collision stay open. */
export function loadEnvironmentUpgrade(scene:T.Scene,world:World,renderer:T.WebGLRenderer){
 const loader=new GLTFLoader(),sources:T.Group[]=[],root=new T.Group();root.name='imported-environment';scene.add(root);let disposed=false;
 const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const configure=(model:T.Group,foliage=false)=>model.traverse(o=>{if(o instanceof T.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material]){
  for(const texture of Object.values(material))if(texture instanceof T.Texture)texture.anisotropy=anisotropy;
  // Cutout leaves sort correctly across instances and cast leaf-shaped shadows.
  if(foliage&&material.transparent){material.transparent=false;material.alphaTest=.4;material.depthWrite=true;material.needsUpdate=true;}
 }});
 const packs=world.id==='storm'?['modular_factory_facade']:world.id==='frontline'?['modular_factory_facade','modular_urban_apartments_facade']:['modular_urban_apartments_facade'];
 for(const pack of packs){
  void loader.loadAsync('/shooter/models/'+pack+'/runtime.gltf').then(({scene:model})=>{
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
   for(const [variant,matrices]of placements){const part=model.getObjectByName(variant);if(part)instanceStaticModel(root,part,matrices);}
  }).catch(error=>console.warn('Facade detail unavailable:',pack,error));
 }
 if(world.id==='storm'||world.id==='frontline')for(const name of ['rock_moss_set_01','grass_medium_01','wild_rooibos_bush']){
  void loader.loadAsync('/shooter/models/'+name+'/asset.gltf').then(({scene:model})=>{
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
   const count=name==='grass_medium_01'?148:name==='wild_rooibos_bush'?42:10;
   for(let n=0;n<count;n++){
    let x=Math.sin(n*27.31+4)*103,z=Math.cos(n*19.17+1)*103;
    if(name==='rock_moss_set_01'){const angle=n/count*Math.PI*2;x=Math.cos(angle)*125;z=Math.sin(angle)*125;}
    else if(Math.hypot(x,z)>108||Math.abs(x)<8||Math.abs(z)<7||Math.abs(Math.abs(x)-43)<5||world.boxes.some(b=>Math.abs(x-b.x)<b.w/2+2&&Math.abs(z-b.z)<b.d/2+2))continue;
    const height=name==='grass_medium_01'?.24+(n%3)*.10:name==='wild_rooibos_bush'?.85+(n%3)*.15:2.5+(n%3);
    if(world.id==='frontline'&&name==='rock_moss_set_01')continue;
    const placement=new T.Object3D(),scale=height/Math.max(.01,size.y);placement.scale.setScalar(scale);placement.rotation.y=n*2.39996;
    placement.position.set(x,terrainHeight(x,z,world),z);placement.updateMatrix();placements.push(placement.matrix.clone());
   }
   if(placements.length){instanceStaticModel(root,sample,placements);if(name==='grass_medium_01'&&part instanceof T.Mesh)root.traverse(o=>{if(o instanceof T.InstancedMesh&&o.geometry===part.geometry)o.castShadow=false;});}
  }).catch(error=>console.warn('Natural detail unavailable:',name,error));
 }
 return ()=>{disposed=true;root.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose();});sources.forEach(disposeSource);root.removeFromParent();};
}
