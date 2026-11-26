import assert from 'node:assert/strict';
import test from 'node:test';
import {PerspectiveCamera} from 'three';
import {createPlayerNameplate} from '../client/playerNameplate';
import type {Box} from '../shared/world';

test('nameplates check cover on screen entry and preserve offscreen resident speech',()=>{
 const createElement=()=>({style:{},append(){},setAttribute(){},classList:{toggle(){}}});
 const parent={...createElement(),ownerDocument:{createElement}} as unknown as HTMLElement;
 const label=createPlayerNameplate(parent,'Bot',false),camera=new PerspectiveCamera(90,1,.1,100);
 const wall:Box[]=[{x:0,y:0,z:-5,w:4,h:4,d:.5,kind:'wall'}];
 const offscreenBoxes=new Proxy<Box[]>([],{get(){throw Error('offscreen bot queried collision geometry');}});
 const check=(boxes:Box[],time:number,audible=false)=>label.visibility(camera,camera.position,boxes,true,audible,time);
 label.anchor.position.set(0,0,-10);
 assert.equal(check([],1000),true);
 label.anchor.position.x=10.9;assert.equal(check([],1001),true);
 label.anchor.position.x=11.1;assert.equal(check(offscreenBoxes,1200),false);
 assert.equal(check([],1201,true),true);
 label.anchor.position.x=0;assert.equal(check(wall,1202),false);
 assert.equal(check([],1203),false);
 assert.equal(check([],1303),true);
 label.hide();
 assert.equal(check(wall,1304),false);
 label.anchor.position.z=10;assert.equal(check(offscreenBoxes,1500),false);
});
