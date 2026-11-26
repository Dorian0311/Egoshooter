import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Group,Skeleton,SkinnedMesh} from 'three';
import {createWorldSkeletonUpdates} from '../client/worldSkeletonUpdates';

test('world rig shares one bone upload per world pass and restores independent updates',()=>{
 const bone=new Bone(),skeleton=new Skeleton([bone]);
 skeleton.computeBoneTexture();
 const root=new Group();
 for(let i=0;i<2;i++){const mesh=new SkinnedMesh();mesh.bind(skeleton);root.add(mesh);}
 const updates=createWorldSkeletonUpdates(),unregister=updates.register(root);
 const secondOwner=updates.register(root),original=Skeleton.prototype.update;
 const version=()=>skeleton.boneTexture!.version;
 const start=version();
 skeleton.update();skeleton.update();
 assert.equal(version(),start+2);
 updates.begin();
 skeleton.update();
 const pose=skeleton.boneMatrices.slice();
 skeleton.update();updates.end();
 assert.equal(version(),start+3);assert.deepEqual(skeleton.boneMatrices,pose);
 bone.position.x=2;bone.updateMatrixWorld();
 updates.begin();skeleton.update();skeleton.update();updates.end();
 assert.equal(version(),start+4);assert.equal(skeleton.boneMatrices[12],2);
 unregister();unregister();assert.notEqual(skeleton.update,original);
 secondOwner();assert.equal(skeleton.update,original);
 assert.equal(Object.hasOwn(skeleton,'update'),false);
 updates.begin();skeleton.update();skeleton.update();updates.end();
 assert.equal(version(),start+6);
 skeleton.dispose();
});
