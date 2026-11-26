import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,neutral} from '../shared/game';
import type {Point} from '../shared/operations';
import {difficultyRules} from '../shared/operationConfig';
import {Bots} from '../server/bots';
import type {Navigation} from '../server/navigation';
import {interiorFixtures} from '../shared/interiors';
import {getWorld} from '../shared/world';

test('limited bot rays agree with the full obstacle scan after doors and glass change',()=>{
 let seed=297;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const map of ['storm','frontline','cologne','alpine'] as const){
  const game=new Game('BOTRAYS',600000,map,()=>.5,{kind:'solo',mode:'battle'});
  const interiors=game.state.interiors;
  assert.ok(interiors);
  for(const changed of [false,true]){
   if(changed)for(const fixture of interiorFixtures(getWorld(map))){
    if(fixture.type==='door')interiors.doors[fixture.id]=false;
    if(fixture.type==='glass')interiors.broken.push(fixture.id);
   }
   for(let i=0;i<240;i++){
    const origin=[random()*200-100,random()*5,random()*180-90];
    const vector=[random()-.5,random()*.12-.06,random()-.5];
    const direction=vector.map(value=>value/Math.hypot(...vector)),limit=1+random()*59;
    const full=game.operation.obstacleDistance(origin,direction);
    assert.equal(game.operation.obstacleDistance(origin,direction,0,limit),Math.min(full,limit));
   }
  }
 }
});

test('bot pathfinding spreads replans across simulation ticks without starving other bots',()=>{
 const game=new Game('BUDGET',600000,'storm',()=>.5,{kind:'solo',mode:'battle'});game.add('human','Player');game.operation.configureBots();for(const player of game.state.players)game.ready(player.id,true,1000);game.tick(4000);
 let calls=0;const reached=new Set<string>(),navigation={sync(){},dispose(){},reachable(){return true;},path(start:{x:number;y:number;z:number;id?:string},end:{x:number;y:number;z:number}){calls++;if(start.id)reached.add(start.id);return [{x:start.x,y:start.y,z:start.z},{...end}];}} as Navigation;
 const bots=new Bots(game,navigation);for(let tick=0;tick<15;tick++){const before=calls;bots.update(4033+tick*33.34);assert.ok(calls-before<=1,'multiple expensive replans in one tick');game.tick(4033+tick*33.34);}assert.equal(reached.size,7);bots.dispose();
});

test('bots investigate shots at their origin and decoys at the first impact, without requiring snapshot events',()=>{
 const game=new Game('HEARING',600000,'storm',()=>.5,{kind:'solo',mode:'battle',battleStyle:'alone',enemies:1});
 const human=game.add('human','Player');game.operation.configureBots();
 const bot=game.player('bot-0')!;
 for(const p of [human,bot])game.ready(p.id,true,1000);
 game.tick(4000);
 Object.assign(human,{x:20,y:4,z:0,yaw:0,pitch:0});
 Object.assign(bot,{x:0,y:4,z:0,yaw:0});
 game.operation.obstacleDistance=()=>Infinity;
 let goal:Point|undefined;
 const nav:Navigation={sync(){},dispose(){},reachable(){return true;},path(_start,end){goal=end;return [end];}};
 const bots=new Bots(game,nav);
 game.shoot(human,neutral(),4033);
 game.state.events=[];
 bots.update(4033);
 assert.equal(goal?.x,human.x);
 assert.equal(goal?.z,human.z);
 assert.equal(game.inputs.get(bot.id)?.fire,false);

 const impact:Point={x:12,y:4,z:-5};
 game.emit({type:'impact',id:human.id,weapon:6,point:[impact.x,impact.y,impact.z]});
 game.state.events=[];
 bots.update(4066);
 assert.deepEqual(goal,impact);
 game.shoot(human,neutral(),5200);
 bots.update(5200);
 assert.deepEqual(goal,impact);

 bot.yaw=-Math.PI/2;
 bots.update(5233);
 assert.equal(goal?.x,human.x);
 assert.equal(game.inputs.get(bot.id)?.fire,false);
 bots.dispose();
});

test('bots fire real bursts with a difficulty-dependent pause after the last shot',()=>{
 for(const difficulty of ['easy','normal','hard'] as const){
  const game=new Game('BURST',600000,'cologne',()=>.5,{kind:'solo',mode:'battle',battleStyle:'alone',enemies:1,difficulty});
  const human=game.add('human','Player');
  game.operation.configureBots();
  const bot=game.player('bot-0')!;
  for(const p of [human,bot])game.ready(p.id,true,1000);
  game.tick(4000);
  Object.assign(human,{x:8,y:0,z:-3,protectedUntil:Infinity});
  Object.assign(bot,{x:8,y:0,z:8,yaw:0});
  const world=game.world();
  game.world=()=>({...world,boxes:[]});
  game.operation.obstacleDistance=()=>Infinity;
  const bots=new Bots(game,{sync(){},dispose(){},reachable(){return true;},path(_start,end){return [end];}});
  const {burstSize,burstPause}=difficultyRules[difficulty],shots:number[]=[];
  for(let now=4033;now<10000&&shots.length<burstSize*2;now+=33){
   game.state.events=[];
   bots.update(now);game.tick(now);
   if(game.state.events.some(e=>e.type==='shot'&&e.id===bot.id&&e.weapon===2))shots.push(now);
  }
  assert.equal(shots.length,burstSize*2,difficulty);
  for(let i=1;i<shots.length;i++){
   const gap=shots[i]-shots[i-1];
   if(i===burstSize)assert.ok(gap>=burstPause&&gap<=burstPause+330,`${difficulty}: pause ${gap}`);
   else assert.ok(gap>=85&&gap<=132,`${difficulty}: burst spacing ${gap}`);
  }
  bots.dispose();
 }
});
