import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {loadHuman,createHuman} from '../client/humanoid';
import {makePlayer} from '../shared/game';

test('resident loading uses Rocketbox even with a bonus uniform, while bonus players keep their source',async()=>{
 const load=GLTFLoader.prototype.loadAsync,requests:string[]=[];
 GLTFLoader.prototype.loadAsync=async url=>{requests.push(url);return {scene:new T.Group(),animations:[],scenes:[],cameras:[],asset:{version:'2.0'}} as unknown as Awaited<ReturnType<typeof load>>;};
 try{
  const resident=await loadHuman('kroenen',true),bonus=await loadHuman('deadpool');
  assert.ok('civilian' in resident&&resident.civilian);
  assert.ok('character' in bonus&&bonus.character==='deadpool');
  assert.ok(requests[0].includes('/characters/civilian/civilian-male.glb'));
  assert.ok(requests[1].includes('/characters/bonus/deadpool.glb'));
 }finally{GLTFLoader.prototype.loadAsync=load;}
});

test('the common human factory delegates civilian source data and disposes only its own instance',()=>{
 const source=new T.Group(),entry={root:source,refs:0},material=new T.MeshStandardMaterial();
 const human=createHuman({civilian:true,entry},'fr','alpine',material,'kroenen',true);
 assert.equal(human.group.userData.civilianModel,'rocketbox-male-adult-03');
 assert.equal(entry.refs,1);assert.equal(source.parent,null);
 const resident=makePlayer('resident','Bewohner','fr');resident.kind='resident';human.update(resident,0,1/60);
 human.dispose();human.dispose();assert.equal(entry.refs,0);assert.equal(human.group.children.length,0);material.dispose();
});
