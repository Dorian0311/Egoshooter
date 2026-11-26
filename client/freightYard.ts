import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {World,Box} from '../shared/world';

export function freightCartSite(world:World,b:Box){
  return world.id==='frontline'&&b.kind==='sandbags'&&(b.x===30&&b.z===-7||b.x===0&&b.z===-27);
}

export function freightYard(world:World){
  const pieces:T.BufferGeometry[]=[],color=new T.Color();
  const metal='#545c58',wood='#a88968',rim='#52524b',strap='#6a5b45',sack='#c6b896';
  const uvRect=[[.765,.025,.20,.10],[.006,.515,.238,.472],[.256,.515,.238,.472],
    [.506,.515,.488,.472],[.006,.135,.238,.347],[.256,.135,.238,.347],[.506,.135,.238,.347]];
  let ox=0,oz=0;
  function add(g:T.BufferGeometry,x:number,y:number,z:number,c:string,tile=0,rx=0,ry=0,rz=0){
    g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(ox+x,y,oz+z);
    const p=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=g.getAttribute('uv');
    const rgb=new Float32Array(p.count*3),[u,v,w,h]=uvRect[tile];
    color.set(c);
    for(let i=0;i<p.count;i++){
      const n=.96+.035*normal.getY(i)+.025*Math.sin(p.getX(i)*2+p.getZ(i));
      rgb[3*i]=color.r*n;rgb[3*i+1]=color.g*n;rgb[3*i+2]=color.b*n;
      uv.setXY(i,u+uv.getX(i)*w,v+uv.getY(i)*h);
    }
    g.setAttribute('color',new T.BufferAttribute(rgb,3));
    const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();pieces.push(flat);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,c:string,tile=0,rz=0){
    add(new T.BoxGeometry(w,h,d),x,y,z,c,tile,0,0,rz);
  }
  function cylinder(x:number,y:number,z:number,r:number,rb:number,h:number,c:string,rx=0){
    add(new T.CylinderGeometry(r,rb,h,12),x,y,z,c,0,rx);
  }
  function spokeWheel(x:number,y:number,z:number,r:number,turn=false){
    const start=pieces.length;
    add(new T.TorusGeometry(r-.028,.028,5,16),x,y,z,rim);
    add(new T.TorusGeometry(r-.055,.026,5,16),x,y,z,wood,1);
    for(let j=0;j<5;j++)box(x,y,z,r*1.77,.027,.036,wood,1,j*Math.PI/5);
    cylinder(x,y,z,.074,.074,.10,metal,Math.PI/2);
    if(turn)for(const g of pieces.slice(start))g.translate(-ox-x,-y,-oz-z).rotateY(Math.PI/2).translate(ox+x,y,oz+z);
  }
  function parcel(x:number,bottom:number,z:number,w:number,h:number,d:number,style:number){
    box(x,bottom+h/2,z,w,h,d,style===0?'#a88761':'#abac8c',style===0?1:2);
    for(const dx of [-.30,.30])box(x+dx*w,bottom+h/2,z,.032,h+.012,d+.012,strap);
    if(style===0){
      for(const side of [-1,1])for(const offset of [-.39,.39])
        box(x+w*offset,bottom+h/2,z+side*(d/2+.011),.057,h,.035,wood,1);
    }
    add(new T.PlaneGeometry(Math.min(.34,w*.38),Math.min(.23,h*.43)),x+.09*w,bottom+h*.53,z+d/2+.017,'#ffffff',4+style);
  }
  for(const b of world.boxes.filter(b=>freightCartSite(world,b))){
    ox=b.x;oz=b.z;
    const long=b.w>6,deckX=long?-.68:-.33,len=long?2.56:2.06,deck=.52;
    // The lowered drawbar, axles and load all fit the former cover footprint.
    for(const side of [-1,1]){
      box(deckX,.385,side*.37,len,.12,.09,metal);
      const handleEnd=-b.w/2+.10,handleBase=deckX-len*.30;
      const run=handleBase-handleEnd,rise=.48;
      box((handleEnd+handleBase)/2,.60,side*.35,Math.hypot(run,rise),.07,.072,wood,1,-Math.atan2(rise,run));
    }
    for(const dx of [-.31,.31]){
      const x=deckX+dx*len;
      cylinder(x,.32,0,.045,.045,1.08,metal,Math.PI/2);
      for(const side of [-1,1])spokeWheel(x,.32,side*.535,.32);
    }
    for(let n=0;n<6;n++)box(deckX,deck-.04,(n-2.5)*.165,len,.08,.158,wood,1);
    parcel(deckX-len*.235,deck,-.012,len*.42,.64,.89,long?0:1);
    parcel(deckX+len*.22,deck,.005,len*.42,.74,.89,long?2:0);
    for(const z of [-.478,.478]){
      for(const dx of [-.46,.46])box(deckX+dx*len,.68,z,.067,.36,.067,rim);
      box(deckX,.75,z,len,.078,.063,wood,1);
    }
    const cargoX=(b.w/2+deckX+len/2)/2+.08,rest=b.w/2-cargoX;
    parcel(cargoX,.033,0,rest*1.8,.63,1.08,0);
    if(long){
      parcel(cargoX,.674,.01,rest*1.52,.55,.91,1);
    }else{
      // Milk churn with rolled lip and tapered shoulder on the second load.
      for(const offset of [-.32,.32]){
        const x=cargoX+offset;
        cylinder(x,.87,0,.20,.19,.39,'#acada0');
        cylinder(x,1.12,0,.115,.20,.11,'#bdbaaa');
        cylinder(x,1.21,0,.14,.13,.07,metal);
      }
    }
  }
  // Station fittings live against the solid front bays or hang above head height.
  const station=world.buildings.find(b=>b.name==='GÜTERBAHNHOF');
  if(station){
    ox=station.x;oz=station.z+station.d/2;
    box(-5.52,1.97,.62,2.40,1.30,.15,wood,1);
    add(new T.PlaneGeometry(2.25,1.12),-5.52,1.97,.702,'#ffffff',3);
    box(-5.52,1.29,.66,2.51,.10,.20,wood,1);
    // Slatted rubbing boards absorb freight impacts below the hatch.
    for(const side of [-1,1])for(let row=0;row<3;row++){
      box(side*5.85,.39+row*.14,.49,5.10,.113,.13,row%2?wood:'#93806b',1);
    }
    // An upright sack barrow stows on wall cleats beyond the entrance.
    const x=7.24,z=.63;
    for(const dx of [-.26,.26]){
      box(x+dx,.98,z,.064,1.65,.067,wood,1);
      spokeWheel(x+dx,.26,z+.08,.18,true);
    }
    for(let i=0;i<4;i++)box(x,.48+i*.31,z,.53,.11,.065,wood,1);
    box(x,.21,z+.12,.66,.055,.32,metal);
    // A small chain block is secured to the loading canopy; the hook is raised for clearance.
    const hx=-3.29,hz=1.83;
    box(hx,3.13,hz,.16,.35,.16,metal);cylinder(hx,2.93,hz,.21,.21,.14,rim,Math.PI/2);
    for(let i=0;i<8;i++)add(new T.TorusGeometry(.035,.012,4,8),hx-.08,2.74-i*.049,hz,metal,0,0,i%2*.98);
    add(new T.TorusGeometry(.067,.020,5,10,Math.PI*1.55),hx-.065,2.30,hz,rim);
  }
  const geometry=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());
  const atlas=new T.TextureLoader().load('/shooter/environment/freight-yard.webp');atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=4;
  const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({map:atlas,vertexColors:true,roughness:.88,metalness:.035}));
  mesh.name='Civil freight carts, consignments and shed fittings';mesh.receiveShadow=true;return mesh;
}
