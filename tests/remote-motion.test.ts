import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RemoteMotion} from '../client/remoteMotion';
const pose=(x:number,yaw=0)=>({x,y:0,z:0,yaw,pitch:0});

test('20 Hz network movement renders evenly at 30, 60, 120 and 144 Hz',()=>{
 for(const rate of [30,60,120,144]){
  const motion=new RemoteMotion();let next=0,previous=0;
  for(let frame=0;frame<rate*3;frame++){
   const now=frame*1000/rate;
   while(next<=now+.00001){motion.push(pose(next*.004),next,next);next+=50;}
   const x=motion.sample(now).x;
   if(now>200)assert.ok(Math.abs(x-previous-4/rate)<1e-8,`${rate} Hz, ${now}: ${x-previous}`);
   previous=x;
  }
 }
});

test('buffer absorbs uneven packet arrivals instead of pulsing toward each target',()=>{
 const motion=new RemoteMotion();let next=0,previous=0,old=0,oldPrevious=0,target=0;
 let bufferedError=0,chaseError=0,count=0;
 for(let frame=0;frame<600;frame++){
  const now=frame*1000/120;
  while(next*50+(next%2?25:0)<=now){target=next*50*.004;motion.push(pose(target),next*50,next*50+(next%2?25:0));next++;}
  const x=motion.sample(now).x;old+=(target-old)*(1-Math.exp(-14/120));
  if(now>500){bufferedError+=(x-previous-4/120)**2;chaseError+=(old-oldPrevious-4/120)**2;count++;}
  previous=x;oldPrevious=old;
 }
 assert.ok(bufferedError<chaseError*.1,`step RMS: buffered=${Math.sqrt(bufferedError/count)}, old=${Math.sqrt(chaseError/count)}`);
});

test('rotations take the short path, stale packets stop, teleports and new lives snap',()=>{
 const motion=new RemoteMotion();motion.push(pose(0,Math.PI-.1),0,0);motion.push(pose(.2,-Math.PI+.1),50,50);
 assert.ok(Math.abs(motion.sample(125).yaw-Math.PI)<1e-8);
 assert.equal(motion.sample(1000).x,.2);
 motion.push(pose(60),1050,1050);assert.equal(motion.sample(1050).x,60);
 motion.push(pose(59),1100,1100,true);assert.equal(motion.sample(1100).x,59);
 motion.push(pose(2),0,1200);assert.equal(motion.sample(1200).x,2);
});

test('copies snapshot values and ignores duplicate timestamps in interpolation',()=>{
 const motion=new RemoteMotion(),p=pose(0);motion.push(p,0,0);p.x=1;
 assert.equal(motion.sample(0).x,0);
 motion.push(p,0,0);motion.push(pose(1.2),50,50);assert.equal(motion.sample(125).x,1.1);
});
