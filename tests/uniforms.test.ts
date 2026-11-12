import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../shared/game.ts';
import {difference,mergeSnapshot} from '../shared/protocol.ts';

test('uniforms are faction/map restricted and reset readiness',()=>{
  const g=new Game('ABC234');g.add('a','A');g.add('b','B');
  g.ready('a',true,1000);
  assert.equal(g.selectUniform('a','de-greatcoat'),true);
  assert.equal(g.player('a')!.ready,false);
  for(const value of ['fr-alpine','unknown',null,{},'__proto__'])assert.equal(g.selectUniform('a',value),false);
  assert.equal(g.selectUniform('b','fr-alpine'),false);
  g.selectMap('a','alpine');assert.equal(g.player('b')!.uniform,'fr-alpine');
  assert.equal(g.selectUniform('b','fr-liberation'),true);
});

test('selection is synchronized and survives countdown, respawn and rematch',()=>{
  const g=new Game('ABC234');g.add('a','A');g.add('b','B');
  const before=structuredClone(g.state);g.selectUniform('a','de-greatcoat');
  assert.equal(mergeSnapshot(before,difference(before,g.state))!.players[0].uniform,'de-greatcoat');
  g.ready('a',true,1000);g.ready('b',true,1000);g.tick(4000);
  assert.equal(g.player('a')!.uniform,'de-greatcoat');
  assert.equal(g.selectUniform('a','de-field'),false);
  g.player('a')!.hp=0;g.player('a')!.respawnAt=5000;g.tick(5000);
  assert.equal(g.player('a')!.uniform,'de-greatcoat');
  g.state.phase='finished';g.rematch('a');assert.equal(g.player('a')!.uniform,'de-greatcoat');
});
