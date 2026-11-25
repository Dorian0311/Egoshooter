import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../shared/game';
import {earnedHistoricalAwards} from '../shared/historicalAwards';

test('German historical awards are granted only to eligible players after a round',()=>{
 const game=new Game('AWARD',600000,'frontline',()=>.5,{kind:'solo',mode:'mission'});
 const player=game.add('player','Spieler');
 Object.assign(player,{team:'de',kills:5,hp:65});player.injuries.lastDamageAt=10;
 const snapshot=game.state;snapshot.winner='de';snapshot.operation.result='success';
 assert.deepEqual(earnedHistoricalAwards(snapshot,player),[]);
 snapshot.phase='finished';
 assert.deepEqual(earnedHistoricalAwards(snapshot,player),['infantry','wound','cross','merit']);
 player.hp=0;assert.deepEqual(earnedHistoricalAwards(snapshot,player),['infantry','cross','merit']);
 player.team='fr';assert.deepEqual(earnedHistoricalAwards(snapshot,player),[]);
 player.team='de';snapshot.mapId='storm';assert.deepEqual(earnedHistoricalAwards(snapshot,player),[]);
});
