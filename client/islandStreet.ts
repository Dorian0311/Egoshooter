import * as T from 'three';
import {islandShops,streetPoles} from '../shared/islandStreet';
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
  const awnings=['#a64c38','#397071','#ae7e39'];
  islandShops.forEach((s,index)=>{
    const body=cuboid(s.x,s.h/2,s.z,s.w,s.h,s.d,facade),uv=body.geometry.getAttribute('uv');
    for(let face=0;face<6;face++){
      const row=face===(s.front===1?4:5)?index:3;
      for(let corner=0;corner<4;corner++){
        const i=face*4+corner;
        uv.setXY(i,.001+uv.getX(i)*.998,(3-row+.002+uv.getY(i)*.996)/4);
      }
    }
    const edge=s.z+s.front*s.d/2;
    cuboid(s.x,s.h+.04,s.z,s.w+.25,.13,s.d+.24,iron);
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
