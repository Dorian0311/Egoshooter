import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {applyHandMaterials} from './handMaterials';
import {reloadEnvelope} from './viewmodel';

/** Anatomical hands for the existing pistol / French weapon placeholders.
 * Parent is the camera's weapon group, so ADS/recoil/bob apply consistently.
 * update returns true only when the replacement is loaded AND visible.
 */
export function createFallbackHands(weapon:T.Group){
  const root=new T.Group();root.name='fallback-anatomical-hands';root.visible=false;
  root.position.set(.24,-.23,-.4);root.rotation.y=Math.PI;weapon.add(root);
  let disposed=false,loaded=false,pending=false,index=0,reloadProgress=0;
  let cloth:T.MeshStandardMaterial|undefined;
  const parts:{object:T.Object3D;rest:T.Vector3;left:boolean}[]=[];
  function release(object:T.Object3D){
    const materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>();
    object.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
  async function load(){
    if(pending||loaded||disposed)return;pending=true;
    try{
      const {scene}=await new GLTFLoader().loadAsync('/shooter/models/viewmodel-hands.glb');
      if(disposed){release(scene);return;}
      cloth=applyHandMaterials(scene,0x292d30).cloth;
      scene.traverse(object=>{
        if(object instanceof T.Mesh){object.castShadow=true;object.receiveShadow=true;}
        if(/^(hand-|view-sleeve-)[lr]$/.test(object.name))parts.push({object,rest:object.position.clone(),left:object.name.endsWith('-l')});
      });
      root.add(scene);loaded=true;
    }catch(error){console.warn('Fallback hands unavailable',error);}
    // A failed asset must not trigger a new HTTP request on every animation frame.
  }
  function pose(){
    const reload=reloadEnvelope(reloadProgress);
    for(const part of parts){
      part.object.position.copy(part.rest);
      // One-handed pistol stance; support grip moves back to the SMG magwell.
      part.object.visible=!(part.left&&index===1);
      if(part.left){part.object.position.z-=index===2?.14:0;part.object.position.y-=reload*.16;}
      else if(index===1)part.object.position.z-=.05;
    }
  }
  return {
    update(weaponIndex:number,team:'de'|'fr',map:string,visible:boolean){
      if(disposed)return false;index=weaponIndex;
      if(visible)void load();
      root.visible=visible&&loaded;
      cloth?.color.setHex(team==='de'?0x292d30:map==='alpine'?0x303b4a:0x62624b);
      pose();return root.visible;
    },
    animatePose(progress:number){reloadProgress=progress;pose();},
    dispose(){disposed=true;root.visible=false;release(root);root.removeFromParent();parts.length=0;},
  };
}
