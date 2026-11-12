import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {surface} from './vendor/muster/surface';
import {reloadEnvelope} from './viewmodel';
import {applyHandMaterials} from './handMaterials';
import {batchWeaponMeshes} from './batchWeaponMeshes';

/** Authored at real scale. The exported muzzle socket stays with the moving weapon. */
export function createWeaponModels(parent:T.Group) {
  const models=new Map<string,T.Group>();
  const pending=new Set<string>();
  let disposed=false, active:T.Group|undefined;
  const root=new T.Group(); parent.add(root);
  const muzzle=new T.Object3D(); root.add(muzzle);
  type MovingPart={object:T.Object3D;rest:T.Vector3;kind:'support'|'magazine'};
  const movingParts=new Map<T.Group,MovingPart[]>();
  function release(object:T.Object3D){object.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
  async function load(name:string){
    if(models.has(name)||pending.has(name)||disposed)return;
    pending.add(name);
    try {
      const gltf=await new GLTFLoader().loadAsync(`/shooter/models/${name}.glb`);
      if(disposed){release(gltf.scene);return;}
      let hands:T.Group|undefined;
      if(name==='g36'){
        try{hands=(await new GLTFLoader().loadAsync('/shooter/models/viewmodel-hands.glb')).scene;}
        catch(error){console.warn('G36 hands unavailable',error);}
        if(disposed){release(gltf.scene);if(hands)release(hands);return;}
      }
      if(name==='g36'){gltf.scene.rotation.y=-Math.PI/2;gltf.scene.position.set(0,.06,.75);}
      const model=new T.Group();model.add(gltf.scene);if(hands)model.add(hands);
      applyHandMaterials(model,name==='g36'?0x42473a:name==='kar98k'||name==='mp40'?0x292d30:0x62624b);
      const replacement=new Map<T.Material,T.Material>();
      model.traverse(o=>{if(!(o instanceof T.Mesh))return;o.castShadow=true;o.receiveShadow=true;if(o.geometry.getAttribute('_aedge'))o.geometry.setAttribute('aEdge',o.geometry.getAttribute('_aedge'));
        const convert=(m:T.Material)=>{if(!m.userData.surfaceParams)return m;let result=replacement.get(m);if(!result){result=surface(m.userData.surfaceParams);replacement.set(m,result);}return result;};
        o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);
      });
      for(const m of replacement.keys())m.dispose();
      if(name!=='g36')model.traverse(o=>{
        if(!(o instanceof T.Mesh)||!o.name.startsWith('view-sleeve-'))return;
        const previous=o.geometry;o.geometry=previous.clone();previous.dispose();
        const positions=o.geometry.getAttribute('position');
        for(let i=0;i<positions.count;i++){
          const y=positions.getY(i),fold=1+.055*Math.sin(y*65)+.025*Math.sin(y*107);
          positions.setXYZ(i,positions.getX(i)*fold,y,positions.getZ(i)*fold);
        }
        positions.needsUpdate=true;o.geometry.computeVertexNormals();
      });
      model.userData.batching=batchWeaponMeshes(model);
      model.rotation.y=Math.PI;model.position.set(.24,-.23,-.4);
      const authored=gltf.scene.children.find(c=>Array.isArray(c.userData.muzzle));
      model.userData.muzzle=authored?.userData.muzzle??(name==='g36'?[0,.06,.75]:[0,.06,.8]);
      const parts:MovingPart[]=[];
      model.traverse(object=>{
        if(object.name==='hand-l'||object.name==='view-sleeve-l')parts.push({object,rest:object.position.clone(),kind:'support'});
        if(name==='g36'&&/g36[_ ]30rd[_ ]magazine/.test(object.name))parts.push({object,rest:object.position.clone(),kind:'magazine'});
      });
      movingParts.set(model,parts);
      model.visible=false;models.set(name,model);root.add(model);
    } catch(error){console.warn('Weapon model could not load:',name,error);}
    finally{pending.delete(name);}
  }
  return {
    update(team:'de'|'fr',map:string,index:number){
      // French weapon replacements remain separate; do not label a US mesh MAS-38.
      const name=index===3?'g36':index===1||team==='fr'&&map!=='cologne'?null:team==='de'?(index===0?'kar98k':'mp40'):(index===0?'m1-garand':'thompson');
      if(name)void load(name);
      active=name?models.get(name):undefined;
      for(const model of models.values())model.visible=model===active;
      if(active){muzzle.position.fromArray(active.userData.muzzle);active.localToWorld(muzzle.position);root.worldToLocal(muzzle.position);}
      else muzzle.position.set(.24,-.18,index===1?-.96:index===2?-1:-1.32);
      return !!active;
    },
    muzzleWorld(){root.updateWorldMatrix(true,true);return muzzle.getWorldPosition(new T.Vector3());},
    muzzleLocal(){return muzzle.position.clone();},
    /** Pass zero outside reload; normalized server-timed progress during reload. */
    animatePose(progress:number){
      for(const [model,parts] of movingParts){
        const blend=model===active?reloadEnvelope(progress):0;
        for(const part of parts){part.object.position.copy(part.rest);part.object.position.y-=blend*(part.kind==='magazine'?.19:.16);}
      }
    },
    dispose(){disposed=true;for(const m of models.values())release(m);root.removeFromParent();models.clear();movingParts.clear();}
  };
}
