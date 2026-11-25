import * as T from 'three';
import {surface} from './vendor/muster/surface';

/** One skin and one cloth material per owned model, shared by both sides. */
export function applyHandMaterials(root:T.Object3D,sleeveColor:T.ColorRepresentation){
  let skin:T.MeshStandardMaterial|undefined,cloth:T.MeshStandardMaterial|undefined;
  const old=new Set<T.Material>();
  root.traverse(o=>{
    if(!(o instanceof T.Mesh))return;
    const isSkin=o.name.startsWith('hand-'),isCloth=o.name.startsWith('view-sleeve-');
    if(!isSkin&&!isCloth)return;
    for(const m of Array.isArray(o.material)?o.material:[o.material])old.add(m);
    if(isSkin)skin??=surface({color:0xb29680,roughness:.78,colorVar:.09,varScale:52,roughVar:.12,detail:'fine',detailSize:.025,detailStrength:.24,bump:.026,bumpScale:205,name:'viewmodel-skin'});
    else cloth??=surface({color:sleeveColor,roughness:.95,detail:'twill',detailSize:.09,detailStrength:.25,colorVar:.06,name:'viewmodel-sleeve'});
    o.material=(isSkin?skin:cloth)!;
    if(isSkin){
      skin!.vertexColors=true;
      const position=o.geometry.getAttribute('position');
      const colors=new Float32Array(position.count*3);
      const fingers=new T.Color(),palm=new T.Color('#fff8ed'),knuckles=new T.Color('#dca78f');
      for(let i=0;i<position.count;i++){
        // The hand asset is in wrist space, with fingers extending along +Y.
        const distal=T.MathUtils.smoothstep(position.getY(i),.034,.105);
        const ridge=.5+.5*Math.cos(position.getY(i)*91+position.getX(i)*28);
        fingers.copy(palm).lerp(knuckles,distal*(.24+.28*ridge));
        fingers.toArray(colors,i*3);
      }
      o.geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    }
  });
  // Some source materials can also be referenced by non-hand meshes.
  const retained=new Set<T.Material>();
  root.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])retained.add(m);});
  for(const m of old)if(!retained.has(m))m.dispose();
  return {skin,cloth};
}
