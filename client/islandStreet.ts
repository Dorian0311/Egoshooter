import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {islandShops,shopParts,streetPoles} from '../shared/islandStreet';
import {createHarbourPosters} from './harbourPosters';
import {batchStaticMeshes} from './scenery';
import {dampSurface} from './dampSurface';

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
  function solid(geometry:T.BufferGeometry,x:number,y:number,z:number,material:T.Material){
    const mesh=new T.Mesh(geometry,material);
    mesh.position.set(x,y,z);mesh.receiveShadow=true;street.add(mesh);return mesh;
  }
  function cylinder(x:number,y:number,z:number,top:number,bottom:number,height:number,material:T.Material){
    return solid(new T.CylinderGeometry(top,bottom,height,16),x,y,z,material);
  }
  const goods=loader.load(base+'shop-goods.webp');goods.colorSpace=T.SRGBColorSpace;goods.anisotropy=4;
  const labelMaterial=new T.MeshStandardMaterial({map:goods,roughness:.83});
  function label(x:number,y:number,z:number,width:number,height:number,yaw:number,cell:number){
    const quad=new T.PlaneGeometry(width,height),uv=quad.getAttribute('uv');
    for(let i=0;i<uv.count;i++)
      uv.setXY(i,(cell%4+.012+.976*uv.getX(i))/4,(1-Math.floor(cell/4)+.012+.976*uv.getY(i))/2);
    const mesh=solid(quad,x,y,z,labelMaterial);mesh.rotation.y=yaw;
    return mesh;
  }
  street.add(createHarbourPosters(loader));
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
  // Recesses and uneven paint make the carriageway read as a working street.
  // All road details sit below step height and share the existing street batches.
  const gutter=paint('#383b37'),grate=paint('#696861'),roadPaint=paint('#c4bba1');
  const wear=paint('#a49c85');
  for(const side of [-1,1]){
    const z=-23+side*4.32;
    cuboid(63,.058,z,63.5,.004,.14,gutter);
    for(const x of [39,57,82]){
      cuboid(x,.062,z,.76,.005,.43,gutter);
      for(let i=0;i<8;i++)cuboid(x+(i-3.5)*.087,.067,z,.033,.007,.38,grate);
    }
  }
  for(let x=33;x<94;x+=6)if(x!==69)cuboid(x,.064,-23,2.9,.012,.12,trim);
  // The crossing sits between shop entrances, clear of the center dashes.
  for(let i=0;i<9;i++){
    const z=-23+(i-4)*.84;
    const x=68.95+.04*Math.sin(i*4);
    cuboid(x,.063,z,1.64,.004,.37,roadPaint);
    cuboid(x+.49*Math.cos(i*3),.066,z+.085,.40,.003,.17,wear);
  }
  const manhole=new T.Mesh(new T.CylinderGeometry(.39,.39,.018,20),gutter);
  manhole.position.set(57.2,.061,-24.85);manhole.receiveShadow=true;street.add(manhole);
  for(let i=-3;i<=3;i++){
    const halfWidth=Math.sqrt(.35**2-(i*.092)**2);
    cuboid(57.2,.073,-24.85+i*.092,halfWidth*2,.005,.021,grate);
  }
  const atlas=loader.load(base+'shops.webp');atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=4;
  const facade=new T.MeshStandardMaterial({map:atlas,roughness:.93});
  const prints=loader.load(base+'interior-prints.webp');
  prints.colorSpace=T.SRGBColorSpace;prints.anisotropy=4;
  const printMaterial=new T.MeshStandardMaterial({map:prints,roughness:.9});
  function boards(file:string){
    const map=loader.load(base+file+'.webp');
    map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;
    return new T.MeshStandardMaterial({map,roughness:.88});
  }
  const timberFloor=boards('wood_floor_worn'),paintedBoards=boards('distressed_painted_planks');
  const linoleum=boards('diner-linoleum');
  timberFloor.vertexColors=linoleum.vertexColors=true;
  const porcelain=paint('#eee4c5'),coffee=paint('#3a271c'),vinyl=paint('#272728');
  const chrome=new T.MeshStandardMaterial({color:'#b3b6ac',metalness:.68,roughness:.27});
  const awnings=['#a64c38','#397071','#ae7e39'];
  islandShops.forEach((s,index)=>{
    const edge=s.z+s.front*s.d/2;
    const accent=paint(awnings[index]),wood=paint('#865b42'),cream=paint('#e8ddbc');
    const detail=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>
      cuboid(s.x+x,y,s.z+z*s.front,w,h,d,m);
    const parts=shopParts(s);
    const furniture=parts.filter(p=>['rack','bench','table','counter','bin'].includes(p.role));
    // Bake broad contact shadows into the floor vertices. They remain visible on low shadow settings.
    const floor=new T.PlaneGeometry(s.w-.42,s.d-.42,Math.ceil(s.w*2),Math.ceil(s.d*2));
    floor.rotateX(-Math.PI/2);
    const positions=floor.getAttribute('position'),uv=floor.getAttribute('uv'),colors=[];
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i);
      const nearWall=Math.min(s.w/2-Math.abs(x),s.d/2+z*s.front);
      let shade=1-.32*Math.exp(-2.3*nearWall);
      for(const part of furniture){
        const dx=Math.max(0,Math.abs(s.x+x-part.x)-part.w/2);
        const dz=Math.max(0,Math.abs(s.z+z-part.z)-part.d/2);
        shade=Math.min(shade,1-.53*Math.exp(-3.1*Math.hypot(dx,dz)));
      }
      colors.push(shade,shade,shade);
      const repeatMetres=index===0?1.25:2;
      uv.setXY(i,uv.getX(i)*s.w/repeatMetres,uv.getY(i)*s.d/repeatMetres);
    }
    floor.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    solid(floor,s.x,.051,s.z,index===0?linoleum:timberFloor);
    for(const part of parts){
      const {role,x,y,z,w,h,d}=part;
      if(role==='side'||role==='back'||role==='sign'||role==='sill'){
        const wall=cuboid(x,y,z,w,h,d,facade),uv=wall.geometry.getAttribute('uv');
        for(let face=0;face<6;face++)for(let n=0;n<4;n++){
          const i=face*4+n,lettering=role==='sign'&&face===(s.front===1?4:5);
          uv.setXY(i,.001+.998*uv.getX(i),lettering?(3-index+.70+.298*uv.getY(i))/4:(.003+.99*uv.getY(i))/4);
        }
      }else if(role==='roof'&&s.id==='diner'){
        cuboid(x,y,z,w,h,d,iron);
        const ceiling=cuboid(x,y-h/2-.016,z,w-.49,.03,d-.49,paint('#e1d9bc'));
        ceiling.castShadow=false;
        for(let beam=-1;beam<=1;beam++)
          detail(0,y-h/2-.065,beam*2.45,w-.52,.078,.14,paint('#a49a80'));
      }else if(role==='rack'){
        for(const end of [-1,1])for(const flank of [-1,1])
          cuboid(x+flank*(w/2-.04),y,z+end*(d/2-.04),.055,h,.055,iron);
        const inward=x<s.x?1:-1;
        for(let shelf=0;shelf<4;shelf++){
          const level=.21+shelf*.57;
          cuboid(x,level,z,w,.09,d,wood);
          for(let n=0;n<6;n++){
            const height=.19+((n+shelf)%3)*.075;
            const centerZ=z+(n-2.5)*.54,baseY=level+.045,cell=(shelf+n)%4;
            if(cell<2){
              cylinder(x,baseY+height/2,centerZ,.17,.17,height,[cream,accent][cell]);
              cylinder(x,baseY+height,centerZ,.18,.18,.018,chrome);
              label(x+inward*.168,baseY+height/2,centerZ,.19,height*.82,inward*Math.PI/2,cell);
            }else{
              cuboid(x,baseY+height/2,centerZ,w*.66,height,.39,wood);
              label(x+inward*(w*.33+.002),baseY+height/2,centerZ,.31,height*.85,inward*Math.PI/2,cell);
            }
          }
        }
      }else if(role==='bin'){
        cuboid(x,y,z,w,h,d,wood);
        for(let n=0;n<15;n++){
          const sleeve=cuboid(x,h+.17,z+(n-7)*.23,.68,.45,.035,[accent,iron,cream,wood][n%4]);
          sleeve.rotation.x=-.17;
          if(n%4===0||n===14){
            const facing=s.front;
            const cover=label(x,h+.17,sleeve.position.z+facing*.024,.45,.43,facing===1?0:Math.PI,4+Math.floor(n/4)%4);
            cover.rotation.order='YXZ';cover.rotation.x=-.17*facing;
          }
        }
      }else if(role==='bench'){
        cuboid(x,.23,z,w*.83,.46,d*.92,iron);
        const backX=x+(x<s.x-3.6?-.24:.24);
        solid(new RoundedBoxGeometry(w,.21,d,2,.08),x,.55,z,accent);
        solid(new RoundedBoxGeometry(.19,.52,d,2,.08),backX,.83,z,accent);
        const faceX=backX+(x<s.x-3.6?.10:-.10);
        for(let rib=-3;rib<=3;rib++)cuboid(faceX,.83,z+rib*.25,.014,.34,.012,cream);
      }else if(role==='table'){
        cuboid(x,.50,z,.18,.96,.25,iron);cuboid(x,1.02,z,w,.12,d,cream);
        for(const end of [-1,1]){
          const cupX=x+end*.20,cupZ=z-end*.39;
          cylinder(cupX,1.09,cupZ,.14,.11,.023,porcelain);
          cylinder(cupX,1.16,cupZ,.079,.058,.14,porcelain);
          cylinder(cupX,1.232,cupZ,.066,.066,.003,coffee);
          const handle=solid(new T.TorusGeometry(.044,.012,5,12),cupX+end*.078,1.17,cupZ,porcelain);
          handle.rotation.y=.16;
        }
        cuboid(x,1.18,z,.13,.20,.27,chrome);cuboid(x,1.287,z,.015,.02,.23,cream);
        // A small enamel cruet tray gathers the squeeze bottles by the napkin holder.
        cuboid(x+.20,1.095,z,.18,.023,.30,porcelain);
        for(const [i,colour] of [accent,trim].entries()){
          const bottleZ=z-.074+i*.14;
          cylinder(x+.20,1.185,bottleZ,.046,.051,.164,colour);
          cylinder(x+.20,1.282,bottleZ,.022,.046,.035,colour);
          cylinder(x+.20,1.320,bottleZ,.009,.022,.041,cream);
        }
      }else{
        cuboid(x,y,z,w,h,d,role==='counter'?wood:iron);
        if(role==='counter'){
          cuboid(x,h+.035,z,w+.06,.07,d+.05,cream);
          cuboid(x+.65,h+.18,z,.38,.24,.31,iron);
          cuboid(x+.65,h+.32,z-s.front*.10,.33,.12,.08,chrome);
          if(index===0){
            for(const offset of [-.95,-.48]){
              cylinder(x+offset,h+.14,z,.19,.20,.15,iron);
              cylinder(x+offset,h+.48,z,.18,.16,.56,chrome);
              cylinder(x+offset,h+.78,z,.06,.19,.07,iron);
              cuboid(x+offset,h+.31,z+s.front*.18,.05,.06,.13,iron);
            }
          }else if(index===2){
            const deckX=x-.53;
            cuboid(deckX,h+.13,z,.90,.10,.63,vinyl);
            cylinder(deckX-.12,h+.195,z,.25,.25,.026,chrome);
            cylinder(deckX-.12,h+.216,z,.23,.23,.015,vinyl);
            cylinder(deckX-.12,h+.227,z,.072,.072,.008,accent);
            cylinder(deckX+.28,h+.24,z-.16,.045,.045,.10,chrome);
            cuboid(deckX+.21,h+.295,z-.06,.022,.025,.28,chrome).rotation.y=-.5;
          }
        }
      }
    }
    let texture:T.Texture;
    if(s.id==='harbour-supply'){
      texture=loader.load(base+'chandlery-samples.webp');texture.anisotropy=4;
      const wall=-s.d/2+.29;
      for(const side of [-1,1]){
        detail(side*1.70,2.29,wall,.085,1.81,.11,wood);
        detail(0,2.29+side*.865,wall,3.47,.08,.11,wood);
      }
      // Rope for sale hangs beside the sample plate. Flatten the coil toward the
      // wall, keeping a true silhouette and a short loose end at either side.
      detail(2.22,2.74,wall+.052,.27,.18,.12,wood);
      detail(2.22,2.71,wall+.17,.055,.06,.25,iron);
      for(let turn=0;turn<4;turn++){
        const coil=solid(new T.TorusGeometry(.265,.025,5,22),s.x+2.22+turn*.008,2.34-turn*.013,s.z+s.front*(wall+.13+turn*.036),trim);
        coil.scale.set(1,.37/.265,1);coil.rotation.z=.07-turn*.047;
      }
      detail(2.40,1.95,wall+.22,.044,.39,.046,trim).rotation.z=.22;
      detail(2.06,2.00,wall+.19,.048,.28,.043,trim).rotation.z=-.17;
    }else if(s.id==='diner'){
      texture=loader.load(base+'diner-menu.webp');texture.anisotropy=4;
      const wall=-s.d/2+.265;
      for(const side of [-1,1]){
        // Formed metal edge and inset coloured pinstripe on the enamel menu case.
        detail(side*1.697,2.29,wall,.054,1.76,.115,chrome).castShadow=false;
        detail(0,2.29+side*.862,wall,3.45,.052,.115,chrome);
        detail(0,2.29+side*.888,wall-.009,3.36,.014,.073,accent);
      }
    }else{
      texture=loader.load(base+'coast-listening.webp');texture.anisotropy=4;
      const wall=-s.d/2+.28;
      detail(0,1.44,wall+.012,3.45,.048,.14,wood);
      for(const side of [-1,1]){
        // Paired walnut monitor cabinets flank the featured record above the turntable.
        const x=side*1.45,y=3.56;
        detail(x,y,wall+.14,.43,.63,.28,wood);
        detail(x,y,wall+.287,.384,.576,.022,vinyl).castShadow=false;
        for(const [dy,radius] of [[-.078,.139],[.147,.064]]){
          const cone=solid(new T.ConeGeometry(radius,.034,18),s.x+x,y+dy,s.z+s.front*(wall+.31),iron);
          cone.rotation.x=s.front*Math.PI/2;
          const surround=solid(new T.TorusGeometry(radius,.011,4,18),s.x+x,y+dy,s.z+s.front*(wall+.308),vinyl);
          surround.rotation.y=Math.PI;
        }
      }
    }
    texture.colorSpace=T.SRGBColorSpace;
    const board=new T.Mesh(new T.PlaneGeometry(3.35,1.68),new T.MeshBasicMaterial({map:texture}));
    board.rotation.y=s.front===1?0:Math.PI;board.position.set(s.x,2.29,s.z-s.front*(s.d/2-.255));street.add(board);
    const back=-s.d/2+.27;
    const panel=detail(0,.59,back,s.w-.48,1.18,.055,paintedBoards);
    const panelUV=panel.geometry.getAttribute('uv');
    for(let i=0;i<panelUV.count;i++)panelUV.setX(i,panelUV.getX(i)*s.w/1.6);
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
      cylinder(s.x+side*3,s.h-.76,s.z,.11,.43,.31,accent);
      cylinder(s.x+side*3,s.h-.92,s.z,.37,.37,.022,porcelain);
      cylinder(s.x+side*3,s.h-.59,s.z,.065,.085,.085,chrome);
      detail(side*(s.w/2-.15),1.10,0,.07,.14,s.d-.35,accent);
    }
    cuboid(s.x,s.h-.08,edge,s.w+.22,.15,.34,trim);
    const canvas=paint(awnings[index]),y=s.h*.70;
    cuboid(s.x,y,edge+s.front*.54,s.w-.32,.10,1.27,canvas).rotation.x=s.front*.13;
    cuboid(s.x,y-.13,edge+s.front*1.15,s.w-.32,.19,.06,canvas);
    // Alternate woven strips and a separate rail give the valance a legible silhouette from across the road.
    const stripeCount=Math.floor(s.w/.9),stripeWidth=(s.w-.32)/stripeCount;
    for(let n=0;n<stripeCount;n+=2){
      const x=s.x-(s.w-.32)/2+(n+.5)*stripeWidth;
      cuboid(x,y+.055,edge+s.front*.54,stripeWidth,.012,1.27,cream).rotation.x=s.front*.13;
      cuboid(x,y-.13,edge+s.front*1.186,stripeWidth,.19,.014,cream);
    }
    for(const dx of [-.41,0,.41])cuboid(s.x+dx*s.w,y-.22,edge+s.front*.46,.055,.055,1.15,iron).rotation.x=-s.front*.35;
    for(const direction of [-1,1]){
      const windowX=s.x+direction*s.w*.285;
      cuboid(windowX,s.h*.192,edge+s.front*.11,s.w*.386,.10,.23,concrete);
      cuboid(windowX,s.h*.425,edge+s.front*.045,.058,s.h*.46,.10,trim);
      // Profiled sills, stall risers and outer posts catch light at street level.
      // The central doorway and the openings above each display stay clear.
      const outerX=s.x+direction*(s.w/2-.20);
      const frameWidth=s.w/2-1.30;
      const frameX=s.x+direction*(1.16+frameWidth/2);
      const frontZ=edge+s.front*.126;
      const diner=s.id==='diner';
      cuboid(outerX,y/2,frontZ,.20,y,.18,diner?chrome:wood).castShadow=!diner;
      cuboid(outerX,y/2,frontZ+s.front*.104,.040,y-.12,.034,diner?cream:accent);
      cuboid(frameX,.18,frontZ,frameWidth,.17,.092,iron);
      cuboid(frameX,.83,frontZ,frameWidth,.073,.095,diner?chrome:wood);
      for(let panel=0;panel<3;panel++){
        const center=frameX+frameWidth*((panel+.5)/3-.5);
        const panelWidth=frameWidth/3-.075;
        if(diner){
          // Fired tile bulkhead and separate steel expansion joints under the enamel sign.
          // The original facade atlas also supplies the lettering, so both share its batch.
          const tiles=new T.PlaneGeometry(frameWidth/3,.59),uv=tiles.getAttribute('uv');
          for(let i=0;i<uv.count;i++)uv.setXY(i,.002+.996*uv.getX(i),1-(494-316*uv.getY(i))/2048);
          solid(tiles,center,.525,frontZ+.085,facade).castShadow=true;
          cuboid(center-frameWidth/6+.011,.525,frontZ+.089,.023,.60,.033,chrome).castShadow=false;
          continue;
        }
        cuboid(center,.477,frontZ+s.front*.03,panelWidth,.43,.085,wood);
        if(panel===1){
          // One painted trade panel each side of the door. Select a different half
          // of the shop's own atlas strip for each window, viewed from the street.
          const plaque=new T.PlaneGeometry(panelWidth-.055,.40),uv=plaque.getAttribute('uv');
          const u=direction<0?.502:.002;
          for(let i=0;i<uv.count;i++)uv.setXY(i,u+.496*uv.getX(i),1-(index*512+432-200*uv.getY(i))/2048);
          const face=solid(plaque,center,.477,frontZ+s.front*.093,facade);
          face.rotation.y=Math.PI;face.castShadow=true;
          continue;
        }
        cuboid(center,.48,frontZ+s.front*.081,panelWidth-.105,.32,.034,accent);
        cuboid(center,.614,frontZ+s.front*.110,panelWidth-.155,.038,.024,trim);
      }
    }
    cuboid(s.x,s.h-.13,edge+s.front*.085,s.w+.16,.15,.24,iron);
    cuboid(s.x,s.h-.21,edge+s.front*.085,s.w+.13,.055,.17,concrete);
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
  const dampRoad=dampSurface(pavement),dampSlabs=dampSurface(pavingMaterial,.68);
  return {
    setDampness(damp:boolean){dampRoad(damp);dampSlabs(damp);},
    dispose(){cables.dispose();cableMaterial.dispose();normal.dispose();palette.forEach(m=>m.dispose());},
  };
}
