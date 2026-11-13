import * as T from 'three';
type Surface='paving'|'plaster'|'facade'|'stone'|'wood'|'metal'|'snow'|'rock'|'cloth'|'roof'|'grass'|'sand';
const names:Record<Exclude<Surface,'cloth'>,string>={paving:'cobblestone_floor_02',plaster:'damaged_plaster',facade:'plastered_wall_02',stone:'sandstone_blocks_04',wood:'wood_planks_dirt',metal:'rusty_metal_02',snow:'snow_02',rock:'rock_01',roof:'roof_slates_02',grass:'aerial_grass_rock',sand:'sand_01'};
const surfaces:Record<string,Surface>={
 '#77766b':'paving','#8d8776':'paving','#8b8a7d':'paving','#c1b59a':'plaster','#a99c85':'wood',
 '#42594d':'metal','#394c43':'metal','#4b5b4f':'metal','#4b4d43':'metal',
 '#67513d':'wood','#674b32':'wood','#6c4c35':'wood','#82603c':'wood','#594b37':'wood',
 '#38413e':'metal','#303936':'metal','#414b46':'metal','#242b28':'metal',
 '#68534a':'stone','#765247':'stone','#9d8b75':'stone','#726d61':'stone','#777365':'stone',
 '#5f6557':'wood','#827866':'stone','#818783':'rock','#deded4':'snow',
 '#232629':'cloth','#202326':'cloth','#6c7250':'cloth','#7a795e':'cloth'
 ,'#cec1a5':'facade','#a9b1ad':'facade','#bdaa96':'facade','#d2cfbf':'facade','#718a48':'grass','#d0b37c':'sand'
};
export function createMaterials(renderer:T.WebGLRenderer){
 const cache=new Map<string,T.MeshStandardMaterial>(),textures=new Map<string,T.Texture>();
 const loader=new T.TextureLoader();let disposed=false;
 const placeholders=new Map<string,HTMLCanvasElement>();
 function placeholder(channel:string){
  const key=channel==='normal'?'normal':'white';if(placeholders.has(key))return placeholders.get(key)!;
  const image=document.createElement('canvas');image.width=image.height=1;
  const context=image.getContext('2d')!;context.fillStyle=key==='normal'?'rgb(128,128,255)':'white';context.fillRect(0,0,1,1);placeholders.set(key,image);return image;
 }
 function texture(surface:Exclude<Surface,'cloth'>,channel:string){
  const key=surface+channel;if(textures.has(key))return textures.get(key)!;
  const value=loader.load(`/shooter/materials/runtime-v1/${names[surface]}/${channel}.jpg`,()=>{
   // WebGL immutable storage must be reallocated when the 1px fallback grows.
   value.dispose();if(!disposed)value.needsUpdate=true;
  },undefined,()=>console.warn('Material unavailable:',surface,channel));
  // A valid neutral texel prevents black terrain while remote images download.
  value.image=placeholder(channel);value.needsUpdate=true;
  value.wrapS=value.wrapT=T.RepeatWrapping;value.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
  if(channel==='albedo')value.colorSpace=T.SRGBColorSpace;textures.set(key,value);return value;
 }
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const context=canvas.getContext('2d')!;
 const pixels=context.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const n=(Math.sin(x*72.7+y*91.3)*43758.5)%1;const v=165+n*12+((x+y)%3===0?12:0),p=(y*128+x)*4;pixels.data.set([v,v,v,255],p);}context.putImageData(pixels,0,0);
 const cloth=new T.CanvasTexture(canvas);cloth.wrapS=cloth.wrapT=T.RepeatWrapping;cloth.repeat.set(8,8);cloth.colorSpace=T.SRGBColorSpace;textures.set('cloth',cloth);
 const roof=new T.MeshStandardMaterial({map:texture('roof','albedo'),normalMap:texture('roof','normal'),roughnessMap:texture('roof','roughness'),aoMap:texture('roof','ao'),roughness:.9});
 roof.normalScale.set(.8,.8);
 cache.set('roof',roof);
 return {
  roof,
  get(color:string){if(cache.has(color))return cache.get(color)!;const surface=surfaces[color];const result=new T.MeshStandardMaterial({color,roughness:.83,metalness:0});
   if(surface==='cloth'){result.map=cloth;result.bumpMap=cloth;result.bumpScale=.0012;result.roughness=.96;}
   else if(surface){result.map=texture(surface,'albedo');result.normalMap=texture(surface,'normal');result.roughnessMap=texture(surface,'roughness');result.normalScale.set(.55,.55);result.color.set(surface==='facade'?color:surface==='metal'?'#8b938b':surface==='wood'?'#b8a58c':'#e0ddd4');result.roughness=surface==='paving'?.75:.95;result.metalness=surface==='metal'?.65:0;if(surface==='rock'){result.vertexColors=true;result.normalScale.set(.85,.85);}}
   if(color==='#7b8a82'){result.color.set('#2e444a');result.metalness=.75;result.roughness=.18;result.envMapIntensity=1.4;}
   if(surface==='facade'||surface==='paving'||surface==='grass'||surface==='sand')result.aoMap=texture(surface,'ao');
   if(surface==='grass'){result.color.set('#b6ca8e');result.normalScale.set(.7,.7);}
   if(surface==='sand')result.color.set('#f0ddb7');
   if(color==='#8b8a7d')result.color.set('#9a9689');
   cache.set(color,result);return result;
  },
  dispose(){disposed=true;cache.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 };
}
// World-sized UVs keep brick/stone scale consistent across differently sized boxes.
export function projectBoxUVs(geometry:T.BufferGeometry,origin:T.Vector3,scale=3){
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');if(!uv)return;
 for(let i=0;i<p.count;i++){const x=p.getX(i)+origin.x,y=p.getY(i)+origin.y,z=p.getZ(i)+origin.z;const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i));if(ay>.8)uv.setXY(i,x/scale,z/scale);else if(ax>.8)uv.setXY(i,z/scale,y/scale);else uv.setXY(i,x/scale,y/scale);}uv.needsUpdate=true;
}
