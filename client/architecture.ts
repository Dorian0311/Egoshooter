import * as T from 'three';
import type { Building } from '../shared/world.ts';
import { projectBoxUVs } from './materials.ts';

export const facadePalette=['#cec1a5','#a9b1ad','#bdaa96','#d2cfbf'];
export function facadeColor(index:number){return facadePalette[index%facadePalette.length];}

/** Architectural relief on the existing wall footprint. Doorways and side firing
 * openings remain open; opaque facade windows are inset within their surrounds. */
export function addArchitecture(scene:T.Scene,buildings:Building[],get:(color:string)=>T.MeshStandardMaterial) {
  const stone=get('#9d8b75'),brick=get('#c1b59a'),wood=get('#67513d');
  const painted=get('#3e514b'),interior=get('#121d20'),glass=get('#7b8a82'),curtain=get('#b6b09a');
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,material:T.MeshStandardMaterial)=>{
    const geometry=new T.BoxGeometry(w,h,d),mesh=new T.Mesh(geometry,material);
    mesh.position.set(x,y,z);if(material.map)projectBoxUVs(geometry,mesh.position,2.5);
    mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
  };
  for(const [index,b]of buildings.entries()){
    const height=b.upper?8:4;
    for(const side of [-1,1]){
      const z=b.z+side*(b.d/2+.245);
      // Lower masonry and dressed stone corners break the repeating plaster wall.
      for(const direction of [-1,1]){
        box(b.x+direction*(b.w/4+1),.38,z,b.w/2-2,.76,.12,brick);
        box(b.x+direction*2.08,1.5,z,.18,3,.22,stone);
      }
      box(b.x,3.03,z,4.5,.22,.28,stone);
      box(b.x,3.22,z+side*.05,4.7,.10,.36,stone);
      if(b.upper)box(b.x,4.16,z,b.w,.18,.17,stone);
      for(const dx of [-b.w/2+.2,b.w/2-.2])for(let y=.3;y<height;y+=.46){
        box(b.x+dx,y,z,.45,.37,.12,stone);
      }
      for(const dx of [-5.5,5.5])for(const y of b.upper?[1.9,5.9]:[1.9]){
        const x=b.x+dx;
        // Dark recess, deep reveals, stone lintel and projecting sloped sill.
        box(x,y,z+side*.025,1.50,1.94,.035,interior);
        box(x,y-.99,z+side*.14,1.86,.16,.46,stone);
        box(x,y+1.02,z+side*.07,1.83,.20,.29,stone);
        for(const direction of [-1,1]){
          box(x+direction*.81,y,z+side*.08,.14,1.92,.24,stone);
          box(x+direction*.69,y,z+side*.10,.09,1.82,.10,painted);
        }
        for(const offset of [-.88,0,.88])box(x,y+offset,z+side*.10,1.46,.07,.10,painted);
        box(x,y,z+side*.11,.055,1.8,.11,painted);
        for(const direction of [-1,1])for(const row of [-1,1]){
          const pane=box(x+direction*.35,y+row*.44,z+side*.066,.62,.79,.025,glass);
          pane.castShadow=false;
        }
        // A few closed curtains and asymmetric shutters give buildings individual use.
        if((index+(dx>0?1:0))%3===0){
          for(const direction of [-1,1])box(x+direction*.54,y,z+side*.086,.19,1.7,.018,curtain).castShadow=false;
        }
        for(const direction of [-1,1]){
          const shutterX=x+direction*1.12;
          box(shutterX,y,z+side*.05,.42,1.92,.07,painted);
          for(const dy of [-.79,.79])box(shutterX,y+dy,z+side*.10,.42,.08,.055,wood);
          for(let slat=0;slat<9;slat++){
            const louver=box(shutterX,y-.67+slat*.165,z+side*.105,.34,.10,.045,painted);
            louver.rotation.x=side*.23;
          }
        }
      }
      // Eaves cast a narrow contact shadow and conceal the roof/wall join.
      box(b.x,height-.10,z,b.w+.6,.14,.32,wood);
      box(b.x,height+.08,z,b.w+.8,.13,.43,stone);
      // Existing side openings: frames only, so movement and firing remain aligned.
      const x=b.x+side*(b.w/2+.245);
      box(x,.42,b.z,.12,.84,b.d,brick);
      for(const dz of [-3.25,3.25]){
        box(x,1.18,b.z+dz,.32,.13,3.55,stone);
        box(x,2.79,b.z+dz,.23,.18,3.55,stone);
        for(const edge of [-1,1])box(x,1.98,b.z+dz+edge*1.72,.16,1.5,.10,painted);
      }
    }
    // Chimney crown, flue and terracotta pots; all above the existing roof collider.
    const chimneyY=b.upper?9:5;
    box(b.x+5,chimneyY+.86,b.z-4,1.15,.18,1.15,stone);
    for(const offset of [-.25,.25]){
      const pipe=new T.Mesh(new T.CylinderGeometry(.13,.16,.52,10),get('#795744'));
      pipe.position.set(b.x+5+offset,chimneyY+1.18,b.z-4);pipe.castShadow=true;scene.add(pipe);
      const opening=new T.Mesh(new T.CircleGeometry(.115,10),interior);
      opening.rotation.x=-Math.PI/2;opening.position.copy(pipe.position);opening.position.y+=.262;scene.add(opening);
    }
  }
}
