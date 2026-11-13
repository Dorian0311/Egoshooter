import * as T from 'three';
import type {Building} from '../shared/world';
import {projectBoxUVs} from './materials';
import {batchStaticMeshes} from './scenery';

/** Flat military roofs and service hardware above the existing solid roof slab. */
export function addMilitaryRoofs(scene:T.Scene,buildings:Building[],get:(color:string)=>T.MeshStandardMaterial){
 const root=new T.Group();root.name='military-roof-details';scene.add(root);
 const steel=get('#303936'),concrete=get('#827866'),paint=new T.MeshStandardMaterial({color:'#677b74',metalness:.4,roughness:.6});
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,material:T.MeshStandardMaterial)=>{const geometry=new T.BoxGeometry(w,h,d);projectBoxUVs(geometry,new T.Vector3(x,y,z));const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
 for(const [index,b]of buildings.entries()){
  const top=(b.upper?8:4)+.3;
  for(const side of [-1,1]){
   box(b.x,top+.24,b.z+side*b.d/2,b.w+.45,.48,.26,concrete);
   box(b.x+side*b.w/2,top+.24,b.z,.26,.48,b.d,concrete);
   box(b.x,3.12,b.z+side*(b.d/2+.95),4.8,.16,1.85,paint);
   for(const x of [-2.25,2.25])box(b.x+x,2.75,b.z+side*(b.d/2+.65),.08,.8,.08,steel);
   // Narrow band under the roof and exposed downpipes reinforce the modern silhouette.
   box(b.x,top-.25,b.z+side*(b.d/2+.27),b.w,.16,.08,paint);
  }
  box(b.x+3,top+.52,b.z-2,2.2,1.04,1.3,paint);
  for(let n=0;n<11;n++)box(b.x+2.1+n*.18,top+.55,b.z-1.33,.055,.74,.04,steel);
  for(const dx of [-.55,.55]){const fan=new T.Mesh(new T.CylinderGeometry(.39,.39,.06,20),steel);fan.position.set(b.x+3+dx,top+1.07,b.z-2);root.add(fan);}
  if(index%2===0){
   const mast=new T.Mesh(new T.CylinderGeometry(.025,.06,3.2,8),steel);mast.position.set(b.x-5,top+1.6,b.z-3);root.add(mast);
   for(let n=0;n<3;n++)box(b.x-5,top+1.9+n*.45,b.z-3,1.3-n*.22,.025,.025,steel);
  }
 }
 batchStaticMeshes(root,new Set());
 return ()=>paint.dispose();
}
