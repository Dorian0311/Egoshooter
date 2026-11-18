import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nearbyBoxes} from '../shared/boxIndex';
import {getWorld,mapIds,type Box} from '../shared/world';
import {initialInteriors,interiorWorld} from '../shared/interiors';

test('spatial movement candidates include every overlapping box, retain source order and have no duplicates',()=>{
 for(const id of mapIds){
  const world=interiorWorld(getWorld(id),initialInteriors(getWorld(id))),boxes=world.boxes;
  for(let n=0;n<400;n++){
   const x=(n*17.93)%250-125,z=(n*31.37)%250-125,padding=n%3===0?1.14:.34;
   const selected=nearbyBoxes(boxes,x-padding,z-padding,x+padding,z+padding);
   const expected=boxes.filter(b=>Math.abs(x-b.x)<=b.w/2+padding&&Math.abs(z-b.z)<=b.d/2+padding);
   for(const box of expected)assert.ok(selected.includes(box),`${id}: ${x},${z}`);
   assert.equal(new Set(selected).size,selected.length);
   const order=selected.map(b=>boxes.indexOf(b));assert.deepEqual(order,[...order].sort((a,b)=>a-b));
  }
 }
});

test('cell boundaries, large sweeps and replacement layouts preserve conservative collision selection',()=>{
 const boxes:Box[]=[{x:-16,y:1,z:0,w:.1,h:2,d:40},{x:16,y:4,z:16,w:32,h:.2,d:32},{x:0,y:0,z:0,w:1,h:1,d:1,kind:'rock'}];
 assert.deepEqual(nearbyBoxes(boxes,-16,-16,16,16),boxes);
 assert.equal(nearbyBoxes(boxes,-16,-16,16,16),nearbyBoxes(boxes,-16,-16,16,16));
 assert.equal(nearbyBoxes(boxes,-1000,-1000,1000,1000),boxes);
 assert.equal(nearbyBoxes(boxes,NaN,0,1,1),boxes);
 const remote:Box={x:100,y:0,z:100,w:1,h:1,d:1};boxes.push(remote);
 assert.ok(nearbyBoxes(boxes,99,99,101,101).includes(remote));
 const replaced=boxes.map(b=>({...b,x:b.x+200}));assert.ok(!nearbyBoxes(replaced,-16,-16,16,16).includes(boxes[0]));
});

test('identical network layouts reuse collision data while doors, broken glass and map changes invalidate it',()=>{
 const world=getWorld('cologne'),state=initialInteriors(world),first=interiorWorld(world,state),next=structuredClone(state);
 next.lights['light-0']=false;assert.equal(interiorWorld(world,next),first);
 next.doors['door-0--1']=!next.doors['door-0--1'];const closed=interiorWorld(world,next);assert.notEqual(closed,first);
 assert.equal(interiorWorld(world,structuredClone(next)),closed);
 assert.equal(interiorWorld(world,structuredClone(state)),first,'separate rooms reuse their own layouts');
 next.broken.push('glass-0--1--3.25-0');assert.notEqual(interiorWorld(world,next),closed);
 assert.notEqual(interiorWorld(getWorld('alpine'),state),first);
});
