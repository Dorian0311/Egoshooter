import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createInteriorLighting} from '../client/interiorLighting';
import {createInteriors} from '../client/interiors';
import {bakeShopLights} from '../client/shopLighting';
import {createWeaponScene} from '../client/weaponScene';
import {instanceStaticModel,batchStaticMeshes} from '../client/scenery';
import {getWorld} from '../shared/world';
import {initialInteriors,interiorFixtures} from '../shared/interiors';

test('baked shop lighting shares one atlas and leaves exterior paving alone',()=>{
 const street=new T.Group(),original=new T.MeshStandardMaterial();
 const tile=(x:number,z:number)=>{
  const geometry=new T.PlaneGeometry(1,1,2,2).rotateX(-Math.PI/2);
  const mesh=new T.Mesh(geometry,original);
  mesh.position.set(x,.1,z);
  street.add(mesh);
  return mesh;
 };
 const diner=tile(60,-34.8),supply=tile(48,-11),road=tile(60,-23);
 const dispose=bakeShopLights(street);
 const atlas=diner.material.lightMap;
 assert.ok(atlas&&atlas===supply.material.lightMap);
 assert.notEqual(diner.material,original);
 assert.equal(road.material,original);
 assert.ok(diner.geometry.getAttribute('uv1').getX(4)>.25);
 assert.equal(street.children.length,3);
 dispose();
 assert.equal(diner.material,original);
 assert.equal(diner.geometry.hasAttribute('uv1'),false);
 street.children.forEach(child=>(child as T.Mesh).geometry.dispose());
 original.dispose();
});

test('opaque colour variants batch without losing surface colours or shadow flags',()=>{
 const root=new T.Group();
 const green=new T.MeshStandardMaterial({color:'#376940'}),sand=new T.MeshStandardMaterial({color:'#d6ba75'});
 for(const material of [green,sand]){
  const mesh=new T.Mesh(new T.BoxGeometry(),material);
  mesh.position.x=root.children.length*2;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 }
 batchStaticMeshes(root,new Set(),16,new Set([green,sand]));
 assert.equal(root.children.length,1);
 const batch=root.children[0] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 assert.ok(batch.material.vertexColors&&batch.castShadow&&batch.receiveShadow);
 const colors=batch.geometry.getAttribute('color'),color=new T.Color();
 for(const [index,expected] of [[0,green],[24,sand]] as const){
  color.fromBufferAttribute(colors,index);
  assert.ok(Math.abs(color.r-expected.color.r)<1e-6&&Math.abs(color.g-expected.color.g)<1e-6&&Math.abs(color.b-expected.color.b)<1e-6);
 }
 batch.geometry.dispose();batch.material.dispose();green.dispose();sand.dispose();
});

test('room lights keep two stable world slots without adding per-pixel lights to the viewmodel',()=>{
 const root=new T.Group(),pool=createInteriorLighting(root,[{x:0,y:3,z:0,building:0},{x:0,y:7,z:0,building:0},{x:50,y:3,z:0,building:1}]);
 const state={doors:{},lights:{'light-0':true,'light-1':true},broken:[]},ids=pool.lights.map(l=>l.uuid);
 const world=new T.Layers(),weapon=new T.Layers();weapon.set(1);
 for(const position of [{x:0,y:1,z:0},{x:0,y:5,z:0},{x:50,y:1,z:0}]){
  pool.update(position,1000,state);assert.deepEqual(pool.lights.map(l=>l.uuid),ids);
  assert.equal(pool.lights.filter(l=>l.visible&&l.layers.test(world)).length,2);
  assert.equal(pool.lights.filter(l=>l.visible&&l.layers.test(weapon)).length,0);
 }
 state.lights['light-0']=false;pool.update({x:0,y:1,z:0},2000,state);
 assert.ok(pool.lights.every(l=>l.intensity===0));assert.ok(pool.lights.every(l=>l.visible));
 pool.dispose();assert.equal(root.children.length,0);
});

