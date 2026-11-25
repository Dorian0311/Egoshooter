import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {batchWeaponMeshes} from './batchWeaponMeshes';
import {createCharacterMotion,loadMotionLibrary,type MotionLibrary} from './characterMotion';
import {isBonusId,loadBonusCharacter,createBonusCharacter,type BonusCharacterData} from './bonusCharacters';
import {defaultUniform,uniforms,type UniformId} from '../shared/uniforms.ts';
import * as T from 'three';
import type {Player} from '../shared/game.ts';
import type {MapId} from '../shared/world.ts';
import {createActorEquipment,rigArm} from './actorEquipment';
import {applyActionPose} from './actionPose';
import {createCivilianAppearance,tailorCivilian} from './civilianAppearance';
import {loadCivilianCharacter,createCivilianCharacter,type CivilianCharacterData} from './civilianCharacter';
type Joint={name:string;parent:number;head:number[];tail:number[]};
type CoatPiece={name:string;positions:number[];normal:number[];uv:number[];indices:number[]|null;skinIndex:number[];skinWeight:number[];albedo:string;normalMap:string};
let coatSource:Promise<CoatPiece[]>|null=null;
const coatTextureCache=new Map<string,{texture:T.Texture;refs:number}>();
function acquireCoatTexture(file:string,color:boolean){let entry=coatTextureCache.get(file);if(!entry){const texture=new T.TextureLoader().load('/shooter/characters/greatcoat/'+file);if(color)texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;entry={texture,refs:0};coatTextureCache.set(file,entry);}entry.refs++;return entry.texture;}
function releaseCoatTexture(texture:T.Texture){for(const [file,entry]of coatTextureCache)if(entry.texture===texture){if(--entry.refs===0){texture.dispose();coatTextureCache.delete(file);}break;}}

const surfaceImages=new Map<string,Promise<HTMLImageElement>>();
const surfaceTextures=new WeakMap<HTMLImageElement,{texture:T.Texture;users:number}>();
function surfaceImage(file:string){
 let pending=surfaceImages.get(file);
 if(!pending){
  pending=new T.ImageLoader().loadAsync('/shooter/characters/'+file).catch(error=>{surfaceImages.delete(file);throw error;});
  surfaceImages.set(file,pending);
 }
 return pending;
}
function acquireSurface(image:HTMLImageElement|undefined){
 if(!image)return undefined;
 let entry=surfaceTextures.get(image);
 if(!entry){
  const texture=new T.Texture(image);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;texture.needsUpdate=true;
  entry={texture,users:0};surfaceTextures.set(image,entry);
 }
 entry.users++;
 return entry.texture;
}
function releaseSurface(image:HTMLImageElement|undefined){
 if(!image)return;
 const entry=surfaceTextures.get(image);
 if(entry&&--entry.users===0){entry.texture.dispose();surfaceTextures.delete(image);}
}

