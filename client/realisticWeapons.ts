import * as T from 'three';

// Each source has its own units and forward axis. All runtime weapons use +Z,
// metres and a muzzle aligned to the existing hand rig before camera mounting.
export const realisticWeapons = {
  kar98k: {rotation: -Math.PI/2, length: 1.11, muzzle: [0,.0475,.8155], top: .103},
  mp40: {rotation: Math.PI/2, length: .833, muzzle: [0,.0908,.5422], top: .145},
  'm1-garand': {rotation: 0, length: 1.10, muzzle: [0,.0485,.8385], top: .106},
  thompson: {rotation: 0, length: .811, muzzle: [0,.0875,.5266], top: .125},
  luger: {rotation: Math.PI/2, length: .222, muzzle: [0,.045,.35], top: .068},
} satisfies Record<string,{rotation:number;length:number;muzzle:number[];top:number}>;
export type RealisticWeapon = keyof typeof realisticWeapons;

export function prepareRealisticWeapon(source:T.Group,name:RealisticWeapon){
  const config=realisticWeapons[name];
  // The imported Kar98k has a static skeleton. Bake its bind pose before adding
  // the camera rig: otherwise its skin matrices retain the source coordinate
  // frame and the gun detaches from the hands when the player turns.
  source.updateWorldMatrix(true,true);
  const skinned:T.SkinnedMesh[]=[],skeletons=new Set<T.Skeleton>();
  source.traverse(object=>{if(object instanceof T.SkinnedMesh)skinned.push(object);});
  const vertex=new T.Vector3();
  for(const mesh of skinned){
    mesh.skeleton.update();skeletons.add(mesh.skeleton);
    const geometry=mesh.geometry.clone(),positions=geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++){mesh.getVertexPosition(i,vertex);positions.setXYZ(i,vertex.x,vertex.y,vertex.z);}
    geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const rigid=new T.Mesh(geometry,mesh.material);rigid.name=mesh.name;
    rigid.position.copy(mesh.position);rigid.quaternion.copy(mesh.quaternion);rigid.scale.copy(mesh.scale);
    mesh.parent?.add(rigid);mesh.removeFromParent();mesh.geometry.dispose();
  }
  skeletons.forEach(skeleton=>skeleton.dispose());
  // This mesh is a separate floating ammunition display, not part of the rifle.
  if(name==='kar98k'){
    const clip=source.getObjectByName('Object_6');
    if(clip){clip.removeFromParent();if(clip instanceof T.Mesh){clip.geometry.dispose();for(const m of Array.isArray(clip.material)?clip.material:[clip.material])m.dispose();}}
  }
  const mount=new T.Group();mount.name='textured-'+name;mount.add(source);
  source.rotation.y+=config.rotation;
  let bounds=new T.Box3().setFromObject(mount);
  const length=bounds.max.z-bounds.min.z;
  if(!Number.isFinite(length)||length<=0)throw Error('Invalid weapon dimensions: '+name);
  source.scale.multiplyScalar(config.length/length);
  bounds=new T.Box3().setFromObject(mount);
  source.position.add(new T.Vector3(
    -(bounds.min.x+bounds.max.x)/2,config.top-bounds.max.y,config.muzzle[2]-bounds.max.z));
  mount.userData.muzzle=[...config.muzzle];
  source.traverse(object=>{
    if(!(object instanceof T.Mesh))return;
    object.castShadow=true;object.receiveShadow=true;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(!(material instanceof T.MeshStandardMaterial))continue;
      material.envMapIntensity=.85;
      for(const value of Object.values(material))if(value instanceof T.Texture)value.anisotropy=8;
    }
  });
  return mount;
}
