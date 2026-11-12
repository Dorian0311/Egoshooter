import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {batchWeaponMeshes} from './batchWeaponMeshes';
import {isBonusId,loadBonusCharacter,createBonusCharacter,type BonusCharacterData} from './bonusCharacters';
import {defaultUniform,uniforms,type UniformId} from '../shared/uniforms.ts';
import * as T from 'three';
import type {Player} from '../shared/game.ts';
import type {MapId} from '../shared/world.ts';
type Joint={name:string;parent:number;head:number[];tail:number[]};
type CoatPiece={name:string;positions:number[];normal:number[];uv:number[];indices:number[]|null;skinIndex:number[];skinWeight:number[];albedo:string;normalMap:string};
let coatSource:Promise<CoatPiece[]>|null=null;
const coatTextureCache=new Map<string,{texture:T.Texture;refs:number}>();
function acquireCoatTexture(file:string,color:boolean){let entry=coatTextureCache.get(file);if(!entry){const texture=new T.TextureLoader().load('/shooter/characters/greatcoat/'+file);if(color)texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;entry={texture,refs:0};coatTextureCache.set(file,entry);}entry.refs++;return entry.texture;}
function releaseCoatTexture(texture:T.Texture){for(const [file,entry]of coatTextureCache)if(entry.texture===texture){if(--entry.refs===0){texture.dispose();coatTextureCache.delete(file);}break;}}

