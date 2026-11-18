import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createCrateShadows} from '../client/crateShadows';

test('crate shadow hulls keep the color geometry intact and switch only for the world shadow pass',()=>{
 const world=new T.Scene(),other=new T.Scene(),camera=new T.PerspectiveCamera();
 camera.position.z=28;camera.updateMatrixWorld(true);
 let throws=false;
 const calls:{depthVisible:boolean;fullCasts:boolean}[]=[];
 const original=(_lights:T.Light[],_scene:T.Scene,_camera:T.Camera)=>{
  const depth=world.getObjectByName('cover-crate-shadow-hulls')!;
  const color=world.getObjectByName('cover-crates')!;
  calls.push({depthVisible:depth.visible,fullCasts:color.children[0].castShadow});
  if(throws)throw new Error('test interrupted shadow');
 };
 const shadowMap={autoUpdate:false,needsUpdate:true,render:original};
 const renderer={shadowMap} as unknown as T.WebGLRenderer;
 const source=new T.Group(),geometry=new T.BoxGeometry(1,1,1,12,12,12),material=new T.MeshBasicMaterial();
 source.add(new T.Mesh(geometry,material));
 const crates=createCrateShadows(renderer,world,true);
 crates.load(source,[new T.Matrix4()]);
 const depth=world.getObjectByName('cover-crate-shadow-hulls')!;
 const color=world.getObjectByName('cover-crates')!;
 assert.equal((color.children[0] as T.Mesh).geometry,geometry);
 assert.ok((depth.children[0] as T.Mesh).geometry.getAttribute('position').count<100);
 assert.equal(depth.visible,false);

 shadowMap.render([],other,camera);
 shadowMap.render([],world,camera);
 camera.position.z=3;camera.updateMatrixWorld(true);
 shadowMap.render([],world,camera);
 camera.position.z=28;camera.updateMatrixWorld(true);
 camera.fov=18;
 shadowMap.render([],world,camera);
 camera.fov=72;
 crates.setCompact(false);
 shadowMap.render([],world,camera);
 assert.deepEqual(calls,[{depthVisible:false,fullCasts:false},{depthVisible:true,fullCasts:false},
  {depthVisible:false,fullCasts:true},{depthVisible:false,fullCasts:true},{depthVisible:false,fullCasts:true}]);
 crates.setCompact(true);throws=true;
 assert.throws(()=>shadowMap.render([],world,camera),/interrupted shadow/);
 assert.equal(depth.visible,false);
 crates.dispose();
 assert.equal(shadowMap.render,original);
 assert.equal(world.children.length,0);
 geometry.dispose();material.dispose();
});