test('viewmodel uses its own scene/cache while retaining camera transforms, environment and world shadow map',()=>{
 const world=new T.Scene(),camera=new T.PerspectiveCamera(),weaponCamera=new T.PerspectiveCamera(),weapon=new T.Group();weaponCamera.layers.set(1);
 world.add(camera);camera.add(weapon);weapon.position.set(.2,-.2,-.5);camera.position.set(4,1.6,5);
 const sun=new T.DirectionalLight(),sky=new T.HemisphereLight(),room=new T.PointLight(0xffffff,0);sun.layers.enable(1);sky.layers.enable(1);sun.castShadow=true;world.add(sun,sun.target,sky,room);
 const environment=new T.Texture();world.environment=environment;
 const viewmodel=createWeaponScene(world,camera,weaponCamera);assert.equal(camera.parent,viewmodel.scene);assert.equal(world.getObjectById(weapon.id),undefined);
 const copy=viewmodel.scene.children.find(o=>o instanceof T.DirectionalLight) as T.DirectionalLight;
 assert.equal(copy.shadow,sun.shadow);assert.equal(viewmodel.scene.children.filter(o=>o instanceof T.PointLight).length,0);
 sun.intensity=.25;sun.position.set(2,3,4);sky.intensity=.15;viewmodel.sync();viewmodel.scene.updateMatrixWorld(true);
 assert.equal(copy.intensity,.25);assert.ok(copy.getWorldPosition(new T.Vector3()).equals(sun.position));
 const bounce=camera.getObjectByName('first-person-sky-bounce') as T.DirectionalLight;
 assert.ok(bounce.layers.test(weaponCamera.layers)&&bounce.intensity>0);
 sky.intensity=.6;viewmodel.sync();assert.ok(bounce.intensity>.3);
 sky.visible=false;viewmodel.sync();assert.equal(bounce.intensity,0);
 assert.equal(viewmodel.scene.environment,environment);assert.deepEqual(weapon.getWorldPosition(new T.Vector3()).toArray(),[4.2,1.4000000000000001,4.5]);
 viewmodel.dispose();assert.equal(camera.parent,world);assert.equal(bounce.parent,null);assert.equal(viewmodel.scene.children.length,0);environment.dispose();
});

test('nearest light slots support upper floors and empty worlds without adding shader variants',()=>{
 const root=new T.Group(),pool=createInteriorLighting(root,[{x:0,y:3.1,z:0,building:0},{x:0,y:7.1,z:0,building:0},{x:25,y:3.1,z:0,building:1}]);
 pool.update({x:0,y:5.7,z:0},100,{doors:{},lights:{},broken:[]});assert.equal(pool.lights[0].position.y,7.1);
 assert.equal(pool.lights[1].position.y,3.1);pool.dispose();
 const empty=createInteriorLighting(root,[]);empty.update({x:0,y:0,z:0},0,{doors:{},lights:{},broken:[]});
 assert.ok(empty.lights.every(l=>l.visible&&l.intensity===0));empty.dispose();
});

test('spatial batches retain all transforms and keep distant geometry out of near-room bounds',()=>{
 const source=new T.Group(),material=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry(2,2,2);source.add(new T.Mesh(geometry,material));
 const scene=new T.Scene(),placements=[1,3,129,131].map(x=>new T.Matrix4().makeTranslation(x,0,1));
 instanceStaticModel(scene,source,placements,false,32);assert.equal(scene.children.length,2);
 const allX:number[]=[];
 for(const child of scene.children){const mesh=child as T.InstancedMesh,matrix=new T.Matrix4();assert.equal(mesh.count,2);assert.ok(mesh.boundingSphere!.radius<4);
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);allX.push(matrix.elements[12]);}mesh.dispose();}
 assert.deepEqual(allX.sort((a,b)=>a-b),[1,3,129,131]);
 const opaque=new T.Scene();for(const x of allX){const mesh=new T.Mesh(geometry.clone(),material);mesh.position.set(x,0,1);opaque.add(mesh);}
 batchStaticMeshes(opaque,new Set(),32);assert.equal(opaque.children.length,2);
 for(const child of opaque.children){const mesh=child as T.Mesh;assert.ok(mesh.geometry.boundingSphere!.radius<4);mesh.geometry.dispose();}
 geometry.dispose();material.dispose();
});

