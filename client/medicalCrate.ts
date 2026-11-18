import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Shared rounded red case and white lid/crosses: two draws per pickup. */
export function createMedicalCrates(){
 const roundedBody=new RoundedBoxGeometry(.62,.40,.46,2,.025);
 const topCross=[new T.BoxGeometry(.25,.008,.065).translate(0,.229,0).toNonIndexed(),new T.BoxGeometry(.065,.008,.25).translate(0,.229,0).toNonIndexed()];
 const body=mergeGeometries([roundedBody,...topCross])!;roundedBody.dispose();topCross.forEach(g=>g.dispose());
 const red=new T.MeshStandardMaterial({color:'#bc2635',roughness:.65});
 const white=new T.MeshStandardMaterial({color:'#f2f0e7',roughness:.7});
 const pieces:T.BufferGeometry[]=[];
 const box=(x:number,y:number,z:number,w:number,h:number,d:number)=>pieces.push(new T.BoxGeometry(w,h,d).translate(x,y,z).toNonIndexed());
 box(0,.19,0,.63,.07,.47);
 // White medical cross on both sides and on the lid; visible from the approach.
 for(const side of [-1,1]){box(0,-.015,side*.232,.23,.065,.008);box(0,-.015,side*.232,.065,.23,.008);}
 // Carry handle with an open centre, rather than a solid block.
 for(const x of [-.10,.10])box(x,.255,0,.035,.055,.045);
 box(0,.285,0,.235,.035,.045);
 const markings=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());
 return {
  create(){const group=new T.Group();group.name='red-white-medical-crate';
   for(const [geometry,material]of [[body,red],[markings,white]] as const){const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
   return group;
  },
  dispose(){body.dispose();markings.dispose();red.dispose();white.dispose();},
 };
}