type HumanData={coat?:CoatPiece[];positions:number[];uv:number[];indices:number[];skinIndex:number[];skinWeight:number[];categories:number[];bones:Joint[];skinImage?:HTMLImageElement;clothImage?:HTMLImageElement;motion?:MotionLibrary};
const fieldFit=new WeakMap<number[],number[]>();
function fitFieldUniform(data:HumanData){
 const existing=fieldFit.get(data.positions);
 if(existing)return existing;
 const fitted=data.positions.slice();
 const joints=new Map(data.bones.map(b=>[b.name,new T.Vector3(...b.head as [number,number,number])]));
 const limbs=['R','L'].map(side=>{
  function line(a:string,b:string){return new T.Line3(joints.get(a+'.'+side)!,joints.get(b+'.'+side)!);}
  return {arms:[line('upperarm01','lowerarm01'),line('lowerarm01','wrist')],
   legs:[line('upperleg01','lowerleg01'),line('lowerleg01','foot')]};
 });
 const point=new T.Vector3(),centre=new T.Vector3(),other=new T.Vector3();
 for(let i=0;i<data.categories.length;i++){
  if(data.categories[i]!==0)continue;
  point.fromArray(data.positions,i*3);
  const {x,y,z}=point,ax=Math.abs(x);
  const side=limbs[x<0?1:0],sleeve=y>1.03&&ax>.19,trousers=y>.215&&y<.93;
  if(sleeve||trousers){
   const [upper,lower]=sleeve?side.arms:side.legs;
   upper.closestPointToPoint(point,true,centre);lower.closestPointToPoint(point,true,other);
   if(other.distanceToSquared(point)<centre.distanceToSquared(point))centre.copy(other);
   const foldZone=sleeve?Math.exp(-Math.pow((ax-.36)/.074,2)):Math.exp(-Math.pow((y-.50)/.11,2));
   const fade=sleeve?T.MathUtils.smoothstep(ax,.19,.27)*(1-T.MathUtils.smoothstep(ax,.43,.49)):
    T.MathUtils.smoothstep(y,.215,.30)*(1-T.MathUtils.smoothstep(y,.80,.93));
   const padding=(sleeve?.013:.019)+foldZone*(.004+.006*Math.sin(y*123+z*20+Math.sin(x*21)*1.6));
   point.addScaledVector(other.subVectors(point,centre).normalize(),padding*fade);
  }else if(y>.88&&y<1.43&&ax<.23){
   const ease=Math.sin((y-.88)/.55*Math.PI);
   point.x*=1+.075*ease;point.z*=1+.12*ease;
  }
  point.toArray(fitted,i*3);
 }
 fieldFit.set(data.positions,fitted);return fitted;
}
let source:Promise<HumanData>|null=null;
function loadBaseHuman(){return source??=fetch('/shooter/characters/humanoid.json').then(r=>{if(!r.ok)throw Error('Human model unavailable');return r.json() as Promise<HumanData>;}).then(async data=>{data.motion=await loadMotionLibrary();return data;}).catch(e=>{source=null;throw e;});}
export async function loadHuman(uniformId?:UniformId,civilian=false){
 if(civilian)return loadCivilianCharacter();
 if(uniformId&&isBonusId(uniformId))return loadBonusCharacter(uniformId);
 const island=uniformId==='task-olive'||uniformId==='task-sand';
 const [base,skinImage,cloth]=await Promise.all([
  loadBaseHuman(),
  island?surfaceImage(uniformId+'-skin.webp').catch(()=>surfaceImage('skin.png')):surfaceImage('skin.png'),
  uniformId==='de-greatcoat'?undefined:surfaceImage(island?'island-cloth.webp':'field-cloth.webp').catch(()=>undefined),
 ]);
 const data={...base,skinImage};
 if(uniformId!=='de-greatcoat')return {...data,clothImage:cloth};
 coatSource??=fetch('/shooter/characters/greatcoat/rigged.json').then(r=>{if(!r.ok)throw Error('Mantelmodell konnte nicht geladen werden');return r.json() as Promise<CoatPiece[]>;}).catch(e=>{coatSource=null;throw e;});
 return {...data,coat:await coatSource};
}
export function createHuman(data:HumanData|BonusCharacterData|CivilianCharacterData,team:'de'|'fr',map:MapId,uniform:T.MeshStandardMaterial,uniformId:UniformId=defaultUniform(team,map),civilian=false,residentId?:string,purpose:'actor'|'remains'='actor'){
 if('civilian' in data)return createCivilianCharacter(data,residentId,purpose);
 if('character' in data)return createBonusCharacter(data,purpose);
 const civilianLook=civilian?createCivilianAppearance():undefined;uniform=civilianLook?.cloth??uniform.clone();const outfit=uniforms[uniformId];if(!civilian)uniform.color.set(outfit.color);
 let isDisposed=false;
 const group=new T.Group(),geometry=new T.BufferGeometry();
 const tailored=civilian?data.positions.slice():fitFieldUniform(data);
 if(civilian)tailorCivilian(tailored,data.categories,data.bones);
 geometry.setAttribute('position',new T.Float32BufferAttribute(tailored,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(data.skinIndex,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(data.skinWeight,4));
 const {skinImage,clothImage:garmentImage}=data;
 const skin=acquireSurface(skinImage);
 const cloth=!civilian?acquireSurface(garmentImage):undefined;
 if(cloth){uniform.map=cloth;uniform.roughness=.94;}
 const materials=[uniform,new T.MeshStandardMaterial({color:'#ffffff',map:skin??null,roughness:.82,envMapIntensity:.35}),civilianLook?.boots??new T.MeshStandardMaterial({color:'#272723',roughness:.85}),...(civilianLook?[civilianLook.cloth]:[])];
 const ordered:number[][]=civilian?[[],[],[],[]]:[[],[],[]];for(let i=0;i<data.indices.length;i+=3){if(data.coat&&!data.indices.slice(i,i+3).every(v=>data.positions[v*3+1]>1.40&&(data.positions[v*3+1]>1.62||Math.abs(data.positions[v*3])<.085)))continue;const tri=data.indices.slice(i,i+3),labels=tri.map(v=>data.categories[v]);let category=data.coat?1:labels.filter(v=>v===1).length>=2?1:labels.filter(v=>v===2).length>=2?2:0;if(civilian&&category===2&&tri.every(v=>data.positions[v*3+1]<.09))continue;if(civilian&&category===0&&tri.reduce((sum,v)=>sum+data.positions[v*3+1],0)/3<.965)category=3;ordered[category].push(...tri);}
 if(!civilian)ordered[2]=[];geometry.setIndex(ordered.flat());let start=0;ordered.forEach((indices,index)=>{geometry.addGroup(start,indices.length,index);start+=indices.length;});geometry.computeVertexNormals();civilianLook?.tintGeometry(geometry);
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
 const ownMaterials:T.Material[]=[uniform,materials[1],materials[2],...(civilianLook?civilianLook.materials.filter(m=>m!==uniform&&m!==materials[2]):[])];
 const detailMaterials=new Map<string,T.MeshStandardMaterial>();
 function detailMaterial(color:string,roughness=.85){const key=`${color}:${roughness}`;let material=detailMaterials.get(key);if(!material){material=new T.MeshStandardMaterial({color,roughness});detailMaterials.set(key,material);ownMaterials.push(material);}return material;}
 // Only our plain, untextured detail materials enter this palette. Their linear
 // RGB moves to vertices, allowing identical surface finishes to share a draw.
 const finishes=new Map<number,T.MeshStandardMaterial>();
 function batchDetails(branch:T.Group){
  const tints=new Set(detailMaterials.values());
  branch.traverse(object=>{
   if(!(object instanceof T.Mesh)||!tints.has(object.material))return;
   const original=object.material as T.MeshStandardMaterial;
   let finish=finishes.get(original.roughness);
   if(!finish){finish=new T.MeshStandardMaterial({vertexColors:true,roughness:original.roughness});finishes.set(original.roughness,finish);ownMaterials.push(finish);}
   const count=object.geometry.getAttribute('position').count,colors=new Float32Array(count*3);
   for(let i=0;i<count;i++)original.color.toArray(colors,i*3);
   object.geometry.setAttribute('color',new T.BufferAttribute(colors,3));object.material=finish;
  });
  batchWeaponMeshes(branch);
 }
 const equipment=new T.Group();group.add(equipment);if(data.coat||civilian){equipment.visible=false;equipment.userData.nonAnatomic=true;}
 function part(x:number,y:number,z:number,w:number,h:number,d:number,color:string,parent:T.Object3D=equipment){const m=new T.Mesh(new T.BoxGeometry(w,h,d),detailMaterial(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
 const headBone=named.get('head')!;const headOrigin=data.bones.find(j=>j.name==='head')!.head;
 const islandKit=!civilian&&uniformId.startsWith('task-');
 const headgear=new T.Group();headgear.position.set(0,1.72-headOrigin[1],data.bones.find(j=>j.name==='head')!.tail[2]-headOrigin[2]);headBone.add(headgear);
 if(!civilian&&uniformId==='de-panzer'){
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
 }else if(!civilian&&outfit.headgear==='helmet'){
  const helmetColor=team==='de'?'#454c42':'#5d684b';
  const material=islandKit?detailMaterial(helmetColor):new T.MeshStandardMaterial({color:helmetColor,roughness:.85});
  if(!islandKit)ownMaterials.push(material);const helmet=new T.Mesh(new T.SphereGeometry(.17,16,islandKit?9:12,0,Math.PI*2,0,Math.PI*.6),material);helmet.castShadow=islandKit;helmet.position.y=-.025;helmet.scale.set(.75,.55,.9);headgear.add(helmet);
  if(team==='de'&&!uniformId.startsWith('task-'))void new GLTFLoader().loadAsync('/shooter/models/m40-helmet.glb').then(gltf=>{
    if(isDisposed){gltf.scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});return;}
    helmet.visible=false;gltf.scene.rotation.y=Math.PI;gltf.scene.scale.setScalar(1.1);
    gltf.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])ownMaterials.push(m);}});batchWeaponMeshes(gltf.scene);headgear.add(gltf.scene);
  }).catch(error=>console.warn('Helm konnte nicht geladen werden',error));

 }else if(!civilian){
  const material=new T.MeshStandardMaterial({color:'#303947',roughness:1});ownMaterials.push(material);const beret=new T.Mesh(new T.SphereGeometry(.2,16,10),material);beret.scale.set(1,.28,1);beret.position.set(.025,.025,0);beret.rotation.z=-.16;headgear.add(beret);
  const hornMaterial=new T.MeshStandardMaterial({color:'#b6ae80',metalness:.55,roughness:.6});ownMaterials.push(hornMaterial);
  const horn=new T.Mesh(new T.TorusGeometry(.018,.003,8,24,Math.PI*1.6),hornMaterial);horn.position.set(.08,.008,-.165);horn.rotation.z=.3;headgear.add(horn);
  const bell=new T.Mesh(new T.ConeGeometry(.008,.018,12,1,true),hornMaterial);bell.position.set(.099,.012,-.166);bell.rotation.z=-.9;headgear.add(bell);

 }
 if(!civilian){
 part(0,.94,0,.34,.035,.24,'#4a3e2b');part(.085,1.15,-.135,.105,.13,.014,outfit.color);part(-.085,1.15,-.135,.105,.13,.014,outfit.color);
 if(islandKit){
  const vest=uniformId==='task-olive'?'#39473b':'#706c53';
  // A bevelled plate carrier narrows at the clavicles and flares around the ribs.
  const carrier=new T.Shape();carrier.moveTo(-.15,-.12);carrier.lineTo(-.144,.055);carrier.lineTo(-.098,.15);
  carrier.lineTo(-.056,.164);carrier.quadraticCurveTo(0,.132,.056,.164);carrier.lineTo(.098,.15);
  carrier.lineTo(.144,.055);carrier.lineTo(.15,-.12);carrier.quadraticCurveTo(0,-.163,-.15,-.12);
  const shell=new T.ExtrudeGeometry(carrier,{depth:.042,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:1,curveSegments:4});
  for(const z of [-.192,.113]){
   const plate=new T.Mesh(shell.clone(),detailMaterial(vest));plate.position.set(0,1.235,z);plate.castShadow=true;equipment.add(plate);
  }
  shell.dispose();
  const binding=uniformId==='task-olive'?'#575c46':'#81775d';
  const web=uniformId==='task-olive'?'#454d38':'#665e48';
  const buckle='#333731';
  // Rounded fabric volumes catch light across the flanks of the pack and pouches.
  function padded(x:number,y:number,z:number,w:number,h:number,d:number,color:string){
   const mesh=new T.Mesh(new T.SphereGeometry(1,8,4),detailMaterial(color));
   mesh.position.set(x,y,z);mesh.scale.set(w/2,h/2,d/2);mesh.castShadow=true;equipment.add(mesh);return mesh;
  }
  for(let n=-1;n<=1;n++){
   part(n*.09,1.12,-.218,.079,.138,.051,web).rotation.z=-n*.045;
   padded(n*.09,1.17,-.24,.086,.068,.031,binding);
   part(n*.09,1.15,-.252,.018,.039,.006,buckle);
  }
  for(let row=0;row<3;row++)part(0,1.235+row*.034,-.202,.242,.012,.009,binding);
  // A short daypack sits above the belt. Its compression straps arc over the shell.
  padded(0,1.24,.171,.30,.36,.186,vest);
  padded(0,1.19,.234,.222,.168,.082,web);
  for(const side of [-1,1]){
   part(side*.074,1.216,.254,.026,.228,.012,binding).rotation.x=-.12;
   part(side*.074,1.197,.269,.032,.028,.009,buckle);
   const strap=part(side*.117,1.409,.003,.052,.019,.236,binding);strap.rotation.z=side*.17;
   part(side*.127,1.351,-.127,.044,.146,.026,web).rotation.x=.40;
   padded(side*.163,1.004,.028,.088,.126,.135,web);
   part(side*.197,1.021,.026,.019,.027,.097,binding);
  }
  part(.18,1.31,-.14,.06,.14,.05,'#26332d');part(.18,1.44,-.14,.009,.15,.009,'#1c2325');
  const rubber=detailMaterial('#34372f'),lens=detailMaterial('#47534c',.26);
  for(const side of [-1,1]){
   const socket=new T.Mesh(new T.SphereGeometry(1,12,8),rubber);socket.scale.set(.057,.033,.019);
   socket.position.set(side*.049,-.026,-.122);socket.rotation.y=-side*.28;headgear.add(socket);
   const glass=new T.Mesh(new T.SphereGeometry(1,12,8),lens);glass.scale.set(.048,.024,.012);
   glass.position.set(side*.048,-.026,-.134);glass.rotation.y=socket.rotation.y;headgear.add(glass);
   part(side*.113,-.025,-.032,.012,.021,.14,'#34372f',headgear).rotation.y=-side*.18;
  }
  part(0,-.022,-.135,.033,.013,.012,'#34372f',headgear);
 }

 const webColor=team==='de'?'#39342c':'#9b9576';
 // Flat leather or web braces follow the chest, shoulder and back in one strip.
 function brace(side:number){
  const width=team==='de'?.028:.042;
  const points=[[.114,.967,-.181],[.132,1.19,-.175],[.145,1.37,-.12],[.139,1.447,-.037],[.134,1.432,.086],[.122,1.33,.143],[.08,.978,.154]];
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let i=0;i<points.length;i++){
   const [x,y,z]=points[i],front=i<3?-1:i>3?1:0;
   for(const edge of [-1,0,1]){
    positions.push(side*x+edge*width*.5,y+(i===3&&edge===0?.003:0),z+(edge===0?front*.003:0));
    uv.push((edge+1)*.5,i/(points.length-1));
   }
   if(i>0){const n=i*3;for(const offset of [0,1])indices.push(n-3+offset,n+offset,n-2+offset,n-2+offset,n+offset,n+1+offset);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const mesh=new T.Mesh(g,detailMaterial(webColor));mesh.castShadow=true;equipment.add(mesh);
  const keeper=part(side*.133,1.29,-.152,width+.007,.014,.01,'#55554b');keeper.rotation.x=.32;
 }
 for(const side of [-1,1]){
   if(!islandKit)brace(side);
   for(let n=0;n<3;n++){part(side*(.07+n*.043),.99,-.173,.038,.075,.04,team==='de'?'#453b2d':'#8c8566');part(side*(.07+n*.043),1.032,-.182,.04,.012,.045,webColor);}
 }
 if(islandKit){
  part(.18,1.02,.14,.13,.17,.055,webColor);part(.18,1.11,.145,.14,.025,.06,webColor);
 }else if(!data.coat){
  const alpine=uniformId==='fr-alpine',crew=uniformId==='de-panzer';
  const canvas=team==='de'?'#666650':alpine?'#48514c':'#78775d';
  // A crewman's compact belt case and a field haversack have different profiles.
  const bag=new T.Mesh(new T.SphereGeometry(1,8,5),detailMaterial(canvas));
  bag.scale.set(crew?.065:.111,crew?.079:.118,crew?.042:.062);
  bag.position.set(.14,1.005,.133);bag.rotation.z=-.19;bag.castShadow=true;equipment.add(bag);
  part(.145,1.045,.172,crew?.09:.16,.040,.024,webColor).rotation.z=-.19;
  part(.154,1.009,.184,.021,.067,.013,'#544d3e').rotation.z=-.19;
  if(alpine){
   const roll=new T.Mesh(new T.CylinderGeometry(.059,.061,.294,10),detailMaterial('#606257'));
   roll.position.set(0,1.17,.188);roll.rotation.z=Math.PI/2;roll.castShadow=true;equipment.add(roll);
   for(const x of [-.086,.086]){
    const binding=new T.Mesh(new T.CylinderGeometry(.063,.063,.025,10,1,true),detailMaterial(webColor));
    binding.rotation.z=Math.PI/2;binding.position.set(x,1.17,.188);binding.castShadow=true;equipment.add(binding);
   }
  }
 }
 if(team==='fr'&&map==='alpine'){
   for(const side of [-1,1]){const patch=part(side*.055,1.49,-.11,.035,.03,.007,'#23334b');patch.rotation.z=side*.2;part(side*.055,1.49,-.115,.018,.003,.003,'#b9a35c');}
 }
 if(uniformId==='de-field')for(const side of [-1,1]){part(side*.055,1.49,-.11,.035,.03,.007,'#353c34');for(const dx of [-.007,.007])part(side*.055+dx,1.49,-.116,.003,.022,.002,'#a4aaa0');}
 const collar=new T.Mesh(new T.CylinderGeometry(.086,.095,.07,32,1,true),uniform);collar.position.set(0,1.51,-.018);equipment.add(collar);
 const jacketColor=outfit.color;
 if(!islandKit)for(const side of [-1,1]){
  part(side*.085,1.205,-.15,.11,.025,.012,jacketColor);
  part(side*.085,1.19,-.16,.009,.009,.007,'#656651');
  part(side*.14,1.43,-.025,.05,.006,.08,jacketColor);
  part(side*.139,1.436,-.045,.012,.007,.012,'#77786b');
  // The lower tunic pockets stand proud of the skirt below the belt.
  if(!data.coat){const pocket=part(side*.105,.884,-.135,.094,.085,.021,jacketColor);pocket.rotation.y=-side*.22;
   const flap=part(side*.105,.916,-.149,.098,.024,.012,jacketColor);flap.rotation.y=pocket.rotation.y;}
 }
 part(0,.94,-.13,.055,.038,.015,'#888a79');part(0,.94,-.14,.038,.023,.005,'#3b4038');
 }
 // Eyeballs sit in the anatomical sockets, rather than painting a face on a primitive.
 const eyes=new T.Group();headBone.add(eyes);
 for(const side of ['L','R']){
  const joint=data.bones.find(j=>j.name===`eye.${side}`);if(!joint)continue;
  const origin=new T.Vector3(joint.head[0]-headOrigin[0],joint.head[1]-headOrigin[1],joint.head[2]-headOrigin[2]);
  for(const [radius,color,depth,segments,roughness] of [[.0105,'#a5a399',0,10,.48],[.005,'#54432c',-.009,12,.35],[.0023,'#101010',-.012,12,.35]] as const){
   const piece=new T.Mesh(new T.SphereGeometry(radius,segments,8),detailMaterial(color,roughness));
   piece.position.copy(origin);piece.position.z+=depth;eyes.add(piece);
  }
 }
 batchDetails(eyes);
 for(const side of ['L','R']){
  if(data.coat||civilian)continue;
  const foot=named.get(`foot.${side}`),joint=data.bones.find(j=>j.name===`foot.${side}`);if(!foot||!joint)continue;
  const boot=new T.Group();boot.position.set(joint.head[0]-joint.head[0],-joint.head[1],.035-joint.head[2]);foot.add(boot);
  const leather=islandKit?detailMaterial('#292a26',.75):new T.MeshStandardMaterial({color:'#292a26',roughness:.75});
  if(!islandKit)ownMaterials.push(leather);
  const shape=new T.Shape();shape.moveTo(-.065,-.025);shape.lineTo(.065,-.025);shape.lineTo(.07,.18);shape.quadraticCurveTo(.065,.27,0,.275);shape.quadraticCurveTo(-.065,.27,-.07,.18);shape.closePath();
  const shoeGeometry=new T.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:true,bevelThickness:.005,bevelSize:.005,bevelSegments:islandKit?1:3,curveSegments:islandKit?5:12});shoeGeometry.rotateX(-Math.PI/2);shoeGeometry.translate(0,.006,0);const shoe=new T.Mesh(shoeGeometry,leather);shoe.castShadow=true;boot.add(shoe);const upper=new T.Mesh(new T.SphereGeometry(1,islandKit?12:16,islandKit?7:12),leather);upper.castShadow=islandKit;upper.scale.set(.068,.052,.15);upper.position.set(0,.062,-.105);boot.add(upper);
  const shaft=new T.Mesh(new T.CylinderGeometry(.06,.063,.16,islandKit?12:16),leather);shaft.position.set(0,.14,-.025);shaft.castShadow=true;boot.add(shaft);
  for(let i=0;i<4;i++){const lace=part(0,.095+i*.012,-.08-i*.018,.08,.006,.007,'#41413b',boot);if(islandKit)lace.material=detailMaterial('#41413b',.75);lace.rotation.z=i%2?.12:-.12;}
  batchDetails(boot);
 }
 if(civilianLook)civilianLook.addDetails(group,named,data.bones,mesh);
 // Held weapons have their own hand targets instead of being baked into the torso.
 // Each branch is rigid in its own bone space. Never merge across animated bones.
 batchDetails(equipment);batchDetails(headgear);
 if(!civilian){group.updateMatrixWorld(true);named.get('spine01')?.attach(equipment);}
 const motion=data.motion&&!civilian?createCharacterMotion(group,named,data.motion,false):undefined;
 group.userData.limbRoots={head:'head',armL:'upperarm01.L',armR:'upperarm01.R',legL:'upperleg01.L',legR:'upperleg01.R'};
 const held=createActorEquipment(group,{armL:rigArm(group,['upperarm01.L','lowerarm01.L','wrist.L']),armR:rigArm(group,['upperarm01.R','lowerarm01.R','wrist.R'])},civilian,false,purpose==='actor');
 group.userData.hasCrouchAnimation=!!motion;
 let previous=new T.Vector3(),speed=0,movementInitialized=!civilian;const rootHeight=named.get('root')?.position.y??0;
 const upperPose=new T.Quaternion(),upperParent=new T.Quaternion(),leanPose=new T.Quaternion(),poseAxis=new T.Vector3(1,0,0);
 function update(player:Player,time:number,dt:number,now=time){
  civilianLook?.style(player.id);
  motion?.update(player,player,dt);
  if(motion&&!civilian){
   // Locomotion drives hips/legs. Keep the armed chest and gaze aligned with aim.
   const chest=named.get('spine01')!;group.getWorldQuaternion(upperPose);
   upperPose.multiply(leanPose.setFromAxisAngle(poseAxis,player.crouching?-.12:player.sprinting?-.09:-.02));
   chest.parent!.getWorldQuaternion(upperParent).invert();chest.quaternion.copy(upperParent.multiply(upperPose));chest.updateWorldMatrix(false,false);
   group.getWorldQuaternion(upperPose);upperPose.multiply(leanPose.setFromAxisAngle(poseAxis,-player.pitch*.35));
   headBone.parent!.getWorldQuaternion(upperParent).invert();headBone.quaternion.copy(upperParent.multiply(upperPose));
  }
  const displacement=movementInitialized?previous.distanceTo(new T.Vector3(player.x,player.y,player.z)):0;movementInitialized=true;speed=T.MathUtils.lerp(speed,Math.min(1,displacement/Math.max(.001,dt)/4),.25);previous.set(player.x,player.y,player.z);
  const phase=time*(civilian?.0065:.009),walk=Math.sin(phase)*(civilian?.32*Math.min(1,speed*5):.48*speed);
  for(const side of ['L','R']){const sign=side==='L'?1:-1;const upper=named.get(`upperleg01.${side}`);if(upper&&!motion)upper.rotation.x=walk*sign;const knee=named.get(`lowerleg01.${side}`);if(knee&&!motion)knee.rotation.x=Math.max(0,-walk*sign)*.8;
   const shoulder=named.get(`upperarm01.${side}`);if(shoulder&&(!civilian||!motion)){shoulder.rotation.y=-sign*.95;shoulder.rotation.z=sign*.22;}
   const elbow=named.get(`lowerarm01.${side}`);if(elbow&&(!civilian||!motion))elbow.rotation.x=.55;
  }
  if(civilian&&!motion){for(const side of ['L','R']){const sign=side==='L'?1:-1,shoulder=named.get(`upperarm01.${side}`),elbow=named.get(`lowerarm01.${side}`);if(shoulder){shoulder.rotation.set(-walk*sign*.55,0,sign*.65);}if(elbow)elbow.rotation.x=.14;} }
  if(civilian&&!motion){const hip=named.get('root');if(hip)hip.position.y=rootHeight-(1-Math.cos(walk))*.88;for(const side of ['L','R']){const foot=named.get(`foot.${side}`);if(foot)foot.rotation.x=-(named.get(`upperleg01.${side}`)?.rotation.x??0)-(named.get(`lowerleg01.${side}`)?.rotation.x??0);}}
  if(!motion||civilian)headBone.rotation.x=-player.pitch*.35;
  for(const [name,bone]of named)if(name.startsWith('finger'))bone.rotation.set(0,0,name.startsWith('finger1-1')?0:(name.endsWith('.L')?1:-1)*.38);
  applyActionPose(group,player,time,now);held.update(player,time,now);
 }
 function dispose(){if(isDisposed)return;isDisposed=true;held.dispose();motion?.dispose();for(const garment of coatMeshes)(garment.material as T.Material).dispose();for(const texture of coatTextures)releaseCoatTexture(texture);releaseSurface(skinImage);if(cloth)releaseSurface(garmentImage);skeleton.dispose();ownMaterials.forEach(m=>m.dispose());group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();o.userData.ownedTexture?.dispose();}});group.clear();}
 return {group,update,dispose,setHeadVisible:(visible:boolean)=>{headBone.scale.setScalar(visible?1:.001);}};
}
