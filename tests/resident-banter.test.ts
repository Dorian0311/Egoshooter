import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createResidentVoice,residentLine,residentSkinTone} from '../client/residentBanter';
import {residentProfile} from '../shared/residentProfiles';
import {Game} from '../shared/game';

test('resident roles select distinct banter independently of appearance',()=>{
 assert.equal(new Set(Array.from({length:4},(_,i)=>residentSkinTone(`resident-${i}`))).size,4);
 assert.equal(residentSkinTone('resident-2'),residentSkinTone('resident-6'));
 assert.ok(new Set(Array.from({length:24},(_,i)=>residentLine(i*1000))).size>=12);
 assert.equal(residentLine(0),'Where the women at?');
 const pools=Array.from({length:3},(_,n)=>new Set(Array.from({length:24},(_,i)=>residentLine(i*1000,`resident-${n}`))));
 for(const pool of pools)assert.equal(pool.size,12);
 assert.equal(new Set(pools.flatMap(pool=>[...pool])).size,36);
 for(let i=0;i<24;i++)assert.equal(residentLine(i*1000,'resident-0'),residentLine(i*1000,'resident-3'),'two machos with different appearances share the same role lines');
 assert.equal(residentProfile('resident-999999999999999999999').name,'Bruno Weber');
});

test('both inhabited maps spawn named archetypes with stable profile identities',()=>{
 for(const map of ['cologne','alpine'] as const){
  const game=new Game('CAST',600000,map,()=>.5,{kind:'solo',mode:'training'});game.add('a','Spieler');game.operation.configureBots();game.ready('a',true,1000);game.tick(4000);
  assert.equal(game.state.npcs.length,4);
  assert.deepEqual(game.state.npcs.map(p=>p.name),['Bruno Weber · Großmaul','David Adler · Veteran','Samuel Rosen · Überforderter Offizier','Elias König · Großmaul']);
  for(const npc of game.state.npcs){assert.equal(npc.kind,'resident');assert.ok(npc.name.startsWith(residentProfile(npc.id).name));assert.equal(npc.kills,0);}
 }
});

test('speech uses installed local voices, avoids overlap, respects mute and releases its own utterance',()=>{
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),originalUtterance=Object.getOwnPropertyDescriptor(globalThis,'SpeechSynthesisUtterance');
 const spoken:unknown[]=[];let cancelled=0,local=false;
 const speech={speaking:false,getVoices:()=>[{lang:'en-US',localService:local}],speak:(line:unknown)=>spoken.push(line),cancel:()=>cancelled++};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{speechSynthesis:speech}});
 Object.defineProperty(globalThis,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(public text:string){}}});
 try{
  const voice=createResidentVoice();voice.say('Remote voice',1,0);assert.equal(spoken.length,0);
  local=true;voice.say('Muted',0,0);assert.equal(spoken.length,0);
  voice.say('Hello',.5,0,'veteran');assert.equal(spoken.length,1);const veteran=spoken[0] as {rate:number;pitch:number;volume:number};assert.equal(veteran.volume,.5);
  voice.say('Too soon',1,1000);assert.equal(spoken.length,1);
  voice.stop();assert.equal(cancelled,1);voice.stop();assert.equal(cancelled,1);
  speech.speaking=true;voice.say('Other speech',1,7000);assert.equal(spoken.length,1);
  speech.speaking=false;voice.reset();voice.say('Replay',1,0,'officer');assert.equal(spoken.length,2);const officer=spoken[1] as {rate:number;pitch:number};assert.ok(officer.rate>veteran.rate);assert.ok(officer.pitch>veteran.pitch);
  voice.dispose();assert.equal(cancelled,2);voice.say('Disposed',1,9000);assert.equal(spoken.length,2);
 }finally{
  if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');
  if(originalUtterance)Object.defineProperty(globalThis,'SpeechSynthesisUtterance',originalUtterance);else Reflect.deleteProperty(globalThis,'SpeechSynthesisUtterance');
 }
});
