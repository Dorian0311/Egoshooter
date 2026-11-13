import {initialInteriors,interiorFixtures} from '../shared/interiors';
import { createScene } from '../client/scene.ts';
import '../client/crosshair.css';
import { parseGraphicsQuality } from '../client/graphicsSettings.ts';
import { makePlayer, VERSION, weapons, type Snapshot,type Player } from '../shared/game.ts';
import { getWorld } from '../shared/world.ts';
import {bonusIds} from '../client/bonusCharacters.ts';

const canvas = document.querySelector('canvas')!;
const view = document.querySelector<HTMLSelectElement>('#view')!;
const quality = document.querySelector<HTMLSelectElement>('#quality')!;
const output = document.querySelector('output')!;
const crowd=document.querySelector<HTMLInputElement>('#crowd')!;
const weapon=document.querySelector<HTMLSelectElement>('#weapon')!;
const reloadButton=document.querySelector<HTMLButtonElement>('#reload')!;
const characters=document.querySelector<HTMLSelectElement>('#characters')!;
const params=new URLSearchParams(location.search);
const clean=params.get('overview')==='1';
if(clean){document.querySelector('aside')!.style.display='none';document.documentElement.classList.add('clean-overview');}
if(['storm','frontline','street','river','alpine','combat','residents','interior','upstairs','station'].includes(params.get('view')??''))view.value=params.get('view')!;
quality.value=parseGraphicsQuality(params.get('quality'));
crowd.checked=params.get('crowd')==='1';
if(params.get('characters')==='bonus')characters.value='bonus';
if(['0','1','2','3','4'].includes(params.get('weapon')??''))weapon.value=params.get('weapon')!;
let currentSnapshot:Snapshot,simulation:ReturnType<typeof setInterval>|undefined;
let scene: ReturnType<typeof createScene> | undefined;
let samples: number[] = [], warmup = performance.now() + 5000;
const history:Record<string,unknown>[]=[];
function resetMeasurement() { samples = [];history.length=0;output.dataset.benchmark='[]';warmup = performance.now() + 5000; output.textContent = 'Messung läuft …'; }
function show() {
  scene?.dispose();
  if(simulation)clearInterval(simulation);
  const mapId = view.value === 'storm'||view.value==='combat' ? 'storm' : view.value === 'frontline' ? 'frontline' : view.value === 'alpine' ? 'alpine' : 'cologne';
  const player = makePlayer('review', 'Grafikprüfung', 'de', 0, getWorld(mapId));
  if(view.value==='storm')Object.assign(player,{x:-25,y:0,z:9,yaw:-1.18,pitch:-.04});
  if(view.value==='frontline')Object.assign(player,{x:-28,y:0,z:0,yaw:-.9,pitch:-.01});
  if(view.value==='interior')Object.assign(player,{x:-48,y:0,z:5,yaw:0,pitch:-.08});
  if(view.value==='upstairs')Object.assign(player,{x:-48,y:4.125,z:-29,yaw:0,pitch:-.08});
  if(view.value==='station')Object.assign(player,{x:48,y:0,z:-29,yaw:0,pitch:-.08});
  if(view.value==='residents')Object.assign(player,{x:-65,y:0,z:-26,yaw:0,pitch:-.04});
  if(view.value==='combat')Object.assign(player,{x:-43,y:0,z:8,yaw:0,pitch:-.02});
  if (view.value === 'river') Object.assign(player, { x: -34, y: 1, z: 24, yaw: -1.1, pitch: -.16 });
  if (view.value === 'alpine') Object.assign(player, { x: -62, y: 0, z: 0, yaw: -1.3, pitch: .06 });
  const snapshot: Snapshot = {
    version: VERSION, mapId, training: true, roomCode: 'REVIEW', matchId: 'review',
    interiors:initialInteriors(getWorld(mapId)),phase: 'playing', now: 0, startsAt: 0, endsAt: 600000, host: player.id,
    scores: { de: 0, fr: 0 }, players: [player], winner: null, events: [], persistence: 'practice',
  };
  player.weapon=Number(weapon.value) as typeof player.weapon;
  if(player.weapon===4)player.uniform='leatherface';
  if(view.value==='combat'){const target=makePlayer('target','Testfigur','fr');Object.assign(target,{x:-43,z:4.5,y:0,yaw:Math.PI,uniform:characters.value==='bonus'?'leatherface':'task-sand'});snapshot.players.push(target);}
  if(crowd.checked&&view.value!=='combat')for(let i=0;i<7;i++){
    const bot=makePlayer(`bot-${i}`,`Figur ${i+1}`,i%2?'de':'fr',0,getWorld(mapId));
    bot.x=mapId==='alpine'?-50+i*2.7:-48+i*6;bot.z=(mapId==='alpine'?0:-19)+((i%3)-1)*(mapId==='alpine'?2.5:4);
    bot.yaw=i%2?0:Math.PI;bot.uniform=mapId==='storm'?(i%2?'task-olive':'task-sand'):i%2?'de-field':mapId==='alpine'?'fr-alpine':'us-field';
    if(characters.value==='bonus')bot.uniform=bonusIds[i%bonusIds.length];
    snapshot.players.push(bot);
  }
  currentSnapshot=snapshot;
  const overview=mapId==='storm'?{position:[-72,27,87] as [number,number,number],target:[0,1,0] as [number,number,number]}:mapId==='frontline'?{position:[-72,24,77] as [number,number,number],target:[0,1,0] as [number,number,number]}:mapId==='alpine'?{position:[-72,25,38] as [number,number,number],target:[0,2,-20] as [number,number,number]}:{position:[-73,27,62] as [number,number,number],target:[8,2,-10] as [number,number,number]};
  scene = createScene(canvas, () => {}, mapId, parseGraphicsQuality(quality.value),undefined,undefined,clean?overview:undefined);
  scene.update(snapshot, player.id);
  simulation=setInterval(()=>{
    snapshot.now+=1000/30;
    if(view.value==='combat'&&snapshot.players[1]){
      const target=snapshot.players[1],motion=document.querySelector<HTMLSelectElement>('#motion')?.value??'idle';
      target.crouching=motion==='crouch';target.sprinting=motion==='sprint';
      target.x=-43+(motion==='walk'||motion==='sprint'?Math.sin(snapshot.now*(motion==='sprint'?.003:.0015))*1.3:0);
    }
    if(view.value!=='combat')for(let i=1;i<snapshot.players.length;i++)snapshot.players[i].x=(mapId==='alpine'?-50+(i-1)*2.7:-48+(i-1)*6)+Math.sin(snapshot.now*.001+i)*1.3;
    scene?.update(snapshot,player.id);
  },1000/30);
  resetMeasurement();
}
view.onchange = show;
crowd.onchange=show;
characters.onchange=show;
weapon.onchange=()=>{const p=currentSnapshot.players[0];p.weapon=Number(weapon.value) as Player['weapon'];p.uniform=p.weapon===4?'leatherface':'de-field';};
document.querySelector<HTMLButtonElement>('#headshot')!.onclick=()=>{const target=currentSnapshot.players[1];if(!target||!target.hp)return;target.hp=0;currentSnapshot.events=[{type:'kill',id:'review',target:target.id,weapon:0,hitZone:'head',point:[target.x,target.y+1.65,target.z]}];scene?.update(currentSnapshot,'review');currentSnapshot.events=[];};
document.querySelector<HTMLButtonElement>('#revive')!.onclick=()=>{for(const p of currentSnapshot.players)p.hp=100;scene?.update(currentSnapshot,'review');};
document.querySelector<HTMLButtonElement>('#lights')!.onclick=()=>{for(const id of Object.keys(currentSnapshot.interiors!.lights))currentSnapshot.interiors!.lights[id]=!currentSnapshot.interiors!.lights[id];scene?.update(currentSnapshot,'review');};
document.querySelector<HTMLButtonElement>('#doors')!.onclick=()=>{for(const id of Object.keys(currentSnapshot.interiors!.doors))currentSnapshot.interiors!.doors[id]=!currentSnapshot.interiors!.doors[id];scene?.update(currentSnapshot,'review');};
document.querySelector<HTMLButtonElement>('#glass')!.onclick=()=>{const panes=interiorFixtures(getWorld(currentSnapshot.mapId)).filter(f=>f.type==='glass'&&!currentSnapshot.interiors!.broken.includes(f.id));currentSnapshot.interiors!.broken.push(...panes.map(f=>f.id));currentSnapshot.events=panes.map(f=>({type:'glass',id:'review',point:[f.box.x,f.box.y,f.box.z]}));scene?.update(currentSnapshot,'review');currentSnapshot.events=[];};
reloadButton.onclick=()=>{const player=currentSnapshot.players[0];player.reloadAt=currentSnapshot.now+weapons[player.weapon].reload;};
quality.onchange = () => { scene?.setQuality(parseGraphicsQuality(quality.value)); resetMeasurement(); };
let previous = performance.now(), raf = 0;
function measure(now: number) {
  if (now > warmup) samples.push(now - previous);
  previous = now;
  if (samples.length >= 120) {
    const sorted = [...samples].sort((a, b) => a - b);
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const stats=scene?.getRenderStats();
    output.textContent = `${Math.round(1000 / mean)} FPS · P95 ${Math.round(sorted[Math.floor(sorted.length * .95)])} ms · ${stats?.calls} Draws · ${Math.round((stats?.scale??1)*100)} %`;
    history.push({view:view.value,crowd:crowd.checked,characters:characters.value,weapon:weapon.value,quality:quality.value,
      fps:Math.round(1000/mean),p95:Math.round(sorted[Math.floor(sorted.length*.95)]),samples:samples.length,
      css:[canvas.clientWidth,canvas.clientHeight],render:[canvas.width,canvas.height],...stats});
    if(history.length>10)history.shift();output.dataset.benchmark=JSON.stringify(history);
    samples = [];
  }
  raf = requestAnimationFrame(measure);
}
show(); raf = requestAnimationFrame(measure);
window.addEventListener('pagehide', () => { cancelAnimationFrame(raf);if(simulation)clearInterval(simulation); scene?.dispose(); });
