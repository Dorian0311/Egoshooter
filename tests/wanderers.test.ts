import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wandererPose} from '../shared/wanderers';
import {getWorld,ground} from '../shared/world';
test('ambient routes remain dry and clear of solid geometry on both maps',()=>{
 for(const map of ['cologne','alpine'] as const)for(let n=0;n<4;n++)for(let time=0;time<400;time+=.5){
  const p=wandererPose(n,time),world=getWorld(map);assert.equal(ground(p.x,p.z,world),0);
  assert.ok(!world.boxes.some(b=>b.y+b.h/2>.1&&b.y-b.h/2<1.8&&Math.abs(p.x-b.x)<b.w/2+.3&&Math.abs(p.z-b.z)<b.d/2+.3),`${map}: route ${n}`);
 }
});
test('residents pause and their movement stays continuous',()=>{
 for(let n=0;n<4;n++){let paused=false;for(let t=0;t<250;t+=.1){const p=wandererPose(n,t),q=wandererPose(n,t+.1);paused||=!p.walking;assert.ok(Math.abs(q.z-p.z)<.1);}assert.ok(paused);}
});
