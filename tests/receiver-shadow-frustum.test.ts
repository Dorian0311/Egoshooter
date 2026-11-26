import test from 'node:test';
import assert from 'node:assert/strict';
import { Frustum, Matrix4, OrthographicCamera, PerspectiveCamera, Vector3, Vector4 } from 'three';
import { createReceiverShadowFrustum, setReceiverShadowScissor } from '../client/receiverShadowFrustum';

test('caster culling keeps full light depth, PCF margins and off-axis viewmodel receivers',()=>{
 const light=new OrthographicCamera(-24,24,24,-24,.1,90);
 light.position.z=25;light.updateMatrixWorld();
 const full=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(light.projectionMatrix,light.matrixWorldInverse));
 const camera=new PerspectiveCamera(30,1,.1,8);camera.updateMatrixWorld();
 const weapon=new PerspectiveCamera(30,1,.025,8);weapon.position.x=6;weapon.updateMatrixWorld();
 const limit=createReceiverShadowFrustum();
 const clipped=limit(full,camera,undefined,.25);
 assert.ok(clipped.containsPoint(new Vector3(0,0,20)));
 assert.ok(clipped.containsPoint(new Vector3(2.3,0,20)));
 assert.equal(clipped.containsPoint(new Vector3(3,0,20)),false);
 assert.ok(full.containsPoint(new Vector3(3,0,20)));
 for(const i of [4,5])assert.ok(clipped.planes[i].equals(full.planes[i]));
 assert.ok(limit(full,camera,weapon,.25).containsPoint(new Vector3(7,0,20)));
});

test('shadow write rectangle rounds outwards, clamps to the map and can cover the entire target',()=>{
 const full=new Frustum(),clipped=full.clone(),rect=new Vector4();
 const insets=[2.11,1.92,.12,1.06];
 insets.forEach((inset,i)=>{clipped.planes[i].constant-=inset;});
 setReceiverShadowScissor(rect,full,clipped,100,80,20);
 assert.deepEqual(rect.toArray(),[9,0,81,76]);
 clipped.planes[1].constant=full.planes[1].constant-32;
 setReceiverShadowScissor(rect,full,clipped,100,80,20);
 assert.deepEqual(rect.toArray(),[99,0,1,76]);
 setReceiverShadowScissor(rect,full,full,100,80,20);
 assert.deepEqual(rect.toArray(),[0,0,100,80]);
});
