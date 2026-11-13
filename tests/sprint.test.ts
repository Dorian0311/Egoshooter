import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makePlayer,move,neutral,STEP,SPRINT_DURATION_MS,SPRINT_RECHARGE_MS,SPRINT_REST_MS} from '../shared/game';
import {getWorld} from '../shared/world';
const world={...getWorld('storm'),boxes:[]};

test('sprint lasts 3.2 seconds, exhausts and cannot immediately restart while held',()=>{
 const player=makePlayer('a','A','de',0,world);Object.assign(player,{x:0,z:0});
 let now=0;
 const tick=(sprint=true)=>{now+=STEP*1000;move(player,{...neutral(),forward:1,sprint,yaw:-Math.PI/2,time:now},STEP,world,now);};
 for(let n=0;n<96;n++)tick();
 assert.equal(player.stamina,0);assert.equal(player.sprintExhausted,true);
 assert.ok(Math.abs(player.x-6.2*SPRINT_DURATION_MS/1000)<1e-6);
 const x=player.x;tick();assert.equal(player.sprinting,false);assert.ok(Math.abs(player.x-x-4.3*STEP)<1e-6);
 for(let n=0;n<20;n++)tick();assert.equal(player.stamina,0);
 for(let n=0;n<Math.ceil((SPRINT_REST_MS+SPRINT_RECHARGE_MS)/1000/STEP);n++)tick(false);
 assert.equal(player.stamina,SPRINT_DURATION_MS);assert.equal(player.sprintExhausted,false);
 tick();assert.equal(player.sprinting,true);assert.ok(player.stamina<SPRINT_DURATION_MS);
});

test('standing, aiming and crouching do not consume sprint energy',()=>{
 for(const input of [{forward:0,side:0},{forward:1,aim:true},{forward:1,crouch:true}]){
  const player=makePlayer('a','A','de',0,world);
  for(let n=0;n<120;n++)move(player,{...neutral(n),sprint:true,...input,time:n*STEP*1000},STEP,world,n*STEP*1000);
  assert.equal(player.stamina,SPRINT_DURATION_MS);assert.equal(player.sprinting,false);
 }
});
