import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {surface} from './vendor/muster/surface';
import {reloadEnvelope} from './viewmodel';
import {applyHandMaterials} from './handMaterials';
import {batchWeaponMeshes} from './batchWeaponMeshes';
import {createViewmodelArms} from './viewmodelArms';
import {prepareRealisticWeapon,realisticWeapons,type RealisticWeapon} from './realisticWeapons';

/** Authored at real scale. The exported muzzle socket stays with the moving weapon. */
export function createWeaponModels(parent:T.Group) {
  const models=new Map<string,T.Group>();
  const pending=new Set<string>();
  const failed=new Set<string>();
  let disposed=false, active:T.Group|undefined;
  const root=new T.Group(); parent.add(root);
  const muzzle=new T.Object3D(); root.add(muzzle);
  type MovingPart={object:T.Object3D;rest:T.Vector3;kind:'support'|'magazine'};
  const movingParts=new Map<T.Group,MovingPart[]>();
  const arms=new Map<T.Group,ReturnType<typeof createViewmodelArms>>();
  function release(object:T.Object3D){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();object.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const m of materials){for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);m.dispose();}geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());}
  async function load(name:string){
    if(models.has(name)||pending.has(name)||failed.has(name)||disposed)return;
    pending.add(name);
    try {
      const gltf=await new GLTFLoader().loadAsync(`/shooter/models/${name==='luger'?'viewmodel-hands':name}.glb`);
      if(disposed){release(gltf.scene);return;}
      let textured:T.Group|undefined;
      if(name in realisticWeapons){
        try{
          const imported=await new GLTFLoader().loadAsync(`/shooter/models/realistic/${name}.glb`);
          if(disposed){release(gltf.scene);release(imported.scene);return;}
          textured=prepareRealisticWeapon(imported.scene,name as RealisticWeapon);
          // Keep the authored grip and sleeve transforms; replace the entire gun.
          const removed=new T.Group(),meshes:T.Mesh[]=[];
          gltf.scene.traverse(object=>{if(object instanceof T.Mesh&&!/^(hand-|view-sleeve-)/.test(object.name))meshes.push(object);});
          for(const mesh of meshes){mesh.removeFromParent();removed.add(mesh);}
          release(removed);
          if(name==='luger')gltf.scene.traverse(object=>{
            if(/^(hand-|view-sleeve-)l$/.test(object.name))object.visible=false;
            if(/^(hand-|view-sleeve-)r$/.test(object.name))object.position.z+=.11;
          });
        }catch(error){if(name==='luger'){release(gltf.scene);throw error;}console.warn('Textured weapon unavailable, using existing model:',name,error);}
      }
      let hands:T.Group|undefined;
      if(name==='g36'){
        try{hands=(await new GLTFLoader().loadAsync('/shooter/models/viewmodel-hands.glb')).scene;}
        catch(error){console.warn('G36 hands unavailable',error);}
        if(disposed){release(gltf.scene);if(hands)release(hands);return;}
      }
      if(name==='g36'){gltf.scene.rotation.y=-Math.PI/2;gltf.scene.position.set(0,.06,.75);}
      const model=new T.Group();model.add(gltf.scene);if(hands)model.add(hands);if(textured)model.add(textured);
      applyHandMaterials(model,name==='g36'?0x42473a:name==='kar98k'||name==='mp40'?0x292d30:0x62624b);
      const replacement=new Map<T.Material,T.Material>();
      model.traverse(o=>{if(!(o instanceof T.Mesh))return;o.castShadow=true;o.receiveShadow=true;if(o.geometry.getAttribute('_aedge'))o.geometry.setAttribute('aEdge',o.geometry.getAttribute('_aedge'));
        const convert=(m:T.Material)=>{
          let params=m.userData.surfaceParams;
          if(!params&&name==='g36'&&m instanceof T.MeshStandardMaterial&&!m.map){
            const metal=m.name.startsWith('Metal');
            params={color:m.color,metalness:metal?.88:0,roughness:metal?.36:.64,
              colorVar:.035,roughVar:.10,detail:metal?'fine':'cast',detailSize:metal?.025:.045,
              detailStrength:metal?.10:.16,bump:.008,bumpScale:240,name:m.name};
          }
          if(!params)return m;
          let result=replacement.get(m);if(!result){result=surface(params);replacement.set(m,result);}return result;
        };
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
      model.traverse(object=>{object.layers.mask=parent.layers.mask;});
      model.rotation.y=Math.PI;model.position.set(.24,-.23,-.4);
      const authored=gltf.scene.children.find(c=>Array.isArray(c.userData.muzzle));
      model.userData.muzzle=textured?.userData.muzzle??authored?.userData.muzzle??(name==='g36'?[0,.06,.75]:[0,.06,.8]);
      model.userData.sightY=name in realisticWeapons?realisticWeapons[name as RealisticWeapon].top:name==='g36'?.15:model.userData.muzzle[1]+.05;
      arms.set(model,createViewmodelArms(model));
      const parts:MovingPart[]=[];
      model.traverse(object=>{
        if(object.name==='hand-l'||object.name==='view-sleeve-l')parts.push({object,rest:object.position.clone(),kind:'support'});
        if(name==='g36'&&/g36[_ ]30rd[_ ]magazine/.test(object.name))parts.push({object,rest:object.position.clone(),kind:'magazine'});
      });
      movingParts.set(model,parts);
      model.visible=false;models.set(name,model);root.add(model);
    } catch(error){failed.add(name);console.warn('Weapon model could not load:',name,error);}
    finally{pending.delete(name);}
  }
  return {
    update(team:'de'|'fr',map:string,index:number){
      // French weapon replacements remain separate; do not label a US mesh MAS-38.
      const name=index===4?null:index===3?'g36':index===1?'luger':team==='fr'&&map==='alpine'?null:team==='de'?(index===0?'kar98k':'mp40'):(index===0?'m1-garand':'thompson');
      if(name)void load(name);
      active=name?models.get(name):undefined;
      for(const model of models.values())model.visible=model===active;
      if(active){muzzle.position.fromArray(active.userData.muzzle);active.localToWorld(muzzle.position);root.worldToLocal(muzzle.position);}
      else muzzle.position.set(.24,-.18,index===1?-.96:index===2?-1:-1.32);
      return !!active;
    },
    muzzleWorld(){root.updateWorldMatrix(true,true);return muzzle.getWorldPosition(new T.Vector3());},
    muzzleLocal(){return muzzle.position.clone();},
    sightY(){return active?active.position.y+active.userData.sightY:muzzle.position.y+.05;},
    /** Pass zero outside reload; normalized server-timed progress during reload. */
    animatePose(progress:number,aimBlend=0){
      for(const [model,parts] of movingParts){
        const blend=model===active?reloadEnvelope(progress):0;
        for(const part of parts){part.object.position.copy(part.rest);part.object.position.y-=blend*(part.kind==='magazine'?.19:.16);}
        arms.get(model)?.update(model===active?aimBlend:0);
      }
    },
    dispose(){disposed=true;for(const m of models.values())release(m);root.removeFromParent();models.clear();movingParts.clear();arms.clear();}
  };
}
