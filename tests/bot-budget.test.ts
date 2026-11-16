import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../shared/game';
import {Bots} from '../server/bots';
import type {Navigation} from '../server/navigation';

test('bot pathfinding spreads replans across simulation ticks without starving other bots',()=>{
 const game=new Game('BUDGET',600000,'storm',()=>.5,{kind:'solo',mode:'battle'});game.add('human','Player');game.operation.configureBots();for(const player of game.state.players)game.ready(player.id,true,1000);game.tick(4000);
 let calls=0;const reached=new Set<string>(),navigation={sync(){},dispose(){},reachable(){return true;},path(start:{x:number;y:number;z:number;id?:string},end:{x:number;y:number;z:number}){calls++;if(start.id)reached.add(start.id);return [{x:start.x,y:start.y,z:start.z},{...end}];}} as Navigation;
 const bots=new Bots(game,navigation);for(let tick=0;tick<15;tick++){const before=calls;bots.update(4033+tick*33.34);assert.ok(calls-before<=1,'multiple expensive replans in one tick');game.tick(4033+tick*33.34);}assert.equal(reached.size,7);bots.dispose();
});
