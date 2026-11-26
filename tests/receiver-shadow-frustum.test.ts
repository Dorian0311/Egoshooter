import test from 'node:test';
import assert from 'node:assert/strict';
import { Frustum, Matrix4, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { createReceiverShadowFrustum } from '../client/receiverShadowFrustum';

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
