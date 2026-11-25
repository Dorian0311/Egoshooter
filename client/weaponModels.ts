import * as T from 'three';
import {createGermanWeapon,germanWeaponNames,germanWeaponId} from './germanWeaponModels';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {surface} from './vendor/muster/surface';
import {reloadEnvelope} from './viewmodel';
import {applyHandMaterials} from './handMaterials';
import {batchWeaponMeshes} from './batchWeaponMeshes';
import {createViewmodelArms} from './viewmodelArms';
import {prepareRealisticWeapon,realisticWeapons,realisticWeaponUrl,type RealisticWeapon} from './realisticWeapons';

// The shared hand asset is authored around the G36. Seat both the
// hand and cuff on the contact points of each replacement mesh.
const sharedGripOffsets:Partial<Record<string,readonly [number,number,number,number]>>={
  // Rear grip (y,z), fore-end (y,z), relative to the shared pose.
  stg44:[-.012,-.062,-.030,-.105],gewehr43:[.038,-.085,-.033,-.052],
  mg42:[-.016,-.079,-.025,-.054],mp34:[.021,-.088,-.034,-.110],
  p38:[-.010,-.085,0,0],fg42:[-.009,-.078,-.031,-.095],
  'gewehr43-zf4':[.038,-.085,-.033,-.052],
  'kar98k-zf39':[.024,-.087,-.037,-.063],
};

