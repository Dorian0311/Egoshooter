import { createScene } from '../client/scene.ts';
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
if(['street','river','alpine'].includes(params.get('view')??''))view.value=params.get('view')!;
quality.value=parseGraphicsQuality(params.get('quality'));
crowd.checked=params.get('crowd')==='1';
if(params.get('characters')==='bonus')characters.value='bonus';
if(['0','1','2','3'].includes(params.get('weapon')??''))weapon.value=params.get('weapon')!;
let currentSnapshot:Snapshot,simulation:ReturnType<typeof setInterval>|undefined;
let scene: ReturnType<typeof createScene> | undefined;
let samples: number[] = [], warmup = performance.now() + 5000;
const history:Record<string,unknown>[]=[];
function resetMeasurement() { samples = [];history.length=0;output.dataset.benchmark='[]';warmup = performance.now() + 5000; output.textContent = 'Messung läuft …'; }
function show() {
  scene?.dispose();
  if(simulation)clearInterval(simulation);
  const mapId = view.value === 'alpine' ? 'alpine' : 'cologne';
  const player = makePlayer('review', 'Grafikprüfung', 'de', 0, getWorld(mapId));
  if (view.value === 'river') Object.assign(player, { x: -34, y: 1, z: 24, yaw: -1.1, pitch: -.16 });
  if (view.value === 'alpine') Object.assign(player, { x: -62, y: 0, z: 0, yaw: -1.3, pitch: .06 });
  const snapshot: Snapshot = {
    version: VERSION, mapId, training: true, roomCode: 'REVIEW', matchId: 'review',
    phase: 'playing', now: 0, startsAt: 0, endsAt: 600000, host: player.id,
    scores: { de: 0, fr: 0 }, players: [player], winner: null, events: [], persistence: 'practice',
  };
  player.weapon=Number(weapon.value) as typeof player.weapon;
  if(crowd.checked)for(let i=0;i<7;i++){
    const bot=makePlayer(`bot-${i}`,`Figur ${i+1}`,i%2?'de':'fr',0,getWorld(mapId));
    bot.x=mapId==='alpine'?-50+i*2.7:-48+i*6;bot.z=(mapId==='alpine'?0:-19)+((i%3)-1)*(mapId==='alpine'?2.5:4);
    bot.yaw=i%2?0:Math.PI;bot.uniform=i%2?'de-field':mapId==='alpine'?'fr-alpine':'us-field';
    if(characters.value==='bonus')bot.uniform=bonusIds[i%bonusIds.length];
    snapshot.players.push(bot);
  }
  currentSnapshot=snapshot;
  scene = createScene(canvas, () => {}, mapId, parseGraphicsQuality(quality.value));
  scene.update(snapshot, player.id);
  simulation=setInterval(()=>{
    snapshot.now+=1000/30;
    for(let i=1;i<snapshot.players.length;i++)snapshot.players[i].x=(mapId==='alpine'?-50+(i-1)*2.7:-48+(i-1)*6)+Math.sin(snapshot.now*.001+i)*1.3;
    scene?.update(snapshot,player.id);
  },1000/30);
  resetMeasurement();
}
view.onchange = show;
crowd.onchange=show;
characters.onchange=show;
weapon.onchange=()=>{currentSnapshot.players[0].weapon=Number(weapon.value) as Player['weapon'];};
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
