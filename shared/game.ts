import {weapons,defaultLoadout,isWeaponId,validLoadout,startingWeapon,fallbackSidearm,type WeaponId,type Loadout} from './weapons';
export {weapons,defaultLoadout,validLoadout,type WeaponId,type Loadout} from './weapons';
import {initialInteriors,interiorFixtures,interiorWorld,doorBox,type InteriorState} from './interiors';
import {defaultUniform,validUniform,type UniformId} from './uniforms.ts';
import { getWorld,validMap,ground,withinPlayArea,type World,type MapId } from "./world.ts";
import {rockBlocks,rockSurface,rayRock} from './rocks.ts';
import {nearbyBoxes} from './boxIndex';
import type {CarCourse,RemoteCar} from './remoteCars';
import {Operation,createOperation,type OperationState,type Pickup,type Projectile,type Treatment} from './operations';
import {difficultyRules} from './operationConfig';
import {freshInjuries,armCount,isCrawling,isForcedCrawl,shotStability,eyeHeight,eyePosition,hasLost,type Injuries,type BodyPart} from './injuries';
import type {Corpse,BodyPartItem,AidTent} from './remains';
export const VERSION = 15,
  STEP = 1 / 30;
export type Team = "de" | "fr";
export type Input = {
  seq: number;
  forward: number;
  side: number;
  yaw: number;
  pitch: number;
  sprint: boolean;
  crouch: boolean;
  prone?: boolean;
  jump: boolean;
  fire: boolean;
  reload: boolean;
  aim: boolean;
  weapon: WeaponId;
  time: number;
};
export type Player = {
  kind:'human'|'bot'|'resident';
  life:number;
  injuries:Injuries;
  stars:number;
  bandages:number;
  throwAt:number;
  downedUntil:number;
  diedAt:number;
  gestureUntil:number;
  heldPart:string|null;
  carriedCorpse:string|null;
  corpseShield:number;
  treatment?:Treatment;
  id: string;
  name: string;
  team: Team;
  uniform: UniformId;
  x: number;
  y: number;
  z: number;
  vy: number;
  yaw: number;
  pitch: number;
  hp: number;
  kills: number;
  headshots: number;
  deaths: number;
  ready: boolean;
  connected: boolean;
  seq: number;
  weapon: WeaponId;
  ammo: number;
  ammoByWeapon: number[];
  loadout: Loadout;
  powerUntil: number;
  powerReadyAt: number;
  reserve: number;
  reloadAt: number;
  fireAt: number;
  respawnAt: number;
  protectedUntil: number;
  grounded: boolean;
  crouching: boolean;
  rockets?: number;
  rocketReadyAt?: number;
  prone?: boolean;
  stamina: number;
  sprintReadyAt: number;
  sprintExhausted: boolean;
  sprinting: boolean;
  departed?: boolean;
};
export type Snapshot = {
  operation:OperationState;
  npcs:Player[];
  pickups:Pickup[];
  projectiles:Projectile[];
  remoteCars?:RemoteCar[];
  carCourse?:CarCourse;
  corpses:Corpse[];
  bodyParts:BodyPartItem[];
  aidTents:AidTent[];
  version: number;
  mapId: MapId;
  training:boolean;
  interiors?:InteriorState;
  roomCode: string;
  matchId: string;
  phase: "waiting" | "countdown" | "playing" | "finished";
  now: number;
  startsAt: number;
  endsAt: number;
  host: string;
  scores: Record<Team, number>;
  players: Player[];
  winner: Team | "draw" | null;
  events: GameEvent[];
  persistence: "pending" | "saved" | "failed" | "practice";
};
export type GameEvent = {
  type: "shot" | "melee" | "hit" | "kill" | "glass" | 'sever' | 'down' | 'revive' | 'pickup' | 'throw' | 'impact' | 'explosion' | 'car-warning' | 'car-gate' | 'heal' | 'part-pickup' | 'part-throw' | 'part-melee' | 'corpse-carry' | 'corpse-drop' | 'harvest-start' | 'harvest' | 'shield' | 'medical-start' | 'medical-revive';
  eventId?:string;
  life?:number;
  bodyPart?:BodyPart;
  id: string;
  target?: string;
  weapon?: number;
  hitZone?: HitZone;
  damage?: number;
  healthLoss?: number;
  /** Direction toward the source, measured in world radians from -Z. */
  bearing?: number;
  radius?: number;
  point?:[number,number,number];
};
export const SAW_POWER_MS = 2200, SAW_RECOVERY_MS = 7000;
export const SPRINT_DURATION_MS=3200,SPRINT_RECHARGE_MS=4000,SPRINT_REST_MS=900;
export function weaponDamage(index:number,distance:number){
  const w=weapons[index];
  return w.damage*Math.max(.5,1-Math.max(0,distance-w.range)/(w.range*2));
}
export function validInput(v: unknown): v is Input {
  if (!v || typeof v !== "object") return false;
  const i = v as Input;
  return (
    Number.isSafeInteger(i.seq) &&
    i.seq >= 0 &&
    ["forward", "side", "yaw", "pitch", "time"].every((k) =>
      Number.isFinite(i[k as keyof Input]),
    ) &&
    Math.abs(i.forward) <= 1 &&
    Math.abs(i.side) <= 1 &&
    Math.abs(i.yaw) <= Math.PI * 2 &&
    Math.abs(i.pitch) <= 1.5 &&
    isWeaponId(i.weapon) &&
    (i.prone===undefined||typeof i.prone==='boolean') &&
    ["sprint", "crouch", "jump", "fire", "reload", "aim"].every(
      (k) => typeof i[k as keyof Input] === "boolean",
    )
  );
}
export function makePlayer(
  id: string,
  name: string,
  team: Team,
  index = 0,
  world:World=getWorld(),
): Player {
  const [x, z] = world.spawns[team][index % 4];
  return {
    kind:'human',life:1,injuries:freshInjuries(),stars:0,bandages:0,throwAt:0,downedUntil:0,diedAt:0,gestureUntil:0,heldPart:null,carriedCorpse:null,corpseShield:0,
    id,
    name,
    team,
    uniform:defaultUniform(team,world.id),
    x,
    y: 0,
    z,
    vy: 0,
    yaw: team === "de" ? -Math.PI / 2 : Math.PI / 2,
    pitch: 0,
    hp: 100,
    kills: 0,
    headshots: 0,
    deaths: 0,
    ready: false,
    connected: true,
    seq: -1,
    weapon: 0,
    ammo: 5,
    ammoByWeapon: weapons.map(w=>w.mag),
    loadout: [...defaultLoadout],
    powerUntil: 0,
    powerReadyAt: 0,
    reserve: 999,
    reloadAt: 0,
    fireAt: 0,
    respawnAt: 0,
    protectedUntil: 0,
    grounded: true,
    crouching: false,
    rockets: 0,
    rocketReadyAt: 0,
    prone: false,
    stamina:SPRINT_DURATION_MS,sprintReadyAt:0,sprintExhausted:false,sprinting:false,
  };
}
export function move(p: Player, i: Input, dt = STEP,world:World=getWorld(),now=i.time) {
  if(p.downedUntil)return;
  if(p.carriedCorpse)i={...i,sprint:false,jump:false};
  const wantsProne=i.prone===true&&!p.carriedCorpse&&(p.grounded||p.prone===true);
  if(p.prone&&!wantsProne&&!isForcedCrawl(p)){
    const height=i.crouch?1.15:1.75, radius=.34;
    const obstacles=nearbyBoxes(world.boxes,p.x-radius,p.z-radius,p.x+radius,p.z+radius);
    p.prone=obstacles.some(b=>b.kind==='rock'?rockBlocks(b,p.x,p.y,p.z,height,radius):
      p.y+height>b.y-b.h/2+.04&&p.y<b.y+b.h/2-.29&&Math.abs(p.x-b.x)<b.w/2+radius&&Math.abs(p.z-b.z)<b.d/2+radius);
  }else p.prone=wantsProne;
  const crawling=isCrawling(p);
  if(crawling)i={...i,sprint:false,jump:false,crouch:false};
  if(p.uniform==='leatherface'&&p.weapon===4&&!p.carriedCorpse&&!p.heldPart&&armCount(p)===2&&p.hp>0&&i.fire&&now>=p.powerReadyAt){
    p.powerUntil=now+SAW_POWER_MS;p.powerReadyAt=p.powerUntil+SAW_RECOVERY_MS;
  }
  p.crouching=i.crouch;
  const inputLength=Math.hypot(i.forward,i.side),moving=inputLength>.01;
  const powered=p.uniform==='leatherface'&&p.weapon===4&&!p.carriedCorpse&&!p.heldPart&&armCount(p)===2&&i.fire&&now<p.powerUntil;
  p.stamina=Number.isFinite(p.stamina)?p.stamina:SPRINT_DURATION_MS;
  p.sprinting=!!(i.sprint&&moving&&!i.crouch&&!i.aim&&!p.sprintExhausted&&p.stamina>0&&!powered);
  if(p.sprinting){
    p.stamina=Math.max(0,p.stamina-dt*1000);p.sprintReadyAt=now+SPRINT_REST_MS;
    if(p.stamina<.001){p.stamina=0;p.sprintExhausted=true;}
  }else if(now>=p.sprintReadyAt){
    p.stamina=Math.min(SPRINT_DURATION_MS,p.stamina+dt*1000*SPRINT_DURATION_MS/SPRINT_RECHARGE_MS);
    if(p.stamina>=SPRINT_DURATION_MS-.001){p.stamina=SPRINT_DURATION_MS;p.sprintExhausted=false;}
  }
  const speed = (crawling ? 4.3*.3 : i.crouch ? 2.3 : powered ? 9.2 : p.sprinting ? 6.2 : 4.3)*(p.carriedCorpse?.55:1),
    len = Math.max(1, inputLength),sinYaw=Math.sin(i.yaw),cosYaw=Math.cos(i.yaw);
  const dx =
    ((cosYaw * i.side - sinYaw * i.forward) * speed * dt) /
    len;
  const dz =
    ((-sinYaw * i.side - cosYaw * i.forward) * speed * dt) /
    len;
  const h = crawling ? .6 : i.crouch ? 1.15 : 1.75,
    r = 0.34;
  const padding=r+(crawling?.8:0),nextX=p.x+dx,nextZ=p.z+dz;
  const boxes=nearbyBoxes(world.boxes,Math.min(p.x,nextX)-padding,Math.min(p.z,nextZ)-padding,
    Math.max(p.x,nextX)+padding,Math.max(p.z,nextZ)+padding);
  function blocked(x: number, z: number) {
    return blockedPoint(x,z)||crawling&&(
      blockedPoint(x-sinYaw*.55,z-cosYaw*.55)||blockedPoint(x+sinYaw*.8,z+cosYaw*.8));
  }
  function blockedPoint(x:number,z:number){
    return (
      !withinPlayArea(x,z,world) ||
      boxes.some(
        (b) => b.kind==='rock' ? rockBlocks(b,x,p.y,z,h,r) :
          p.y + h > b.y - b.h / 2 + 0.04 &&
          p.y < b.y + b.h / 2 - 0.29 &&
          Math.abs(x - b.x) < b.w / 2 + r &&
          Math.abs(z - b.z) < b.d / 2 + r,
      )
    );
  }
  if (!Object.is(nextX,p.x) && !blocked(nextX,p.z)) p.x=nextX;
  if (!Object.is(nextZ,p.z) && !blocked(p.x,nextZ)) p.z=nextZ;
  if (i.jump && p.grounded) {
    p.vy = 5.5;
    p.grounded = false;
  }
  const old = p.y;
  p.vy -= 18 * dt;
  p.y += p.vy * dt;
  let floor = ground(p.x, p.z,world,boxes);
  for (const b of boxes) {
    if (
      Math.abs(p.x - b.x) >= b.w / 2 + r ||
      Math.abs(p.z - b.z) >= b.d / 2 + r
    )
      continue;
    const top = b.kind==='rock'?rockSurface(b,p.x,p.z):b.y + b.h / 2,
      bottom = b.y - b.h / 2;
    if (old >= top - 0.3 && p.y <= top && p.vy <= 0)
      floor = Math.max(floor, top);
    if (p.vy > 0 && old + h <= bottom + 0.05 && p.y + h >= bottom) {
      p.y = bottom - h;
      p.vy = 0;
    }
  }
  if (p.y <= floor) {
    p.y = floor;
    p.vy = 0;
    p.grounded = true;
  } else p.grounded = false;
  p.yaw = i.yaw;
  p.pitch = i.pitch;
  p.seq = i.seq;
}
export function rayBox(
  o: number[],
  d: number[],
  min: number[],
  max: number[],
): number {
  let near = 0,
    far = 150;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-8) {
      if (o[a] < min[a] || o[a] > max[a]) return Infinity;
      continue;
    }
    let t1 = (min[a] - o[a]) / d[a],
      t2 = (max[a] - o[a]) / d[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near > far) return Infinity;
  }
  return near;
}
export type HitZone='head'|'body'|'legs';
export function raySphere(origin:number[],direction:number[],center:number[],radius:number){
 const rel=origin.map((v,i)=>v-center[i]),b=rel.reduce((s,v,i)=>s+v*direction[i],0),c=rel.reduce((s,v)=>s+v*v,0)-radius*radius,disc=b*b-c;
 if(disc<0)return Infinity;const near=-b-Math.sqrt(disc),far=-b+Math.sqrt(disc);return near>=0?near:far>=0?far:Infinity;
}
export function hitPlayer(origin:number[],direction:number[],p:Player):{distance:number;zone:HitZone;part:BodyPart}|null{
 const c=Math.cos(p.yaw),s=Math.sin(p.yaw),dx=origin[0]-p.x,dz=origin[2]-p.z,scale=p.crouching?.66:1;
 const o=[c*dx-s*dz,origin[1]-p.y,s*dx+c*dz],d=[c*direction[0]-s*direction[2],direction[1],s*direction[0]+c*direction[2]];
 const crawl=isCrawling(p),zones:{distance:number;zone:HitZone;part:BodyPart}[]=[];
 const add=(part:BodyPart,min:number[],max:number[])=>{if(!hasLost(p,part))zones.push({distance:rayBox(o,d,min,max),zone:part==='head'?'head':part.startsWith('leg')?'legs':'body',part});};
 if(crawl){
  add('head',[-.14,.30,-.70],[.14,.58,-.42]);add('body',[-.23,.12,-.42],[.23,.48,.38]);
  for(const [side,suffix]of [[-1,'L'],[1,'R']] as const){add(`arm${suffix}`,[side*.31-.085,.08,-.55],[side*.31+.085,.32,.12]);add(`leg${suffix}`,[side*.12-.085,.05,.38],[side*.12+.085,.30,1.1]);}
 }else{
  if(!hasLost(p,'head'))zones.push({distance:raySphere(o,d,[0,1.64*scale,-.1],.14*scale),zone:'head',part:'head'});
  add('body',[-.23,.82*scale,-.2],[.23,1.54*scale,.18]);
  for(const [side,suffix]of [[-1,'L'],[1,'R']] as const){add(`arm${suffix}`,[side*.31-.08,.86*scale,-.15],[side*.31+.08,1.48*scale,.15]);add(`leg${suffix}`,[side*.10-.085,.02,-.28],[side*.10+.085,.9*scale,.15]);}
 }
 const hit=zones.sort((a,b)=>a.distance-b.distance)[0];return hit&&Number.isFinite(hit.distance)?hit:null;
}
export const neutral = (seq = 0): Input => ({
  seq,
  forward: 0,
  side: 0,
  yaw: 0,
  pitch: 0,
  sprint: false,
  crouch: false,
  jump: false,
  fire: false,
  reload: false,
  aim: false,
  weapon: 0,
  time: 0,
});
export class Game {
  operation:Operation;
  private eventSequence=0;
  emit(event:GameEvent){
    event.eventId=`${this.state.matchId}:${++this.eventSequence}`;
    event.life=event.target?this.operation.actor(event.target)?.life:undefined;
    this.operation.recordNoise(event);
    this.state.events.push(event);
    this.state.events=this.state.events.slice(-128);
  }
  state: Snapshot;
  inputs = new Map<string, Input & {pendingFire?:boolean}>();
  received = new Map<string, number>();
  history: { at: number; players: Player[] }[] = [];
  round = 0;
  interactions=new Map<string,number>();
  world(){return interiorWorld(getWorld(this.state.mapId),this.state.interiors);}
  constructor(
    code: string,
    readonly durationMs = 600000,
    mapId:MapId="cologne",
    private readonly random:()=>number=Math.random,
    config?:unknown,
  ) {
    this.state = {
      version: VERSION,
      mapId,
      training:false,
      operation:createOperation(config,getWorld(mapId),random),npcs:[],pickups:[],projectiles:[],corpses:[],bodyParts:[],aidTents:[],
      interiors:initialInteriors(getWorld(mapId)),
      roomCode: code,
      matchId: "",
      phase: "waiting",
      now: 0,
      startsAt: 0,
      endsAt: 0,
      host: "",
      scores: { de: 0, fr: 0 },
      players: [],
      winner: null,
      events: [],
      persistence: "pending",
    };
    this.operation=new Operation(this);
  }
  add(id: string, name: string) {
    const returning=this.player(id);
    if(returning?.departed&&this.state.phase==='playing'){
      if(this.state.players.filter(p=>!p.departed).length>=8||this.count(returning.team)>=4)throw Error('Dein Team ist bereits voll.');
      const fresh=makePlayer(id,name,returning.team,returning.deaths,getWorld(this.state.mapId));
      this.operation.remains.release(returning);
      Object.assign(returning,fresh,{life:returning.life+1,treatment:undefined,kills:returning.kills,deaths:returning.deaths,headshots:returning.headshots,ready:true,departed:false});return returning;
    }
    if (
      this.state.players.filter(p=>!p.departed).length >= 8 ||
      this.state.players.some((p) => p.id === id)
    )
      throw Error("Raum voll oder bereits beigetreten");
    const team = this.operation.pve?'de':this.count("de") <= this.count("fr") ? "de" : "fr";
    const p = makePlayer(id, name, team, this.count(team),getWorld(this.state.mapId));
    this.state.players.push(p);
    this.state.host ||= id;
    return p;
  }
  selectMap(id:string,mapId:unknown){
    if(id!==this.state.host||this.state.phase!=='waiting'||!validMap(mapId))return false;
    this.state.mapId=mapId;
    this.state.remoteCars=[];
    this.state.carCourse=undefined;
    const world=getWorld(mapId);
    this.state.interiors=initialInteriors(world);
    this.history=[];this.inputs.clear();
    for(const p of this.state.players){
      const fresh=makePlayer(p.id,p.name,p.team,0,world);
      const uniform=validUniform(p.uniform,p.team,mapId)?p.uniform:fresh.uniform;
      const loadout=validLoadout(p.loadout,uniform,mapId)?p.loadout:fresh.loadout;
      Object.assign(p,fresh,{uniform,connected:p.connected,loadout,weapon:loadout[0],ammo:weapons[loadout[0]].mag});
    }
    return true;
  }
  count(t: Team) {
    return this.state.players.filter((p) => p.team === t&&!p.departed).length;
  }
  remove(id: string) {
    this.inputs.delete(id);
    const p = this.player(id);
    if(p)this.operation.remains.release(p);
    if (p && this.state.phase === "playing") {
      p.connected = false;
      p.departed = true;
    } else this.state.players = this.state.players.filter((p) => p.id !== id);
    this.elect();
  }
  elect() {
    if (
      !this.state.players.some((p) => p.id === this.state.host && p.connected&&p.kind==='human')
    )
      this.state.host = this.state.players.find((p) => p.connected&&p.kind==='human')?.id ?? "";
  }
  team(id: string, t: Team) {
    const p = this.player(id);
    if (
      !p ||
      this.state.phase !== "waiting" ||
      this.operation.pve ||
      !["de", "fr"].includes(t) ||
      p.team === t ||
      this.count(t) >= 4 ||
      this.count(t) + 1 > this.count(p.team)
    )
      return false;
    p.team = t;
    p.uniform=defaultUniform(t,this.state.mapId);
    if(p.loadout.includes(4))p.loadout=[...defaultLoadout];p.weapon=p.loadout[0];p.ammo=p.ammoByWeapon[p.weapon];p.powerUntil=p.powerReadyAt=0;
    p.ready = false;
    return true;
  }
  selectUniform(id:string,value:unknown){
    const p=this.player(id);
    if(!p||this.state.phase!=='waiting'||!validUniform(value,p.team,this.state.mapId))return false;
    p.uniform=value;
    if(value==='leatherface'&&!p.loadout.includes(4))p.loadout=[4,...p.loadout.filter(w=>w!==4).slice(0,4)] as Loadout;
    else if(value!=='leatherface'&&p.loadout.includes(4))p.loadout=[...defaultLoadout];
    p.weapon=startingWeapon(p.loadout,value);p.ammo=p.ammoByWeapon[p.weapon];p.powerUntil=p.powerReadyAt=0;p.ready=false;return true;
  }
  selectLoadout(id:string,value:unknown){
    const p=this.player(id);
    if(!p||this.state.phase!=='waiting'||!validLoadout(value,p.uniform,this.state.mapId))return false;
    p.loadout=[...value];p.weapon=startingWeapon(p.loadout,p.uniform);p.ammoByWeapon=weapons.map(w=>w.mag);p.ammo=p.ammoByWeapon[p.weapon];p.reloadAt=0;p.ready=false;return true;
  }
  player(id: string) {
    return this.state.players.find((p) => p.id === id);
  }
  input(id: string, i: unknown) {
    const p = this.player(id);
    if (
      !p ||
      !validInput(i) ||
      i.seq <= Math.max(p.seq, this.inputs.get(id)?.seq ?? -1) ||
      this.state.phase !== "playing"
    )
      return;
    this.received.set(id, this.state.now);
    const previous=this.inputs.get(id);
    this.inputs.set(id, {
      ...i,
      pendingFire:!!previous&&previous.seq>p.seq&&previous.weapon===i.weapon&&(previous.fire||previous.pendingFire),
      time: Math.max(this.state.now - 150, Math.min(this.state.now, i.time)),
    });
  }
  ready(id: string, value: boolean, now: number) {
    if (this.state.phase !== "waiting") return;
    const p = this.player(id);
    if (p) p.ready = value;
    if (
      (this.operation.pve?this.operation.humans.length>=(this.state.operation.config.kind==='coop'?2:1):this.state.players.length >= 2) &&
      this.count("de") &&
      this.count("fr") &&
      (this.operation.pve||Math.abs(this.count("de") - this.count("fr")) <= 1) &&
      this.state.players.every((p) => p.ready && p.connected)
    ) {
      this.state.phase = "countdown";
      this.state.startsAt = now + 3000;
    }
  }
  rematch(id: string) {
    if (id !== this.state.host || this.state.phase !== "finished") return;
    this.state.phase = "waiting";
    this.state.players = this.state.players.filter((p) => !p.departed);
    this.elect();
    this.state.winner = null;
    for (const p of this.state.players) p.ready = false;
  }
  tick(now: number) {
    const s = this.state;
    s.now = now;
    if (
      s.phase === "countdown" &&
      (s.players.length < 2 || !s.players.every((p) => p.connected))
    ) {
      s.phase = "waiting";
      for (const p of s.players) p.ready = false;
    }
    if (s.phase === "countdown" && now >= s.startsAt) {
      s.phase = "playing";
      s.matchId = `${s.roomCode}-${now}-${++this.round}`;
      s.endsAt = now + this.durationMs;
      s.scores = { de: 0, fr: 0 };
      s.interiors=initialInteriors(getWorld(s.mapId));this.interactions.clear();
      s.persistence = "pending";
      this.history = [];
      this.inputs.clear();
      for (const p of s.players)
        Object.assign(
          p,
          makePlayer(
            p.id,
            p.name,
            p.team,
            s.players.filter((q) => q.team === p.team).indexOf(p),
            getWorld(s.mapId),
          ),
          { protectedUntil: now + 2000,uniform:p.uniform,kind:p.kind,life:p.life+1,loadout:p.loadout,weapon:startingWeapon(p.loadout,p.uniform),ammo:weapons[startingWeapon(p.loadout,p.uniform)].mag },
        );
      this.operation.onStart();
    }
    if (s.phase !== "playing") return;
    this.operation.beforeTick(now);
    for (const p of s.players) {
      if(p.carriedCorpse){const sidearm=fallbackSidearm(p.loadout,p.weapon);if(p.weapon!==sidearm)p.reloadAt=0;p.weapon=sidearm;p.ammo=p.ammoByWeapon[sidearm];}
      if(armCount(p)===1){const sidearm=fallbackSidearm(p.loadout,p.weapon);if(p.weapon!==sidearm){p.weapon=sidearm;p.ammo=p.ammoByWeapon[sidearm];p.reloadAt=0;}}
      if (!p.hp) {
        if (now >= p.respawnAt&&!p.downedUntil&&!(this.state.operation.config.mode==='survival'&&p.kind==='bot')) {
          const fresh = makePlayer(p.id, p.name, p.team, p.deaths,getWorld(s.mapId));
          Object.assign(p, {
            ...fresh,
            uniform:p.uniform,
            loadout:p.loadout,
            weapon:startingWeapon(p.loadout,p.uniform),
            ammo:weapons[startingWeapon(p.loadout,p.uniform)].mag,
            kills: p.kills,
            headshots:p.headshots,
            deaths: p.deaths,
            connected: p.connected,
            seq: p.seq,
            life:p.life+1,kind:p.kind,stars:p.stars,bandages:p.bandages,
            protectedUntil: now + 2000,
          });
        }
        continue;
      }
      const i =
        now - (this.received.get(p.id) ?? 0) < 300
          ? this.inputs.get(p.id)
          : undefined;
      if(this.operation.driveRemoteCar(p,i))continue;
      if (i && p.connected) {
        move(p, i,STEP,this.world(),now);
        if(p.y < -4){this.operation.damage(p,'',0,100,'body',[p.x,p.y,p.z]);continue;}
        if (!p.carriedCorpse && !p.heldPart && armCount(p)===2 && p.loadout.includes(i.weapon) && (i.weapon!==4||p.uniform==='leatherface') && i.weapon !== p.weapon) {
          p.ammoByWeapon[p.weapon] = p.ammo;
          p.weapon = i.weapon;
          p.ammo = p.ammoByWeapon[p.weapon];
          p.reloadAt = 0;
          p.fireAt = now + 350;
        }
        if (!p.heldPart && p.weapon!==4 && i.reload && p.ammo < weapons[p.weapon].mag && !p.reloadAt)
          p.reloadAt = now + weapons[p.weapon].reload;
      }
      if (p.reloadAt && now >= p.reloadAt) {
        p.ammo = weapons[p.weapon].mag;
        p.ammoByWeapon[p.weapon] = p.ammo;
        p.reloadAt = 0;
      }
      if (i && p.connected && (i.fire||i.pendingFire)) this.shoot(p, i, now);
      if(i)i.pendingFire=false;
    }
    this.history.push({ at: now, players: this.operation.actors().map((p) => ({ ...p,injuries:{...p.injuries,damage:{...p.injuries.damage}} })) });
    while (this.history.length && this.history[0].at < now - 200)
      this.history.shift();
    this.operation.afterTick();
    if (s.phase==='playing'&&s.operation.config.mode==='battle'&&(now >= s.endsAt || Math.max(s.scores.de, s.scores.fr) >= 50)) {
      s.phase = "finished";
      s.winner =
        s.scores.de === s.scores.fr
          ? "draw"
          : s.scores.de > s.scores.fr
            ? "de"
            : "fr";
      if(this.operation.pve){s.operation.result=s.winner==='de'?'success':'failure';s.persistence='practice';}
    }
  }
  interact(id:string,value:unknown){
    const p=this.player(id),state=this.state.interiors;
    if(!p?.hp||!p.connected||this.state.phase!=='playing'||!state||typeof value!=='string')return false;
    const immediate=value==='throw'||value==='rocket'||value==='car:exit'||value==='car:explode';
    if(!immediate&&this.state.now-(this.interactions.get(id)??-Infinity)<450)return false;
    const handled=this.operation.interact(p,value);if(handled!==undefined){if(handled&&value!=='throw')this.interactions.set(id,this.state.now);return handled;}
    const f=interiorFixtures(getWorld(this.state.mapId)).find(f=>f.id===value&&f.type!=='glass');if(!f)return false;
    const x=f.type==='door'?f.box.x+f.box.w/2-.2:f.box.x,y=f.box.y,z=f.box.z;
    const eye=eyePosition(p),o=[eye.x,eye.y,eye.z],delta=[x-o[0],y-o[1],z-o[2]],distance=Math.hypot(...delta);
    if(distance>2.7)return false;
    const d=delta.map(v=>v/Math.max(.001,distance));
    if(d[0]*-Math.sin(p.yaw)+d[2]*-Math.cos(p.yaw)<.1)return false;
    if(getWorld(this.state.mapId).boxes.some(b=>rayBox(o,d,[b.x-b.w/2,b.y-b.h/2,b.z-b.d/2],[b.x+b.w/2,b.y+b.h/2,b.z+b.d/2])<distance-.2))return false;
    if(f.type==='door'){
      const next=doorBox(f,!state.doors[f.id]);
      if(this.state.players.some(q=>q.hp>0&&q.y<next.y+next.h/2&&q.y+1.75>next.y-next.h/2&&Math.abs(q.x-next.x)<next.w/2+.4&&Math.abs(q.z-next.z)<next.d/2+.4))return false;
      state.doors[f.id]=!state.doors[f.id];
    }else state.lights[f.id]=!state.lights[f.id];
    this.interactions.set(id,this.state.now);return true;
  }
  shoot(p: Player, i: Input, now: number) {
    this.state.now=Math.max(this.state.now,now);
    if(!p.hp||armCount(p)<1||p.treatment)return;
    if(p.heldPart){this.operation.remains.swing(p,now);return;}
    if(p.carriedCorpse&&armCount(p)<2)return;
    if(p.weapon===4&&p.uniform==='leatherface'&&!p.carriedCorpse){this.saw(p,i,now);return;}
    if(p.weapon===4)return;
    if (p.reloadAt || p.fireAt > now || !p.ammo || i.sprint&&!p.carriedCorpse) return;
    p.fireAt = now + weapons[p.weapon].interval;
    p.ammo--;
    p.ammoByWeapon[p.weapon] = p.ammo;
    p.protectedUntil = 0;
    const spread=(weapons[p.weapon].spread+(Math.abs(i.forward)+Math.abs(i.side)>0?.012:0))*shotStability(p)*(i.aim?.3:1);
    const shotYaw=p.yaw+(this.random()*2-1)*spread,shotPitch=p.pitch+(this.random()*2-1)*spread;
    const eye=eyePosition(p),o=[eye.x,eye.y,eye.z],d=[-Math.sin(shotYaw)*Math.cos(shotPitch),Math.sin(shotPitch),-Math.cos(shotYaw)*Math.cos(shotPitch)];
    let distance=150,target:Player|undefined,zone:HitZone='body',part:BodyPart='body';
    for(const b of this.world().boxes)distance=Math.min(distance,b.kind==='rock'?rayRock(b,o,d):rayBox(o,d,[b.x-b.w/2,b.y-b.h/2,b.z-b.d/2],[b.x+b.w/2,b.y+b.h/2,b.z+b.d/2]));
    const historical=[...this.history].reverse().find(h=>h.at<=i.time)?.players??this.operation.actors();
    for(const q of historical){const live=this.operation.actor(q.id);if(q.id===p.id||!live?.hp)continue;const hit=hitPlayer(o,d,q);if(hit&&hit.distance<distance){distance=hit.distance;target=live;zone=hit.zone;part=hit.part;}}
    this.emit({type:'shot',id:p.id,weapon:p.weapon,point:[o[0]+d[0]*distance,o[1]+d[1]*distance,o[2]+d[2]*distance]});
    if(!target&&this.state.interiors){
      const pane=interiorFixtures(getWorld(this.state.mapId)).find(f=>f.type==='glass'&&!this.state.interiors!.broken.includes(f.id)&&Math.abs(rayBox(o,d,[f.box.x-f.box.w/2,f.box.y-f.box.h/2,f.box.z-f.box.d/2],[f.box.x+f.box.w/2,f.box.y+f.box.h/2,f.box.z+f.box.d/2])-distance)<.001);
      if(pane){this.state.interiors.broken.push(pane.id);this.emit({type:'glass',id:p.id,point:[pane.box.x,pane.box.y,pane.box.z]});}
    }
    if(target){
      const config=this.state.operation.config,coopBot=config.kind==='coop'&&p.kind==='bot'&&target.kind==='human';
      const headWeight=coopBot?1.5:p.weapon===0?2:4;
      const multiplier=zone==='head'?headWeight:zone==='legs'?.75:1;
      const damage=Math.floor(weaponDamage(p.weapon,distance)*multiplier*(coopBot?difficultyRules[config.difficulty].coopDamage:1));
      this.operation.damage(target,p.id,p.weapon,damage,part,[o[0]+d[0]*distance,o[1]+d[1]*distance,o[2]+d[2]*distance],false,eye);
    }
    this.state.events = this.state.events.slice(-64);
  }
  saw(p:Player,i:Input,now:number){
    this.state.now=Math.max(this.state.now,now);
    if(p.uniform!=='leatherface'||!p.hp||armCount(p)<2||p.treatment||p.fireAt>now)return;
    p.weapon=4;p.fireAt=now+weapons[4].interval;p.protectedUntil=0;
    this.emit({type:'melee',id:p.id,weapon:4});
    const eye=eyePosition(p),origin=[eye.x,Math.max(p.y+.25,eye.y-.2),eye.z];
    const facing=[-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch)];
    let target:Player|undefined,nearest=weapons[4].range;
    for(const q of this.operation.actors()){
      if(q.id===p.id||!q.hp)continue;
      const delta=[q.x-origin[0],q.y+(isCrawling(q)?.3:q.crouching?.7:1.1)-origin[1],q.z-origin[2]];
      const distance=Math.hypot(...delta);if(distance>nearest||distance<.001)continue;
      const direction=delta.map(v=>v/distance);
      if(direction.reduce((sum,v,n)=>sum+v*facing[n],0)<.72)continue;
      const blocked=this.world().boxes.some(b=>(b.kind==='rock'?rayRock(b,origin,direction):rayBox(origin,direction,[b.x-b.w/2,b.y-b.h/2,b.z-b.d/2],[b.x+b.w/2,b.y+b.h/2,b.z+b.d/2]))<distance);
      if(!blocked){nearest=distance;target=q;}
    }
    if(!target)return;
    const precise=hitPlayer(origin,facing,target);
    const part:BodyPart=precise?.part??(p.pitch<-.25?'legL':p.pitch>.25?'head':target.injuries.lost&2?'armR':'armL');
    this.operation.damage(target,p.id,4,weapons[4].damage,part,[target.x,target.y+eyeHeight(target),target.z],true);
    this.state.events=this.state.events.slice(-64);
  }
}
