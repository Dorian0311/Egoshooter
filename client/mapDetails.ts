import * as T from 'three';
import type {Box,World} from '../shared/world';
import {batchStaticMeshes,createRiver} from './scenery';
import {projectBoxUVs} from './materials';
import {createBattleTerrain} from './battleTerrain';

export const detailedPropKinds=new Set(['sandbags','container','truck','ruin','tree','platform']);

/** All substantial playable props follow shared collision boxes. Small dressing
 * stays below step height, on existing walls, or beyond the walking boundary. */
export function createMapDetails(scene:T.Scene,world:World,get:(color:string)=>T.MeshStandardMaterial,camera:T.Camera){
  const root=new T.Group();root.name='map-dressing-'+world.id;scene.add(root);
  const island=world.id==='storm',war=world.id==='frontline';
  const colors=new Map<string,T.MeshStandardMaterial>();
  function material(color:string,metalness=0,roughness=.85){
    const key=color+':'+metalness+':'+roughness;
    let value=colors.get(key);if(!value){value=new T.MeshStandardMaterial({color,metalness,roughness});colors.set(key,value);}return value;
  }
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,parent:T.Object3D=root)=>{
    const geometry=new T.BoxGeometry(w,h,d);projectBoxUVs(geometry,new T.Vector3(x,y,z),2.5);
    const mesh:T.Mesh<T.BufferGeometry,T.Material>=new T.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const cylinder=(x:number,y:number,z:number,r:number,h:number,mat:T.Material,segments=12)=>{
    const mesh=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const olive=material('#53654f',.18,.68),sand=material('#a59973'),rubber=material('#25292b',0,.94),steel=material('#515e62',.8,.35);
  function sandbags(b:Box){
    const rows=Math.max(2,Math.ceil(b.h/.27)),columns=Math.max(2,Math.ceil(b.w/.7));
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const bag=box(b.x-b.w/2+(col+.5)*b.w/columns,b.y-b.h/2+(row+.5)*b.h/rows,b.z+(row%2?.04:-.04),b.w/columns*.97,b.h/rows*.92,b.d,material(row%3?'#aaa17d':'#8b886d'));
      // Slightly rounded sacks read as stacked fabric, not a perfectly flat wall.
      const rounded=new T.CapsuleGeometry(b.h/rows*.45,Math.max(.02,b.w/columns-b.h/rows),4,8);
      bag.geometry.dispose();bag.geometry=rounded;bag.rotation.z=Math.PI/2;bag.scale.z=b.d/(b.h/rows*.9);
    }
  }
  function container(b:Box,index:number){
    const paint=material(index%2?'#476d79':'#9f694c',.45,.59);
    box(b.x,b.y,b.z,b.w,b.h,b.d,paint);
    for(const side of [-1,1]){
      for(let i=0;i<23;i++)box(b.x-b.w/2+(i+.5)*b.w/23,b.y,b.z+side*(b.d/2+.025),.065,b.h-.12,.05,paint);
      box(b.x,b.y-b.h/2+.08,b.z+side*(b.d/2+.04),b.w+.06,.13,.10,steel);
      box(b.x,b.y+b.h/2-.08,b.z+side*(b.d/2+.04),b.w+.06,.13,.10,steel);
      box(b.x+side*b.w/2,b.y,b.z,.08,b.h,.08,steel);
    }
    for(const z of [-.72,.72])box(b.x+b.w/2+.035,b.y,b.z+z,.06,b.h-.20,.045,steel);
    box(b.x,b.y+b.h/2+.025,b.z,b.w,.05,b.d,paint);
  }
  function truck(b:Box){
    box(b.x,b.y-.15,b.z,b.w*.82,b.h*.45,b.d*.94,olive);
    box(b.x-b.w*.31,b.y+.3,b.z,b.w*.30,b.h*.62,b.d*.91,olive);
    const glass=material('#264855',.3,.16);
    box(b.x-b.w*.31,b.y+.63,b.z,b.w*.28,.52,b.d*.94,glass);
    box(b.x+b.w*.14,b.y+.44,b.z,b.w*.55,.8,b.d*.98,material('#787f61'));
    for(const side of [-1,1])for(const x of [-b.w*.3,b.w*.28]){
      const wheel=cylinder(b.x+x,.55,b.z+side*b.d*.43,.55,.30,rubber,16);wheel.rotation.x=Math.PI/2;
      const hub=cylinder(b.x+x,.55,b.z+side*b.d*.51,.23,.32,steel);hub.rotation.x=Math.PI/2;
    }
    box(b.x-b.w*.48,.65,b.z,.13,.32,b.d,steel);
    for(const z of [-b.d*.33,b.d*.33]){const lamp=cylinder(b.x-b.w*.49,.97,b.z+z,.11,.09,material('#d8cfaa',.1,.25));lamp.rotation.z=Math.PI/2;}
  }
  function palm(b:Box,index:number){
    const trunk=cylinder(b.x,b.y,b.z,b.w/2,b.h,get('#67513d'),9);
    for(let ring=0;ring<12;ring++){
      const band=new T.Mesh(new T.TorusGeometry(b.w*.47,.018,4,9),material('#9b8d65'));band.rotation.x=Math.PI/2;band.position.set(b.x,b.h*(ring+.5)/12,b.z);root.add(band);
    }
    trunk.rotation.z=(index%2?1:-1)*.015;
    for(let frond=0;frond<9;frond++){
      const angle=frond*Math.PI*2/9+index*.3,positions:number[]=[],uv:number[]=[],indices:number[]=[];
      for(let n=0;n<=8;n++){
        const t=n/8,r=t*3.7,width=Math.sin(Math.PI*t)*.48;
        for(const side of [-1,1]){
          positions.push(Math.cos(angle)*r+Math.sin(angle)*width*side,b.h+.8*Math.sin(t*Math.PI)-t*t*1.5,Math.sin(angle)*r-Math.cos(angle)*width*side);uv.push(t,(side+1)/2);
        }
        if(n<8){const k=n*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
      const leaf=material(frond%3?'#427a3b':'#689d47');leaf.side=T.DoubleSide;
      const mesh=new T.Mesh(geometry,leaf);mesh.position.set(b.x,0,b.z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    }
  }
  for(const [index,b]of world.boxes.entries()){
    if(b.kind==='sandbags')sandbags(b);
    if(b.kind==='container')container(b,index);
    if(b.kind==='truck')truck(b);
    if(b.kind==='tree')palm(b,index);
    if(b.kind==='platform'){
      box(b.x,b.y,b.z,b.w,b.h,b.d,get('#9d8b75'));
      for(const side of [-1,1])box(b.x,b.y+b.h/2-.08,b.z+side*b.d/2,b.w+.2,.16,.25,olive);
      cylinder(0,5.5,0,.13,5,steel);
      const radar=new T.Group();radar.position.set(0,7.6,0);radar.rotation.z=-.55;root.add(radar);
      const dishMaterial=material('#c9d4c9',.55,.4);dishMaterial.side=T.DoubleSide;
      const profile=Array.from({length:15},(_,i)=>new T.Vector2(i/14*1.7,Math.pow(i/14,2)*.55));
      const dish=new T.Mesh(new T.LatheGeometry(profile,40),dishMaterial);dish.castShadow=true;radar.add(dish);
      const rim=new T.Mesh(new T.TorusGeometry(1.7,.035,6,40),steel);rim.rotation.x=Math.PI/2;rim.position.y=.55;radar.add(rim);
      const feed=new T.Mesh(new T.CylinderGeometry(.1,.08,.35,10),steel);feed.position.y=1.15;radar.add(feed);
      for(let n=0;n<3;n++){
        const angle=n*Math.PI*2/3,start=new T.Vector3(Math.cos(angle)*1.65,.55,Math.sin(angle)*1.65),end=new T.Vector3(0,1.15,0),direction=end.clone().sub(start);
        const brace=new T.Mesh(new T.CylinderGeometry(.025,.025,direction.length(),6),steel);brace.position.copy(start).add(end).multiplyScalar(.5);brace.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());radar.add(brace);
      }
      box(0,3.2,0,1,.4,1,olive);
      for(const side of [-1,1]){
        const panel=box(side*3.2,3.85,-3,2.6,.12,1.8,material('#263f58',.4,.26));panel.rotation.x=-.25;
        for(let n=0;n<7;n++)box(side*3.2-1.1+n*.35,3.94,-3,.025,.025,1.65,material('#87969f',.6,.35));
      }
      for(const x of [-1.6,1.6])box(x,3.8,1.5,.9,1.6,.7,olive);
    }
    if(b.kind==='ruin'){
      box(b.x,b.y,b.z,b.w,b.h,b.d,get('#c1b59a'));
      for(let n=0;n<7;n++){const chunk=box(b.x-b.w/2+(n+.5)*b.w/7,b.y+b.h/2+(n%3)*.11,b.z,.55,.25+(n%3)*.12,b.d*.9,get('#9d8b75'));chunk.rotation.z=(n%2?.1:-.1);}
    }
    if(war&&b.kind==='wagon'){
      // Existing shared body collider remains the full extent of the rail car.
      for(const side of [-1,1])for(const x of [-3.7,3.7]){const wheel=cylinder(b.x+x,.45,b.z+side*1.30,.5,.22,steel,16);wheel.rotation.x=Math.PI/2;}
      for(let i=0;i<22;i++)box(b.x-b.w/2+(i+.5)*b.w/22,b.y,b.z+b.d/2+.025,.055,b.h,.055,get('#67513d'));
      for(const x of [-4.8,4.8])box(b.x+x,b.y,b.z+b.d/2+.05,.1,b.h,.08,steel);
    }
  }
  let ocean:ReturnType<typeof createRiver>|undefined;
  const terrain=island||war?createBattleTerrain(world,get(island?'#718a48':'#77766b'),get('#d0b37c')):undefined;
  if(terrain)root.add(terrain.mesh);
  if(island){
    ocean=createRiver(scene,1000,1000,-3.4);
    // Distant rock islands and buoys remain outside the playable square.
    for(let i=0;i<10;i++){
      const angle=i*Math.PI*2/10,r=150+(i%3)*18;
      const rock=new T.Mesh(new T.DodecahedronGeometry(10+(i%3)*4,1),get('#818783'));rock.position.set(Math.cos(angle)*r,-1,Math.sin(angle)*r);rock.scale.y=.5+(i%2)*.4;root.add(rock);
    }
    for(let i=0;i<80;i++){
      const x=Math.sin(i*29.13)*69,z=Math.cos(i*17.71)*69;
      if(Math.abs(x)<9||Math.abs(z)<7||world.boxes.some(b=>Math.abs(x-b.x)<b.w/2+2&&Math.abs(z-b.z)<b.d/2+2))continue;
      const bush=new T.Mesh(new T.IcosahedronGeometry(.45+(i%3)*.17,1),material(i%2?'#497c39':'#718d3c'));bush.position.set(x,.3,z);bush.scale.set(1,.7,1.2);bush.castShadow=true;root.add(bush);
    }
  }
  if(war){
    // Twin rail lines, sleepers and broken paving give the courtyard a clear use.
    for(const z of [-12,12]){
      for(const offset of [-.8,.8])box(0,.055,z+offset,234,.11,.09,steel);
      for(let x=-116;x<=116;x+=1.4)box(x,.018,z,.22,.036,2.5,get('#67513d'));
    }
    for(const side of [-1,1])for(const z of [-31,-25]){
      // Chimneys sit on the now-accessible machine halls.
      cylinder(side*92,19,z,1.3,26,get('#9d8b75'),14);
      cylinder(side*92,32,z,1.5,.5,steel,14);
    }
  }
  // Ground-level chips and sparse weeds: deterministic, batched, no gameplay
  // obstacles. Keep door openings and the bridge's water entirely clear.
  for(const [index,b]of world.buildings.entries())for(const side of [-1,1]){
    for(let n=0;n<(island?10:28);n++){
      const x=b.x+Math.sin(n*13.71+index)*b.w*.48;
      if(Math.abs(x-b.x)<2.7)continue;
      const z=b.z+side*(b.d/2+.45+(n%4)*.28);
      const chip=box(x,.035+(n%3)*.018,z,.09+(n%4)*.09,.07+(n%3)*.036,.12+(n%5)*.07,get(n%3?'#9d8b75':'#c1b59a'));
      chip.rotation.y=n*1.9;chip.rotation.z=(n%3)*.1;
      if(n%5===0){const weed=new T.Mesh(new T.ConeGeometry(.14,.32,5),material('#5b6b42'));weed.position.set(x,.16,z);root.add(weed);}
    }
    // Cables, drainpipes and wall-mounted lamps break up large flat facades.
    for(const dx of [-b.w/2+.55,b.w/2-.55]){
      cylinder(b.x+dx,(b.upper?8:4)/2,b.z+side*(b.d/2+.31),.055,b.upper?8:4,steel,7);
    }
    const lamp=box(b.x+2.7,2.8,b.z+side*(b.d/2+.43),.24,.35,.18,steel);
    box(lamp.position.x,2.77,lamp.position.z+side*.10,.17,.21,.025,material('#cfbb82',.1,.35));
  }
  // Low kerbs establish street edges without introducing invisible collisions.
  if(!island)for(const b of world.buildings)for(const side of [-1,1])box(b.x,.055,b.z+side*(b.d/2+1.6),b.w+1,.11,.35,get('#9d8b75'));
  batchStaticMeshes(root,new Set());
  return {update(seconds:number){ocean?.update(seconds);},dispose(){terrain?.dispose();colors.forEach(m=>m.dispose());}};
}
