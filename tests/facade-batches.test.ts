import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createFacadeBatches} from '../client/facadeBatches';

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
