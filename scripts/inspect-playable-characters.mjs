import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import * as T from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
globalThis.window={URL:{createObjectURL(){return 'embedded';}}};
T.TextureLoader.prototype.load=function(url){const t=new T.Texture();t.userData.file=url;return t;};
for(const id of ['deadpool','harley','rocket','homer']){
 const folder='research/playable-characters/'+id;
 const file=readdirSync(folder).find(n=>n.endsWith('.fbx'));
 const b=readFileSync(folder+'/'+file),root=new FBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');root.updateMatrixWorld(true);
 const meshes=[],bones=new Set(),materials=new Map();
 root.traverse(o=>{if(o.isBone)bones.add(o.name);if(!o.isMesh)return;meshes.push({name:o.name,vertices:o.geometry.attributes.position.count,triangles:(o.geometry.index?.count??o.geometry.attributes.position.count)/3,skin:!!o.isSkinnedMesh});for(const m of Array.isArray(o.material)?o.material:[o.material])materials.set(m.name,{name:m.name,color:m.color?.getHexString(),map:m.map?.userData.file,normal:m.normalMap?.userData.file});});
 const bounds=new T.Box3().setFromObject(root);
 const report={id,file,meshes,bones:[...bones],materials:[...materials.values()],animations:root.animations.map(a=>({name:a.name,duration:a.duration,tracks:a.tracks.length})),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
 writeFileSync(folder+'/inspection.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,bones:report.bones.slice(0,25)},null,2));
}
