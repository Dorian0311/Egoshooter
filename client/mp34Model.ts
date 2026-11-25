import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {surface} from './vendor/muster/surface';

/** Authored MP 34: continuous walnut stock, bored cooling jacket and side feed. */
export function createMP34(){
  const root=new T.Group();root.name='mp34';
  const steel=surface({color:0x343b3e,metalness:.86,roughness:.36,colorVar:.055,roughVar:.1,bump:.008,bumpScale:220,name:'mp34-blued-steel'});
  const edge=new T.MeshStandardMaterial({color:0x7b8587,metalness:.94,roughness:.31});
  const dark=new T.MeshStandardMaterial({color:0x151b1d,metalness:.62,roughness:.46});
  const wood=surface({color:0x67442c,roughness:.55,metalness:0,colorVar:.025,roughVar:.06,wood:{axis:[0,0,1],dark:0x432a1d,ringFreq:100,figure:.10},bump:.003,bumpScale:150,name:'mp34-walnut'});
  function add(geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0,name='mp34-detail'){const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;}
  function box(x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material=steel,r=.003,name='mp34-machined-part'){return add(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/4,h/4,d/4)),material,x,y,z,name);}
  function cylinder(x:number,y:number,z:number,r:number,length:number,material:T.Material=steel,open=false){const mesh=add(new T.CylinderGeometry(r,r,length,32,1,open),material,x,y,z);mesh.rotation.x=Math.PI/2;return mesh;}
  function ring(x:number,y:number,z:number,r:number,thickness:number,material:T.Material=steel){return add(new T.TorusGeometry(r,thickness,8,32),material,x,y,z);}

  // Elliptical sections create a rounded comb, slim wrist and a full-length fore-end.
  const sections=[[-.355,-.045,.029,.070],[-.345,-.043,.034,.073],[-.31,-.028,.035,.068],[-.25,-.016,.032,.056],[-.18,-.021,.026,.044],[-.12,-.040,.021,.032],[-.075,-.044,.022,.030],[-.02,-.026,.026,.035],[.05,-.012,.029,.032],[.14,-.008,.029,.031],[.23,-.006,.027,.029],[.285,-.006,.024,.026],[.302,-.006,.012,.022]];
  const positions:number[]=[],indices:number[]=[],sides=24;
  for(const [z,y,rx,ry] of sections)for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;positions.push(Math.cos(a)*rx,y+Math.sin(a)*ry,z);}
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
  for(let j=1;j<sides-1;j++){indices.push(0,j+1,j);const end=(sections.length-1)*sides;indices.push(end,end+j,end+j+1);}
  const stock=new T.BufferGeometry();stock.setAttribute('position',new T.Float32BufferAttribute(positions,3));stock.setIndex(indices);stock.computeVertexNormals();add(stock,wood,0,0,0,'mp34-rounded-walnut-stock');
  box(0,-.043,-.357,.064,.143,.012,dark,.006,'mp34-buttplate');
  for(const y of [-.083,.003]){const screw=cylinder(0,y,-.365,.003,.003,edge);screw.rotation.x=0;}

  cylinder(0,.040,.098,.029,.345,steel);
  cylinder(0,.040,-.079,.031,.016,edge);
  cylinder(0,.040,.268,.032,.018,steel);
  cylinder(0,.040,.467,.010,.410,dark);
  // Through-openings on both sides of a hollow steel jacket reveal the barrel.
  const jacketPositions:number[]=[],jacketIndices:number[]=[],segments=48,rows=48,start=.283,end=.665;
  for(const radius of [.025,.021])for(let row=0;row<=rows;row++)for(let angle=0;angle<=segments;angle++){
    const a=angle/segments*Math.PI*2;jacketPositions.push(Math.cos(a)*radius,.040+Math.sin(a)*radius,start+(end-start)*row/rows);
  }
  const layer=(rows+1)*(segments+1);
  const hole=(row:number,angle:number)=>row>2&&row<45&&row%7>=2&&row%7<=4&&angle%12>=3&&angle%12<=7;
  for(let row=0;row<rows;row++)for(let angle=0;angle<segments;angle++){
    if(hole(row,angle))continue;
    for(let side=0;side<2;side++){const a=side*layer+row*(segments+1)+angle,b=a+1,c=a+segments+1,d=c+1;jacketIndices.push(...(side?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
    for(const [dr,da] of [[-1,0],[1,0],[0,-1],[0,1]])if(hole(row+dr,(angle+da+segments)%segments)){
      const a=row*(segments+1)+angle,b=dr<0?a+1:dr>0?a+segments+1:da<0?a:a+1,c=dr?b+(dr>0?1:-1):b+segments+1;
      jacketIndices.push(b,c,b+layer,c,c+layer,b+layer);
    }
  }
  const jacket=new T.BufferGeometry();jacket.setAttribute('position',new T.Float32BufferAttribute(jacketPositions,3));jacket.setIndex(jacketIndices);jacket.computeVertexNormals();add(jacket,steel,0,0,0,'mp34-perforated-cooling-jacket');
  cylinder(0,.040,.669,.026,.016,steel,true);ring(0,.040,.679,.015,.004,edge);
  cylinder(0,.040,.682,.010,.020,dark,true);

  box(.034,.040,.145,.038,.048,.072,steel,.004,'mp34-side-feed-block');
  const magazine=new T.Group();magazine.name='mp34-magazine-assembly';magazine.position.set(.044,.042,.145);magazine.rotation.z=-.06;root.add(magazine);
  const mag=box(.158,.042,.145,.229,.036,.062,dark,.004,'mp34-side-magazine');root.remove(mag);mag.position.set(.114,0,0);magazine.add(mag);
  const lip=box(.276,.042,.145,.012,.043,.069,steel,.003,'mp34-magazine-base');root.remove(lip);lip.position.set(.231,0,0);magazine.add(lip);
  for(const z of [.123,.167])magazine.attach(box(.156,.023,z,.213,.002,.003,edge,.0005,'mp34-magazine-fold'));
  for(let i=0;i<5;i++){const hole=add(new T.CircleGeometry(.0023,12),dark,.071+i*.036,.042,.177,'mp34-magazine-witness-hole');hole.rotation.x=.03;magazine.attach(hole);}

  box(-.028,.048,.151,.004,.026,.102,dark,.002,'mp34-ejection-port');
  box(-.030,.045,.145,.005,.014,.075,edge,.002,'mp34-bolt');
  const handle=cylinder(-.048,.043,.013,.004,.045,edge);handle.rotation.z=Math.PI/2;handle.rotation.x=0;
  add(new T.SphereGeometry(.008,16,12),steel,-.070,.043,.013,'mp34-charging-handle');
  box(0,.074,.070,.025,.012,.072,steel,.002,'mp34-tangent-sight-base');
  box(0,.084,.074,.016,.007,.067,edge,.001,'mp34-rear-sight-leaf');
  for(let i=0;i<7;i++)box(.010,.088,.049+i*.007,.004,.0015,.0015,dark,.0003,'mp34-sight-graduation');
  box(0,.094,.043,.024,.015,.007,steel,.001,'mp34-rear-notch');
  box(0,.090,.625,.015,.065,.025,steel,.003,'mp34-front-sight-base');
  ring(0,.120,.625,.018,.003,steel);box(0,.113,.625,.003,.019,.006,dark,.0007,'mp34-front-sight-post');

  const guardPoints:T.Vector3[]=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;guardPoints.push(new T.Vector3(0,-.065+Math.sin(a)*.027,.013+Math.cos(a)*.040));}
  add(new T.TubeGeometry(new T.CatmullRomCurve3(guardPoints),48,.0035,8,true),steel,0,0,0,'mp34-trigger-guard');
  const trigger=new T.CatmullRomCurve3([new T.Vector3(0,-.033,.019),new T.Vector3(0,-.051,.009),new T.Vector3(0,-.067,.021)]);add(new T.TubeGeometry(trigger,16,.003,8,false),edge,0,0,0,'mp34-curved-trigger');
  for(const sign of [-1,1])for(const [y,z] of [[-.029,-.23],[-.013,.231]]){
    const pin=add(new T.CylinderGeometry(.0037,.0037,.002,16),edge,sign*.032,y,z,'mp34-stock-screw');pin.rotation.z=Math.PI/2;
    box(sign*.0335,y,z,.001,.0014,.004,dark,.0003,'mp34-screw-slot');
  }
  const swivel=ring(0,-.098,-.29,.012,.0025,steel);swivel.rotation.y=Math.PI/2;
  root.userData.muzzle=[0,.040,.692];root.userData.sightY=.138;
  root.userData.authoredQuality='rounded-stock-through-vents-walnut';return root;
}
