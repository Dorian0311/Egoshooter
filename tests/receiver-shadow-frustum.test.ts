import test from 'node:test';
import assert from 'node:assert/strict';
import { Frustum, Matrix4, OrthographicCamera, PerspectiveCamera, Vector3, Vector4 } from 'three';
import { createReceiverShadowFrustum, setReceiverShadowScissor } from '../client/receiverShadowFrustum';
import { createShadowMapFootprint } from '../client/projectedShadowBounds';

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

test('outdoor shadow footprint stays conservative through a full camera turn',()=>{
 const light=new OrthographicCamera(-52,52,52,-52,1,300);
 light.position.set(-70,110,55);light.lookAt(0,0,0);light.updateMatrixWorld();
 const full=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(light.projectionMatrix,light.matrixWorldInverse));
 const view=new PerspectiveCamera(70,16/9,.08,350),weapon=new PerspectiveCamera(54,16/9,.025,8);
 const point=new Vector3(),scissor=new Vector4(),projectFootprint=createShadowMapFootprint(),padding=.19;
 let receiverCount=0,clippedHeadings=0;
 for(let heading=0;heading<16;heading++){
  view.position.set(0,1.65,0);view.rotation.set(-.06,heading*Math.PI/8,0);view.updateMatrixWorld();
  weapon.position.copy(view.position);weapon.rotation.copy(view.rotation);weapon.updateMatrixWorld();
  const clipped=projectFootprint(full,view,weapon,padding,104);
  setReceiverShadowScissor(scissor,full,clipped,2048,2048,104);
  if(scissor.z*scissor.w<.85*2048**2)clippedHeadings++;
  for(const side of [4,5])assert.ok(clipped.planes[side].equals(full.planes[side]));
  for(const camera of [view,weapon])for(const x of [-1,-.5,0,.5,1])for(const y of [-1,-.5,0,.5,1]){
   for(const depth of [-1,-.8,-.1,.5,.8,.9,.97,.99,.998,1]){
    point.set(x,y,depth).unproject(camera);
    if(!full.planes.slice(0,4).every(plane=>plane.distanceToPoint(point)>=-padding))continue;
    receiverCount++;
    for(let side=0;side<4;side++){
     if(!clipped.planes[side].equals(full.planes[side])){
      assert.ok(clipped.planes[side].distanceToPoint(point)>=padding-1e-8);
     }
    }
   }
  }
 }
 assert.ok(receiverCount>4000);
 assert.ok(clippedHeadings>8);
});
