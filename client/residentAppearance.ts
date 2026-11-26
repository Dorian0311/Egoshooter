import * as T from 'three';
import {residentProfile,type ResidentLook} from '../shared/residentProfiles';

const looks:Record<ResidentLook,{build:[number,number,number];face:[number,number,number];jacket:string;trousers:string;boots:string}>={
 bruiser:{build:[1.23,1.04,1.17],face:[1.12,.95,1.06],jacket:'#bf6929',trousers:'#263643',boots:'#29241e'},
 veteran:{build:[1.02,.94,1.05],face:[.94,1.03,.99],jacket:'#717960',trousers:'#514433',boots:'#332b25'},
 officer:{build:[.89,1.10,.95],face:[.95,1.08,.97],jacket:'#445d70',trousers:'#233244',boots:'#202126'},
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
  if(!aviator){
   for(const side of [-1,1]){
    const rim=ring(dark,side*.032/w,1.554/h,-.100,.026,.0021);
    rim.name='resident-veteran-spectacle';rim.scale.y=.88;rim.rotation.y=-side*.37;
    const temple=box(dark,side*.067/w,1.553/h,-.031,.0038,.004,.118,'head');
    temple.rotation.y=side*.15;
   }
   box(dark,0,1.557/h,-.110,.020,.0035,.004,'head');
   return;
  }
  for(const side of [-1,1]){
   ring(gold,side*.049,1.696,-.123,.038,.006);
   ball(material('#171c24',.18),side*.049,1.696,-.124,.034,.027,.009);
   box(gold,side*.093,1.695,-.057,.006,.006,.13,'head');
  }
  box(gold,0,1.698,-.124,.028,.004,.006,'head');
 }
 if(profile.look==='officer'){
  // Shape the visible shirt into the jacket opening, with folded collar tips
  // and a narrow tied front. All pieces share one coloured garment draw.
  const positions:number[]=[],colors:number[]=[];
  type Point=[number,number,number];
  function panel(color:string,a:Point,b:Point,c:Point){
   const tint=new T.Color(color);
   for(const p of [a,b,c]){positions.push(...p);colors.push(tint.r,tint.g,tint.b);}
  }
  const topL:Point=[-.071,.092,.008],topR:Point=[.071,.092,.008],bottom:Point=[0,-.104,-.006];
  panel('#c4bfae',topL,topR,bottom);
  panel('#303944',[0,.061,-.010],[.017,.043,-.011],[0,.018,-.016]);
  panel('#46505b',[0,.061,-.010],[0,.018,-.016],[-.016,.043,-.011]);
  panel('#39424b',[0,.025,-.014],[.018,-.055,-.013],[0,-.092,-.011]);
  panel('#46505b',[0,.025,-.014],[0,-.092,-.011],[-.018,-.055,-.013]);
  panel('#ded9c9',topL,[0,.065,-.013],[-.032,.019,-.014]);
  panel('#cfcab9',[0,.065,-.013],topR,[.031,.019,-.014]);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const textile=material('#ffffff');textile.vertexColors=true;textile.roughness=.96;
  const shirt=mesh(geometry,textile,0,1.365,-.153,'body');shirt.name='resident-officer-shirt-and-tie';shirt.scale.set(w,h,1);
 }else{
  const neckline=new T.Shape();neckline.moveTo(-.065,.11);neckline.lineTo(.065,.11);neckline.lineTo(.032,-.12);neckline.lineTo(-.032,-.12);neckline.closePath();
  const shirt=mesh(new T.ShapeGeometry(neckline),material(profile.look==='showman'?'#e6d6ab':'#c9bda1'),0,1.34,-.153,'body');shirt.rotation.y=Math.PI;shirt.scale.set(w,h,1);
 }
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
  const scarf=material('#d9b862');
  // Bind-pose depths in millimetres sampled from the veteran's chin and cheek.
  // Each column runs from below the jaw to the short hairline beneath the lips.
  const skinDepth=[
   [-65,-98,-105,-104,-103],[-69,-98,-104,-103,-103],[-87,-97,-99,-98,-100],
   [-86,-93,-92,-93,-93],[-78,-83,-87,-90,-90],[-77,-81,-84,-86,-87],
   [-69,-72,-74,-77,-80],[-55,-59,-63,-68,-73],[-45,-48,-49,-50,-52],
  ];
  const beardPosition:number[]=[],beardColor:number[]=[],beardIndex:number[]=[];
  for(let col=-8;col<=8;col++){
   const u=Math.abs(col)/8,lower=1.443+.072*u**1.45,upper=1.481+.054*u**1.65;
   for(let row=0;row<5;row++){
    const fraction=row/4,thickness=.0032+.007*Math.sin(fraction*Math.PI)*(1-u*.65);
    beardPosition.push(.066*col/8,lower+(upper-lower)*fraction-1.495,skinDepth[Math.abs(col)][row]/1000-thickness+.085);
    const shade=.78+.18*Math.cos(col*2.3+row*.75)-.16*fraction;
    beardColor.push(shade,shade,shade);
    if(col<8&&row<4){
     const a=(col+8)*5+row;beardIndex.push(a,a+1,a+6,a,a+6,a+5);
    }
   }
  }
  const beard=new T.BufferGeometry();beard.setAttribute('position',new T.Float32BufferAttribute(beardPosition,3));
  beard.setAttribute('color',new T.Float32BufferAttribute(beardColor,3));beard.setIndex(beardIndex);beard.computeVertexNormals();
  const whiskers=material('#8c8579');whiskers.vertexColors=true;whiskers.roughness=1;
  mesh(beard,whiskers,0,1.495/h,-.085).name='resident-veteran-beard';
  glasses();
  const skirt=mesh(new T.CylinderGeometry(.23,.285,.43,24,1,true),cloth,0,.855,.009,'body');skirt.scale.x=w;skirt.scale.z=.65;
  // A diagonal wrap catches the light along its rolled edge. Its tucked end
  // drapes over the chest with a central fold and a slanted hem.
  const scarfPositions:number[]=[],scarfColors:number[]=[],scarfIndices:number[]=[];
  function scarfVertex(x:number,y:number,z:number,shade:number){
   scarfPositions.push(x*w,y*h,z);scarfColors.push(shade,shade,shade);
  }
  const bands=[[.121,.094,1.416,.66],[.132,.101,1.448,.95],[.135,.104,1.473,.78],[.125,.096,1.504,1.03]];
  for(let s=0;s<20;s++){
   const angle=s*Math.PI/10,side=Math.sin(angle),front=Math.cos(angle);
   for(const [rx,rz,y,shade] of bands)scarfVertex(side*rx,y+.021*side,-.026-front*rz,shade);
   for(let row=0;row<bands.length-1;row++){
    const a=s*bands.length+row,b=((s+1)%20)*bands.length+row;
    scarfIndices.push(a,a+1,b+1,a,b+1,b);
   }
  }
  const tail=scarfPositions.length/3;
  const folds=[[.048,1.456,-.115,.055],[.074,1.408,-.151,.049],[.064,1.305,-.174,.049],[.085,1.17,-.166,.041],[.075,1.045,-.180,.047]];
  for(const [row,[x,y,z,width]] of folds.entries()){
   scarfVertex(x-width,y,z,.72);scarfVertex(x,y-.006,z-.010,1.05);
   scarfVertex(x+width,y-(row===folds.length-1?.029:0),z+.002,.86);
   if(row)for(let col=0;col<2;col++){
    const a=tail+(row-1)*3+col;
    scarfIndices.push(a,a+1,a+3,a+1,a+4,a+3);
   }
  }
  const drape=new T.BufferGeometry();drape.setAttribute('position',new T.Float32BufferAttribute(scarfPositions,3));
  drape.setAttribute('color',new T.Float32BufferAttribute(scarfColors,3));drape.setIndex(scarfIndices);drape.computeVertexNormals();
  scarf.vertexColors=true;scarf.roughness=.96;
  mesh(drape,scarf,0,0,0,'body').name='resident-veteran-scarf';
  for(let i=0;i<3;i++){
   box(material(['#99453e','#416077','#a08440'][i]),-.105+i*.054,1.345,-.163,.033,.067,.013);
   const medal=mesh(new T.CylinderGeometry(.027,.027,.01,16),i===1?silver:gold,-.105+i*.054,1.294,-.172,'body');medal.rotation.x=Math.PI/2;
  }
  box(leather,.255,.91,.015,.18,.24,.13).name='resident-veteran-satchel';
  const strap=box(leather,0,1.24,-.172,.024,.56,.014);strap.rotation.z=-.55;
 }else if(profile.look==='officer'){
  // The lower band fits around the temples; the broader cloth crown rolls
  // back above it instead of balancing on top of the scalp.
  const capProfile=[[.123,-.050],[.124,-.016],[.153,.012],[.161,.054],[.147,.077],[.074,.088],[0,.088]];
  const crown=new T.LatheGeometry(capProfile.map(([radius,y])=>new T.Vector2(radius,y)),20);
  const crownColors:number[]=[],ringShade=[.40,.49,.83,.99,1.04,1.02,1];
  for(let n=0;n<crown.attributes.position.count;n++){
   const fold=ringShade[n%capProfile.length];
   crownColors.push(fold,fold,fold);
  }
  crown.setAttribute('color',new T.Float32BufferAttribute(crownColors,3));cloth.vertexColors=true;
  const cap=mesh(crown,cloth,0,1.728,.012);cap.name='resident-oversized-cap';
  cap.scale.set(.88,1,1.08);cap.rotation.set(.09,0,.045);
  const visor=ball(dark,0,1.698,-.111,.116,.012,.090);visor.rotation.x=-.14;
  box(gold,0,1.726,-.137,.037,.025,.008,'head');
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