test('furniture batches stay inside their own buildings; doors, glass and light switches still sync',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})}});
 const scene=new T.Scene(),world=getWorld('cologne');
 try{
  const interiors=createInteriors(scene,world),root=scene.getObjectByName('building-interiors')!;
  const floorMaterials=new Set<T.Material>();
  for(const [index,b] of world.buildings.entries()){
   const room=root.getObjectByName(`interior-room-${index}`)!;assert.ok(room);
   const bounds=new T.Box3().setFromObject(room);assert.ok(bounds.min.x>=b.x-b.w/2-1&&bounds.max.x<=b.x+b.w/2+1);
   assert.ok(bounds.min.z>=b.z-b.d/2-1&&bounds.max.z<=b.z+b.d/2+1);
   room.traverse(o=>{if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial&&o.material.map&&o.material.roughness===.95)floorMaterials.add(o.material);});
  }
  assert.equal(floorMaterials.size,2);
  const state=initialInteriors(world),door=root.children.find(o=>o instanceof T.Mesh&&o.children.length)!;
  const oldRotation=door.rotation.y;state.doors['door-0--1']=!state.doors['door-0--1'];
  const pane=interiorFixtures(world).find(f=>f.type==='glass')!;
  state.broken.push(pane.id);state.lights['light-0']=false;interiors.sync(state);
  assert.notEqual(door.rotation.y,oldRotation);
  const facades=root.children.filter((o):o is T.InstancedMesh=>o instanceof T.InstancedMesh&&o.name.startsWith('glass-facade-'));
  assert.equal(facades.length,world.buildings.length*2);
  const hasPane=()=>{
   const matrix=new T.Matrix4(),point=new T.Vector3();
   for(const facade of facades)for(let i=0;i<facade.count;i++){
    facade.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix).add(facade.position);
    if(point.distanceTo(new T.Vector3(pane.box.x,pane.box.y,pane.box.z))<.001)return true;
   }
   return false;
  };
  assert.equal(hasPane(),false);
  assert.equal(facades.reduce((sum,f)=>sum+f.count,0),interiorFixtures(world).filter(f=>f.type==='glass').length-state.broken.length);
  state.broken.splice(state.broken.indexOf(pane.id),1);interiors.sync(state);assert.ok(hasPane());
  assert.equal(facades[0].geometry.index?.count,6);
  assert.equal((facades[0].material as T.Material).forceSinglePass,true);
  interiors.dispose();assert.equal(scene.children.length,0);
 }finally{
  if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');
 }
});


test('at night a switched indoor lamp lights the grip from its world direction without changing the viewmodel light budget',()=>{
 const world=new T.Scene(),room=new T.Group(),eye=new T.PerspectiveCamera(),weapon=new T.PerspectiveCamera();
 world.add(eye,room);weapon.layers.set(1);eye.position.set(8,1.6,7);
 const sky=new T.HemisphereLight(0xa3b9df,0x756960,.22);sky.layers.enable(1);world.add(sky);
 const lamp=new T.PointLight(0xffd59b,0,14,2);room.add(lamp);lamp.position.set(10,3,6);
 const vm=createWeaponScene(world,eye,weapon),bounce=eye.getObjectByName('first-person-sky-bounce') as T.DirectionalLight;
 const lights:T.Light[]=[];vm.scene.traverse(o=>{if(o instanceof T.Light)lights.push(o);});
 assert.equal(lights.length,2);assert.ok(lights.every(l=>!(l instanceof T.PointLight)));
 const blue=bounce.color.clone(),power=bounce.intensity;
 lamp.intensity=38;vm.sync();
 assert.ok(bounce.intensity>power+2);
 assert.ok(bounce.color.r/bounce.color.b>blue.r/blue.b*2);
 const actual=new T.Vector3(),expected=new T.Vector3(),target=new T.Vector3();
 for(const yaw of [0,Math.PI/2,Math.PI]){
  eye.rotation.y=yaw;vm.sync();bounce.target.getWorldPosition(target);
  actual.subVectors(bounce.getWorldPosition(actual),target).normalize();
  expected.subVectors(lamp.getWorldPosition(expected),target).normalize();
  assert.ok(actual.dot(expected)>.995,'the lamp stays fixed in the world as the player turns');
 }
 room.visible=false;vm.sync();assert.ok(Math.abs(bounce.intensity-power)<1e-9);
 room.visible=true;lamp.position.x+=20;vm.sync();assert.ok(Math.abs(bounce.intensity-power)<1e-9);
 lamp.position.x-=20;lamp.intensity=0;vm.sync();assert.ok(Math.abs(bounce.intensity-power)<1e-9);
 assert.ok(Math.abs(bounce.color.r-blue.r)<1e-9&&Math.abs(bounce.color.b-blue.b)<1e-9);
 vm.dispose();
});
