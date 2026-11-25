import test from 'node:test';
import assert from 'node:assert/strict';
import {actorBehindWall} from '../client/actorOcclusion';
const eye={x:0,y:1.6,z:0},feet={x:20,y:0,z:0};
const wall={kind:'wall',x:7,y:2,z:0,w:.4,h:4,d:6};
test('occlusion requires a single intervening opaque wall covering the whole actor',()=>{
 assert.ok(actorBehindWall(eye,feet,[wall]));
 assert.equal(actorBehindWall(eye,feet,[{...wall,x:-7}]),false);
 assert.equal(actorBehindWall(eye,feet,[{...wall,x:25}]),false);
 assert.equal(actorBehindWall(eye,feet,[{...wall,h:.7,y:.35}]),false);
 assert.equal(actorBehindWall(eye,{...feet,z:9},[wall]),false);
 const door=[{...wall,z:-2,d:2.4},{...wall,z:2,d:2.4}];
 assert.equal(actorBehindWall(eye,feet,door),false);
 assert.ok(actorBehindWall({x:0,y:1.6,z:20},{x:0,y:0,z:0},[{...wall,x:0,z:12,w:7,d:.4}]));
});