/** Authored at real scale. The exported muzzle socket stays with the moving weapon. */
export function createWeaponModels(parent:T.Group,warmup?:(model:T.Group)=>Promise<unknown>) {
  const models=new Map<string,T.Group>();
  const pending=new Set<string>();
  const failed=new Set<string>();
  let disposed=false, active:T.Group|undefined;
  const root=new T.Group(); parent.add(root);
  const muzzle=new T.Object3D(); root.add(muzzle);
  type MovingPart={object:T.Object3D;rest:T.Vector3;reach:T.Vector3;travel:T.Vector3;stowed?:T.Vector3};
  type ReloadParts={support:MovingPart[];magazine?:MovingPart;action:MovingPart[]};
  const actionName=/^(?:Gun_bolt_01|Magazine|P38_Mag_Mesh|Low_Magazin|mp34-magazine-assembly|mp34-bolt|bolt-handle|Bolt|g36[_ ]charging[_ ]handle|g36[_ ]30rd[_ ]magazine)$/i;
  const magazineName=/mag(?:azine|azin|_Mesh)/i;
  const movingParts=new Map<T.Group,ReloadParts>();
  const arms=new Map<T.Group,ReturnType<typeof createViewmodelArms>>();
  function release(object:T.Object3D){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();object.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const m of materials){for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);m.dispose();}geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());}
  async function load(name:string){
    if(models.has(name)||pending.has(name)||failed.has(name)||disposed)return;
    pending.add(name);
    try {
      const germanId=germanWeaponId(name);
      const gltf=await new GLTFLoader().loadAsync(`/shooter/models/${name==='luger'||germanId!==undefined?'viewmodel-hands':name}.glb`);
      if(disposed){release(gltf.scene);return;}
      let textured:T.Group|undefined;
      if(germanId!==undefined&&!(name in realisticWeapons)){
        textured=createGermanWeapon(germanId);
        const removed=new T.Group(),meshes:T.Mesh[]=[];
        gltf.scene.traverse(o=>{if(o instanceof T.Mesh&&!/^(hand-|view-sleeve-)/.test(o.name))meshes.push(o);});
        for(const mesh of meshes){mesh.removeFromParent();removed.add(mesh);}release(removed);
        if(germanId===11)gltf.scene.traverse(o=>{if(/^(hand-|view-sleeve-)l$/.test(o.name))o.visible=false;});
      }
      if(name in realisticWeapons){
        try{
          const imported=await new GLTFLoader().loadAsync(realisticWeaponUrl(name as RealisticWeapon));
          if(disposed){release(gltf.scene);release(imported.scene);return;}
          textured=prepareRealisticWeapon(imported.scene,name as RealisticWeapon);
          // Keep the authored grip and sleeve transforms; replace the entire gun.
          const removed=new T.Group(),meshes:T.Mesh[]=[];
          gltf.scene.traverse(object=>{if(object instanceof T.Mesh&&!/^(hand-|view-sleeve-)/.test(object.name))meshes.push(object);});
          for(const mesh of meshes){mesh.removeFromParent();removed.add(mesh);}
          release(removed);
          if(name==='luger'||name==='p38')gltf.scene.traverse(object=>{
            if(/^(hand-|view-sleeve-)l$/.test(object.name))object.visible=false;
            if(name==='luger'&&/^(hand-|view-sleeve-)r$/.test(object.name))object.position.z+=.11;
          });
        }catch(error){if(name==='luger'){release(gltf.scene);throw error;}if(germanId!==undefined)textured=createGermanWeapon(germanId);console.warn('Textured weapon unavailable, using existing model:',name,error);}
      }
      let hands:T.Group|undefined;
      if(name==='g36'){
        try{hands=(await new GLTFLoader().loadAsync('/shooter/models/viewmodel-hands.glb')).scene;}
        catch(error){console.warn('G36 hands unavailable',error);}
        if(disposed){release(gltf.scene);if(hands)release(hands);return;}
      }
      if(name==='g36'){gltf.scene.rotation.y=-Math.PI/2;gltf.scene.position.set(0,.06,.75);}
      const model=new T.Group();model.add(gltf.scene);if(hands)model.add(hands);if(textured)model.add(textured);
      const offsets=sharedGripOffsets[name];
      if(offsets)for(const [side,slot] of [['r',0],['l',2]] as const){
        for(const prefix of ['hand-','view-sleeve-']){
          const part=model.getObjectByName(prefix+side);
          if(part){part.position.y+=offsets[slot];part.position.z+=offsets[slot+1];}
        }
      }
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
          let result=replacement.get(m);if(!result){result=surface(params);if(m instanceof T.MeshStandardMaterial)result.vertexColors=m.vertexColors;replacement.set(m,result);}return result;
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
      if(name==='kar98k'||name==='kar98k-zf39'){
        const strap=new T.Mesh(new T.PlaneGeometry(.025,.025,1,24),new T.MeshStandardMaterial({
          color:'#53402d',roughness:.91,side:T.DoubleSide,
        }));
        const vertices=strap.geometry.getAttribute('position');
        for(let i=0;i<vertices.count;i++){
          const fraction=.5-vertices.getY(i)/.025;
          vertices.setXYZ(i,-.025-.018*Math.sin(Math.PI*fraction),-.069-.12*Math.sin(Math.PI*fraction)+vertices.getX(i),-.23+.72*fraction);
        }
        strap.geometry.computeVertexNormals();
        model.add(strap);
      }
      const mechanisms:T.Object3D[]=[];
      model.traverse(object=>{
        if(actionName.test(object.name)){object.userData.viewmodelMovingPart=true;mechanisms.push(object);}
      });
      model.userData.batching=batchWeaponMeshes(model);
      model.traverse(object=>{object.layers.mask=parent.layers.mask;});
      model.rotation.y=Math.PI;model.position.set(.24,-.23,-.4);
      const authored=gltf.scene.children.find(c=>Array.isArray(c.userData.muzzle));
      model.userData.muzzle=textured?.userData.muzzle??authored?.userData.muzzle??(name==='g36'?[0,.06,.75]:[0,.06,.8]);
      model.userData.sightY=textured?.userData.sightY??(name in realisticWeapons?realisticWeapons[name as RealisticWeapon].top:name==='g36'?.15:model.userData.muzzle[1]+.05);
      arms.set(model,createViewmodelArms(model));
      model.updateWorldMatrix(true,true);
      const magazine=mechanisms.find(object=>magazineName.test(object.name));
      const grip=model.getObjectByName('hand-l');
      const reach=new T.Vector3(),withdrawal=new T.Vector3(0,-.13,0);
      if(name==='fg42'||name==='mp34')withdrawal.set(name==='fg42'?-.13:.13,0,0);
      if(magazine&&grip){
        const bounds=new T.Box3().setFromObject(magazine);
        if(!bounds.isEmpty()){
          const contact=model.worldToLocal(bounds.getCenter(new T.Vector3()));
          contact.x+=name==='mp34'?.035:-.025;
          contact.y-=.022;
          reach.copy(contact).sub(model.worldToLocal(grip.getWorldPosition(new T.Vector3())));
        }
      }
      function part(object:T.Object3D,reach:T.Vector3,travel:T.Vector3):MovingPart{
        const parent=object.parent!;
        const origin=parent.worldToLocal(model.localToWorld(new T.Vector3()));
        const toParent=(vector:T.Vector3)=>parent.worldToLocal(model.localToWorld(vector.clone())).sub(origin);
        return {object,rest:object.position.clone(),reach:toParent(reach),travel:toParent(travel),
          stowed:object.visible?undefined:toParent(new T.Vector3(0,-.42,-.10))};
      }
      const support:MovingPart[]=[];
      for(const id of ['hand-l','view-sleeve-l']){
        const object=model.getObjectByName(id);
        if(object&&(object.visible||magazine))support.push(part(object,reach,magazine?withdrawal:new T.Vector3(0,-.085,-.045)));
      }
      movingParts.set(model,{
        support,
        magazine:magazine&&part(magazine,new T.Vector3(),withdrawal),
        action:mechanisms.filter(object=>object!==magazine).filter(object=>{
          for(let parent=object.parent;parent&&parent!==model;parent=parent.parent)
            if(mechanisms.includes(parent))return false;
          return true;
        }).map(object=>part(object,new T.Vector3(),new T.Vector3(0,0,-.055))),
      });
      try{await warmup?.(model);}catch(error){console.warn('Weapon shader warmup unavailable',error);}
      if(disposed){release(model);return;}
      models.set(name,model);
    } catch(error){failed.add(name);console.warn('Weapon model could not load:',name,error);}
    finally{pending.delete(name);}
  }
  return {
    preload(indices:readonly number[]){for(const index of new Set(indices)){
      const name=germanWeaponNames[index]??(index===4?null:index===3?'g36':index===1?'luger':index===0?'kar98k':'mp40');
      if(name)void load(name);
    }},
    update(team:'de'|'fr',map:string,index:number){
      // French weapon replacements remain separate; do not label a US mesh MAS-38.
      const name=germanWeaponNames[index]??(index===4?null:index===3?'g36':index===1?'luger':index===0?'kar98k':'mp40');
      if(name)void load(name);
      const next=name?models.get(name):undefined;
      if(next!==active){
        active?.removeFromParent();
        active=next;
        if(active)root.add(active);
      }
      if(active){muzzle.position.fromArray(active.userData.muzzle);active.localToWorld(muzzle.position);root.worldToLocal(muzzle.position);}
      else muzzle.position.set(.24,-.18,index===1?-.96:index===2?-1:-1.32);
      return !!active;
    },
    muzzleWorld(){return muzzle.getWorldPosition(new T.Vector3());},
    muzzleLocal(){return muzzle.position.clone();},
    sightY(){return active?active.position.y+active.userData.sightY:muzzle.position.y+.05;},
    /** Pass zero outside reload; normalized server-timed progress during reload. */
    animatePose(progress:number,aimBlend=0){
      if(!active)return;
      const parts=movingParts.get(active);
      if(parts){
        const ease=(from:number,to:number)=>T.MathUtils.smoothstep(progress,from,to);
        const grasp=ease(.05,.25)*(1-ease(.73,.92));
        const extraction=ease(.25,.46)*(1-ease(.55,.73));
        const cycle=ease(.72,.82)*(1-ease(.82,.95));
        for(const part of parts.support){
          part.object.position.copy(part.rest).addScaledVector(part.reach,grasp)
            .addScaledVector(part.travel,parts.magazine?extraction:reloadEnvelope(progress));
          if(part.stowed){
            part.object.visible=grasp>0;
            part.object.position.addScaledVector(part.stowed,1-grasp);
          }
        }
        const magazine=parts.magazine;
        if(magazine)magazine.object.position.copy(magazine.rest).addScaledVector(magazine.travel,extraction);
        for(const part of parts.action)part.object.position.copy(part.rest).addScaledVector(part.travel,cycle);
      }
      arms.get(active)?.update(aimBlend);
    },
    dispose(){disposed=true;for(const m of models.values())release(m);root.removeFromParent();models.clear();movingParts.clear();arms.clear();}
  };
}
