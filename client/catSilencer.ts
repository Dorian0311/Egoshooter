import * as T from 'three';
import {batchWeaponMeshes} from './batchWeaponMeshes';

/** A rigid calico mascot for the Island MP 40 viewmodel. Face points towards the player. */
export function createCatSilencer(){
  const cat=new T.Group();
  cat.name='calico-silencer';
  const fabric=(color:string)=>new T.MeshStandardMaterial({color,roughness:1,flatShading:true});
  const cream=fabric('#e5cda8'),ginger=fabric('#b45d2d'),charcoal=fabric('#3c302d'),rose=fabric('#b58077');
  const sphere=new T.SphereGeometry(1,12,8);
  const ear=new T.ConeGeometry(1,1,3);
  function part(material:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,geometry:T.BufferGeometry=sphere){
    const mesh=new T.Mesh(geometry,material);
    mesh.position.set(x,y,z);mesh.scale.set(w,h,d);cat.add(mesh);return mesh;
  }
  part(ginger,0,0,-.08,.09,.09,.19);
  part(cream,0,.035,.073,.10,.091,.077);
  for(const side of [-1,1]){
    part(side<0?ginger:charcoal,side*.063,.123,.058,.042,.076,.044,ear);
    part(rose,side*.063,.123,.081,.023,.044,.015,ear);
    part(charcoal,side*.036,.049,.144,.011,.015,.008);
    for(const z of [.01,-.18])part(cream,side*.061,-.086,z,.032,.072,.035);
  }
  part(rose,0,.023,.151,.015,.01,.008);
  part(charcoal,.061,.058,-.126,.04,.043,.083);
  part(ginger,0,.039,-.251,.027,.09,.031).rotation.x=-.58;
  batchWeaponMeshes(cat);
  cat.visible=false;
  return cat;
}
