import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createHuman} from '../client/humanoid.ts';
import {createActorDetails} from '../client/actorDetails.ts';
import {makePlayer} from '../shared/game.ts';

test('greatcoat keeps the neck down inside the collar instead of a floating head',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/shooter/characters/humanoid.json',import.meta.url),'utf8'));
 // Empty garment pieces exercise the same body cut without browser texture loading.
 const human=createHuman({...data,coat:[]},'de','cologne',new T.MeshStandardMaterial(),'de-greatcoat');
 const body=human.group.children.find(o=>o instanceof T.SkinnedMesh) as T.SkinnedMesh;
 const positions=body.geometry.getAttribute('position'),indices=body.geometry.index!;
 const heights=Array.from(indices.array,i=>positions.getY(i));
 assert.ok(Math.min(...heights)<1.46,'neck must extend into the coat collar');
 assert.ok(Math.max(...heights)>1.7,'head remains at its original height');
 human.dispose();
});
test('human asset has valid topology, bounded skin weights and a rooted skeleton',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/shooter/characters/humanoid.json',import.meta.url),'utf8'));
 const vertices=data.positions.length/3;
 assert.ok(vertices>10000);assert.ok(data.indices.length/3>20000);assert.equal(data.skinIndex.length,vertices*4);assert.equal(data.skinWeight.length,vertices*4);
 assert.ok(data.indices.every((i:number)=>Number.isInteger(i)&&i>=0&&i<vertices));
 for(let i=0;i<vertices;i++){const weight=data.skinWeight.slice(i*4,i*4+4);assert.ok(Math.abs(weight.reduce((a:number,b:number)=>a+b,0)-1)<.00001);assert.ok(data.skinIndex.slice(i*4,i*4+4).every((n:number)=>n>=0&&n<data.bones.length));}
 const roots=data.bones.filter((b:{parent:number})=>b.parent===-1);assert.equal(roots.length,1);assert.ok(data.bones.every((b:{parent:number},i:number)=>b.parent!==i&&b.parent<data.bones.length));
});

test('standard attachments stay inside draw budget and follow their animated bones',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/shooter/characters/humanoid.json',import.meta.url),'utf8'));
 const human=createHuman(data,'fr','cologne',new T.MeshStandardMaterial(),'us-field');
 let draws=0;human.group.traverse(o=>{if(o instanceof T.Mesh)draws+=Array.isArray(o.material)?o.geometry.groups.filter((g:{count:number})=>g.count>0).length:1;});
 assert.ok(draws<=40,`standard figure uses ${draws} draws`);
 const foot=human.group.getObjectByName('foot.L')!;
 const boot=foot.children.find(c=>c instanceof T.Group)!;
 assert.ok(boot&&boot.children.length<=3);
 human.group.updateMatrixWorld(true);const before=boot.getWorldPosition(new T.Vector3());
 const player=makePlayer('a','A','fr',0);player.x=1;human.update(player,150,1/60);human.group.updateMatrixWorld(true);
 assert.ok(boot.getWorldPosition(new T.Vector3()).distanceTo(before)>1e-5);
 human.setHeadVisible(false);assert.equal(human.group.getObjectByName('head')!.scale.x,.001);
 human.dispose();human.dispose();assert.equal(human.group.children.length,0);
});

test('Island boots keep a complete shadow-casting silhouette when small details are culled',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/shooter/characters/humanoid.json',import.meta.url),'utf8'));
 const human=createHuman(data,'de','storm',new T.MeshStandardMaterial(),'task-olive');
 const details=createActorDetails(human.group);
 for(const distance of [8,100,8]){
  details.update(distance,720,80);
  for(const name of ['foot.L','foot.R']){
   const foot=human.group.getObjectByName(name)!;
   const boot=foot.children.find(child=>child instanceof T.Group)!;
   assert.equal(boot.children.length,1);
   const shoe=boot.children[0] as T.Mesh;
   assert.ok(shoe.castShadow&&shoe.layers.isEnabled(0));
   shoe.geometry.computeBoundingBox();
   const size=shoe.geometry.boundingBox!.getSize(new T.Vector3());
   assert.ok(size.y>.21&&size.z>.29,'shaft, sole and toe preserved');
  }
 }
 details.dispose();human.dispose();
});

test('standard actors reuse immutable body streams while keeping independently disposable GPU attributes and injury indices',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/shooter/characters/humanoid.json',import.meta.url),'utf8'));
 const first=createHuman({...data},'de','storm',new T.MeshStandardMaterial(),'task-olive');
 const second=createHuman({...data},'fr','storm',new T.MeshStandardMaterial(),'task-sand');
 const body=(actor:typeof first)=>(actor.group.children.find(o=>o instanceof T.SkinnedMesh) as T.SkinnedMesh).geometry;
 const a=body(first),b=body(second);
 for(const name of ['position','normal','uv','skinIndex','skinWeight']){
  assert.notEqual(a.attributes[name],b.attributes[name]);
  assert.equal(a.attributes[name].array,b.attributes[name].array);
 }
 assert.notEqual(a.index!.array,b.index!.array);
 assert.notEqual(a.groups,b.groups);
 assert.deepEqual(a.groups,b.groups);
 first.dispose();
 assert.ok(b.getAttribute('position').count>10000);
 second.dispose();
});

test('finger pose follows equipped and empty hands without rewriting a stable grip each frame',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/shooter/characters/humanoid.json',import.meta.url),'utf8'));
 const human=createHuman(data,'fr','storm',new T.MeshStandardMaterial(),'task-sand');
 const finger=human.group.getObjectByName('finger3-2.R')!,p=makePlayer('grip','Grip','fr');
 p.weapon=0;human.update(p,100,1/60);const grip=finger.quaternion.clone();
 let changes=0;const set=finger.rotation.set;
 finger.rotation.set=function(...args){changes++;return set.apply(this,args);};
 for(let i=0;i<10;i++)human.update(p,120+i*16,1/60);
 assert.equal(changes,0);
 p.weapon=4;human.update(p,320,1/60);assert.equal(changes,1);
 assert.ok(finger.quaternion.angleTo(grip)>.5);
 human.update(p,340,1/60);assert.equal(changes,1);
 p.weapon=2;human.update(p,360,1/60);assert.equal(changes,2);
 assert.ok(finger.quaternion.angleTo(grip)<1e-6);
 human.dispose();
});
