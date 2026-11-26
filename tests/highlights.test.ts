import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../shared/game';
import {HighlightRecorder} from '../client/highlights';
import {mergeSnapshot} from '../shared/protocol';
test('highlight recording deduplicates events, includes lead-in and aftermath, and caps memory by clip count',()=>{
 const g=new Game('REPLAY');g.add('a','A');g.add('b','B');g.ready('a',true,1000);g.ready('b',true,1000);g.tick(4000);const recorder=new HighlightRecorder();
 for(let i=0;i<300;i++){g.state.now=4000+i*50;g.state.events=i>=120&&i<123?[{type:'kill',id:'a',target:'b',eventId:'one',hitZone:'head'}]:[];recorder.push(g.state,'a');}
 assert.equal(recorder.clips.length,1);const clip=recorder.clips[0];assert.equal(clip.title,'Kopftreffer');assert.equal(clip.frames[0].snapshot.now,4000);assert.ok(clip.frames.at(-1)!.snapshot.now>=14000);assert.ok(clip.frames.length<=205);
 for(let i=0;i<6;i++){g.state.now+=100;g.state.events=[{type:'revive',id:'a',target:'b',eventId:'rescue'+i}];recorder.push(g.state,'a');}recorder.finish();assert.equal(recorder.clips.length,3);
 g.state.matchId='next';g.state.events=[];recorder.push(g.state,'a');assert.equal(recorder.clips.length,0);
});

test('network replay frames retain individual snapshot states across later patches',()=>{
 const game=new Game('REPLAY');
 game.add('a','A');game.add('b','B');game.ready('a',true,1000);game.ready('b',true,1000);game.tick(4000);
 const first=structuredClone(game.state);
 const recorded=new HighlightRecorder();
 recorded.push(first,'a','immutable');
 const initialHp=first.players.find(p=>p.id==='b')!.hp;
 const second=mergeSnapshot(first,{
  patch:{now:first.now+50,events:[{type:'kill',id:'a',target:'b',eventId:'first'}]},
  players:[{id:'b',hp:0}],
 })!;
 recorded.push(second,'a','immutable');
 const [clip]=recorded.finish();
 assert.equal(clip.frames[0].snapshot,first);
 assert.equal(clip.frames[1].snapshot,second);
 assert.equal(clip.frames[0].snapshot.players.find(p=>p.id==='b')!.hp,initialHp);
 assert.equal(clip.frames[1].snapshot.players.find(p=>p.id==='b')!.hp,0);
});
