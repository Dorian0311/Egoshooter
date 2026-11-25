import {islandShops} from '../shared/islandStreet';
import {islandRoute,islandCourseRadius} from '../shared/islandRoute';
import {createCarCourse,driveCar,parkedCars,parkTrainingCar} from '../shared/remoteCars';
import {createOperation} from '../shared/operations';
import {initialInteriors,interiorFixtures,interiorWorld} from '../shared/interiors';
import { createScene } from '../client/scene.ts';
import '../client/crosshair.css';
import { parseGraphicsQuality } from '../client/graphicsSettings.ts';
import { makePlayer, move, neutral, STEP, VERSION, weapons, type Snapshot,type Player } from '../shared/game.ts';
import { getWorld, ground } from '../shared/world.ts';
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
const stress=params.get('stress')==='1';
const routeMode=params.get('route');
const clean=params.get('overview')==='1';
if(clean){document.querySelector('aside')!.style.display='none';document.documentElement.classList.add('clean-overview');}
if(['storm','frontline','street','river','alpine','combat','residents','interior','upstairs','station'].includes(params.get('view')??''))view.value=params.get('view')!;
quality.value=parseGraphicsQuality(params.get('quality'));
crowd.checked=params.get('crowd')==='1';
if(params.get('characters')==='bonus')characters.value='bonus';
if(['0','1','2','3','4'].includes(params.get('weapon')??''))weapon.value=params.get('weapon')!;
let currentSnapshot:Snapshot,simulation:ReturnType<typeof setInterval>|undefined;
let routeRunning=false;
let stressTick=0,stressRun=0,stressFrames=0,stressShots=0,stressBlasts=0;
let scene: ReturnType<typeof createScene> | undefined;
let samples: number[] = [], warmup = performance.now() + 5000;
const history:Record<string,unknown>[]=[];
function resetMeasurement() { samples = [];history.length=0;output.dataset.benchmark='[]';warmup = performance.now() + 5000; output.textContent = 'Messung lÃ¤uft â€¦'; }
function show() {
  routeRunning=false;
  scene?.dispose();
  if(simulation)clearInterval(simulation);
  const mapId = view.value === 'storm'||view.value==='combat' ? 'storm' : view.value === 'frontline' ? 'frontline' : view.value === 'alpine' ? 'alpine' : 'cologne';
  const player = makePlayer('review', 'Grafikprüfung', 'de', 0, getWorld(mapId));
  if(view.value==='storm')Object.assign(player,{x:-25,y:0,z:9,yaw:-1.18,pitch:-.04});
  if(view.value==='frontline')Object.assign(player,{x:-28,y:0,z:0,yaw:-.9,pitch:-.01});
  if(view.value==='frontline'&&params.get('focus')==='station'){
    const station=getWorld(mapId).buildings.find(building=>building.name==='GÜTERBAHNHOF')!;
    Object.assign(player,{x:station.x-10,y:0,z:station.z+21,yaw:-.47,pitch:.035});
  }
  if(view.value==='frontline'&&params.get('focus')==='cinema'){
    const cinema=getWorld(mapId).buildings.find(building=>building.name==='UNION-LICHTSPIELE')!;
    Object.assign(player,{x:cinema.x+3,y:0,z:cinema.z+23,yaw:.14,pitch:.14});
  }
  if(view.value==='interior')Object.assign(player,{x:-48,y:0,z:5,yaw:0,pitch:-.08});
  if(view.value==='upstairs')Object.assign(player,{x:-48,y:4.125,z:-29,yaw:0,pitch:-.08});
  if(view.value==='station')Object.assign(player,{x:48,y:0,z:-29,yaw:0,pitch:-.08});
  if(view.value==='residents')Object.assign(player,{x:-65,y:0,z:-26,yaw:0,pitch:-.04});
  if(view.value==='combat')Object.assign(player,{x:-43,y:0,z:8,yaw:0,pitch:-.02});
  if (view.value === 'river') Object.assign(player, { x: -34, y: 1, z: 24, yaw: -1.1, pitch: -.16 });
  if (view.value === 'alpine') Object.assign(player, { x: -62, y: 0, z: 0, yaw: -1.3, pitch: .06 });
  const snapshot: Snapshot = {
    version: VERSION, mapId, training: true, operation:createOperation(undefined,getWorld(mapId),Math.random),npcs:[],pickups:[],projectiles:[],corpses:[],bodyParts:[],aidTents:[], roomCode: 'REVIEW', matchId: 'review',
    interiors:initialInteriors(getWorld(mapId)),phase: 'playing', now: 0, startsAt: 0, endsAt: 600000, host: player.id,
    scores: { de: 0, fr: 0 }, players: [player], winner: null, events: [], persistence: 'practice',
  };
  const routeReview=mapId==='storm'&&['sprint','drive','turn'].includes(routeMode??'');
  const routeWorld=interiorWorld(getWorld(mapId),snapshot.interiors);
  let routeIndex=params.get('focus')==='radar-bend'?(routeMode==='turn'?6:5):routeMode==='drive'?3:1;
  const [routeX,routeZ]=islandRoute[routeIndex-1];
  const routeYaw=(x:number,z:number)=>Math.atan2(x-islandRoute[routeIndex][0],z-islandRoute[routeIndex][1]);
  if(routeReview)Object.assign(player,{x:routeX,y:ground(routeX,routeZ,routeWorld),z:routeZ,yaw:routeYaw(routeX,routeZ)});
  const shopFocus=['diner','harbour-supply','coast-records'].indexOf(params.get('focus')??'');
  const streetTurn=routeReview&&routeMode==='turn'&&(params.get('focus')==='island-street'||shopFocus>=0);
  if(streetTurn)Object.assign(player,{x:63,y:ground(63,-23,routeWorld),z:-23,yaw:0,pitch:.02});
  if(mapId==='storm'&&shopFocus>=0){
    const shop=islandShops[shopFocus];
    Object.assign(player,{x:shop.x-.6,y:0,z:shop.z+shop.front*1.8,yaw:shop.front===1?.23:Math.PI-.2,pitch:-.04});
  }
  if(mapId==='storm'&&!routeReview&&params.get('focus')==='island-street'){
    Object.assign(player,{x:40,y:ground(40,-21,routeWorld),z:-21,yaw:-1.34,pitch:.015});
  }
  if(mapId==='storm'&&!routeReview&&params.get('focus')==='harbour-entrance'){
    Object.assign(player,{x:74,y:ground(74,-23,routeWorld),z:-23,yaw:-Math.PI/2,pitch:.04});
  }
  const notice=islandShops.find(shop=>params.get('focus')==='notice-'+shop.id);
  if(mapId==='storm'&&notice)Object.assign(player,{x:notice.x-2.43,y:0,z:notice.z-notice.front*(notice.d/2-2.4),yaw:notice.front===1?0:Math.PI,pitch:.11});
  if(mapId==='storm'&&params.get('focus')==='water')Object.assign(player,{x:8,z:117,y:ground(8,117,routeWorld),yaw:Math.PI-.48,pitch:-.05});
  if(mapId==='cologne'&&params.get('focus')==='station-front')Object.assign(player,{x:50,z:-11,y:0,yaw:.10,pitch:.19});
  if(mapId==='cologne'&&params.get('focus')==='cathedral')Object.assign(player,{x:-62,z:-7,y:0,yaw:.40,pitch:.53});
  if(mapId==='cologne'&&params.get('focus')==='bridge')Object.assign(player,{x:-25,z:1.7,y:0,yaw:-Math.PI/2,pitch:.19});
  if(mapId==='cologne'&&params.get('focus')==='rhine-quay')Object.assign(player,{x:-31.3,z:-45,y:0,yaw:-1.93,pitch:-.075});
  if(mapId==='storm'&&params.get('focus')==='passage')Object.assign(player,{x:-21,y:0,z:72,yaw:.08,pitch:.03});
  if(mapId==='storm'&&params.get('focus')==='coast')Object.assign(player,{x:-20,y:ground(-20,107,routeWorld),z:107,yaw:.55,pitch:-.03});
  if(params.has('supplies'))snapshot.pickups=[{id:'review-medkit',kind:'bandage',x:player.x-.8,y:player.y,z:player.z-2.6,taken:false}];
  if(params.get('phase')==='waiting')snapshot.phase='waiting';
  player.weapon=Number(weapon.value) as typeof player.weapon;
  if(player.weapon===4)player.uniform='leatherface';
  if(view.value==='combat'){const target=makePlayer('target','Testfigur','fr');Object.assign(target,{x:-43,z:4.5,y:0,yaw:Math.PI,uniform:characters.value==='bonus'?'leatherface':'task-sand'});snapshot.players.push(target);}
  const requestedActors=params.get('actors');
  const actorCount=crowd.checked?7:routeReview
    ?Math.max(1,Math.min(7,Number.parseInt(requestedActors??'1',10)||1)):0;
  if(view.value!=='combat')for(let i=0;i<actorCount;i++){
    const bot=makePlayer(`bot-${i}`,`Figur ${i+1}`,i%2?'de':'fr',0,getWorld(mapId));
    bot.x=mapId==='alpine'?-50+i*2.7:-48+i*6;bot.z=(mapId==='alpine'?0:-19)+((i%3)-1)*(mapId==='alpine'?2.5:4);
    bot.yaw=i%2?0:Math.PI;bot.uniform=mapId==='storm'?(i%2?'task-olive':'task-sand'):i%2?'de-field':mapId==='alpine'?'fr-alpine':'us-field';
    if(characters.value==='bonus')bot.uniform=bonusIds[i%bonusIds.length];
    snapshot.players.push(bot);
  }
  const cars=routeReview&&routeMode==='drive'?parkedCars(routeWorld):[];
  const course=createCarCourse(routeWorld,cars);
  const car=cars.find(item=>item.id===course?.carId);
  if(car&&course){
    parkTrainingCar(car,routeWorld);
    Object.assign(car,{x:routeX,y:ground(routeX,routeZ,routeWorld),z:routeZ,
      yaw:routeYaw(routeX,routeZ),driver:player.id,driverLife:player.life});
    snapshot.remoteCars=[car];snapshot.carCourse=course;course.next=routeIndex-1;
  }
  currentSnapshot=snapshot;
  const overview=mapId==='storm'?{position:[-72,27,87] as [number,number,number],target:[0,1,0] as [number,number,number]}:mapId==='frontline'?{position:[-72,24,77] as [number,number,number],target:[0,1,0] as [number,number,number]}:mapId==='alpine'?{position:[-72,25,38] as [number,number,number],target:[0,2,-20] as [number,number,number]}:{position:[-73,27,62] as [number,number,number],target:[8,2,-10] as [number,number,number]};
  // Replay the fixed view on each update so test shots cannot accumulate recoil.
  scene = createScene(canvas, () => {}, mapId, parseGraphicsQuality(quality.value),undefined,undefined,clean?overview:undefined,stress||routeReview,stress);
  if(params.get('native')==='1')scene.setResolutionScaling(false);
  scene.update(snapshot, player.id);
  simulation=setInterval(()=>{
    snapshot.now+=1000/30;
    if(view.value==='combat'&&snapshot.players[1]){
      const target=snapshot.players[1],motion=document.querySelector<HTMLSelectElement>('#motion')?.value??'idle';
      target.crouching=motion==='crouch';target.sprinting=motion==='sprint';
      target.x=-43+(motion==='walk'||motion==='sprint'?Math.sin(snapshot.now*(motion==='sprint'?.003:.0015))*1.3:0);
    }
    if(view.value!=='combat')for(let i=1;i<snapshot.players.length;i++)snapshot.players[i].x=(mapId==='alpine'?-50+(i-1)*2.7:-48+(i-1)*6)+Math.sin(snapshot.now*.001+i)*1.3;
    if(routeReview){
      const [x,z]=islandRoute[routeIndex];
      const active=car??player;
      if(routeRunning&&routeMode==='turn'){
        player.yaw=streetTurn?(shopFocus>0?Math.PI:0)+Math.sin(performance.now()*Math.PI/4000)*1.95:Math.sin(snapshot.now*.0034)*1.95;
      }else if(routeRunning&&car&&course){
        const angle=car.yaw-routeYaw(car.x,car.z);
        driveCar(car,1,Math.max(-1,Math.min(1,Math.atan2(Math.sin(angle),Math.cos(angle))*3)),STEP,routeWorld);
      }else if(routeRunning){
        move(player,{...neutral(),yaw:routeYaw(player.x,player.z),forward:1,sprint:true},STEP,routeWorld);
      }
      if(routeRunning&&Math.hypot(x-active.x,z-active.z)<islandCourseRadius&&routeIndex<islandRoute.length-1){
        routeIndex++;if(course)course.next=routeIndex-1;
      }
      for(const [index,bot] of snapshot.players.slice(1).entries()){
        bot.x=active.x+((index%4)-1.5)*1.36+Math.sin(snapshot.now*.003+index)*.38;
        bot.z=active.z-5-index*.7;
        bot.y=ground(bot.x,bot.z,routeWorld);bot.yaw=Math.PI;
      }
    }
    if(stress){
      stressTick++;
      const events:Snapshot['events']=[];
      const seconds=stressTick/30;
      const rightX=Math.cos(player.yaw),rightZ=-Math.sin(player.yaw);
      const forwardX=-Math.sin(player.yaw),forwardZ=-Math.cos(player.yaw);
      const at=(side:number,forward:number,y:number):[number,number,number]=>[
        player.x+rightX*side+forwardX*forward,player.y+y,player.z+rightZ*side+forwardZ*forward,
      ];
      for(const [i,actor] of snapshot.players.entries()){
        if(i>0){
          const [x,,z]=at((i-4)*1.25+Math.sin(seconds*2+i)*.45,3.8+(i%3)*1.45,0);
          actor.x=x;actor.z=z;
          actor.yaw=Math.atan2(actor.x-player.x,actor.z-player.z);
        }
        if((stressTick+i)%3!==0)continue;
        const point=i===0?at(.7,10,1.3):at((i-4)*.74,-1.1,1.35);
        events.push({type:'shot',eventId:`fire-${stressRun}-${stressTick}-${i}`,id:actor.id,weapon:2,point});
        if(stressFrames>0)stressShots++;
      }
      if(stressTick%42===0){
        for(let n=0;n<3;n++)events.push({type:'explosion',eventId:`blast-${stressRun}-${stressTick}-${n}`,id:player.id,weapon:15,point:at((n-1)*2.3,4+n,.4),radius:4.5});
        if(stressFrames>0)stressBlasts+=3;
      }
      if(stressFrames>0)stressFrames--;
      snapshot.events=events;
    }
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
    output.textContent = `${Math.round(1000 / mean)} FPS Â· P95 ${Math.round(sorted[Math.floor(sorted.length * .95)])} ms Â· ${stats?.calls} Draws Â· ${Math.round((stats?.scale??1)*100)} %`;
    history.push({view:view.value,crowd:crowd.checked,characters:characters.value,weapon:weapon.value,quality:quality.value,
      fps:Math.round(1000/mean),p95:Math.round(sorted[Math.floor(sorted.length*.95)]),samples:samples.length,
      css:[canvas.clientWidth,canvas.clientHeight],render:[canvas.width,canvas.height],...stats});
    if(history.length>10)history.shift();output.dataset.benchmark=JSON.stringify(history);
    samples = [];
  }
  raf = requestAnimationFrame(measure);
}
Object.assign(window,{graphicsReview:{ready:()=>scene?.worldPrepared,routeStart:()=>{routeRunning=true;},profile:(limit=1200)=>scene?.profileFrames(limit),samples:()=>scene?.frameProfile()??[],gpuTiming:(enabled:boolean)=>scene?.gpuTiming(enabled),
  stressStart:(ticks=420)=>{stressRun++;stressTick=0;stressFrames=ticks;stressShots=stressBlasts=0;scene?.profileFrames(3600);},
  stressStats:()=>({remaining:stressFrames,shots:stressShots,blasts:stressBlasts}),
}});
show(); raf = requestAnimationFrame(measure);
window.addEventListener('pagehide', () => { cancelAnimationFrame(raf);if(simulation)clearInterval(simulation); scene?.dispose(); });
