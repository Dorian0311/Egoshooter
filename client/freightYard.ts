import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {World,Box} from '../shared/world';

export function freightCartSite(world:World,b:Box){
  return world.id==='frontline'&&b.kind==='sandbags'&&(b.x===30&&b.z===-7||b.x===0&&b.z===-27);
}

export function freightYard(world:World){
  const pieces:T.BufferGeometry[]=[],color=new T.Color();
  const metal='#545c58',wood='#a88968',rim='#52524b',strap='#6a5b45',sack='#c6b896';
  // Original cargo tiles occupy the lower left quarter; the tower panels wrap once around each drum.
  const cargoTiles=[[.765,.025,.20,.10],[.006,.515,.238,.472],[.256,.515,.238,.472],
    [.506,.515,.488,.472],[.006,.135,.238,.347],[.256,.135,.238,.347],[.506,.135,.238,.347]];
  const surfaceTiles=[[3,3,1530,506],[1027,515,1018,238],[1539,3,506,250],[1539,259,506,250],[1027,759,250,260],[1281,757,766,266],[769,769,250,170]];
  const uvRect=[...cargoTiles.map(tile=>tile.map(n=>n*.5)),...surfaceTiles.map(([x,y,w,h])=>[x/2048,1-(y+h)/1024,w/2048,h/1024])];
  const masonry=7,ironPlate=8,stonework=9,slate=10,boardDoor=11,postalBrick=12,cinemaMosaic=13;
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
    g.setAttribute('surfaceGloss',new T.Uint8BufferAttribute(new Uint8Array(p.count).fill(tile===ironPlate?82:tile===slate?41:0),1,true));
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
    // A wall-mounted goods crane at the east corner serves the siding. Two
    // spaced bearings take the cantilever moment back into the masonry.
    const pivotX=station.x+station.w/2+.37,pivotZ=oz-.95;
    for(const level of [1.90,3.73]){
      box(station.w/2+.24,level,-.95,.52,.28,.56,'#647068',ironPlate);
      box(station.w/2+.028,level,-.95,.09,.53,.72,'#605e53',ironPlate);
    }
    const craneStart=pieces.length;
    ox=0;oz=0;
    const steel='#4f605b',flange='#7b8270';
    function boomBar(x:number,z0:number,y0:number,z1:number,y1:number,width:number,height:number){
      add(new T.BoxGeometry(width,height,Math.hypot(z1-z0,y1-y0)),x,(y0+y1)/2,(z0+z1)/2,
        steel,0,-Math.atan2(y1-y0,z1-z0));
    }
    cylinder(0,3.49,0,.16,.18,3.48,steel);
    for(const y of [1.90,3.73,5.13])cylinder(0,y,0,.225,.225,.19,flange);
    const bottom=(z:number)=>3.87+.155*z,top=(z:number)=>5.16+.024*z;
    const reach=6,panels=4;
    for(const x of [-.20,.20]){
      boomBar(x,0,bottom(0),reach,bottom(reach),.12,.15);
      boomBar(x,0,top(0),reach,top(reach),.105,.125);
      for(let i=0;i<panels;i++){
        const a=i*reach/panels,b=(i+1)*reach/panels;
        boomBar(x,a,i%2?top(a):bottom(a),b,i%2?bottom(b):top(b),.060,.072);
      }
    }
    for(let n=0;n<=panels;n++){
      const z=n*reach/panels;
      box(0,top(z),z,.51,.10,.085,flange);
      box(0,bottom(z),z,.51,.10,.085,steel);
    }
    // The hoist line leaves the drum tangentially, runs over the tip sheave
    // and ends in a raised hook above the boxcar roof.
    const drumZ=.82,drumY=4.63,wheelY=5.05;
    for(const x of [-.16,.16]){
      box(x,4.43,drumZ,.075,.51,.35,steel,ironPlate);
      add(new T.CylinderGeometry(.26,.26,.047,12),x,drumY,drumZ,flange,0,0,0,Math.PI/2);
    }
    add(new T.CylinderGeometry(.19,.19,.30,12),0,drumY,drumZ,'#594e40',0,0,0,Math.PI/2);
    for(const x of [-.20,.20])box(x,wheelY,reach,.078,.55,.32,steel,ironPlate);
    add(new T.CylinderGeometry(.205,.205,.19,12),0,wheelY,reach,flange,0,0,0,Math.PI/2);
    boomBar(0,drumZ,drumY+.19,reach,wheelY+.205,.032,.032);
    box(0,4.45,reach+.205,.034,1.20,.034,'#514b40');
    const hook=new T.TorusGeometry(.13,.031,5,13,Math.PI*1.60).rotateZ(Math.PI/2);
    add(hook,0,3.72,reach+.205,'#605447',0,0,Math.PI/2);
    for(const piece of pieces.slice(craneStart))piece.rotateY(.30).translate(pivotX,0,pivotZ);
  }
  const cinema=world.buildings.find(b=>b.name==='UNION-LICHTSPIELE');
  if(cinema){
    ox=cinema.x;oz=cinema.z+cinema.d/2+2.57;
    // Terrazzo marquee set flush in the flagstone runner. Its sunburst and clipped
    // corners echo the fanlight above the door; the stone joints continue around it.
    add(new T.PlaneGeometry(2.62,1.78),0,.058,0,'#fff8e8',cinemaMosaic,-Math.PI/2);
    for(const side of [-1,1]){
      for(let ray=0;ray<5;ray++){
        const x0=side*1.34,z0=(ray-2)*.132,x1=side*(2.78-Math.abs(ray-2)*.11),z1=(ray-2)*.46;
        const dx=x1-x0,dz=z1-z0;
        add(new T.PlaneGeometry(Math.hypot(dx,dz),ray===2?.083:.052),(x0+x1)/2,.057,(z0+z1)/2,
          ray%2?'#ba9868':'#526e62',0,-Math.PI/2,-Math.atan2(dz,dx));
      }
      for(const line of [-1,1]){
        const z=line*1.08;
        add(new T.PlaneGeometry(1.14,.045),side*1.93,.057,z,'#b2976c',0,-Math.PI/2);
        add(new T.PlaneGeometry(.91,.054),side*1.76,.057,z+line*.14,'#5b7467',0,-Math.PI/2);
      }
    }
    ox=cinema.x;oz=cinema.z;
    const screenZ=cinema.d/2-.48,velvet='#843e3e',gold='#bd9f67',lacquer='#543633';
    // A gathered house curtain sits outside the projected photograph. The left
    // drape finishes at the solid jamb, so the neighbouring entrance stays clear.
    function curtain(cols:number,rows:number,sample:(u:number,v:number)=>[number,number,number]){
      const vertices:number[]=[],uv:number[]=[],indices:number[]=[];
      for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
        const u=col/cols,v=row/rows;vertices.push(...sample(u,v));uv.push(u,v);
        if(col<cols&&row<rows){
          const a=row*(cols+1)+col;
          indices.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);
        }
      }
      const cloth=new T.BufferGeometry();cloth.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
      cloth.setAttribute('uv',new T.Float32BufferAttribute(uv,2));cloth.setIndex(indices);cloth.computeVertexNormals();
      add(cloth,0,0,screenZ,velvet);
    }
    for(const [left,width] of [[2.035,.265],[5.76,.57]]){
      curtain(20,5,(u,v)=>{
        const gather=1-.36*Math.exp(-((v-.43)**2)/.026);
        const x=left+(left<3?u:gather*u+1-gather)*width*(left<3?gather:1);
        return [x,.54+v*2.84+(1-v)*.033*Math.cos(u*8*Math.PI),-.071-.072*Math.cos(u*8*Math.PI)*gather];
      });
      box(left+width*(left<3?.32:.67),1.76,screenZ-.104,width*.67,.055,.052,gold);
    }
    curtain(48,3,(u,v)=>{
      const scallop=.115*(.5-.5*Math.cos(u*Math.PI*6));
      const hem=3.38-scallop;
      return [2.04+4.33*u,hem+v*(3.61-hem),-.074-.044*Math.cos(u*Math.PI*44)-.038*(1-v)];
    });
    box(4.20,3.64,screenZ-.05,4.44,.12,.24,lacquer);
    box(4.20,3.685,screenZ-.153,4.50,.035,.065,gold);
    box(4.20,.66,screenZ-.06,4.34,.19,.23,lacquer);
    box(4.20,.74,screenZ-.16,4.35,.033,.062,gold);
    // The cloth slips cover the existing seat backs. Rows keep the original width
    // and sightline; the ceiling ribs sit against the underside of the upper floor.
    for(const rowZ of [-4,-1.7,.6,2.9]){
      for(let seat=0;seat<4;seat++){
        const x=3.9+(seat-1.5)*.78;
        box(x,.727,rowZ-.375,.746,.422,.123,velvet);
        box(x,.934,rowZ-.375,.746,.027,.133,'#a16450');
      }
    }
    for(const z of [-4.8,-1.55,1.70,4.95]){
      box(0,3.82,z,9.78,.081,.17,'#a39a84');
      box(0,3.773,z,9.66,.023,.065,'#bda370');
    }
  }
  const postOffice=world.buildings.find(b=>b.name==='FELDPOST');
  if(postOffice){
    ox=postOffice.x+postOffice.w/2;oz=postOffice.z;
    const depth=postOffice.d/2,face=.244;
    // One continuous hand-lettered elevation, clipped to the actual masonry around
    // the sorting-room windows. Its open bays remain sightlines into both storeys.
    function panel(low:number,high:number,near:number,far:number){
      const geometry=new T.PlaneGeometry(far-near,high-low);
      const uv=geometry.getAttribute('uv');
      for(let i=0;i<uv.count;i++){
        uv.setXY(i,(depth-far+uv.getX(i)*(far-near))/(2*depth),(low+uv.getY(i)*(high-low))/8);
      }
      add(geometry,face,(low+high)/2,(near+far)/2,'#fff9ee',postalBrick,0,Math.PI/2);
    }
    for(const [low,high] of [[.62,1.20],[2.50,5.20],[6.50,8]])panel(low,high,-depth,depth);
    for(const low of [1.20,5.20])for(const [near,far] of [[-depth,-5],[-1.5,1.5],[5,depth]])panel(low,low+1.30,near,far);
    for(const z of [-7.74,-.65,.65,7.74]){
      // The middle pilasters terminate at the painted parcel office fascia.
      for(const [base,cap] of Math.abs(z)<1?[[.63,3.04],[4.90,7.85]]:[[.63,7.85]]){
        box(face+.041,(base+cap)/2,z,.092,cap-base,.18,'#956e58');
        box(face+.064,cap-.08,z,.142,.15,.27,'#b2a08a');
      }
    }
    for(const low of [1.20,5.20])for(const z of [-3.25,3.25]){
      box(face+.048,low-.045,z,.19,.095,3.66,'#b1a18a');
      box(face-.12,low+.67,z,.047,1.30,.045,'#626861');
      box(face-.12,low+.85,z,.047,.038,3.50,'#626861');
    }
    box(face+.064,7.87,0,.18,.105,2*depth,'#a9947b');
  }
  // Steam-service water tower and crane beyond the eastern limit of the playable yard.
  // The existing two track centres continue into this bank instead of ending in open ground.
  ox=125;oz=-3.4;
  const tank='#5f7068',stone='#aaa08b',neutral='#f5f0e6';
  function drum(y:number,top:number,bottom:number,h:number,tone:string,n=24,tile=0){
    add(new T.CylinderGeometry(top,bottom,h,n),0,y,0,tone,tile);
  }
  drum(-.22,3.28,3.42,1.66,neutral,32,stonework);
  // True-scale bonded brick, west-facing relieving arches and staining share the tapered shaft UV.
  drum(4.77,2.89,3.06,8.33,neutral,48,masonry);
  // Corbelled stone drum supports the riveted iron reservoir, with horizontal compression rings.
  for(let i=0;i<4;i++)drum(9.00+i*.18,3.12+i*.22,2.99+i*.22,.20,neutral,32,stonework);
  drum(10.20,4.35,3.83,1.05,'#52615a');
  drum(12.04,4.35,4.35,2.66,neutral,48,ironPlate);
  for(const y of [10.74,12.05,13.36])drum(y,4.40,4.40,.11,'#47554e');
  for(let i=0;i<18;i++){
    const a=i*Math.PI/9;
    add(new T.BoxGeometry(.058,2.56,.068),Math.cos(a)*4.34,12.04,Math.sin(a)*4.34,'#77837a',0,0,-a);
  }
  drum(14.48,.74,4.59,2.06,neutral,32,slate);
  drum(15.74,.63,.63,.48,'#474f49',12);drum(16.22,.035,.85,.52,'#64675c',12);
  // Door, high ventilators and the exterior level gauge are on the town-facing side.
  const sill=.625,landingX=-3.62,landingEdge=.83,run=.34,rise=.16,treads=8;
  box(-3.06,(sill+2.78)/2,0,.11,2.78-sill,1.44,neutral,boardDoor);box(-3.14,2.84,0,.22,.19,1.77,stone);
  // The stair reaches the lower cinder yard at the north end, away from the crane.
  const footing=-1.02;
  function landingStone(z:number,length:number,top:number){
    box(landingX,(top+footing)/2,z,1.25,top-footing,length,neutral,stonework);
  }
  landingStone(0,2*landingEdge,sill);
  for(let i=1;i<=treads;i++)landingStone(landingEdge+(i-.5)*run,run,sill-i*rise);
  const railX=landingX-.55,railY=sill+.90;
  for(const i of [0,3,treads]){
    const z=landingEdge+(i-.5)*run,top=railY-i*rise;
    box(railX,top-.45,z,.044,.90,.044,metal,ironPlate);
  }
  box(railX,railY,-.055,.055,.055,2*(landingEdge-run/2+.055),metal,ironPlate);
  box(railX,railY-.45,-.735,.044,.90,.044,metal,ironPlate);
  add(new T.BoxGeometry(.055,.055,treads*Math.hypot(run,rise)),railX,railY-treads*rise/2,
    landingEdge+(treads-1)*run/2,metal,ironPlate,Math.atan2(rise,run));
  for(const y of [4.60,7.43]){
    box(-2.97,y,0,.15,1.17,.72,stone);box(-3.06,y,0,.07,.98,.55,'#4a504a');
    for(const dy of [-.29,0,.29])box(-3.11,y+dy,0,.05,.045,.56,metal);
  }
  box(-4.30,11.87,.94,.12,2.00,.27,'#d7cbb0');
  for(let n=0;n<9;n++)box(-4.37,11.0+n*.21,.95,.05,.033,n%2?.10:.19,rim);
  for(const z of [-12,12]){
    ox=0;oz=z;
    // Both continuous rail heads and their raised ballast bed are in freightTracks.
    for(const dz of [-.8,.8]){
      box(141.5,.55,dz,2.30,.12,.16,metal,0,.52);
    }
    box(142.36,1.08,0,.22,.27,2.42,'#8d5745');
  }
  // Water column between the tower and the southern track; the hose clears the last sleeper.
  ox=121.5;oz=-9.25;
  cylinder(0,-.26,0,.53,.57,1.46,stone);cylinder(0,2.20,0,.19,.28,3.58,tank);
  cylinder(0,3.90,0,.30,.30,.24,metal);box(0,3.98,-1.03,.24,.23,2.29,tank);
  cylinder(0,3.63,-2.11,.18,.17,.61,metal);cylinder(0,3.16,-2.11,.161,.135,.40,'#514d43');
  // The bolted base and swivelling crown share the weathered finish of the water tower.
  for(const [y,r] of [[.53,.34],[3.81,.27]] as const){
    add(new T.CylinderGeometry(r,r,.093,16),0,y,0,'#8b8980',ironPlate);
    for(let bolt=0;bolt<8;bolt++){
      const angle=bolt*Math.PI/4;
      add(new T.CylinderGeometry(.035,.035,.042,6),Math.cos(angle)*(r-.045),y+.061,Math.sin(angle)*(r-.045),'#675d4f');
    }
  }
  add(new T.CylinderGeometry(.234,.234,.115,12),0,1.32,0,'#71685a',ironPlate);
  box(-.24,1.30,0,.19,.18,.16,metal);
  add(new T.CylinderGeometry(.062,.062,.20,10),-.37,1.30,0,'#615848',0,0,0,Math.PI/2);
  spokeWheel(-.43,1.30,0,.25,true);
  for(const y of [3.88,3.49,3.29])add(new T.CylinderGeometry(.194,.194,.065,12),0,y,-2.11,'#878474',ironPlate);
  const nozzle=new T.CylinderGeometry(.151,.128,.158,12,1,true);
  add(nozzle,0,2.95,-2.11,'#5d5850');
  add(new T.TorusGeometry(.132,.026,5,14),0,2.87,-2.11,'#747165',0,Math.PI/2);
  add(new T.CircleGeometry(.105,12),0,2.89,-2.11,'#292923',0,Math.PI/2);
  const geometry=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());
  const loader=new T.TextureLoader(),atlas=loader.load('/shooter/environment/freight-yard.webp'),normal=loader.load('/shooter/environment/freight-yard-normal.webp');
  atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=normal.anisotropy=4;
  const material=new T.MeshStandardMaterial({map:atlas,normalMap:normal,vertexColors:true,roughness:.88,metalness:.035});
  material.normalScale.setScalar(.82);
  material.onBeforeCompile=s=>{
    s.vertexShader='attribute float surfaceGloss; varying float vSurfaceGloss;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceGloss=surfaceGloss;');
    s.fragmentShader='varying float vSurfaceGloss;\n'+s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor-=vSurfaceGloss;');
  };
  material.addEventListener('dispose',()=>normal.dispose());
  const mesh=new T.Mesh(geometry,material);
  mesh.name='Civil freight carts, consignments and shed fittings';mesh.receiveShadow=true;return mesh;
}
