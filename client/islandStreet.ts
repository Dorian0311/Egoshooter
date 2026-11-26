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
      uv.setXY(i,(cell%4+.012+.976*uv.getX(i))/4,(3-Math.floor(cell/4)+.012+.976*uv.getY(i))/4);
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
  paving.anisotropy=4;
  const pavingMaterial=new T.MeshStandardMaterial({map:paving,roughness:.98,alphaTest:.30});
  const crossingX=68.95;
  for(const side of [-1,1]){
    const kerb=-23+side*4.62;
    // Fold the curb, its bevel and the apron into the same strip. Kerb joints
    // continue up the riser and the drainage course always faces the carriageway.
    const profile=[[-.12,.053,0],[-.12,.115,20],[-.09,.144,26],[.12,.144,66],[1.30,.142,286],[3.45,.139,688],[3.45,.016,665]];
    const points:number[]=[],texcoords:number[]=[],indices:number[]=[];
    // Drop the stone lip at each end of the crossing. The sloping apron returns
    // to the full pavement height before the shop thresholds.
    const cx=crossingX-63,cuts=[-32,cx-1.86,cx-1.16,cx+1.16,cx+1.86,32];
    function ramp(x:number,offset:number,level:number){
      const along=T.MathUtils.clamp((1.86-Math.abs(x-cx))/.70,0,1);
      const across=T.MathUtils.clamp((1.30-offset)/1.18,0,1);
      return level-Math.max(0,level-.062)*along*across;
    }
    for(let span=0;span<cuts.length-1;span++)for(let i=0;i<profile.length-1;i++){
      const [start,low,v0]=profile[i],[end,high,v1]=profile[i+1],n=points.length/3;
      const a=cuts[span],b=cuts[span+1],u0=(a+32)/8,u1=(b+32)/8;
      points.push(a,ramp(a,start,low),side*start,a,ramp(a,end,high),side*end,
        b,ramp(b,end,high),side*end,b,ramp(b,start,low),side*start);
      texcoords.push(u0,1-v0/960,u0,1-v1/960,u1,1-v1/960,u1,1-v0/960);
      if(side===1)indices.push(n,n+1,n+2,n,n+2,n+3);
      else indices.push(n,n+2,n+1,n,n+3,n+2);
    }
    const strip=new T.BufferGeometry();strip.setIndex(indices);
    strip.setAttribute('position',new T.Float32BufferAttribute(points,3));
    strip.setAttribute('uv',new T.Float32BufferAttribute(texcoords,2));strip.computeVertexNormals();
    const slabs=new T.Mesh(strip,pavingMaterial);slabs.position.set(63,0,kerb);
    slabs.receiveShadow=true;street.add(slabs);
  }
  // Recesses and uneven paint make the carriageway read as a working street.
  // All road details sit below step height and share the existing street batches.
  const gutter=paint('#383b37'),grate=paint('#696861');
  for(const side of [-1,1]){
    const z=-23+side*4.32;
    cuboid(63,.058,z,63.5,.004,.14,gutter);
    for(const x of [39,57,82]){
      cuboid(x,.062,z,.76,.005,.43,gutter);
      for(let i=0;i<8;i++)cuboid(x+(i-3.5)*.087,.067,z,.033,.007,.38,grate);
    }
  }
  // Missing flakes reveal the actual road aggregate through the paint.
  function stripe(x:number,z:number,w:number,d:number,tile:number){
    const geometry=new T.PlaneGeometry(w,d),uv=geometry.getAttribute('uv');
    const left=983+tile%2*272,top=706+Math.floor(tile/2)*60;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(left+1+264*uv.getX(i))/1536,1-(top+54-53*uv.getY(i))/960);
    // Share the centre and culling bounds of the continuous street apron.
    geometry.rotateX(-Math.PI/2).translate(x-63,0,z+23);
    solid(geometry,63,.0595,-23,pavingMaterial);
  }
  for(let x=33;x<94;x+=6)if(x!==69)stripe(x,-23,2.9,.135,6+(x-33)/6%2);
  for(let i=0;i<9;i++){
    stripe(crossingX+.025*Math.sin(i*4),-23+(i-4)*.84,2.20,.42,i%6);
  }
  const manhole=new T.Mesh(new T.CylinderGeometry(.39,.39,.018,20),gutter);
  manhole.position.set(57.2,.061,-24.85);manhole.receiveShadow=true;street.add(manhole);
  // The local foundry cast its name, the port anchor and the lifting eyes into the iron lid.
  const lid=new T.CircleGeometry(.382,32),lidUV=lid.getAttribute('uv');
  for(let i=0;i<lidUV.count;i++)
    lidUV.setXY(i,(12+248*lidUV.getX(i))/1536,1-(948-248*lidUV.getY(i))/960);
  const cover=solid(lid,57.2,.071,-24.85,pavingMaterial);cover.rotation.x=-Math.PI/2;
  const atlas=loader.load(base+'shops.webp');atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=4;
  const facade=new T.MeshStandardMaterial({map:atlas,roughness:.93});
  const atlasV=(pixelY:number)=>1-pixelY/2752;
  const facadeV=(originalV:number)=>atlasV((1-originalV)*2048);
  function drawer(x:number,y:number,z:number,width:number,height:number,yaw:number){
    const geometry=new T.PlaneGeometry(width,height),uv=geometry.getAttribute('uv');
    for(let i=0;i<uv.count;i++)uv.setXY(i,(776+240*uv.getX(i))/1024,atlasV(2425-80*uv.getY(i)));
    const panel=solid(geometry,x,y,z,facade);panel.rotation.y=yaw;panel.castShadow=true;
  }
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
    const jambWidth=parts.find(part=>part.role==='post')!.w;
    const sideWidth=parts.find(part=>part.role==='side')!.w;
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
        // Render each sill between the door jamb and the side wall. The collision
        // boxes meet across the full wing, but their overlapping faces flicker.
        const jamb=role==='sill'?jambWidth:0,sideWall=role==='sill'?sideWidth:0;
        const wallX=x+Math.sign(x-s.x)*(jamb-sideWall)/2;
        const wall=cuboid(wallX,y,z,w-jamb-sideWall,h,d,facade),uv=wall.geometry.getAttribute('uv');
        for(let face=0;face<6;face++)for(let n=0;n<4;n++){
          const i=face*4+n,lettering=role==='sign'&&face===(s.front===1?4:5);
          const sideLining=role==='side'&&face===(x<s.x?0:1);
          if(s.id==='diner'&&role==='side'&&x<s.x&&face===1){
            // The west wall carries the full mural. The harbour side has the service hatch.
            uv.setXY(i,(5+670*uv.getX(i))/1024,atlasV(2428-376*uv.getY(i)));
          }else if(s.id==='diner'&&(sideLining||role==='back'&&face===4)){
            // A continuous tile dado wraps the dining room. Keep its physical tile
            // size on the shorter side walls, and preserve each outer wall finish.
            const portion=sideLining?s.d/s.w:1,start=sideLining&&x>s.x?1-portion:0;
            uv.setXY(i,.001+.998*(start+portion*uv.getX(i)),atlasV(2746-309*uv.getY(i)));
          }else{
            uv.setXY(i,.001+.998*uv.getX(i),facadeV(lettering?(3-index+.70+.298*uv.getY(i))/4:(.003+.99*uv.getY(i))/4));
          }
        }
      }else if(role==='roof'&&s.id==='diner'){
        cuboid(x,y,z,w,h,d,iron);
        const ceiling=cuboid(x,y-h/2-.016,z,w-.49,.03,d-.49,paint('#e1d9bc'));
        ceiling.castShadow=false;
        for(let beam=-1;beam<=1;beam++)
          detail(0,y-h/2-.065,beam*2.45,w-.52,.078,.14,paint('#a49a80'));
      }else if(role==='roof'){
        cuboid(x,y,z,w,h,d,iron);
        // Each shop's lining repeats at its own physical scale within its stock atlas.
        const supply=s.id==='harbour-supply';
        const points:number[]=[],uv:number[]=[],indices:number[]=[];
        const width=w-.49,depth=d-.49,cols=supply?4:14,rows=supply?4:8;
        const u0=supply?1/1024:685/1024,u1=supply?510/1024:764/1024;
        const v0=supply?255/1024:atlasV(2345),v1=supply?1/1024:atlasV(2424);
        for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
          const x0=width*(col/cols-.5),x1=x0+width/cols,z0=depth*(row/rows-.5),z1=z0+depth/rows;
          const n=points.length/3;
          points.push(x0,0,z0,x1,0,z0,x1,0,z1,x0,0,z1);indices.push(n,n+1,n+2,n,n+2,n+3);
          uv.push(u0,v0,u1,v0,u1,v1,u0,v1);
        }
        const lining=new T.BufferGeometry();lining.setIndex(indices);
        lining.setAttribute('position',new T.Float32BufferAttribute(points,3));lining.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
        lining.computeVertexNormals();solid(lining,x,y-h/2-.012,z,supply?labelMaterial:facade).castShadow=!supply;
        if(supply)for(const offset of [-depth/4,0,depth/4])
          cuboid(x,y-h/2-.078,z+offset,width,.115,.14,paint('#a3a58b'));
      }else if(role==='rack'){
        for(const end of [-1,1])for(const flank of [-1,1])
          cuboid(x+flank*(w/2-.04),y,z+end*(d/2-.04),.055,h,.055,iron);
        const inward=x<s.x?1:-1;
        const boardX=s.x-inward*(s.w/2-.29),boardZ=z,rigging=inward<0;
        cuboid(boardX,3.08,boardZ,.09,1.68,3.76,wood);
        const plate=new T.PlaneGeometry(3.64,1.59),plateUV=plate.getAttribute('uv');
        for(let i=0;i<plateUV.count;i++)plateUV.setXY(i,((rigging?1:0)+.004+.992*plateUV.getX(i))/2,(1.006+.988*plateUV.getY(i))/4);
        const sampleX=boardX+inward*.092;
        solid(plate,boardX+inward*.051,3.08,boardZ,labelMaterial).rotation.y=inward*Math.PI/2;
        // Full-sized shop samples stand proud of their painted mounting boards.
        // The printed scale and captions sit under the corresponding fitting.
        for(let col=0;col<3;col++){
          const sampleZ=boardZ-inward*(col-1)*1.165,sampleY=3.045;
          if(!rigging){
            cuboid(sampleX,sampleY-.09,sampleZ,.115,.073,.55,iron);
            if(col===0){
              for(const side of [-1,1]){
                cuboid(sampleX+inward*.033,sampleY+.015,sampleZ+side*.20,.085,.19,.062,chrome).rotation.x=side*.33;
              }
            }else if(col===1){
              cuboid(sampleX+inward*.040,sampleY,sampleZ,.12,.17,.14,iron);
              cuboid(sampleX+inward*.045,sampleY+.080,sampleZ,.093,.070,.56,chrome);
            }else for(const side of [-1,1]){
              cylinder(sampleX+inward*.055,sampleY+.016,sampleZ+side*.135,.081,.078,.224,iron);
              cylinder(sampleX+inward*.055,sampleY+.134,sampleZ+side*.135,.10,.10,.04,chrome);
            }
          }else{
            const radius=col===1?.165:col===0?.115:.075;
            const ferrule=solid(new T.TorusGeometry(radius,.029,5,16),sampleX,sampleY+.042,sampleZ,col===1?trim:chrome);
            ferrule.rotation.y=inward*Math.PI/2;
            if(col===0)cuboid(sampleX,sampleY-.084,sampleZ,.078,.054,.28,iron);
            else if(col===1){
              const spindle=solid(new T.CylinderGeometry(.038,.038,.102,12),sampleX,sampleY+.042,sampleZ,iron);
              spindle.rotation.z=Math.PI/2;
              for(let spoke=0;spoke<3;spoke++)cuboid(sampleX,sampleY+.042,sampleZ,.035,.30,.03,trim).rotation.x=spoke*Math.PI/3;
            }else cuboid(sampleX,sampleY-.119,sampleZ,.046,.20,.046,iron);
          }
        }
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
        const inward=x<s.x?1:-1;
        for(const drawerY of [.34,.79]){
          for(let col=0;col<3;col++)drawer(x+inward*(w/2+.01),drawerY,z+(col-1)*1.22,1.18,.412,inward*Math.PI/2);
          drawer(x,drawerY,z-d/2-.01,w-.08,.412,Math.PI);
        }
        cuboid(x+inward*(w/2+.009),.105,z,.047,.15,d,iron);
        for(let n=0;n<15;n++){
          const sleeve=cuboid(x,h+.17,z+(n-7)*.23,.68,.45,.035,[accent,iron,cream,wood][n%4]);
          sleeve.rotation.x=-.17;
          if(n>0&&(n%4===0||n===14)){
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
          if(s.id==='coast-records')for(const drawerY of [.33,.81])for(const offset of [-.64,.64])
            drawer(x+offset,drawerY,z-d/2-.011,1.22,.43,Math.PI);
          if(s.id==='harbour-supply'){
            // Painted matchboards wrap the till. Only the aisle-facing face carries
            // the brass order plate; the narrow ends retain vertical painted boards.
            for(const end of [-1,0,1]){
              const front=end===0;
              const skin=new T.PlaneGeometry(front?w-.06:d-.04,h-.13),uv=skin.getAttribute('uv');
              for(let i=0;i<uv.count;i++)uv.setXY(i,(513+(front?509:145)*uv.getX(i))/1024,
                (front?2+107*uv.getY(i):113+140*uv.getY(i))/1024);
              const face=solid(skin,x+end*(w/2+.008),h/2,z-(front?d/2+.008:0),labelMaterial);
              face.rotation.y=front?Math.PI:end*Math.PI/2;
            }
            cuboid(x,.087,z-d/2-.017,w+.025,.11,.052,iron);
            cuboid(x,h+.074,z-d*.34,w-.09,.015,.037,trim);
            for(let tick=0;tick<=20;tick++){
              const graduation=new T.PlaneGeometry(.013,tick%5===0?.034:.018);
              solid(graduation,x+(tick/20-.5)*(w-.14),h+.084,z-d*.34,iron).rotation.x=-Math.PI/2;
            }
          }
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
    if(s.id==='harbour-supply'){
      const boardUV=board.geometry.getAttribute('uv');
      for(let i=0;i<boardUV.count;i++)boardUV.setY(i,1-(1-boardUV.getY(i))*700/848);
      // Paired navigation lights are shop stock on the existing display sills.
      // Concentric prisms, a chimney and guard rods give the lenses a true silhouette.
      const brass=paint('#a98a58'),bronze=paint('#696346'),rackZ=edge+.105;
      for(const [number,side] of [1,-1].entries()){
        const x=s.x+side*4.42,glass=paint(number?'#408b72':'#b9503e');
        cuboid(x,1.032,rackZ,.91,.144,.40,wood);
        cuboid(x,1.111,rackZ,.95,.044,.43,brass);
        cylinder(x,1.18,rackZ,.187,.212,.10,bronze);
        cylinder(x,1.243,rackZ,.21,.198,.057,brass);
        const profile=[new T.Vector2(.154,0)];
        for(let ring=0;ring<5;ring++){
          const y=ring*.060;
          profile.push(new T.Vector2(.168,y+.006),new T.Vector2(.187,y+.024),new T.Vector2(.157,y+.056));
        }
        solid(new T.LatheGeometry(profile,12),x,1.272,rackZ,glass);
        cylinder(x,1.60,rackZ,.145,.216,.072,brass);
        cylinder(x,1.672,rackZ,.102,.13,.09,bronze);
        cylinder(x,1.733,rackZ,.065,.15,.047,brass);
        for(let guard=0;guard<4;guard++){
          const a=(guard+.5)*Math.PI/2;
          cuboid(x+.182*Math.cos(a),1.433,rackZ+.182*Math.sin(a),.021,.33,.021,brass);
        }
        const bail=solid(new T.TorusGeometry(.102,.012,4,14,Math.PI),x,1.735,rackZ,bronze);
        bail.rotation.y=side*.33;
        const tag=new T.PlaneGeometry(.83,.151),uv=tag.getAttribute('uv');
        for(let i=0;i<uv.count;i++)uv.setXY(i,(6+number*700+686*uv.getX(i))/1400,(8+132*uv.getY(i))/848);
        const sign=new T.Mesh(tag,board.material);sign.position.set(x,1.031,rackZ-.204);sign.rotation.y=Math.PI;street.add(sign);
      }
    }
    if(s.id==='coast-records'){
      const boardUV=board.geometry.getAttribute('uv');
      for(let i=0;i<boardUV.count;i++)boardUV.setY(i,1/3+boardUV.getY(i)*2/3);
      function jacket(x:number,y:number,z:number,size:number,yaw:number,cell:number){
        const geometry=new T.PlaneGeometry(size,size),uv=geometry.getAttribute('uv');
        for(let i=0;i<uv.count;i++)uv.setXY(i,(cell+.005+.99*uv.getX(i))/4,(.005+.99*uv.getY(i))/3);
        const print=new T.Mesh(geometry,board.material);
        print.position.set(x,y,z);print.rotation.order='YXZ';print.rotation.y=yaw;street.add(print);return print;
      }
      // A dimensional record and a striped tail form a single wall sign on the
      // approach from the diner. The roundel sits proud of the lettering panel.
      const alleyX=s.x-s.w/2,roundelZ=s.z-1.88,signY=2.64;
      cuboid(alleyX-.056,signY,s.z+.53,.10,1.23,4.52,iron);
      for(const h of [-.67,.67])cuboid(alleyX-.11,signY+h,s.z+.36,.12,.052,5.16,accent);
      const lettering=new T.PlaneGeometry(3.76,.96),letters=lettering.getAttribute('uv');
      for(let i=0;i<letters.count;i++)letters.setXY(i,.003+.994*letters.getX(i),facadeV((3-index+.70+.298*letters.getY(i))/4));
      const enamel=solid(lettering,alleyX-.112,signY,s.z+.81,facade);
      enamel.rotation.y=-Math.PI/2;enamel.castShadow=true;
      const recordFace=(radius:number,depth:number,material:T.Material)=>{
        const disc=solid(new T.CircleGeometry(radius,48),alleyX-depth,signY,roundelZ,material);
        disc.rotation.y=-Math.PI/2;
      };
      const rim=solid(new T.CylinderGeometry(1.06,1.06,.16,48,1,true),alleyX-.10,signY,roundelZ,accent);
      rim.rotation.z=Math.PI/2;
      recordFace(1.06,.181,accent);recordFace(1.006,.185,vinyl);
      for(const radius of [.59,.76,.91]){
        const groove=solid(new T.RingGeometry(radius,radius+.012,48),alleyX-.190,signY,roundelZ,iron);
        groove.rotation.y=-Math.PI/2;
      }
      recordFace(.37,.194,accent);recordFace(.27,.198,cream);recordFace(.075,.202,vinyl);
      for(const [wallIndex,bin] of parts.filter(p=>p.role==='bin').entries()){
        const side=bin.x<s.x?-1:1,wallX=s.x+side*(s.w/2-.29);
        // Enlarged sleeve prints and their actual records are paired on walnut rails above the bins.
        cuboid(wallX,1.77,bin.z,.16,.10,3.57,wood);
        for(const [slot,offset] of [-.83,.83].entries()){
          const z=bin.z+offset,cell=wallIndex*2+slot,frameX=wallX-side*.037;
          cuboid(frameX,2.32,z,.083,1.08,1.43,iron).castShadow=false;
          jacket(frameX-side*.048,2.32,z-.16,.87,-side*Math.PI/2,cell);
          const recordZ=z+.47,discX=frameX-side*.055;
          const record=solid(new T.CylinderGeometry(.157,.157,.014,18),discX,2.32,recordZ,vinyl);
          record.rotation.z=Math.PI/2;
          const centre=solid(new T.CylinderGeometry(.053,.053,.019,12),discX-side*.004,2.32,recordZ,slot?cream:accent);
          centre.rotation.z=Math.PI/2;
        }
        // The first item in each crate faces the street for browsing.
        jacket(bin.x,bin.h+.17,bin.z-7*.23-.026,.43,Math.PI,wallIndex*2).rotation.x=.17;
      }
    }
    const back=-s.d/2+.27;
    if(s.id==='diner'){
      detail(0,.12,back,s.w-.48,.07,.061,iron);
    }else{
      const panel=detail(0,.59,back,s.w-.48,1.18,.055,paintedBoards);
      const panelUV=panel.geometry.getAttribute('uv');
      for(let i=0;i<panelUV.count;i++)panelUV.setX(i,panelUV.getX(i)*s.w/1.6);
    }
    for(const side of [-1,1]){
      if(s.id==='diner')detail(side*(s.w/2-.27),.12,0,.063,.07,s.d-.52,iron);
      else if(s.id==='harbour-supply'){
        const length=(s.d-.52)/2;
        for(const half of [-1,1]){
          const boards=new T.PlaneGeometry(length,1.18),uv=boards.getAttribute('uv');
          for(let i=0;i<uv.count;i++)uv.setXY(i,(513+509*uv.getX(i))/1024,(113+140*uv.getY(i))/1024);
          solid(boards,s.x+side*(s.w/2-.27),.59,s.z+half*length/2,labelMaterial).rotation.y=-side*Math.PI/2;
        }
      }
      else detail(side*(s.w/2-.27),.59,0,.055,1.18,s.d-.52,wood);
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
    // Cut the canopy in cloth panels. Each bows between its stitched edges, runs
    // over the front roller and ends in a scallop that is visible from both sides.
    const stripeCount=Math.floor(s.w/.83),stripeWidth=(s.w-.32)/stripeCount;
    for(let n=0;n<stripeCount;n++){
      const positions:number[]=[],indices:number[]=[],coords:number[]=[];
      for(let i=0;i<=4;i++){
        const t=i/4,curve=Math.sin(t*Math.PI),x=(t-.5)*stripeWidth;
        const bow=.043*curve,hem=-.25-.115*curve;
        for(const [level,depth] of [[.105,-.03],[-.038-bow,.63],[-.095,1.14],
          [-.126,1.20],[hem,1.18],[hem,1.18],[-.116,1.157],[-.095,.63],[.086,-.03]]){
          positions.push(x,level,s.front*depth);coords.push(t,depth);
        }
        if(i===4)continue;
        for(let joint=0;joint<8;joint++){
          if(joint===4)continue; // The front and back meet along the cut fabric edge.
          const step=joint===3||joint===5?1:joint===2||joint>5?4:2;
          if(i%step)continue;
          const a=i*9+joint,b=a+step*9;
          if(s.front===1)indices.push(a,a+1,b,b,a+1,b+1);
          else indices.push(a,b,a+1,b,b+1,a+1);
        }
      }
      const fabric=new T.BufferGeometry();fabric.setIndex(indices);
      fabric.setAttribute('position',new T.Float32BufferAttribute(positions,3));fabric.setAttribute('uv',new T.Float32BufferAttribute(coords,2));
      fabric.computeVertexNormals();
      solid(fabric,s.x-(s.w-.32)/2+(n+.5)*stripeWidth,y,edge,n%2?canvas:cream);
    }
    cuboid(s.x,y-.12,edge+s.front*1.109,s.w-.30,.058,.076,iron);
    for(const dx of [-.41,0,.41]){
      cuboid(s.x+dx*s.w,y-.28,edge+s.front*.54,.055,.061,1.21,iron).rotation.x=-s.front*.25;
      cuboid(s.x+dx*s.w,y-.43,edge+s.front*.06,.13,.22,.08,wood);
    }
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
          for(let i=0;i<uv.count;i++)uv.setXY(i,.002+.996*uv.getX(i),atlasV(494-316*uv.getY(i)));
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
          for(let i=0;i<uv.count;i++)uv.setXY(i,u+.496*uv.getX(i),atlasV(index*512+432-200*uv.getY(i)));
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
      // The kitchen's closed serving hatch opens visually onto the harbour alley.
      // Its hood and ledger sit tight to the solid east wall, away from the front door.
      const galleyX=s.x+s.w/2,galleyZ=s.z+.62;
      const hatch=new T.PlaneGeometry(2.15,1.67),hatchUV=hatch.getAttribute('uv');
      for(let i=0;i<hatchUV.count;i++)
        hatchUV.setXY(i,(686+330*hatchUV.getX(i))/1024,atlasV(2338-283*hatchUV.getY(i)));
      const galley=solid(hatch,galleyX+.024,1.84,galleyZ,facade);
      galley.rotation.y=Math.PI/2;galley.castShadow=true;
      for(const side of [-1,1]){
        cuboid(galleyX+.046,1.84,galleyZ+side*1.095,.115,1.75,.070,wood);
        cuboid(galleyX+.103,2.55,galleyZ+side*.93,.14,.050,.039,iron).rotation.z=.46;
      }
      cuboid(galleyX+.12,1.36,galleyZ,.25,.057,2.20,cream);
      cuboid(galleyX+.096,2.73,galleyZ,.25,.062,2.32,accent).rotation.z=-.12;
      cuboid(galleyX+.211,2.69,galleyZ,.033,.077,2.32,cream);
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
  const timber=paint('#76624b'),lampEnamel=paint('#536860');
  for(const x of streetPoles){
    const poleZ=-29.2,shadeZ=-26.88;
    solid(new T.CylinderGeometry(.127,.172,7.4,9),x,3.7,poleZ,timber).castShadow=true;
    solid(new T.CylinderGeometry(.174,.184,.43,9),x,.215,poleZ,iron);
    cuboid(x,7.04,-29.2,.18,.16,1.65,timber);
    for(const offset of [-.70,0,.70]){
      const cups=new T.LatheGeometry([[.059,0],[.081,.044],[.049,.067],[.056,.123]]
        .map(([r,h])=>new T.Vector2(r,h)),6);
      solid(cups,x,offset===0?7.40:7.115,poleZ+offset,porcelain);
    }
    // A braced swan neck suspends an enamel shade over the street. Its rolled
    // lip and opal bowl are solid surfaces; they need no transparent pass.
    const arm=new T.CatmullRomCurve3([new T.Vector3(0,5.32,.10),new T.Vector3(0,5.62,.43),
      new T.Vector3(0,5.72,1.18),new T.Vector3(0,5.76,1.97),new T.Vector3(0,5.59,2.32)]);
    solid(new T.TubeGeometry(arm,6,.048,5,false),x,0,poleZ,iron);
    cuboid(x,5.47,poleZ+.13,.22,.42,.088,lampEnamel);
    cuboid(x,5.33,poleZ+.58,.055,.061,1.10,iron).rotation.x=-.46;
    // Turn the shade hem under to meet the opal bowl. Increasing radii wind
    // this underside toward the pavement; the outer shell then turns upward.
    const shield=new T.LatheGeometry([[.305,-.193],[.339,-.205],[.357,-.208],[.363,-.201],[.372,-.18],[.195,-.095],[.141,.03],[.085,.08]]
      .map(([r,h])=>new T.Vector2(r,h)),10);
    solid(shield,x,5.55,shadeZ,lampEnamel);
    const lens=new T.LatheGeometry([[0,-.326],[.228,-.287],[.305,-.193]]
      .map(([r,h])=>new T.Vector2(r,h)),10);
    solid(lens,x,5.55,shadeZ,porcelain);
  }
  // Mount the exchange telephone on the existing pole, on the seaward side of the footway.
  const phoneX=55,phoneZ=-28.91,phoneEnamel=paint('#355b54'),bakelite=paint('#302e29');
  cuboid(phoneX,1.54,phoneZ,.71,.97,.27,phoneEnamel);
  cuboid(phoneX,2.065,phoneZ+.056,.81,.075,.46,phoneEnamel).rotation.x=.085;
  for(const side of [-1,1])cuboid(phoneX+side*.351,1.55,phoneZ+.098,.046,.95,.21,phoneEnamel);
  function phonePlate(x:number,y:number,z:number,width:number,height:number,yaw:number,tile:number[]){
    const geometry=new T.PlaneGeometry(width,height),uv=geometry.getAttribute('uv');
    for(let i=0;i<uv.count;i++)uv.setXY(i,(tile[0]+uv.getX(i)*tile[2])/1536,1-(tile[1]+(1-uv.getY(i))*tile[3])/960);
    solid(geometry,x,y,z,pavingMaterial).rotation.y=yaw;
  }
  phonePlate(phoneX,1.55,phoneZ+.137,.66,.90,0,[756,706,208,240]);
  cuboid(phoneX-.218,1.56,phoneZ+.205,.068,.36,.09,bakelite).rotation.z=-.12;
  for(const y of [1.39,1.73]){
    const ear=solid(new T.CylinderGeometry(.075,.094,.094,12),phoneX-.216+(y-1.55)*.12,y,phoneZ+.21,bakelite);
    ear.rotation.x=Math.PI/2;
  }
  const flex=new T.CatmullRomCurve3([new T.Vector3(-.22,1.36,.21),new T.Vector3(-.25,1.11,.22),
    new T.Vector3(-.15,1.04,.19),new T.Vector3(-.10,1.22,.14)]);
  solid(new T.TubeGeometry(flex,9,.013,5,false),phoneX,0,phoneZ,bakelite);
  cuboid(phoneX,3.02,phoneZ+.52,.08,.075,1.47,iron);
  cuboid(phoneX,2.78,phoneZ+.66,.053,.43,1.31,phoneEnamel);
  for(const side of [-1,1])phonePlate(phoneX+side*.029,2.78,phoneZ+.66,1.29,.40,side*Math.PI/2,[283,705,462,138]);
  const points:number[]=[];
  for(let span=1;span<streetPoles.length;span++)for(const offset of [-.7,0,.7]){
    const start=streetPoles[span-1],end=streetPoles[span];
    const wireHeight=offset===0?7.52:7.24;
    for(let n=0;n<8;n++)for(const t of [n/8,(n+1)/8])points.push(start+(end-start)*t,wireHeight-2.4*t*(1-t),-29.2+offset);
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
