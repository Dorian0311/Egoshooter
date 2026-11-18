import * as T from 'three';
import {batchWeaponMeshes} from './batchWeaponMeshes';

export function createGadgetModels(){
  const materials=[
    new T.MeshStandardMaterial({color:'#af3624',metalness:.2,roughness:.42}),
    new T.MeshStandardMaterial({color:'#252a29',roughness:.8}),
    new T.MeshStandardMaterial({color:'#cec6a7',metalness:.55,roughness:.4}),
    new T.MeshStandardMaterial({color:'#4a573b',metalness:.4,roughness:.6}),
    new T.MeshStandardMaterial({color:'#ffaa43',emissive:'#aa360e',emissiveIntensity:1.5}),
  ];
  function part(group:T.Group,geometry:T.BufferGeometry,index:number,x:number,y:number,z:number){
    const mesh=new T.Mesh(geometry,materials[index]);
    mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);
    return mesh;
  }
  const box=(group:T.Group,index:number,x:number,y:number,z:number,w:number,h:number,d:number)=>
    part(group,new T.BoxGeometry(w,h,d),index,x,y,z);
  const car=new T.Group();
  box(car,0,0,.12,0,.34,.12,.57);
  box(car,0,0,.13,-.26,.42,.07,.14);
  box(car,2,0,.28,.24,.44,.028,.10);
  box(car,1,0,.20,.23,.04,.14,.04);
  box(car,3,0,.226,.03,.20,.15,.28);
  box(car,2,0,.3,.04,.032,.008,.28);
  box(car,4,0,.309,-.04,.055,.014,.046);
  box(car,2,.13,.27,.18,.013,.18,.013);
  for(const x of [-.174,.174])for(const z of [-.18,.18]){
    part(car,new T.CylinderGeometry(.096,.096,.075,14),1,x,.10,z).rotation.z=Math.PI/2;
    part(car,new T.CylinderGeometry(.047,.047,.079,10),2,x,.10,z).rotation.z=Math.PI/2;
  }

  const rocket=new T.Group();
  part(rocket,new T.CylinderGeometry(.018,.018,.37,10),2,0,0,-.09).rotation.x=Math.PI/2;
  part(rocket,new T.CylinderGeometry(.067,.06,.18,14),3,0,0,.155).rotation.x=Math.PI/2;
  part(rocket,new T.ConeGeometry(.067,.095,14),3,0,0,.288).rotation.x=Math.PI/2;
  for(let n=0;n<3;n++){
    const fin=box(rocket,3,0,0,-.211,.015,.12,.06);
    const angle=n*Math.PI*2/3;
    fin.position.set(Math.sin(angle)*.04,Math.cos(angle)*.04,-.211);
    fin.rotation.z=-angle;
  }
  batchWeaponMeshes(car);batchWeaponMeshes(rocket);
  return {car:()=>car.clone(true),rocket:()=>rocket.clone(true),dispose(){
    for(const group of [car,rocket])group.traverse(object=>{if(object instanceof T.Mesh)object.geometry.dispose();});
    materials.forEach(material=>material.dispose());
  }};
}
