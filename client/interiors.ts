import {batchStaticMeshes} from './scenery';
import * as T from 'three';
import {doorBox,furnitureFor,initialInteriors,insideBuilding,interiorFixtures,roomThemes,type InteriorState} from '../shared/interiors';
import type {World,Box} from '../shared/world';
import type {Player,GameEvent} from '../shared/game';

export function createInteriors(scene:T.Scene,world:World){
 const root=new T.Group();root.name='building-interiors';scene.add(root);
 const materials:T.Material[]=[],textures:T.Texture[]=[];
 const material=(color:number)=>{const m=new T.MeshStandardMaterial({color,roughness:.85});materials.push(m);return m;};
 const wood=material(0x554434),metal=material(0x3d4642),fabric=material(0x77725b),paper=material(0xc9bb92),plaster=material(0x827365),dark=material(0x1d2524);
 const mesh=(b:Box,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(b.w,b.h,b.d),m);o.position.set(b.x,b.y,b.z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>mesh({x,y,z,w,h,d},m);
 function sign(text:string,x:number,y:number,z:number,width:number){
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#303a33';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#b8b08d';ctx.lineWidth=6;ctx.strokeRect(8,8,496,112);ctx.fillStyle='#dfd5b3';ctx.font='bold 40px serif';ctx.textAlign='center';ctx.fillText(text,256,80,470);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;textures.push(t);const m=new T.MeshStandardMaterial({map:t,roughness:1});materials.push(m);const plane=new T.Mesh(new T.PlaneGeometry(width,width/4),m);plane.position.set(x,y,z);root.add(plane);
 }
 const doors=new Map<string,T.Mesh>(),panes=new Map<string,T.Mesh>();
 const lampMaterials:T.MeshStandardMaterial[]=[],lamps:T.PointLight[]=[];
 const fixtures=interiorFixtures(world);let state=initialInteriors(world);
 const glass=new T.MeshPhysicalMaterial({color:0xa5c5ba,transparent:true,opacity:.24,roughness:.12,metalness:.1,side:T.DoubleSide,depthWrite:false});materials.push(glass);
 for(const f of fixtures){
  if(f.type==='door'){const o=mesh(doorBox(f,false),wood);doors.set(f.id,o);const handle=new T.Mesh(new T.BoxGeometry(.18,.05,.08),metal);handle.position.set(1.4,0,.13);o.add(handle);}
  if(f.type==='glass'){const o=mesh(f.box,glass);o.castShadow=false;panes.set(f.id,o);}
  if(f.type==='light'){mesh(f.box,paper);box(f.box.x,f.box.y,f.box.z+.07,.06,.12,.03,metal);}
 }
 world.buildings.forEach((b,index)=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
  for(let x=0;x<128;x+=16)for(let y=0;y<128;y+=16){ctx.fillStyle=index%3===0?((x+y)%32?'#8e8574':'#b4aa92'):((x/16)%2?'#70604a':'#806c50');ctx.fillRect(x,index%3===0?y:0,15,index%3===0?15:128);}
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(4,4);textures.push(tex);
  const floorMat=new T.MeshStandardMaterial({map:tex,roughness:.95});materials.push(floorMat);box(b.x,.012,b.z,b.w-.5,.025,b.d-.5,floorMat);
  if(b.upper)box(b.x,4.14,b.z,b.w-8,.025,b.d-.5,floorMat);
  for(const z of [-5,0,5])box(b.x,3.83,b.z+z,b.w-.5,.18,.18,wood);
  sign(roomThemes[index%roomThemes.length].toUpperCase(),b.x+4,2.65,b.z-b.d/2+.26,2.8);
  for(const f of furnitureFor(b,index)){
   const q=f.box,base=mesh(q,f.style==='sandbags'||f.style==='bed'?fabric:f.style==='stove'||f.style==='radio'?metal:f.style==='rubble'?plaster:wood);
   if(f.style==='desk'){box(q.x,q.y+q.h/2+.025,q.z,q.w+.06,.05,q.d+.06,wood);box(q.x-.4,q.y+q.h/2+.07,q.z,.55,.025,.38,paper);}
   if(f.style==='bench'){base.scale.y=.5;base.position.y=q.y-q.h/4;box(q.x,q.y+q.h/4,q.z-q.d/2+.05,q.w,q.h/2,.1,wood);}
   if(f.style==='radio'){for(const dx of [-.25,0,.25])box(q.x+dx,q.y,q.z+q.d/2+.012,.08,.08,.025,dark);box(q.x,q.y+.5,q.z,.025,.6,.025,metal);}
   if(f.style==='cabinet'){for(const dy of [-.7,0,.7])box(q.x,q.y+dy,q.z+q.d/2+.012,q.w-.1,.035,.02,dark);}
   if(f.style==='bed')box(q.x,q.y+q.h/2+.06,q.z-.65,q.w*.8,.12,.45,paper);
   if(f.style==='sandbags'){base.removeFromParent();base.geometry.dispose();for(let row=0;row<3;row++)for(let col=0;col<3;col++){const bag=new T.Mesh(new T.SphereGeometry(1,8,6),fabric);bag.position.set(q.x-q.w/3+col*q.w/3,q.y-q.h/2+(row+.5)*q.h/3,q.z);bag.scale.set(q.w/5,q.h/6,q.d/2);bag.castShadow=true;root.add(bag);}}
   if(f.style==='rubble'){box(q.x+.3,q.y+.1,q.z,.3,.1,.3,plaster);}
   if(f.label)sign(f.label,q.x,q.y+.1,q.z+q.d/2+.03,q.w*.9);
  }
  const lamp=material(0xd9c596);lamp.emissive.set(0xffc67d);lampMaterials.push(lamp);
  for(const level of b.upper?[0,4]:[0]){box(b.x,level+3.35,b.z,1.4,.12,.4,lamp);box(b.x,level+3.65,b.z,.04,.5,.04,metal);const light=new T.PointLight(0xffd59b,0,14,2);light.position.set(b.x,level+3.1,b.z);light.userData.building=index;lamps.push(light);root.add(light);}
  // Chipped plaster, masonry edges and bullet scars on interior wall faces.
  for(let n=0;n<12;n++){const x=b.x-5.5+(n%4)*3.5,y=.4+(n%3)*.82;box(x,y,b.z+b.d/2-.24,.24+(n%3)*.12,.12,.025,n%2?plaster:dark);}
  for(const side of [-1,1]){box(b.x+side*(b.w/2-.26),1.1,b.z-1.7,.12,2.2,.15,plaster);box(b.x+side*(b.w/2-.26),1.1,b.z+1.7,.12,2.2,.15,plaster);}
 });
 batchStaticMeshes(root,new Set<T.Object3D>([...doors.values(),...panes.values()]));
 const dustGeometry=new T.BufferGeometry(),dustPositions=new Float32Array(72*3);dustGeometry.setAttribute('position',new T.BufferAttribute(dustPositions,3));
 const dustMaterial=new T.PointsMaterial({color:0xf1dfb7,size:.018,transparent:true,opacity:.23,depthWrite:false});materials.push(dustMaterial);const dust=new T.Points(dustGeometry,dustMaterial);root.add(dust);
 const marks=new T.InstancedMesh(new T.SphereGeometry(.026,5,4),dark,48);marks.count=0;root.add(marks);let markIndex=0;
 const shards:{mesh:T.Mesh;velocity:T.Vector3;life:number}[]=[];const shardGeometry=new T.TetrahedronGeometry(.06);const shardMat=material(0xb4d4cc);
 function sync(next:InteriorState|undefined){state=next??state;for(const f of fixtures){if(f.type==='door'){const q=doorBox(f,!!state.doors[f.id]),o=doors.get(f.id)!;o.position.set(q.x,q.y,q.z);o.rotation.y=state.doors[f.id]?Math.PI/2:0;}if(f.type==='glass')panes.get(f.id)!.visible=!state.broken.includes(f.id);} }
 sync(state);
 return {sync,
  interaction(p:Player,yaw:number){
   return fixtures.filter(f=>f.type!=='glass').map(f=>{const x=f.type==='door'?f.box.x+1.7:f.box.x,dx=x-p.x,dz=f.box.z-p.z;return {f,distance:Math.hypot(dx,dz,f.box.y-p.y-1.5),dot:dx*-Math.sin(yaw)+dz*-Math.cos(yaw)};}).filter(v=>v.distance<2.7&&v.dot>.1).sort((a,b)=>a.distance-b.distance)[0]?.f;
  },label(id:string){return id.startsWith('door')?(state.doors[id]?'Tür schließen':'Tür öffnen'):(state.lights[id]?'Licht ausschalten':'Licht einschalten');},
  impact(e:GameEvent){if(!e.point)return;if(e.type==='shot'){marks.setMatrixAt(markIndex%48,new T.Matrix4().makeTranslation(...e.point));marks.count=Math.min(48,++markIndex);marks.instanceMatrix.needsUpdate=true;marks.computeBoundingSphere();}if(e.type==='glass'){for(let n=0;n<12&&shards.length<72;n++){const mesh=new T.Mesh(shardGeometry,shardMat);mesh.position.set(...e.point);root.add(mesh);shards.push({mesh,velocity:new T.Vector3(Math.sin(n*7)*2,Math.cos(n)*2,Math.cos(n*7)*2),life:1.4});}}},
  update(p:Player|undefined,time:number,dt:number){
   const location=new T.Vector3(p?.x??0,p?.y??0,p?.z??0);
   const nearest=[...lamps].sort((a,b)=>a.position.distanceToSquared(location)-b.position.distanceToSquared(location)).slice(0,4);
   for(const l of lamps){const on=state.lights[`light-${l.userData.building}`]!==false;l.visible=nearest.includes(l);l.intensity=on&&l.visible?38*(1+.025*Math.sin(time*.014+l.userData.building)):0;}
   lampMaterials.forEach((m,n)=>m.emissiveIntensity=state.lights[`light-${n}`]===false?0:1.1);
   const room=p?insideBuilding(world,p.x,p.z):-1;dust.visible=room>=0&&state.lights[`light-${room}`]!==false;
   if(room>=0){const b=world.buildings[room];for(let n=0;n<72;n++){dustPositions[n*3]=b.x+Math.sin(n*12.3+time*.00007)*5;dustPositions[n*3+1]=.3+((n*.173+time*.00004)%3);dustPositions[n*3+2]=b.z+Math.cos(n*8.7+time*.0001)*5;}dustGeometry.attributes.position.needsUpdate=true;dustGeometry.computeBoundingSphere();}
   for(let n=shards.length-1;n>=0;n--){const s=shards[n];s.life-=dt;if(s.life<=0){s.mesh.removeFromParent();shards.splice(n,1);continue;}s.velocity.y-=9.8*dt;s.mesh.position.addScaledVector(s.velocity,dt);s.mesh.rotation.x+=dt*3;}
  },dispose(){root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points)o.geometry.dispose();});materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());shardGeometry.dispose();marks.dispose();root.removeFromParent();}};
}
