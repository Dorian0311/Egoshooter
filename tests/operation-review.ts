// Development-only visual fixture. No production entry point imports this module.
import {Game} from '../shared/game';
import {uniforms,type UniformId} from '../shared/uniforms';
import {createScene} from '../client/scene';
import {defaultSettings} from '../client/gameSettings';
import type {BodyPart} from '../shared/injuries';
const canvas=document.querySelector('canvas')!,select=document.querySelector<HTMLSelectElement>('#character')!,status=document.querySelector<HTMLOutputElement>('#status')!;
for(const [id,entry]of Object.entries(uniforms))select.add(new Option(entry.name,id));
select.value=new URLSearchParams(location.search).get('character')??'kroenen';
const game=new Game('VISUAL',600000,'storm');game.add('review','Prüfung');game.add('target','Prüffigur');game.ready('review',true,0);game.ready('target',true,0);game.tick(3000);
const human=game.player('review')!,target=game.player('target')!;
Object.assign(human,{x:-43,y:0,z:8,yaw:0,pitch:-.02,protectedUntil:0});Object.assign(target,{x:-43,y:0,z:4.5,yaw:Math.PI,protectedUntil:0,uniform:select.value as UniformId});
const scene=createScene(canvas,()=>{},'storm','performance',defaultSettings,()=>{},undefined,true);
const hit=(part:BodyPart)=>{game.operation.damage(target,human.id,4,part==='head'?100:38,part,[target.x,target.y+(part==='head'?1.65:part.startsWith('leg')?.6:1.3),target.z],true);if(part!=='head')target.injuries.bleeding=0;};
document.querySelector<HTMLButtonElement>('#arm')!.onclick=()=>hit('armL');document.querySelector<HTMLButtonElement>('#leg')!.onclick=()=>hit('legR');document.querySelector<HTMLButtonElement>('#head')!.onclick=()=>hit('head');
document.querySelector<HTMLButtonElement>('#reset')!.onclick=()=>location.reload();select.onchange=()=>{const url=new URL(location.href);url.searchParams.set('character',select.value);location.href=url.href;};
let timer=setInterval(()=>{game.tick(game.state.now+1000/30);scene.update(game.state,human.id);game.state.events=[];status.value=`HP ${Math.round(target.hp)} · Maske ${target.injuries.lost}`;},1000/30);
scene.update(game.state,human.id);window.addEventListener('pagehide',()=>{clearInterval(timer);scene.dispose();});
