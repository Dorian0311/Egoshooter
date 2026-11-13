import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CameraMotion} from '../client/cameraMotion';

test('30 Hz local movement renders at uniform 60 Hz increments instead of duplicate positions',()=>{
 const motion=new CameraMotion(),player={x:0,y:0,z:0};motion.reset(player);
 const samples:number[]=[];let accumulator=0;
 for(let n=0;n<120;n++){
  accumulator+=1/60;
  if(accumulator>=1/30){accumulator-=1/30;motion.beforeStep(player);player.x+=4.3/30;}
  samples.push(motion.sample(player,accumulator/(1/30),1/60).x);
 }
 for(let n=3;n<samples.length;n++)assert.ok(Math.abs(samples[n]-samples[n-1]-4.3/60)<1e-8);
});

test('small server corrections ease in; respawns and teleports reset without trailing',()=>{
 const motion=new CameraMotion(),before={x:1,y:0,z:0},after={x:1.2,y:0,z:0};motion.reset(before);
 motion.reconcile(before,after);
 assert.ok(Math.abs(motion.sample(after,1,0).x-1)<1e-9);
 const eased=motion.sample(after,1,.1).x;assert.ok(eased>1&&eased<1.2);
 const spawn={x:65,y:0,z:19};motion.reconcile(after,spawn);
 assert.deepEqual(motion.sample(spawn,.5,1/60).toArray(),[65,0,19]);
});
