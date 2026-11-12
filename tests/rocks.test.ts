import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {rockHull,rockBlocks,rockSurface,rayRock} from '../shared/rocks.ts';
import {getWorld} from '../shared/world.ts';
import {makePlayer,move,neutral} from '../shared/game.ts';
import {createRockGeometry} from '../client/rockGeometry.ts';

const rocks=getWorld('alpine').boxes.filter(b=>b.kind==='rock');
test('rock hulls are finite, convex and stay inside authoritative broad bounds',()=>{
  for(const b of rocks){
    const hull=rockHull(b);assert.ok(hull.vertices.length>=12);assert.ok(hull.faces.length>=10);
    assert.equal(rockHull(b),hull);
    for(const v of hull.vertices){
      assert.ok(v.every(Number.isFinite));
      assert.ok(Math.abs(v[0])<=b.w/2+1e-6&&Math.abs(v[2])<=b.d/2+1e-6);
      for(const p of hull.planes)assert.ok(p.normal.reduce((sum,n,i)=>sum+n*v[i],0)<=p.offset+1e-6);
    }
  }
});

test('server rock hits match visible triangles, including clipped corners',()=>{
  for(const b of rocks){
    const mesh=new T.Mesh(createRockGeometry(b),new T.MeshBasicMaterial());
    mesh.position.set(b.x,b.y,b.z);mesh.updateMatrixWorld();
    const raycaster=new T.Raycaster();
    for(let i=0;i<60;i++){
      const angle=i*2.39996;
      const origin=new T.Vector3(b.x+Math.cos(angle)*20,b.y+2+(i%6),b.z+Math.sin(angle)*20);
      const target=new T.Vector3(b.x+Math.sin(i)*b.w*.48,b.y+(i%4)*.5,b.z+Math.cos(i)*b.d*.48);
      const direction=target.sub(origin).normalize();raycaster.set(origin,direction);
      const rendered=raycaster.intersectObject(mesh)[0]?.distance??Infinity;
      const authoritative=rayRock(b,origin.toArray(),direction.toArray());
      assert.ok(rendered===authoritative||Math.abs(rendered-authoritative)<1e-4,`${rendered} vs ${authoritative}`);
    }
    assert.equal(rockBlocks(b,b.x+b.w*.48,0,b.z+b.d*.48,1.75,.1),false);
    assert.equal(rockBlocks(b,b.x,0,b.z,1.75,.34),true);
  }
});

test('falling player lands on visible rock surface and can pass clipped corner',()=>{
  const world=getWorld('alpine'),b=rocks[0],p=makePlayer('test','Test','de',0,world);
  const surface=rockSurface(b,b.x,b.z);
  Object.assign(p,{x:b.x,z:b.z,y:surface+3,vy:0,grounded:false});
  for(let i=0;i<120;i++)move(p,neutral(i),1/60,world);
  assert.ok(Math.abs(p.y-surface)<1e-6);assert.equal(p.grounded,true);
  assert.equal(rockSurface(b,b.x+b.w,b.z),-Infinity);
});
