import * as T from 'three';
import {islandShops,shopParts,streetPoles} from '../shared/islandStreet';
import {batchStaticMeshes} from './scenery';

export function addIslandStreet(scene:T.Group){
  const street=new T.Group();street.name='Harbour Road';scene.add(street);
  const palette=new Map<string,T.MeshStandardMaterial>();
  function paint(color:string){
    let value=palette.get(color);
    if(!value){value=new T.MeshStandardMaterial({color,roughness:.94});palette.set(color,value);}
    return value;
  }
  function cuboid(x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material){
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=h>.3;mesh.receiveShadow=true;street.add(mesh);return mesh;
  }
  const loader=new T.TextureLoader(),base='/shooter/island-street/';
  const asphalt=loader.load(base+'asphalt-color.webp'),normal=loader.load(base+'asphalt-normalgl.webp');
  asphalt.colorSpace=T.SRGBColorSpace;
  for(const map of [asphalt,normal]){
    map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(14,2);map.anisotropy=4;
  }
  const pavement=new T.MeshStandardMaterial({map:asphalt,normalMap:normal,roughness:.96,normalScale:new T.Vector2(.5,.5)});
  const road=new T.Mesh(new T.PlaneGeometry(64,9),pavement);
  road.rotation.x=-Math.PI/2;road.position.set(63,.056,-23);road.receiveShadow=true;street.add(road);
  const concrete=paint('#b6ac99'),trim=paint('#e6cf98'),iron=paint('#555c58');
  const paving=loader.load(base+'concrete.webp');
  paving.colorSpace=T.SRGBColorSpace;paving.wrapS=paving.wrapT=T.RepeatWrapping;
  paving.repeat.set(20,1);paving.anisotropy=4;
  const pavingMaterial=new T.MeshStandardMaterial({map:paving,roughness:.98});
  for(const side of [-1,1]){
    const kerb=-23+side*4.62;
    cuboid(63,.071,kerb,64,.142,.24,concrete);
    cuboid(63,.068,kerb+side*1.75,64,.135,3.4,concrete);
    const slabs=new T.Mesh(new T.PlaneGeometry(64,3.4),pavingMaterial);
    slabs.rotation.x=-Math.PI/2;slabs.position.set(63,.139,kerb+side*1.75);
    slabs.receiveShadow=true;street.add(slabs);
    for(let x=32;x<=94;x+=3.5)cuboid(x,.14,kerb+side*1.74,.022,.006,3.6,iron);
  }
  for(let x=33;x<94;x+=6)cuboid(x,.064,-23,2.9,.012,.12,trim);
  const atlas=loader.load(base+'shops.webp');atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=4;
  const facade=new T.MeshStandardMaterial({map:atlas,roughness:.93});
  const prints=loader.load(base+'interior-prints.webp');
  prints.colorSpace=T.SRGBColorSpace;prints.anisotropy=4;
  const printMaterial=new T.MeshStandardMaterial({map:prints,roughness:.9});
  const awnings=['#a64c38','#397071','#ae7e39'];
  islandShops.forEach((s,index)=>{
    const edge=s.z+s.front*s.d/2;
    const tile=paint(['#e1d5ad','#b6a589','#9b7656'][index]);
    const accent=paint(awnings[index]),wood=paint('#865b42'),cream=paint('#e8ddbc');
    const detail=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>
      cuboid(s.x+x,y,s.z+z*s.front,w,h,d,m);
    detail(0,.024,0,s.w-.4,.048,s.d-.4,tile);
    // Tile, plank and checker patterns stay in the same static colour batch.
    if(index===0){
      for(let x=-6;x<6;x++)for(let z=-3;z<3;z++)if((x+z)%2===0)
        detail(x+.5,.051,z+.5,1,.004,1,paint('#657168'));
    }else{
      for(let x=-s.w/2+.7;x<s.w/2-.25;x+=.65)detail(x,.051,0,.012,.004,s.d-.5,wood);
    }
    for(const part of shopParts(s)){
      const {role,x,y,z,w,h,d}=part;
      if(role==='side'||role==='back'||role==='sign'||role==='sill'){
        const wall=cuboid(x,y,z,w,h,d,facade),uv=wall.geometry.getAttribute('uv');
        for(let face=0;face<6;face++)for(let n=0;n<4;n++){
          const i=face*4+n,lettering=role==='sign'&&face===(s.front===1?4:5);
          uv.setXY(i,.001+.998*uv.getX(i),lettering?(3-index+.70+.298*uv.getY(i))/4:(.003+.99*uv.getY(i))/4);
        }
      }else if(role==='rack'){
        for(const end of [-1,1])cuboid(x,y,z+end*(d/2-.05),w,h,.10,iron);
        for(let shelf=0;shelf<4;shelf++){
          const level=.21+shelf*.57;
          cuboid(x,level,z,w,.09,d,wood);
          for(let n=0;n<6;n++){
            const height=.19+((n+shelf)%3)*.075;
            cuboid(x,level+.045+height/2,z+(n-2.5)*.51,w*.68,height,.35,[accent,cream,wood][(shelf+n)%3]);
          }
        }
      }else if(role==='bin'){
        cuboid(x,y,z,w,h,d,wood);
        for(let n=0;n<15;n++){
          const sleeve=cuboid(x,h+.17,z+(n-7)*.23,.68,.45,.035,[accent,iron,cream,wood][n%4]);
          sleeve.rotation.x=-.17;
        }
      }else if(role==='bench'){
        cuboid(x,.23,z,w*.83,.46,d*.92,iron);
        cuboid(x,.55,z,w,.18,d,accent);
        cuboid(x+(x<s.x-3.6?-.24:.24),.81,z,.16,.48,d,accent);
      }else if(role==='table'){
        cuboid(x,.50,z,.18,.96,.25,iron);cuboid(x,1.02,z,w,.12,d,cream);
        for(const end of [-1,1])cuboid(x,1.16,z+end*.51,.12,.16,.12,accent);
      }else{
        cuboid(x,y,z,w,h,d,role==='counter'?wood:iron);
        if(role==='counter'){
          cuboid(x,h+.035,z,w+.06,.07,d+.05,cream);
          cuboid(x+.65,h+.18,z,.38,.26,.31,iron);
        }
      }
    }
    const poster=document.createElement('canvas');poster.width=640;poster.height=320;
    const ctx=poster.getContext('2d')!;
    ctx.fillStyle=['#304b42','#21485a','#583735'][index];ctx.fillRect(0,0,640,320);
    ctx.strokeStyle='#cfaf72';ctx.lineWidth=6;ctx.strokeRect(12,12,616,296);
    ctx.textAlign='center';ctx.fillStyle='#f4e6bc';ctx.font='bold 45px Georgia';
    ctx.fillText(['TODAY AT THE DINER','HARBOUR SUPPLY','COAST RECORDS'][index],320,73);
    ctx.font='30px Georgia';
    const lines=[['House breakfast ........ 4.95','Grilled cheese ........ 3.25','Fresh coffee ........ 1.00'],['MARINE HARDWARE','Rope  /  paint  /  tackle','Orders collected at the counter'],['NEW ARRIVALS','Jazz   /   Soul   /   Rock','Listening desk open daily']][index];
    lines.forEach((line,n)=>ctx.fillText(line,320,140+n*55));
    const texture=new T.CanvasTexture(poster);texture.colorSpace=T.SRGBColorSpace;
    const board=new T.Mesh(new T.PlaneGeometry(3.35,1.68),new T.MeshBasicMaterial({map:texture}));
    board.rotation.y=s.front===1?0:Math.PI;board.position.set(s.x,2.29,s.z-s.front*(s.d/2-.255));street.add(board);
    const back=-s.d/2+.27;
    detail(0,.59,back,s.w-.48,1.18,.055,wood);
    for(const side of [-1,1]){
      detail(side*(s.w/2-.27),.59,0,.055,1.18,s.d-.52,wood);
      detail(side*3.85,2.3,back+.05,1.46,1.46,.08,iron);
      const artwork=new T.PlaneGeometry(1.32,1.32),uv=artwork.getAttribute('uv');
      const cell=index*2+(side===1?1:0);
      for(let i=0;i<uv.count;i++)uv.setXY(i,(cell%3+.005+.99*uv.getX(i))/3,(1-Math.floor(cell/3)+.005+.99*uv.getY(i))/2);
      const print=new T.Mesh(artwork,printMaterial);
      print.rotation.y=board.rotation.y;print.position.set(s.x+side*3.85,2.3,s.z+s.front*(back+.10));street.add(print);
    }
    // Pendant shades and luminous diffusers use baked colours rather than per-shop shadow lights.
    for(const side of [-1,1]){
      detail(side*3,s.h-.36,0,.035,.68,.035,iron);
      detail(side*3,s.h-.73,0,1.15,.12,.5,accent);
      detail(side*3,s.h-.81,0,.96,.055,.38,paint('#fff1cd'));
      detail(side*(s.w/2-.15),1.10,0,.07,.14,s.d-.35,accent);
    }
    cuboid(s.x,s.h-.08,edge,s.w+.22,.15,.34,trim);
    const canvas=paint(awnings[index]),y=s.h*.70;
    cuboid(s.x,y,edge+s.front*.54,s.w-.32,.10,1.27,canvas).rotation.x=s.front*.13;
    cuboid(s.x,y-.13,edge+s.front*1.15,s.w-.32,.19,.06,canvas);
    for(const dx of [-.41,0,.41])cuboid(s.x+dx*s.w,y-.22,edge+s.front*.46,.055,.055,1.15,iron).rotation.x=-s.front*.35;
    for(const direction of [-1,1]){
      const windowX=s.x+direction*s.w*.285;
      cuboid(windowX,s.h*.192,edge+s.front*.11,s.w*.386,.10,.23,concrete);
      cuboid(windowX,s.h*.425,edge+s.front*.045,.058,s.h*.46,.10,trim);
    }
    if(index===0){
      const blade=loader.load(base+'diner-sign.webp');blade.colorSpace=T.SRGBColorSpace;
      const face=new T.MeshStandardMaterial({map:blade,roughness:.65});
      const poleX=s.x-s.w*.43;
      cuboid(poleX,s.h+.64,edge+.8,.12,.14,1.8,iron);
      cuboid(poleX,s.h+.15,edge+1.52,.17,1.64,1.29,canvas);
      for(const side of [-1,1]){
        const panel=new T.Mesh(new T.PlaneGeometry(1.23,1.58),face);
        panel.rotation.y=side*Math.PI/2;panel.position.set(poleX+side*.09,s.h+.15,edge+1.52);
        street.add(panel);
      }
    }
    // Roof plant breaks the silhouette; louvres are batched with the parapet.
    cuboid(s.x+s.w*.23,s.h+.52,s.z,2.1,.94,1.35,concrete);
    for(let n=0;n<4;n++)cuboid(s.x+s.w*.23,s.h+.26+n*.14,s.z+.69,1.75,.055,.05,iron);
  });
  const timber=paint('#76624b');
  for(const x of streetPoles){
    cuboid(x,3.7,-29.2,.28,7.4,.28,timber);
    cuboid(x,7.04,-29.2,.18,.16,1.65,timber);
    cuboid(x,5.6,-28,.09,.09,2.4,iron);
    cuboid(x,5.50,-26.88,.46,.16,.65,trim);
  }
  const points:number[]=[];
  for(let span=1;span<streetPoles.length;span++)for(const offset of [-.7,0,.7]){
    const start=streetPoles[span-1],end=streetPoles[span];
    for(let n=0;n<8;n++)for(const t of [n/8,(n+1)/8])points.push(start+(end-start)*t,7.24-2.4*t*(1-t),-29.2+offset);
  }
  const cables=new T.BufferGeometry();cables.setAttribute('position',new T.Float32BufferAttribute(points,3));
  const cableMaterial=new T.LineBasicMaterial({color:'#393d3b'});street.add(new T.LineSegments(cables,cableMaterial));
  batchStaticMeshes(street,new Set(),32,new Set(palette.values()));
  return ()=>{cables.dispose();cableMaterial.dispose();normal.dispose();palette.forEach(m=>m.dispose());};
}
