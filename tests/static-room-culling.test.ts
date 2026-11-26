import assert from 'node:assert/strict';
import test from 'node:test';
import {Box3, Vector3, BoxGeometry, Frustum, Group, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene} from 'three';
import {behindIslandWall,islandWallSections} from '../client/islandWallOcclusion';
import {createStaticRoomCulling, registerFixedRoom} from '../client/staticRoomCulling';

test('room culling preserves offscreen casters for the world pass and restores only its own changes', () => {
  const scene = new Scene(), camera = new PerspectiveCamera(60, 1, .1, 100);
  const geometry = new BoxGeometry(2, 2, 2), material = new MeshBasicMaterial();
  function room(x: number, z: number) {
    const group = new Group();
    group.add(new Mesh(geometry, material));
    group.position.set(x, 0, z);
    scene.add(group);
    registerFixedRoom(scene, group);
    return group;
  }
  const front = room(0, -10), caster = room(0, 10), outside = room(100, 0), alreadyHidden = room(100, 10);
  const movable = new Group(); scene.add(movable);
  alreadyHidden.visible = false;
  const shadows = camera.clone();
  shadows.rotation.y = Math.PI;
  shadows.updateMatrixWorld();
  const lightFrustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(shadows.projectionMatrix, shadows.matrixWorldInverse));
  const culling = createStaticRoomCulling(scene);
  culling.begin(camera, lightFrustum);
  assert.deepEqual([front.visible, caster.visible, outside.visible, alreadyHidden.visible, movable.visible], [true, true, false, false, true]);
  culling.afterWorld();
  assert.deepEqual([front.visible, caster.visible, outside.visible], [true, false, false]);
  culling.restore();
  assert.deepEqual([caster.visible, outside.visible, alreadyHidden.visible], [true, true, false]);
  culling.begin(shadows);
  assert.deepEqual([front.visible, caster.visible, outside.visible], [false, true, false]);
  // Interrupted world draw, before the normal pass.
  culling.restore();
  assert.deepEqual([front.visible, caster.visible, outside.visible, alreadyHidden.visible], [true, true, true, false]);
  geometry.dispose(); material.dispose();
});

test('Island wall coverage preserves the sun caster, doorway, near plane and restores furnishings', () => {
  const scene=new Scene(), room=new Group(), camera=new PerspectiveCamera(70,1,.1,100);
  const material=new MeshBasicMaterial(), geometry=new BoxGeometry(.3,.3,.3);
  const wall={x:-1.5,y:1,z:-3,w:2,h:3,d:.45,kind:'wall'};
  const world={id:'storm' as const,name:'test',subtitle:'',opponent:'test',opponentCode:'QA',boxes:[wall],buildings:[],spawns:{de:[],fr:[]}};
  function prop(x:number,casts=false){
    const mesh=new Mesh(geometry,material);
    mesh.position.set(x,1,-6);mesh.castShadow=casts;room.add(mesh);return mesh;
  }
  const furniture=prop(-2),caster=prop(-2.5,true),doorway=prop(0);
  scene.add(room);registerFixedRoom(scene,room,world);
  camera.position.y=1;camera.updateMatrixWorld();
  const sunlight=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const culling=createStaticRoomCulling(scene);
  culling.begin(camera,sunlight,true);
  assert.deepEqual([furniture.visible,caster.visible,doorway.visible],[false,true,true]);
  culling.restore();assert.ok(furniture.visible);
  culling.begin(camera,undefined,false);assert.ok(furniture.visible);culling.restore();
  camera.near=4;camera.updateProjectionMatrix();
  culling.begin(camera,undefined,true);assert.ok(furniture.visible);culling.restore();
  camera.near=.1;camera.updateProjectionMatrix();camera.position.x=3;camera.updateMatrixWorld();
  culling.begin(camera,undefined,true);assert.ok(furniture.visible);culling.restore();
  material.dispose();geometry.dispose();
});

test('front of a thick wall crossing the near plane cannot occlude furnishings', () => {
  const furniture=new Box3(new Vector3(-.1,-.1,-2.1),new Vector3(.1,.1,-1.9));
  const sections=islandWallSections([{kind:'wall',x:0,y:0,z:-.26,w:4,h:3,d:.45}]);
  assert.equal(behindIslandWall(furniture,new Vector3(),.08,sections),false);
  assert.equal(behindIslandWall(furniture,new Vector3(0,0,.1),.08,sections),true);
});
