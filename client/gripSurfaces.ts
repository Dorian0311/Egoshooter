import * as T from 'three';

const imageSources=new Map<string,Promise<T.Source>>();

function imageSource(name:string){
 let source=imageSources.get(name);
 if(!source){
  source=new T.ImageLoader().loadAsync('/shooter/materials/viewmodel/'+name+'.webp')
   .then(image=>new T.Source(image))
   .catch(error=>{imageSources.delete(name);throw error;});
  imageSources.set(name,source);
 }
 return source;
}

/** Independent handles keep the weapon-disposal paths safe. Three shares the
 * decoded image and the uploaded texture between handles with the same Source. */
function surfaceMap(material:T.MeshStandardMaterial,slot:'map'|'normalMap',name:string){
 if(typeof document==='undefined')return;
 const isColor=slot==='map';
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
 const ctx=canvas.getContext('2d')!;
 ctx.fillStyle=isColor?(name==='hand-skin'?'#b98c72':'#dadada'):'#8080ff';ctx.fillRect(0,0,1,1);
 const map=new T.Texture(canvas);map.colorSpace=isColor?T.SRGBColorSpace:T.NoColorSpace;
 map.anisotropy=4;map.needsUpdate=true;material[slot]=map;
 let alive=true;
 const release=()=>{alive=false;map.dispose();material.removeEventListener('dispose',release);};
 material.addEventListener('dispose',release);
 void imageSource(name).then(source=>{
  if(!alive)return;
  map.dispose();map.source=source;map.needsUpdate=true;
 }).catch(()=>{/* Keep the neutral base if a texture is unavailable. */});
}

export function handSurface(){
 const material=new T.MeshStandardMaterial({name:'viewmodel-skin',roughness:.68,envMapIntensity:.44,vertexColors:true});
 surfaceMap(material,'map','hand-skin');surfaceMap(material,'normalMap','hand-skin-normal');material.normalScale.setScalar(.54);
 return material;
}

export function sleeveSurface(color:T.ColorRepresentation,geometry:T.BufferGeometry){
 const material=new T.MeshStandardMaterial({name:'viewmodel-sleeve',color,roughness:.94});
 surfaceMap(material,'map','jacket-twill');surfaceMap(material,'normalMap','jacket-twill-normal');material.normalScale.setScalar(.70);
 // GLBs exported for different weapon families orient their cuff at opposite ends.
 const position=geometry.getAttribute('position');geometry.computeBoundingBox();
 const bounds=geometry.boundingBox!;
 let top=0,bottom=0;
 for(let i=0;i<position.count;i++){
  const radius=Math.hypot(position.getX(i),position.getZ(i));
  if(position.getY(i)>bounds.max.y-.02)top=Math.max(top,radius);
  if(position.getY(i)<bounds.min.y+.02)bottom=Math.max(bottom,radius);
 }
 if(bottom<top)for(const map of [material.map,material.normalMap])if(map){map.repeat.y=-1;map.offset.y=1;}
 return material;
}

export function projectGripSkin(geometry:T.BufferGeometry){
 const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
 const uvs=new Float32Array(positions.count*2),colors=new Float32Array(positions.count*3);
 const tint=new T.Color(),warm=new T.Color('#efd4cc'),palm=new T.Color('#fff4e9');
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  // Canonical wrist coordinates precede the left hand's mirrored scene transform.
  // Bend the projection around the thumb and palm to retain grain on the gripping surface.
  uvs[i*2]=(x+.10+.20*z)/.20;uvs[i*2+1]=(y+.09+.19*z)/.26;
  const underside=T.MathUtils.smoothstep(normals?.getZ(i)??0,-.35,.60);
  const distal=T.MathUtils.smoothstep(y,.043,.104);
  tint.copy(palm).lerp(warm,.32*underside+.35*distal).toArray(colors,i*3);
 }
 geometry.setAttribute('uv',new T.BufferAttribute(uvs,2));geometry.setAttribute('color',new T.BufferAttribute(colors,3));
}
