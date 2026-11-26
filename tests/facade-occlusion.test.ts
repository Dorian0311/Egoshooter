import assert from 'node:assert/strict';
import test from 'node:test';
import {Box3, Matrix4, Vector3} from 'three';
import {facadePartIsBuried,opaqueWallCores} from '../client/facadeOcclusion';

test('facade culling requires all transformed copies to fit within opaque wall cores',()=>{
 const walls=opaqueWallCores([
  {kind:'wall',x:5,y:2,z:8,w:7,h:4,d:.45},
  {kind:'wall',x:-5,y:2,z:-8,w:7,h:4,d:.45},
  {kind:'door',x:0,y:2,z:8,w:2,h:4,d:.45},
 ]);
 const pane=new Box3(new Vector3(-2.45,.76,-.168),new Vector3(-.55,2.18,-.168));
 const part=new Matrix4().makeTranslation(1.5,0,0);
 const front=new Matrix4().makeTranslation(4,0,8.24);
 const back=new Matrix4().makeRotationY(Math.PI).setPosition(-4,0,-8.24);
 assert.equal(facadePartIsBuried(pane,part,[front,back],walls),true);
 const exposed=front.clone().setPosition(4,0,8.48);
 const doorway=front.clone().setPosition(0,0,8.24);
 assert.equal(facadePartIsBuried(pane,part,[front,exposed],walls),false);
 assert.equal(facadePartIsBuried(pane,part,[doorway],walls),false);
});
