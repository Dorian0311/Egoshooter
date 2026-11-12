import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import * as T from 'three';
const root='public/shooter/characters/greatcoat';mkdirSync(root,{recursive:true});
let counter=0;const blobs=new Map();
globalThis.window={URL:{createObjectURL(blob){const name='image-'+counter+++'.png';blobs.set(name,blob);return name;}}};
T.TextureLoader.prototype.load=function(url){const texture=new T.Texture();texture.userData.file=url;return texture;};
const pieces=[];
for(const name of ['BODY','MANOS','PIERNAS']){
 const bytes=readFileSync('research/uniforme-aleman/source/'+name+'.fbx');const group=new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');group.updateMatrixWorld(true);
 group.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.scale(.012,.012,.012);g.rotateY(Math.PI);const m=Array.isArray(o.material)?o.material[0]:o.material;pieces.push({name,positions:Array.from(g.attributes.position.array),normal:Array.from(g.attributes.normal.array),uv:Array.from(g.attributes.uv.array),indices:g.index?Array.from(g.index.array):null,albedo:m.map?.userData.file,normalMap:m.normalMap?.userData.file});});
}
for(const [name,blob] of blobs)writeFileSync(root+'/'+name,Buffer.from(await blob.arrayBuffer()));
writeFileSync(root+'/source-geometry.json',JSON.stringify(pieces));console.log(pieces.map(p=>({name:p.name,vertices:p.positions.length/3,albedo:p.albedo,normal:p.normalMap})),blobs.size,'textures');
