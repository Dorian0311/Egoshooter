import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import * as T from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
globalThis.window={URL:{createObjectURL(){return 'embedded';}}};
T.TextureLoader.prototype.load=function(url){const t=new T.Texture();t.userData.file=url;return t;};
globalThis.FileReader=class {result;onloadend;async readAsArrayBuffer(b){this.result=await b.arrayBuffer();this.onloadend?.();}async readAsDataURL(b){this.result='data:application/octet-stream;base64,'+Buffer.from(await b.arrayBuffer()).toString('base64');this.onloadend?.();}};
for(const id of ['deadpool','harley','rocket','homer']){
 const folder='research/playable-characters/'+id,file=readdirSync(folder).find(n=>n.endsWith('.fbx'));
 const bytes=readFileSync(folder+'/'+file),source=new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 source.updateMatrixWorld(true);
 const meshes=[];source.traverse(o=>{if(o.isSkinnedMesh&&!(id==='deadpool'&&o.name.startsWith('mesh_Gun')))meshes.push(o);});
 const bones=[],boneMap=new Map();
 for(const mesh of meshes){const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<si.count;i++)for(let k=0;k<4;k++)if(sw.getComponent(i,k)>0){const bone=mesh.skeleton.bones[si.getComponent(i,k)];if(!boneMap.has(bone)){boneMap.set(bone,bones.length);bones.push(bone);}}
 }
 const keep=new Set([source]);for(const bone of bones)for(let p=bone;p;p=p.parent)keep.add(p);
 const sourceInverse=source.matrixWorld.clone().invert(),groups=new Map(),materialInfo={};
 for(const mesh of meshes){
  const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
  // Bake the FBX bind matrices into its current deform pose before rebinding.
  // Constraint-exported rigs may have a T-pose mesh but lowered rest bones.
  const position=geo.attributes.position,normal=geo.attributes.normal;
  const originalIndices=geo.attributes.skinIndex,originalWeights=geo.attributes.skinWeight;
  const skin=new T.Matrix4(),part=new T.Matrix4(),point=new T.Vector3(),normalMatrix=new T.Matrix3();
  for(let i=0;i<position.count;i++){
   skin.elements.fill(0);
   for(let k=0;k<4;k++){
    const weight=originalWeights.getComponent(i,k);if(!weight)continue;
    const index=originalIndices.getComponent(i,k);
    part.multiplyMatrices(mesh.skeleton.bones[index].matrixWorld,mesh.skeleton.boneInverses[index]);
    for(let n=0;n<16;n++)skin.elements[n]+=part.elements[n]*weight;
   }
   skin.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
   point.fromBufferAttribute(position,i).applyMatrix4(skin);position.setXYZ(i,point.x,point.y,point.z);
   if(normal){normalMatrix.getNormalMatrix(skin);point.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();normal.setXYZ(i,point.x,point.y,point.z);}
  }
  geo.applyMatrix4(new T.Matrix4().multiplyMatrices(sourceInverse,mesh.matrixWorld));
  const si=geo.attributes.skinIndex,sw=geo.attributes.skinWeight;
  for(let i=0;i<si.count;i++)for(let k=0;k<4;k++)si.setComponent(i,k,sw.getComponent(i,k)>0?boneMap.get(mesh.skeleton.bones[si.getComponent(i,k)]):0);
  for(const key of Object.keys(geo.attributes))if(!['position','normal','uv','skinIndex','skinWeight'].includes(key))geo.deleteAttribute(key);
  if(!geo.attributes.uv)geo.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
  if(!geo.attributes.normal)geo.computeVertexNormals();
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const ranges=geo.groups.length?geo.groups:[{start:0,count:geo.attributes.position.count,materialIndex:0}];
  for(const range of ranges){
   const original=materials[range.materialIndex]??materials[0],key=original.name;
   let entry=groups.get(key);if(!entry){
    const material=new T.MeshStandardMaterial({name:key,color:original.map?0xffffff:original.color,roughness:.85,metalness:0,side:T.FrontSide});
    entry={geometries:[],material};groups.set(key,entry);materialInfo[key]={albedo:original.map?.userData.file};
   }
   const piece=new T.BufferGeometry();
   for(const [name,attribute]of Object.entries(geo.attributes)){
    const values=attribute.array.slice(range.start*attribute.itemSize,(range.start+range.count)*attribute.itemSize);
    piece.setAttribute(name,new T.BufferAttribute(values,attribute.itemSize,attribute.normalized));
   }
   entry.geometries.push(piece);
  }
  geo.dispose();
 }
 function prune(parent){for(const child of [...parent.children]){if(!keep.has(child))parent.remove(child);else prune(child);}}
 prune(source);source.animations=[];source.updateMatrixWorld(true);
 const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();
 let triangles=0;
 for(const {geometries,material}of groups.values()){
  const merged=mergeGeometries(geometries,false);if(!merged)throw Error('Cannot merge '+id);const geometry=mergeVertices(merged,1e-5);merged.dispose();
  geometries.forEach(g=>g.dispose());triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
  const mesh=new T.SkinnedMesh(geometry,material);mesh.name=id+'-'+material.name;source.add(mesh);mesh.bind(skeleton,source.matrixWorld);mesh.normalizeSkinWeights();
 }
 const output=new T.Group();output.name=id;output.add(source);output.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(source),size=bounds.getSize(new T.Vector3());
 const scale=1.78/size.y;source.scale.multiplyScalar(scale);source.position.add(new T.Vector3(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2).multiplyScalar(scale));
 // Source assets face +Z, except Rocket's source mesh which faces -X.
 output.rotation.y=id==='rocket'?Math.PI/2:Math.PI;
 output.updateMatrixWorld(true);
 const glb=await new GLTFExporter().parseAsync(output,{binary:true,onlyVisible:true});
 mkdirSync('public/shooter/characters/bonus',{recursive:true});writeFileSync(folder+'/untextured.glb',Buffer.from(glb));
 writeFileSync(folder+'/materials.json',JSON.stringify(materialInfo,null,2));
 writeFileSync(folder+'/conversion.json',JSON.stringify({id,triangles,draws:groups.size,bones:bones.length,source:file},null,2));
 console.log(id,triangles,'triangles',groups.size,'draws',bones.length,'weighted bones');
}
