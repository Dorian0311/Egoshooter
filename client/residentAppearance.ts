import * as T from 'three';
import {residentProfile,type ResidentLook} from '../shared/residentProfiles';

const looks:Record<ResidentLook,{build:[number,number,number];face:[number,number,number];jacket:string;trousers:string;boots:string}>={
 bruiser:{build:[1.23,1.04,1.17],face:[1.12,.95,1.06],jacket:'#bf6929',trousers:'#263643',boots:'#29241e'},
 veteran:{build:[1.02,.94,1.05],face:[.94,1.03,.99],jacket:'#879254',trousers:'#514433',boots:'#332b25'},
 officer:{build:[.89,1.10,.95],face:[.95,1.08,.97],jacket:'#33668f',trousers:'#233244',boots:'#202126'},
 showman:{build:[1.14,.98,1.13],face:[1.05,.96,1.08],jacket:'#a74576',trousers:'#62304c',boots:'#e2d4b2'},
};

/** Bone-attached caricature details, authored in game metres. No new texture assets. */
export function createResidentAppearance(root:T.Group,body:T.Object3D,id:string){
 const profile=residentProfile(id),look=looks[profile.look],geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
 body.scale.multiply(new T.Vector3(...look.build));
 const head=root.getObjectByName('Bip01_Head');head?.scale.multiply(new T.Vector3(...look.face));root.updateMatrixWorld(true);
 const jacket=new T.Color(look.jacket),trousers=new T.Color(look.trousers),boots=new T.Color(look.boots),h=look.build[1],w=look.build[0];
 function material(color:string,metalness=0){const m=new T.MeshStandardMaterial({color,roughness:metalness?.34:.87,metalness});materials.add(m);return m;}
 const dark=material('#201d1c'),gold=material('#d4a63c',.68),silver=material('#a6aaa5',.5),leather=material('#453226'),cloth=material(look.jacket),paper=material('#eee1ba');
 function mesh(geometry:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,part:'head'|'body'|'armL'|'armR'='head'){
  geometries.add(geometry);const m=new T.Mesh(geometry,mat);m.position.set(x*w,y*h,z);m.castShadow=m.receiveShadow=true;m.userData.bodyPart=part;root.add(m);return m;
 }
 const ball=(mat:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,part:'head'|'body'|'armL'|'armR'='head')=>{const m=mesh(new T.SphereGeometry(1,20,12),mat,x,y,z,part);m.scale.set(sx*w,sy*h,sz);return m;};
 const box=(mat:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,part:'head'|'body'|'armL'|'armR'='body')=>mesh(new T.BoxGeometry(sx*w,sy*h,sz),mat,x,y,z,part);
 function ring(mat:T.Material,x:number,y:number,z:number,radius:number,tube:number,part:'head'|'body'='head'){return mesh(new T.TorusGeometry(radius,tube,8,24),mat,x,y,z,part);}
 function glasses(aviator=false){
  for(const side of [-1,1]){
   ring(aviator?gold:dark,side*.049,1.696,-.123,.038,aviator?.006:.0035);
   if(aviator)ball(material('#171c24',.18),side*.049,1.696,-.124,.034,.027,.009);
   box(aviator?gold:dark,side*.093,1.695,-.057,.006,.006,.13,'head');
  }
  box(aviator?gold:dark,0,1.698,-.124,.028,.004,.006,'head');
 }
 const neckline=new T.Shape();neckline.moveTo(-.065,.11);neckline.lineTo(.065,.11);neckline.lineTo(.032,-.12);neckline.lineTo(-.032,-.12);neckline.closePath();
 const shirt=mesh(new T.ShapeGeometry(neckline),material(profile.look==='showman'?'#e6d6ab':'#c9bda1'),0,1.34,-.153,'body');shirt.rotation.y=Math.PI;shirt.scale.set(w,h,1);
 box(leather,0,.94,-.17,.39,.045,.06);box(gold,0,.94,-.207,.073,.055,.018);
 if(profile.look==='bruiser'){
  const hair=material('#24201e');
  ball(hair,0,1.755,.012,.102,.075,.087).name='resident-pompadour';
  const quiff=ball(hair,0,1.815,-.045,.106,.073,.091);quiff.rotation.x=-.25;
  for(const side of [-1,1]){box(hair,side*.091,1.703,-.008,.016,.075,.052,'head');const brow=box(hair,side*.044,1.721,-.119,.055,.012,.012,'head');brow.rotation.z=side*.12;}
  // Oversized work-jacket shoulders and a conspicuously large belt buckle.
  for(const side of [-1,1])ball(cloth,side*.219,1.425,-.005,.096,.072,.13,side<0?'armL':'armR');
  for(const side of [-1,1])box(dark,side*.102,1.24,-.162,.041,.41,.025).rotation.z=side*.11;
  box(silver,.105,1.325,-.157,.055,.08,.01);box(dark,.105,1.337,-.166,.006,.055,.005);
 }else if(profile.look==='veteran'){
  const grey=material('#b8b1a1'),scarf=material('#d9b862');
  ball(grey,0,1.59,-.084,.08,.056,.063).name='resident-veteran-beard';
  ball(grey,0,1.75,.025,.096,.039,.085);
  glasses();
  const skirt=mesh(new T.CylinderGeometry(.23,.285,.43,24,1,true),cloth,0,.855,.009,'body');skirt.scale.x=w;skirt.scale.z=.65;
  box(scarf,0,1.47,-.075,.26,.12,.16);box(scarf,.071,1.24,-.179,.11,.42,.035);
  for(let i=0;i<3;i++){
   box(material(['#99453e','#416077','#a08440'][i]),-.105+i*.054,1.345,-.163,.033,.067,.013);
   const medal=mesh(new T.CylinderGeometry(.027,.027,.01,16),i===1?silver:gold,-.105+i*.054,1.294,-.172,'body');medal.rotation.x=Math.PI/2;
  }
  box(leather,.255,.91,.015,.18,.24,.13).name='resident-veteran-satchel';
  const strap=box(leather,0,1.24,-.172,.024,.56,.014);strap.rotation.z=-.55;
 }else if(profile.look==='officer'){
  const cap=mesh(new T.CylinderGeometry(.185,.133,.14,32),cloth,0,1.825,.003);cap.name='resident-oversized-cap';cap.rotation.z=.09;
  const visor=ball(dark,0,1.777,-.134,.16,.017,.114);visor.rotation.x=-.08;
  box(gold,0,1.806,-.145,.07,.045,.014,'head');
  for(const side of [-1,1]){box(gold,side*.191,1.442,-.017,.103,.019,.10);box(gold,side*.051,1.38,-.126,.045,.026,.014);}
  for(let i=0;i<4;i++)ball(gold,0,1.115+i*.072,-.15,.009,.009,.006,'body');
  const clipboard=box(leather,.235,1.055,-.133,.23,.34,.027);clipboard.name='resident-clipboard';clipboard.rotation.z=.19;
  const sheet=box(paper,.235,1.067,-.154,.20,.28,.006);sheet.rotation.z=.19;
  for(let i=0;i<5;i++){const line=box(dark,.22,1.15-i*.039,-.162,.12-(i%2)*.035,.005,.003);line.rotation.z=.19;}
  box(silver,.215,1.225,-.164,.075,.023,.013);
 }else{
  const hair=material('#38251c'),trim=material('#d9b559',.35);
  for(let i=0;i<5;i++)ball(hair,(i-2)*.031,1.79+Math.sin(i*.8)*.015,.012,.042,.086,.083).name=i===2?'resident-showman-hair':'';
  glasses(true);
  const necklace=ring(gold,0,1.46,-.075,.105,.012,'body');necklace.rotation.x=.52;necklace.scale.y=1.16;
  const medal=mesh(new T.CylinderGeometry(.047,.047,.018,24),gold,0,1.325,-.169,'body');medal.rotation.x=Math.PI/2;medal.name='resident-gold-medallion';
  for(const side of [-1,1]){const lapel=box(trim,side*.085,1.325,-.155,.055,.34,.019);lapel.rotation.z=side*.23;}
 }
 // Preserve each accessory's world position while parenting it to the native rig.
 const roots={head:'Bip01_Head',body:'Bip01_Spine2',armL:'Bip01_L_UpperArm',armR:'Bip01_R_UpperArm'};
 for(const child of [...root.children])if(child instanceof T.Mesh&&child.userData.bodyPart){root.updateMatrixWorld(true);root.getObjectByName(roots[child.userData.bodyPart as keyof typeof roots])?.attach(child);}
 root.updateMatrixWorld(true);root.userData.residentLook=profile.look;root.userData.nameplateHeight=new T.Box3().setFromObject(root).max.y+.20;
 return {jacket,trousers,boots,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