type HumanData={coat?:CoatPiece[];positions:number[];uv:number[];indices:number[];skinIndex:number[];skinWeight:number[];categories:number[];bones:Joint[];skinImage?:HTMLImageElement};
let source:Promise<HumanData>|null=null;
function loadBaseHuman(){return source??=fetch('/shooter/characters/humanoid.json').then(r=>{if(!r.ok)throw Error('Human model unavailable');return r.json() as Promise<HumanData>;}).then(async data=>{data.skinImage=await new T.ImageLoader().loadAsync('/shooter/characters/skin.png');return data;}).catch(e=>{source=null;throw e;});}
export async function loadHuman(uniformId?:UniformId){
 if(uniformId&&isBonusId(uniformId))return loadBonusCharacter(uniformId);
 const data=await loadBaseHuman();if(uniformId!=='de-greatcoat')return data;
 coatSource??=fetch('/shooter/characters/greatcoat/rigged.json').then(r=>{if(!r.ok)throw Error('Mantelmodell konnte nicht geladen werden');return r.json() as Promise<CoatPiece[]>;}).catch(e=>{coatSource=null;throw e;});
 return {...data,coat:await coatSource};
}
export function createHuman(data:HumanData|BonusCharacterData,team:'de'|'fr',map:MapId,uniform:T.MeshStandardMaterial,uniformId:UniformId=defaultUniform(team,map)){
 if('character' in data)return createBonusCharacter(data);
 uniform=uniform.clone();const outfit=uniforms[uniformId];uniform.color.set(outfit.color);
 let isDisposed=false;
 const group=new T.Group(),geometry=new T.BufferGeometry();
 const tailored=data.positions.slice();
 for(let i=0;i<data.categories.length;i++){if(data.categories[i]!==0)continue;const x=tailored[i*3],y=tailored[i*3+1],z=tailored[i*3+2];if(y>.88&&y<1.43&&Math.abs(x)<.23){const ease=Math.sin((y-.88)/.55*Math.PI);tailored[i*3]=x*(1+.075*ease);tailored[i*3+2]=z*(1+.12*ease);}}
 geometry.setAttribute('position',new T.Float32BufferAttribute(tailored,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(data.skinIndex,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(data.skinWeight,4));
 const skin=new T.Texture(data.skinImage);skin.colorSpace=T.SRGBColorSpace;skin.anisotropy=4;skin.needsUpdate=true;
 const materials=[uniform,new T.MeshStandardMaterial({color:'#ffffff',map:skin,roughness:.82,envMapIntensity:.35}),new T.MeshStandardMaterial({color:'#272723',roughness:.85})];
 const ordered:number[][]=[[],[],[]];for(let i=0;i<data.indices.length;i+=3){if(data.coat&&!data.indices.slice(i,i+3).every(v=>data.positions[v*3+1]>1.54&&(data.positions[v*3+1]>1.62||Math.abs(data.positions[v*3])<.085)))continue;const tri=data.indices.slice(i,i+3),labels=tri.map(v=>data.categories[v]);const category=data.coat?1:labels.filter(v=>v===1).length>=2?1:labels.filter(v=>v===2).length>=2?2:0;ordered[category].push(...tri);}
 ordered[2]=[];geometry.setIndex(ordered.flat());let start=0;ordered.forEach((indices,index)=>{geometry.addGroup(start,indices.length,index);start+=indices.length;});geometry.computeVertexNormals();
 const bones=data.bones.map(j=>{const b=new T.Bone();b.name=j.name;return b;});
 for(let i=0;i<bones.length;i++){const j=data.bones[i],parent=j.parent>=0?data.bones[j.parent].head:[0,0,0];bones[i].position.set(j.head[0]-parent[0],j.head[1]-parent[1],j.head[2]-parent[2]);if(j.parent>=0)bones[j.parent].add(bones[i]);else group.add(bones[i]);}
 const mesh=new T.SkinnedMesh(geometry,materials);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);group.updateMatrixWorld(true);
 const skeleton=new T.Skeleton(bones);mesh.bind(skeleton);mesh.normalizeSkinWeights();
 const coatMeshes:T.SkinnedMesh[]=[],coatTextures:T.Texture[]=[];
 if(data.coat)for(const piece of data.coat){
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(piece.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(piece.normal,3));g.setAttribute('uv',new T.Float32BufferAttribute(piece.uv,2));if(piece.indices)g.setIndex(piece.indices);g.setAttribute('skinIndex',new T.Uint16BufferAttribute(piece.skinIndex,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(piece.skinWeight,4));
   const albedo=acquireCoatTexture(piece.albedo,true),normal=acquireCoatTexture(piece.normalMap,false);coatTextures.push(albedo,normal);
   const material=new T.MeshStandardMaterial({map:albedo,normalMap:normal,roughness:piece.name==='BODY'?.96:.8,metalness:0,normalScale:new T.Vector2(.65,.65)});
   const garment=new T.SkinnedMesh(g,material);garment.castShadow=true;garment.receiveShadow=true;garment.frustumCulled=false;group.add(garment);garment.bind(skeleton,mesh.bindMatrix);garment.normalizeSkinWeights();coatMeshes.push(garment);
 }

 const named=new Map(bones.map(b=>[b.name,b]));
 const ownMaterials:T.Material[]=[uniform,materials[1],materials[2]];
 const detailMaterials=new Map<string,T.MeshStandardMaterial>();
 function detailMaterial(color:string,roughness=.85){const key=`${color}:${roughness}`;let material=detailMaterials.get(key);if(!material){material=new T.MeshStandardMaterial({color,roughness});detailMaterials.set(key,material);ownMaterials.push(material);}return material;}
 const equipment=new T.Group();group.add(equipment);if(data.coat)equipment.visible=false;
 function part(x:number,y:number,z:number,w:number,h:number,d:number,color:string,parent:T.Object3D=equipment){const m=new T.Mesh(new T.BoxGeometry(w,h,d),detailMaterial(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
 const headBone=named.get('head')!;const headOrigin=data.bones.find(j=>j.name==='head')!.head;
 const headgear=new T.Group();headgear.position.set(0,1.72-headOrigin[1],data.bones.find(j=>j.name==='head')!.tail[2]-headOrigin[2]);headBone.add(headgear);
 if(uniformId==='de-panzer'){
  const insigniaCanvas=document.createElement('canvas');insigniaCanvas.width=256;insigniaCanvas.height=128;
  const ink=insigniaCanvas.getContext('2d')!;ink.strokeStyle='#b5b8ac';ink.fillStyle='#b5b8ac';ink.lineWidth=6;ink.lineCap='square';
  // Small historical Heer breast insignia, not a separate faction banner.
  for(const side of [-1,1])for(let row=0;row<3;row++){ink.beginPath();ink.moveTo(128+side*15,34+row*8);ink.lineTo(128+side*(100-row*15),20+row*12);ink.stroke();}
  ink.fillRect(121,25,14,32);ink.beginPath();ink.arc(128,83,24,0,Math.PI*2);ink.stroke();
  ink.save();ink.translate(128,83);ink.rotate(Math.PI/4);ink.lineWidth=5;
  for(let arm=0;arm<4;arm++){ink.rotate(Math.PI/2);ink.beginPath();ink.moveTo(0,0);ink.lineTo(0,-14);ink.lineTo(13,-14);ink.stroke();}ink.restore();
  const insigniaTexture=new T.CanvasTexture(insigniaCanvas);insigniaTexture.colorSpace=T.SRGBColorSpace;
  const insigniaMaterial=new T.MeshStandardMaterial({map:insigniaTexture,transparent:true,alphaTest:.2,roughness:1,side:T.DoubleSide});ownMaterials.push(insigniaMaterial);
  const insignia=new T.Mesh(new T.PlaneGeometry(.085,.043),insigniaMaterial);insignia.position.set(-.085,1.36,-.18);insignia.rotation.y=Math.PI;equipment.add(insignia);
  insignia.userData.ownedTexture=insigniaTexture;

  const capMat=new T.MeshStandardMaterial({color:'#292d30',roughness:1});ownMaterials.push(capMat);const cap=new T.Mesh(new T.SphereGeometry(.12,20,12,0,Math.PI*2,0,Math.PI*.6),capMat);cap.scale.set(1,.65,1.05);headgear.add(cap);const visor=new T.Mesh(new T.SphereGeometry(.12,16,8),capMat);visor.scale.set(1,.045,.7);visor.position.set(0,-.035,-.08);headgear.add(visor);
  part(.01,1.22,-.105,.13,.30,.012,'#292d30').rotation.z=-.16;
  for(const side of [-1,1]){part(side*.05,1.50,-.103,.042,.032,.005,'#ad8694').rotation.z=side*.25;part(side*.05,1.50,-.107,.035,.026,.003,'#25292c');const skullMaterial=new T.MeshStandardMaterial({color:'#bfc0ba',roughness:.7});ownMaterials.push(skullMaterial);const skull=new T.Mesh(new T.SphereGeometry(.009,10,8),skullMaterial);skull.scale.set(1,.85,.3);skull.position.set(side*.05,1.503,-.112);equipment.add(skull);part(side*.05,1.493,-.112,.008,.006,.003,'#bfc0ba');}
 }else if(outfit.headgear==='helmet'){
  const material=new T.MeshStandardMaterial({color:team==='de'?'#454c42':'#5d684b',roughness:.85});ownMaterials.push(material);const helmet=new T.Mesh(new T.SphereGeometry(.17,16,12,0,Math.PI*2,0,Math.PI*.6),material);helmet.position.y=-.025;helmet.scale.set(.75,.55,.9);headgear.add(helmet);
  if(team==='de')void new GLTFLoader().loadAsync('/shooter/models/m40-helmet.glb').then(gltf=>{
    if(isDisposed){gltf.scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});return;}
    helmet.visible=false;gltf.scene.rotation.y=Math.PI;gltf.scene.scale.setScalar(1.1);
    gltf.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])ownMaterials.push(m);}});batchWeaponMeshes(gltf.scene);headgear.add(gltf.scene);
  }).catch(error=>console.warn('Helm konnte nicht geladen werden',error));

 }else{
  const material=new T.MeshStandardMaterial({color:'#303947',roughness:1});ownMaterials.push(material);const beret=new T.Mesh(new T.SphereGeometry(.2,16,10),material);beret.scale.set(1,.28,1);beret.position.set(.025,.025,0);beret.rotation.z=-.16;headgear.add(beret);
  const hornMaterial=new T.MeshStandardMaterial({color:'#b6ae80',metalness:.55,roughness:.6});ownMaterials.push(hornMaterial);
  const horn=new T.Mesh(new T.TorusGeometry(.018,.003,8,24,Math.PI*1.6),hornMaterial);horn.position.set(.08,.008,-.165);horn.rotation.z=.3;headgear.add(horn);
  const bell=new T.Mesh(new T.ConeGeometry(.008,.018,12,1,true),hornMaterial);bell.position.set(.099,.012,-.166);bell.rotation.z=-.9;headgear.add(bell);

 }
 part(0,.94,0,.34,.035,.24,'#4a3e2b');part(.085,1.15,-.135,.105,.13,.014,outfit.color);part(-.085,1.15,-.135,.105,.13,.014,outfit.color);

 const webColor=team==='de'?'#39342c':'#9b9576';
 function strap(points:T.Vector3[],radius:number,color:string){const mesh=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),20,radius,6,false),detailMaterial(color,.95));mesh.castShadow=true;equipment.add(mesh);}
 for(const side of [-1,1]){
   strap([new T.Vector3(side*.12,.97,-.17),new T.Vector3(side*.13,1.2,-.19),new T.Vector3(side*.15,1.43,-.07),new T.Vector3(side*.14,1.41,.12),new T.Vector3(side*.1,.98,.16)],.012,webColor);
   for(let n=0;n<3;n++){part(side*(.07+n*.043),.99,-.173,.038,.075,.04,team==='de'?'#453b2d':'#8c8566');part(side*(.07+n*.043),1.032,-.182,.04,.012,.045,webColor);}
 }
 part(.18,1.02,.14,.13,.17,.055,webColor);part(.18,1.11,.145,.14,.025,.06,webColor);
 if(team==='fr'&&map==='alpine'){
   for(const side of [-1,1]){const patch=part(side*.055,1.49,-.11,.035,.03,.007,'#23334b');patch.rotation.z=side*.2;part(side*.055,1.49,-.115,.018,.003,.003,'#b9a35c');}
 }
 if(uniformId==='de-field')for(const side of [-1,1]){part(side*.055,1.49,-.11,.035,.03,.007,'#353c34');for(const dx of [-.007,.007])part(side*.055+dx,1.49,-.116,.003,.022,.002,'#a4aaa0');}
 const collar=new T.Mesh(new T.CylinderGeometry(.086,.095,.07,32,1,true),uniform);collar.position.set(0,1.51,-.018);equipment.add(collar);
 const jacketColor=outfit.color;
 for(const side of [-1,1]){
  part(side*.085,1.205,-.15,.11,.025,.012,jacketColor);
  part(side*.085,1.19,-.16,.009,.009,.007,'#656651');
  part(side*.14,1.43,-.025,.05,.006,.08,jacketColor);
  part(side*.139,1.436,-.045,.012,.007,.012,'#77786b');
  for(let row=0;row<8;row++)part(side*.138,1.09+row*.014,-.148,.002,.006,.002,'#686b5e');
 }
 part(0,.94,-.13,.055,.038,.015,'#888a79');part(0,.94,-.14,.038,.023,.005,'#3b4038');
 // Eyeballs sit in the anatomical sockets, rather than painting a face on a primitive.
 for(const side of ['L','R']){const j=data.bones.find(j=>j.name===`eye.${side}`);if(!j)continue;const material=new T.MeshStandardMaterial({color:'#a5a399',roughness:.48});ownMaterials.push(material);const eye=new T.Mesh(new T.SphereGeometry(.0105,10,8),material);eye.position.set(j.head[0]-headOrigin[0],j.head[1]-headOrigin[1],j.head[2]-headOrigin[2]);headBone.add(eye);for(const [radius,color,depth] of [[.005,'#54432c',-.009],[.0023,'#101010',-.012]] as const){const m=new T.MeshStandardMaterial({color,roughness:.35});ownMaterials.push(m);const detail=new T.Mesh(new T.SphereGeometry(radius,12,8),m);detail.position.z=depth;eye.add(detail);}}
 for(const side of ['L','R']){
  if(data.coat)continue;
  const foot=named.get(`foot.${side}`),joint=data.bones.find(j=>j.name===`foot.${side}`);if(!foot||!joint)continue;
  const boot=new T.Group();boot.position.set(joint.head[0]-joint.head[0],-joint.head[1],.035-joint.head[2]);foot.add(boot);
  const leather=new T.MeshStandardMaterial({color:'#292a26',roughness:.75});ownMaterials.push(leather);
  const shape=new T.Shape();shape.moveTo(-.065,-.025);shape.lineTo(.065,-.025);shape.lineTo(.07,.18);shape.quadraticCurveTo(.065,.27,0,.275);shape.quadraticCurveTo(-.065,.27,-.07,.18);shape.closePath();
  const shoeGeometry=new T.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:true,bevelThickness:.005,bevelSize:.005,bevelSegments:3});shoeGeometry.rotateX(-Math.PI/2);shoeGeometry.translate(0,.006,0);const shoe=new T.Mesh(shoeGeometry,leather);shoe.castShadow=true;boot.add(shoe);const upper=new T.Mesh(new T.SphereGeometry(1,16,12),leather);upper.scale.set(.068,.052,.15);upper.position.set(0,.062,-.105);boot.add(upper);
  const shaft=new T.Mesh(new T.CylinderGeometry(.06,.063,.16,16),leather);shaft.position.set(0,.14,-.025);shaft.castShadow=true;boot.add(shaft);
  for(let i=0;i<4;i++){const lace=part(0,.095+i*.012,-.08-i*.018,.08,.006,.007,'#41413b',boot);lace.rotation.z=i%2?.12:-.12;}
  batchWeaponMeshes(boot);
 }
 // Rifle grip is kept in the same local pose as the articulated forearms.
 part(.14,1.18,-.42,.045,.055,.6,'#5c4732');part(.14,1.215,-.7,.022,.025,.35,'#414744');
 // Each branch is rigid in its own bone space. Never merge across animated bones.
 batchWeaponMeshes(equipment);batchWeaponMeshes(headgear);
 let previous=new T.Vector3(),speed=0;
 function update(player:Player,time:number,dt:number){
  const displacement=previous.distanceTo(new T.Vector3(player.x,player.y,player.z));speed=T.MathUtils.lerp(speed,Math.min(1,displacement/Math.max(.001,dt)/4),.25);previous.set(player.x,player.y,player.z);
  const phase=time*.009,walk=Math.sin(phase)*.48*speed;
  for(const side of ['L','R']){const sign=side==='L'?1:-1;const upper=named.get(`upperleg01.${side}`);if(upper)upper.rotation.x=walk*sign;const knee=named.get(`lowerleg01.${side}`);if(knee)knee.rotation.x=Math.max(0,-walk*sign)*.8;
   const shoulder=named.get(`upperarm01.${side}`);if(shoulder){shoulder.rotation.y=-sign*.95;shoulder.rotation.z=sign*.22;}
   const elbow=named.get(`lowerarm01.${side}`);if(elbow)elbow.rotation.x=.55;
  }
  headBone.rotation.x=-player.pitch*.35;
  for(const [name,bone]of named)if(name.startsWith('finger')&&!name.startsWith('finger1-1'))bone.rotation.z=(name.endsWith('.L')?1:-1)*.38;
 }
 function dispose(){if(isDisposed)return;isDisposed=true;for(const garment of coatMeshes)(garment.material as T.Material).dispose();for(const texture of coatTextures)releaseCoatTexture(texture);skin.dispose();skeleton.dispose();ownMaterials.forEach(m=>m.dispose());group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();o.userData.ownedTexture?.dispose();}});group.clear();}
 return {group,update,dispose,setHeadVisible:(visible:boolean)=>{headBone.scale.setScalar(visible?1:.001);}};
}
