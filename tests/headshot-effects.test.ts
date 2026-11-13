import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createHitEffects} from '../client/hitEffects';
import {createBonusCharacter} from '../client/bonusCharacters';
import {makePlayer} from '../shared/game';
import {headshotPose} from '../client/headshotAnimation';
test('headshot fragments run slower locally and all resources are removed afterwards',()=>{
 const normalScene=new T.Scene(),slowScene=new T.Scene(),normal=createHitEffects(normalScene),slow=createHitEffects(slowScene);
 const event={type:'kill' as const,id:'a',target:'b',hitZone:'head' as const,point:[0,1.7,0] as [number,number,number]};
 normal.emit(event);slow.emit(event,true);assert.equal(slowScene.children.length,72);
 assert.ok(slowScene.children.some(mesh=>mesh instanceof T.Mesh&&mesh.geometry.type==='SphereGeometry'));
 normal.update(1.7);slow.update(1.4);assert.equal(normalScene.children.length,0);assert.equal(slowScene.children.length,72);
 slow.update(2);assert.equal(slowScene.children.length,0);normal.dispose();slow.dispose();
});

test('lethal headshot sprays away from the shooter and debris stays above an elevated floor',()=>{
 const scene=new T.Scene(),effects=createHitEffects(scene);
 effects.emit({type:'kill',id:'a',hitZone:'head',point:[0,5.7,0]},false,new T.Vector3(1,0,0),4);
 assert.equal(scene.children.filter(o=>o.name==='headshot-mist').length,8);
 effects.update(.1);
 const droplets=scene.children.filter(o=>o.name==='hit-droplet');
 assert.ok(droplets.every(o=>o.position.x>0));
 for(let i=0;i<12;i++)effects.update(.1);
 assert.ok(scene.children.every(o=>o.position.y>=4));
 effects.dispose();assert.equal(scene.children.length,0);
});

test('ordinary hits stay small and fresh headshots survive the multiplayer particle cap',()=>{
 const scene=new T.Scene(),effects=createHitEffects(scene);
 effects.emit({type:'kill',id:'a',hitZone:'body',point:[0,1,0]});assert.equal(scene.children.length,0);
 effects.emit({type:'hit',id:'a',hitZone:'body',point:[0,1,0]});assert.equal(scene.children.length,16);
 for(let i=0;i<20;i++)effects.emit({type:'kill',id:'a',hitZone:'head',point:[i,1.7,0]});
 assert.equal(scene.children.length,256);assert.ok(scene.children.some(o=>o.position.x>18.9));
 const sprite=scene.children.find(o=>o instanceof T.Sprite) as T.Sprite;
 let materialDisposed=false,textureDisposed=false;
 sprite.material.addEventListener('dispose',()=>{materialDisposed=true;});
 sprite.material.map!.addEventListener('dispose',()=>{textureDisposed=true;});
 effects.dispose();assert.ok(materialDisposed&&textureDisposed);assert.equal(scene.children.length,0);
});

test('headshot collapse follows the particle clock, finishes grounded and never replays',()=>{
 assert.deepEqual(headshotPose(0,false),{fall:0,recoil:0,height:0});
 assert.ok(headshotPose(.2,false).recoil>0);
 assert.ok(headshotPose(.5,true).fall<headshotPose(.5,false).fall);
 const final=headshotPose(3,true);assert.equal(final.fall,1);assert.equal(final.height,.14);assert.ok(Math.abs(final.recoil)<1e-12);
 assert.deepEqual(headshotPose(10,true),final);
});
test('static Leatherface head clipping resets after respawn',()=>{
 const root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(1,1.8,1),new T.MeshStandardMaterial()));
 const character=createBonusCharacter({character:'leatherface',entry:{root,refs:0}}),mesh=character.group.children[0].children[0] as T.Mesh;
 character.setHeadVisible(false);character.update(makePlayer('a','A','de'),0,.016);
 assert.equal((mesh.material as T.Material).clippingPlanes?.length,1);
 character.setHeadVisible(true);assert.equal((mesh.material as T.Material).clippingPlanes,null);character.dispose();
});
