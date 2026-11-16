import {Game,makePlayer} from '../shared/game';
import {createScene} from '../client/scene';
import {defaultSettings} from '../client/gameSettings';
const game=new Game('CIVILIANWORLD',600000,'storm');
game.add('review','Prüfung');game.add('kroenen','Kroenen');game.add('deadpool','Deadpool');
for(const p of game.state.players)game.ready(p.id,true,0);game.tick(3000);
game.state.phase='playing';
if(!game.state.npcs.length)game.state.npcs.push({...makePlayer('resident-review','Stadtbewohner','de'),kind:'resident'});
const resident=game.state.npcs[0];let gesture=false;
const scene=createScene(document.querySelector('canvas')!,()=>{},'storm','performance',defaultSettings,()=>{},{position:[-43,1.6,9],target:[-43,1,4.5]},true);
function update(){game.tick(game.state.now+1000/30);Object.assign(game.player('review')!,{x:-43,z:12,y:0});Object.assign(game.player('kroenen')!,{x:-44.2,z:4.5,y:0,yaw:Math.PI,uniform:'kroenen'});Object.assign(game.player('deadpool')!,{x:-41.8,z:4.5,y:0,yaw:Math.PI,uniform:'deadpool'});Object.assign(resident,{x:-43,z:4.5,y:0,yaw:Math.PI,gestureUntil:gesture?game.state.now+1000:0});scene.update(game.state,'review');game.state.events=[];}
const timer=setInterval(update,1000/30);update();
Object.assign(window,{civilianWorld:{gesture:(on:boolean)=>gesture=on,stats:scene.getRenderStats}});
addEventListener('pagehide',()=>{clearInterval(timer);scene.dispose();});
