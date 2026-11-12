import {defaultUniform,validUniform,type UniformId} from './uniforms.ts';
import { getWorld,validMap,ground,type World,type MapId } from "./world.ts";
import {rockBlocks,rockSurface,rayRock} from './rocks.ts';
export const VERSION = 7,
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
  jump: boolean;
  fire: boolean;
  reload: boolean;
  aim: boolean;
  weapon: 0 | 1 | 2 | 3;
  time: number;
};
export type Player = {
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
  weapon: 0 | 1 | 2 | 3;
  ammo: number;
  ammoByWeapon: [number, number, number, number];
  reserve: number;
  reloadAt: number;
  fireAt: number;
  respawnAt: number;
  protectedUntil: number;
  grounded: boolean;
  crouching: boolean;
  departed?: boolean;
};
export type Snapshot = {
  version: number;
  mapId: MapId;
  training:boolean;
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
  type: "shot" | "hit" | "kill";
  id: string;
  target?: string;
  weapon?: number;
  hitZone?: HitZone;
  damage?: number;
  point?:[number,number,number];
};
export const weapons = [
  { name: "Repetiergewehr", mag: 5, damage: 65, interval: 1100, reload: 2600 },
  { name: "Pistole", mag: 8, damage: 28, interval: 310, reload: 1600 },
  { name: "Maschinenpistole", mag: 30, damage: 24, interval: 100, reload: 2400 },
  { name: "HK G36 (modern)", mag: 30, damage: 30, interval: 100, reload: 2600 },
];
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
    [0, 1, 2, 3].includes(i.weapon) &&
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
    ammoByWeapon: [5, 8, 30, 30],
    reserve: 999,
    reloadAt: 0,
    fireAt: 0,
    respawnAt: 0,
    protectedUntil: 0,
    grounded: true,
    crouching: false,
  };
}
export function move(p: Player, i: Input, dt = STEP,world:World=getWorld()) {
  const boxes=world.boxes;
  p.crouching=i.crouch;
  const speed = i.crouch ? 2.3 : i.sprint ? 6.2 : 4.3,
    len = Math.max(1, Math.hypot(i.forward, i.side));
  const dx =
    ((Math.cos(i.yaw) * i.side - Math.sin(i.yaw) * i.forward) * speed * dt) /
    len;
  const dz =
    ((-Math.sin(i.yaw) * i.side - Math.cos(i.yaw) * i.forward) * speed * dt) /
    len;
  const h = i.crouch ? 1.15 : 1.75,
    r = 0.34;
  function blocked(x: number, z: number) {
    return (
      Math.abs(x) > 73 ||
      Math.abs(z) > 73 ||
      boxes.some(
        (b) => b.kind==='rock' ? rockBlocks(b,x,p.y,z,h,r) :
          p.y + h > b.y - b.h / 2 + 0.04 &&
          p.y < b.y + b.h / 2 - 0.29 &&
          Math.abs(x - b.x) < b.w / 2 + r &&
          Math.abs(z - b.z) < b.d / 2 + r,
      )
    );
  }
  if (!blocked(p.x + dx, p.z)) p.x += dx;
  if (!blocked(p.x, p.z + dz)) p.z += dz;
  if (i.jump && p.grounded) {
    p.vy = 5.5;
    p.grounded = false;
  }
  const old = p.y;
  p.vy -= 18 * dt;
  p.y += p.vy * dt;
  let floor = ground(p.x, p.z,world);
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
export function hitPlayer(origin:number[],direction:number[],p:Player):{distance:number;zone:HitZone}|null{
 const c=Math.cos(p.yaw),s=Math.sin(p.yaw),dx=origin[0]-p.x,dz=origin[2]-p.z,scale=p.crouching?.66:1;
 const o=[c*dx-s*dz,origin[1]-p.y,s*dx+c*dz],d=[c*direction[0]-s*direction[2],direction[1],s*direction[0]+c*direction[2]];
 const zones:{distance:number;zone:HitZone}[]=[
 {distance:raySphere(o,d,[0,1.64*scale,-.1],.14*scale),zone:'head'},
 {distance:rayBox(o,d,[-.23,.82*scale,-.2],[.23,1.5*scale,.18]),zone:'body'},
 {distance:rayBox(o,d,[-.08,1.45*scale,-.12],[.08,1.54*scale,.08]),zone:'body'},
 ...[-1,1].map(side=>({distance:rayBox(o,d,[side*.10-.085,.02,-.28],[side*.10+.085,.9*scale,.15]),zone:'legs' as HitZone}))];
 const hit=zones.sort((a,b)=>a.distance-b.distance)[0];return Number.isFinite(hit.distance)?hit:null;
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
  state: Snapshot;
  inputs = new Map<string, Input>();
  received = new Map<string, number>();
  history: { at: number; players: Player[] }[] = [];
  round = 0;
  constructor(
    code: string,
    readonly durationMs = 600000,
    mapId:MapId="cologne",
  ) {
    this.state = {
      version: VERSION,
      mapId,
      training:false,
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
  }
  add(id: string, name: string) {
    if (
      this.state.players.length >= 8 ||
      this.state.players.some((p) => p.id === id)
    )
      throw Error("Raum voll oder bereits beigetreten");
    const team = this.count("de") <= this.count("fr") ? "de" : "fr";
    const p = makePlayer(id, name, team, this.count(team),getWorld(this.state.mapId));
    this.state.players.push(p);
    this.state.host ||= id;
    return p;
  }
  selectMap(id:string,mapId:unknown){if(id!==this.state.host||this.state.phase!=='waiting'||!validMap(mapId))return false;this.state.mapId=mapId;this.history=[];this.inputs.clear();for(const p of this.state.players){const fresh=makePlayer(p.id,p.name,p.team,0,getWorld(mapId));Object.assign(p,fresh,{connected:p.connected});}return true;}
  count(t: Team) {
    return this.state.players.filter((p) => p.team === t).length;
  }
  remove(id: string) {
    this.inputs.delete(id);
    const p = this.player(id);
    if (p && this.state.phase === "playing") {
      p.connected = false;
      p.departed = true;
    } else this.state.players = this.state.players.filter((p) => p.id !== id);
    this.elect();
  }
  elect() {
    if (
      !this.state.players.some((p) => p.id === this.state.host && p.connected)
    )
      this.state.host = this.state.players.find((p) => p.connected)?.id ?? "";
  }
  team(id: string, t: Team) {
    const p = this.player(id);
    if (
      !p ||
      this.state.phase !== "waiting" ||
      !["de", "fr"].includes(t) ||
      p.team === t ||
      this.count(t) >= 4 ||
      this.count(t) + 1 > this.count(p.team)
    )
      return false;
    p.team = t;
    p.uniform=defaultUniform(t,this.state.mapId);
    p.ready = false;
    return true;
  }
  selectUniform(id:string,value:unknown){
    const p=this.player(id);
    if(!p||this.state.phase!=='waiting'||!validUniform(value,p.team,this.state.mapId))return false;
    p.uniform=value;p.ready=false;return true;
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
    this.received.set(id, this.state.now);
    this.inputs.set(id, {
      ...i,
      time: Math.max(this.state.now - 150, Math.min(this.state.now, i.time)),
    });
  }
  ready(id: string, value: boolean, now: number) {
    if (this.state.phase !== "waiting") return;
    const p = this.player(id);
    if (p) p.ready = value;
    if (
      this.state.players.length >= 2 &&
      this.count("de") &&
      this.count("fr") &&
      Math.abs(this.count("de") - this.count("fr")) <= 1 &&
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
          { protectedUntil: now + 2000,uniform:p.uniform },
        );
    }
    if (s.phase !== "playing") return;
    for (const p of s.players) {
      if (!p.hp) {
        if (now >= p.respawnAt) {
          const fresh = makePlayer(p.id, p.name, p.team, p.deaths,getWorld(s.mapId));
          Object.assign(p, {
            ...fresh,
            uniform:p.uniform,
            kills: p.kills,
            headshots:p.headshots,
            deaths: p.deaths,
            connected: p.connected,
            seq: p.seq,
            protectedUntil: now + 2000,
          });
        }
        continue;
      }
      const i =
        now - (this.received.get(p.id) ?? 0) < 300
          ? this.inputs.get(p.id)
          : undefined;
      if (i && p.connected) {
        move(p, i,STEP,getWorld(s.mapId));
        if(p.y < -4){p.hp=0;p.deaths++;p.respawnAt=now+5000;continue;}
        if (i.weapon !== p.weapon) {
          p.ammoByWeapon[p.weapon] = p.ammo;
          p.weapon = i.weapon;
          p.ammo = p.ammoByWeapon[p.weapon];
          p.reloadAt = 0;
          p.fireAt = now + 350;
        }
        if (i.reload && p.ammo < weapons[p.weapon].mag && !p.reloadAt)
          p.reloadAt = now + weapons[p.weapon].reload;
      }
      if (p.reloadAt && now >= p.reloadAt) {
        p.ammo = weapons[p.weapon].mag;
        p.ammoByWeapon[p.weapon] = p.ammo;
        p.reloadAt = 0;
      }
      if (i && p.connected && i.fire) this.shoot(p, i, now);
    }
    this.history.push({ at: now, players: s.players.map((p) => ({ ...p })) });
    while (this.history.length && this.history[0].at < now - 200)
      this.history.shift();
    if (now >= s.endsAt || Math.max(s.scores.de, s.scores.fr) >= 50) {
      s.phase = "finished";
      s.winner =
        s.scores.de === s.scores.fr
          ? "draw"
          : s.scores.de > s.scores.fr
            ? "de"
            : "fr";
    }
  }
  shoot(p: Player, i: Input, now: number) {
    if (p.reloadAt || p.fireAt > now || !p.ammo || i.sprint) return;
    p.fireAt = now + weapons[p.weapon].interval;
    p.ammo--;
    p.ammoByWeapon[p.weapon] = p.ammo;
    p.protectedUntil = 0;
    const spread=(Math.abs(i.forward)+Math.abs(i.side)>0?.012:0)*(i.crouch?.45:1)*(i.aim?.5:1);
    const shotYaw=p.yaw+(Math.random()*2-1)*spread,shotPitch=p.pitch+(Math.random()*2-1)*spread;
    const o=[p.x,p.y+(i.crouch?1:1.6),p.z],d=[-Math.sin(shotYaw)*Math.cos(shotPitch),Math.sin(shotPitch),-Math.cos(shotYaw)*Math.cos(shotPitch)];
    let distance=150,target:Player|undefined,zone:HitZone='body';
    for(const b of getWorld(this.state.mapId).boxes)distance=Math.min(distance,b.kind==='rock'?rayRock(b,o,d):rayBox(o,d,[b.x-b.w/2,b.y-b.h/2,b.z-b.d/2],[b.x+b.w/2,b.y+b.h/2,b.z+b.d/2]));
    const historical=[...this.history].reverse().find(h=>h.at<=i.time)?.players??this.state.players;
    for(const q of historical){const live=this.player(q.id);if(q.id===p.id||!live?.hp)continue;const hit=hitPlayer(o,d,q);if(hit&&hit.distance<distance){distance=hit.distance;target=live;zone=hit.zone;}}
    this.state.events.push({type:'shot',id:p.id,weapon:p.weapon,point:[o[0]+d[0]*distance,o[1]+d[1]*distance,o[2]+d[2]*distance]});
    if(target&&target.team!==p.team&&target.protectedUntil<=now){
      const multiplier=zone==='head'?(p.weapon===0?2:4):zone==='legs'?.75:1,damage=Math.floor(weapons[p.weapon].damage*multiplier);
      target.hp=Math.max(0,target.hp-damage);this.state.events.push({type:'hit',id:p.id,target:target.id,hitZone:zone,damage,point:[o[0]+d[0]*distance,o[1]+d[1]*distance,o[2]+d[2]*distance]});
      if(!target.hp){target.deaths++;target.respawnAt=now+5000;p.kills++;if(zone==='head')p.headshots++;this.state.scores[p.team]++;this.state.events.push({type:'kill',id:p.id,target:target.id,hitZone:zone,point:[o[0]+d[0]*distance,o[1]+d[1]*distance,o[2]+d[2]*distance]});}
    }
    this.state.events = this.state.events.slice(-64);
  }
}
