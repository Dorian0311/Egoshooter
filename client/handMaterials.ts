import * as T from 'three';
import {handSurface,projectGripSkin,sleeveSurface} from './gripSurfaces';

/** One skin and one cloth material per owned model, shared by both sides. */
export function applyHandMaterials(root:T.Object3D,sleeveColor:T.ColorRepresentation){
  let skin:T.MeshStandardMaterial|undefined,cloth:T.MeshStandardMaterial|undefined;
  const old=new Set<T.Material>();
  root.traverse(o=>{
    if(!(o instanceof T.Mesh))return;
    const isSkin=o.name.startsWith('hand-'),isCloth=o.name.startsWith('view-sleeve-');
    if(!isSkin&&!isCloth)return;
    for(const m of Array.isArray(o.material)?o.material:[o.material])old.add(m);
    if(isSkin){
      skin??=handSurface();o.material=skin;
      projectGripSkin(o.geometry);
    }else{
      cloth??=sleeveSurface(sleeveColor,o.geometry);o.material=cloth;
    }
  });
  // Some source materials can also be referenced by non-hand meshes.
  const retained=new Set<T.Material>();
  root.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])retained.add(m);});
  for(const m of old)if(!retained.has(m))m.dispose();
  return {skin,cloth};
}
