import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createFacadeBatches} from '../client/facadeBatches';
import {addFactoryGlazing} from '../client/factoryGlazing';

test('opaque facade modules share batches while transparent parts remain independent',()=>{
 const root=new T.Group(),left=new T.Group(),right=new T.Group();
 const opaque=new T.MeshStandardMaterial(),glass=new T.MeshStandardMaterial({transparent:true});
 const wall=new T.BoxGeometry(2,3,.2),pane=new T.BoxGeometry(1,1,.06);
 const panel=new T.Mesh(wall,opaque);panel.position.x=2;
 left.add(panel,new T.Mesh(pane,glass));right.add(new T.Mesh(wall,opaque));
 const {meshes,replaced}=createFacadeBatches(root,[
  {part:left,matrices:[new T.Matrix4().makeTranslation(10,0,0)]},
  {part:right,matrices:[new T.Matrix4().makeTranslation(-10,0,0)]},
 ]);
 try{
  assert.equal(meshes.length,1);
  assert.equal(replaced.has(opaque),true);
  assert.equal(replaced.has(glass),false);
  assert.equal(meshes[0].perObjectFrustumCulled,true);
  const matrix=new T.Matrix4();
  meshes[0].getMatrixAt(0,matrix);assert.equal(matrix.elements[12],12);
  meshes[0].getMatrixAt(1,matrix);assert.equal(matrix.elements[12],-10);
 }finally{
  meshes.forEach(mesh=>mesh.dispose());wall.dispose();pane.dispose();opaque.dispose();glass.dispose();
 }
});

test('depot glazing moves ahead of the wall and shares the existing frame material',()=>{
 const module=new T.Group();
 const frame=new T.Mesh(new T.BoxGeometry(2,2,.06),new T.MeshStandardMaterial());
 const glass=new T.Mesh(new T.PlaneGeometry(1.6,1.6),new T.MeshStandardMaterial({transparent:true}));
 frame.material.name='modular_factory_facade_windows';frame.position.x=1.5;
 glass.material.name='modular_factory_facade_windows_glass';glass.position.set(1.7,0,-.167);
 const frameMaterial=frame.material;
 const frameVertices=frame.geometry.attributes.position.count;
 module.add(frame,glass);
 addFactoryGlazing(module);
 try{
  assert.equal(frame.material,frameMaterial);
  assert.equal(glass.visible,false);
  const position=frame.geometry.attributes.position;
  assert.equal(position.count,frameVertices+glass.geometry.attributes.position.count);
  for(let vertex=frameVertices;vertex<position.count;vertex++){
   assert.ok(.24+position.getZ(vertex)>.225);
   assert.ok(position.getZ(vertex)<.03);
  }
  assert.ok(Math.abs(position.getX(frameVertices)+.6)<1e-5);
 }finally{
  frame.geometry.dispose();glass.geometry.dispose();frame.material.dispose();glass.material.dispose();
 }
});
