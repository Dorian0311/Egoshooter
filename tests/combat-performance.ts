import {mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {Game,neutral} from '../shared/game';
import {Bots} from '../server/bots';
import {createNavigation} from '../server/navigation';
import {getWorld} from '../shared/world';
import {interiorFixtures,doorBox,initialInteriors,interiorWorld} from '../shared/interiors';

const world=getWorld('cologne'),interiors=initialInteriors(world),iterations=20000;
const uncached=()=>({...world,boxes:[...world.boxes,...interiorFixtures(world).flatMap(f=>f.type==='door'?[doorBox(f,!!interiors.doors[f.id])]:f.type==='glass'&&!interiors.broken.includes(f.id)?[f.box]:[])]});
const measure=(fn:()=>{boxes:unknown[]})=>{let consumed=0;const start=performance.now();for(let n=0;n<iterations;n++)consumed+=fn().boxes.length;return {milliseconds:performance.now()-start,consumed};};
const collisionBefore=measure(uncached),collisionAfter=measure(()=>interiorWorld(world,interiors));
const game=new Game('PERFQA',600000,'cologne',()=>.5,{kind:'solo',mode:'battle'});game.add('human','Performance');game.operation.configureBots();for(const p of game.state.players)game.ready(p.id,true,1000);game.tick(4000);const bots=new Bots(game,await createNavigation('cologne')),samples:number[]=[];
try{for(let n=0;n<900;n++){const now=4033+n*1000/30;game.input('human',{...neutral(n+1),forward:n%120<60?1:-1,side:.35,yaw:0,time:game.state.now});const start=performance.now();bots.update(now);game.tick(now);samples.push(performance.now()-start);}}finally{bots.dispose();}
samples.sort((a,b)=>a-b);const report={environment:'Local CPU simulation; not a physical-GPU FPS test',simulatedSeconds:30,actors:game.state.players.length,npcs:game.state.npcs.length,tickMs:{median:samples[Math.floor(samples.length*.5)],p95:samples[Math.floor(samples.length*.95)],p99:samples[Math.floor(samples.length*.99)],max:samples.at(-1)},collisionLayouts:{calls:iterations,before:collisionBefore.milliseconds,after:collisionAfter.milliseconds},hitEffects:{previousMaximumDrawCalls:256,newMaximumDrawCalls:3}};
mkdirSync('artifacts/movement-combat-20261116',{recursive:true});writeFileSync('artifacts/movement-combat-20261116/performance-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
