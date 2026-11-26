import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {decodeBodyDistance,matchingBodyDistance} from '../client/bodyDistance';
import {createHuman} from '../client/humanoid';
import {actorLodHeight,createActorDetails,withBodyDistanceUpload} from '../client/actorDetails';
import {createAnatomy} from '../client/anatomy';

test('standard distance body uses original skinned vertices and retreats on injury, approach and scope zoom',async()=>{
 const root=new URL('../public/shooter/characters/',import.meta.url);
 const source=readFileSync(new URL('humanoid.json',root)),file=readFileSync(new URL('humanoid-distance.bin',root));
 assert.equal(file.subarray(0,32).toString('hex'),createHash('sha256').update(source).digest('hex'));
 assert.equal(await matchingBodyDistance(new ArrayBuffer(1),Uint8Array.from(file).buffer),undefined);
 const data={...JSON.parse(source.toString()),bodyDistance:decodeBodyDistance(Uint8Array.from(file).buffer)};
 const human=createHuman(data,'de','storm',new T.MeshStandardMaterial(),'task-olive');
 const full=human.group.children.find(o=>o instanceof T.SkinnedMesh) as T.SkinnedMesh;
 const details=createActorDetails(human.group),anatomy=createAnatomy(human.group);
 anatomy.setLost(0);
 const far=human.group.getObjectByName('distance-body') as T.SkinnedMesh;
 assert.equal(far.boundingSphere,full.boundingSphere);assert.ok(far.boundingSphere!.radius>=3);
 assert.equal(far.skeleton,full.skeleton);
 assert.equal(far.material,full.material);
 assert.equal(far.geometry.getAttribute('skinWeight'),full.geometry.getAttribute('skinWeight'));
 assert.equal(far.geometry.index!.count,9968*3);
 assert.equal(full.geometry.index!.count,22188*3);
 for(const [i,group] of far.geometry.groups.entries()){
  const original=full.geometry.groups[i],insideMaterial=new Set(full.geometry.index!.array.slice(original.start,original.start+original.count));
  for(let j=group.start;j<group.start+group.count;j++)assert.ok(insideMaterial.has(far.geometry.index!.getX(j)));
 }
 human.group.getObjectByName('lowerarm01.R')!.rotation.x=.8;
 human.group.updateMatrixWorld(true);
 const p=new T.Vector3(),q=new T.Vector3();
 for(let j=0;j<far.geometry.index!.count;j+=53){
  const vert=far.geometry.index!.getX(j);
  assert.ok(far.getVertexPosition(vert,p).distanceTo(full.getVertexPosition(vert,q))<1e-6);
 }
 const check=(distance:number,fov:number,expected:boolean)=>{
  details.update(distance,720,fov);assert.equal(far.visible,expected);assert.equal(full.visible,!expected);
 };
 function checkUploadRestores(expectedFar:boolean){
  assert.throws(()=>withBodyDistanceUpload([human.group],()=>{
   assert.ok(full.visible&&far.visible);throw Error('simulated draw failure');
  }),/simulated draw failure/);
  assert.equal(full.visible,!expectedFar);assert.equal(far.visible,expectedFar);
 }
 // CSS size stays fixed; use actual render-target heights at this distance.
 for(const [quality,height,expectedFar] of [
  ['auto',720,true],['high',1440,false],['performance',900,true],['ultra',2160,false],
  ['auto',2160,true],['ultra',0,true],
 ] as const){
  details.update(19.5,actorLodHeight(quality,1080,height),80);
  assert.equal(far.visible,expectedFar,quality+' at '+height);
 }
 check(8,80,false);checkUploadRestores(false);
 check(60,80,true);checkUploadRestores(true);
 check(60,20,false);check(60,80,true);
 anatomy.setLost(2);check(60,80,false);checkUploadRestores(false);assert.ok(full.geometry.drawRange.count<full.geometry.index!.count);
 assert.ok(anatomy.detach('armL'));anatomy.setLost(0);check(60,80,true);check(8,80,false);
 let released=false;
 far.geometry.addEventListener('dispose',()=>{assert.equal(Object.keys(far.geometry.attributes).length,0);released=true;});
 details.dispose();assert.ok(released);
 withBodyDistanceUpload([human.group],()=>assert.equal(human.group.getObjectByName('distance-body'),undefined));
 assert.ok(full.geometry.getAttribute('position').count>10000);
 anatomy.dispose();human.dispose();
});
