import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createGermanWeapon} from '../client/germanWeaponModels';
import {batchWeaponProxy} from '../client/weaponProxy';

test('German actor proxies preserve transformed bounds and material colors in one draw',()=>{
  for(let id=7;id<=13;id++){
    const root=new T.Group(),gun=createGermanWeapon(id);gun.rotation.y=Math.PI;root.position.set(2,3,4);root.rotation.y=.4;root.add(gun);
    const before=new T.Box3().setFromObject(root,true),colors=new Set<string>(),originalMaterials=new Set<T.Material>();
    gun.traverse(o=>{if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial){colors.add(o.material.color.toArray().join(','));originalMaterials.add(o.material);}});
    batchWeaponProxy(root);
    const meshes:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh)meshes.push(o);});
    assert.equal(meshes.length,1);assert.equal(meshes[0].geometry.groups.length,0);
    const after=new T.Box3().setFromObject(root,true);assert.ok(before.min.distanceTo(after.min)<.00001);assert.ok(before.max.distanceTo(after.max)<.00001);
    const attribute=meshes[0].geometry.getAttribute('color'),baked=new Set<string>();
    for(let i=0;i<attribute.count;i++)baked.add([attribute.getX(i),attribute.getY(i),attribute.getZ(i)].map(n=>n.toFixed(5)).join(','));
    for(const color of colors)assert.ok(baked.has(color.split(',').map(n=>Number(n).toFixed(5)).join(',')));
    assert.ok((meshes[0].material as T.MeshStandardMaterial).vertexColors);
    meshes[0].geometry.dispose();(meshes[0].material as T.Material).dispose();originalMaterials.forEach(m=>m.dispose());
  }
});
