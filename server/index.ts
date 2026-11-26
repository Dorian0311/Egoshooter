import express from "express";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { Room, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import type { Client } from "@colyseus/core";
import {Bots} from './bots';
import {createNavigation} from './navigation';
import {parseOperation} from '../shared/operationConfig';
import {validMap,mapIds} from "../shared/world.ts";
import { Game,neutral,validLoadout } from "../shared/game.ts";
import { createSnapshotPublisher } from "../shared/protocol.ts";
import { identity } from "./auth.ts";
import { Store } from "./store.ts";
import {Accounts} from './accounts';
import {accountRoutes} from './accountRoutes';
import {resolve} from 'node:path';
import {validUniform} from '../shared/uniforms';
const store = new Store();
await store.init();
const codes = new Map<string, string>();
const liveRooms=new Map<string,CityRoom>();
export class CityRoom extends Room {
  maxClients = 8;
  game!: Game;
  users = new Map<string, string>();
  rates = new Map<string, { at: number; count: number }>();
  training=false;
  bots?:Bots;
  ownerId="";
  clockOffset=0;
  pausedAt=0;
  now(){return Date.now()-this.clockOffset;}
  saving = false;
  private readonly publishSnapshot = createSnapshotPublisher(packet => this.broadcast("snapshot", packet));
  async onCreate(options:{mapId?:unknown;training?:unknown;operation?:unknown}={}) {
    const config=parseOperation(options.operation??(options.training===true?{kind:'solo',mode:'training'}:undefined));
    this.training=config.kind!=='multiplayer';
    this.maxClients=config.kind==='solo'?1:config.kind==='coop'?4:8;
    if (codes.size >= 32) throw Error("Server ausgelastet");
    let code: string;
    do {
      code = Array.from(
        randomBytes(6),
        (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32],
      ).join("");
    } while (codes.has(code));
    codes.set(code, this.roomId);
    liveRooms.set(code,this);
    this.game = new Game(
      code,
      process.env.NODE_ENV === "test" ? 15000 : 600000,
      validMap(options.mapId)?options.mapId:"cologne",
      Math.random,config,
    );
    this.game.state.training=this.training;
    if(this.training)this.bots=new Bots(this.game,await createNavigation(this.game.state.mapId));
    if(config.kind==='solo')await this.setPrivate(true);
    this.setMetadata({ code });
    this.onMessage("sync", (c) => {
      if (this.limit(c,10,'sync')) c.send("snapshot", { full: this.game.state });
    });
    this.onMessage("input", (c, v) => {
      const id = this.users.get(c.sessionId);
      if (id && this.limit(c,100,'input')) this.game.input(id, v);
    });
    this.onMessage("interact",(c,value)=>{if(this.limit(c,5,'interact'))this.game.interact(this.users.get(c.sessionId)??"",value);});
    this.onMessage("ready", (c, v) => {
      if (typeof v === "boolean" && this.limit(c,10,'ready'))
        this.game.ready(this.users.get(c.sessionId) ?? "", v, this.now());
    });
    this.onMessage("map",(c,v)=>{if(!this.training&&this.limit(c,10,'map'))this.game.selectMap(this.users.get(c.sessionId)??"",v);});
    this.onMessage("uniform",(c,v)=>{if(this.limit(c,10,'uniform'))this.game.selectUniform(this.users.get(c.sessionId)??"",v);});
    this.onMessage("team", (c, v) => {
      if ((v === "de" || v === "fr") && this.limit(c,10,'team'))
        this.game.team(this.users.get(c.sessionId) ?? "", v);
    });
    this.onMessage("rematch", (c) => {
      if (this.limit(c,10,'rematch') && !this.saving)
        this.game.rematch(this.users.get(c.sessionId) ?? "");
    });
    this.setSimulationInterval(() => {
      if(this.pausedAt)return;
      if(this.training&&this.game.state.phase==='waiting')for(const p of this.game.state.players)if(p.kind==='bot'&&!p.ready){p.connected=true;this.game.ready(p.id,true,this.now());}
      this.bots?.update(this.now());
      this.game.tick(this.now());
      if(this.game.state.operation.config.kind==='coop'&&this.game.state.phase!=='waiting')void this.lock();
      else if(this.game.state.operation.config.kind==='coop'&&this.game.state.phase==='waiting'&&this.clients.length<4&&this.locked)void this.unlock();
      if (
        this.game.state.phase === "finished" &&
        this.game.state.persistence === "pending" &&
        !this.saving
      ) {
        if(this.training){this.game.state.persistence="practice";return;}
        this.saving = true;
        void store
          .save(structuredClone(this.game.state))
          .then(() => {
            this.game.state.persistence = "saved";
          })
          .catch(() => {
            this.game.state.persistence = "failed";
            console.error("Match persistence failed", this.game.state.matchId);
          })
          .finally(() => {
            this.saving = false;
          });
      }
    }, 1000 / 30);
    this.clock.setInterval(() => {
      this.publishSnapshot(this.game.state);
      this.game.state.events = [];
    }, 50);
  }
  limit(c: Client, max: number,channel='control') {
    const key=`${c.sessionId}:${channel}`;
    const now = Date.now();
    let r = this.rates.get(key);
    if (!r || now - r.at >= 1000) {
      r = { at: now, count: 0 };
      this.rates.set(key, r);
    }
    return ++r.count <= max;
  }
  async onAuth(_c: Client, options: { ticket?: unknown }) {
    const user=await identity(options.ticket);
    if(this.game.state.operation.config.kind==='solo'&&this.ownerId&&user.id!==this.ownerId)throw Error('Privater Einzelspieler-Einsatz');
    if(this.training&&this.game.state.phase!=='waiting')throw Error('Dieser Einsatz wurde bereits gestartet');
    return user;
  }
  onJoin(c: Client,options:{uniform?:unknown;loadout?:unknown}={}) {
    if(options.loadout!==undefined&&!validLoadout(options.loadout,typeof options.uniform==='string'?options.uniform:undefined,this.game.state.mapId))throw Error('Bitte genau fünf unterschiedliche Waffen auswählen.');
    const user = c.auth as { id: string; name: string };
    if (!['waiting','playing'].includes(this.game.state.phase))throw Error('Dieser Einsatz nimmt gerade keine Spieler auf.');
    const config=this.game.state.operation.config;
    if(config.kind==='solo'&&this.ownerId&&user.id!==this.ownerId)throw Error('Privater Einzelspieler-Einsatz');
    if(this.training&&this.game.state.phase!=='waiting')throw Error('Dieser Einsatz wurde bereits gestartet');
    this.ownerId ||= user.id;
    const player=this.game.add(user.id,user.name);
    if(validUniform(options.uniform,player.team,this.game.state.mapId)){
      if(this.game.state.phase==='waiting')this.game.selectUniform(player.id,options.uniform);
      else player.uniform=options.uniform;
    }
    if(options.loadout!==undefined){
      if(this.game.state.phase==='waiting')this.game.selectLoadout(player.id,options.loadout);
      else if(validLoadout(options.loadout,player.uniform,this.game.state.mapId)){player.loadout=[...options.loadout];player.weapon=player.loadout[0];player.ammo=player.ammoByWeapon[player.weapon];}
    }
    if(this.game.state.phase==='playing'){player.ready=true;player.protectedUntil=this.game.state.now+3000;}
    if(this.training&&!this.game.state.players.some(p=>p.kind==='bot'))this.game.operation.configureBots();
    this.users.set(c.sessionId, user.id);
    c.send("snapshot", { full: this.game.state });
  }
  async onDrop(c: Client) {
    if(this.game.state.operation.config.kind==='solo'){this.pausedAt=Date.now();this.game.state.operation.paused=true;}
    const id = this.users.get(c.sessionId);
    if (!id) return;
    const p = this.game.player(id);
    if (p) {
      p.connected = false;
      p.ready = false;
    }
    this.game.inputs.delete(id);
    this.game.elect();
    try {
      await this.allowReconnection(c, 10);
    } catch {
      /* onLeave removes expired reservations */
    }
  }
  onReconnect(c: Client) {
    if(this.pausedAt){this.clockOffset+=Date.now()-this.pausedAt;this.pausedAt=0;this.game.state.operation.paused=false;}
    const p = this.game.player(this.users.get(c.sessionId) ?? "");
    if (p) p.connected = true;
    this.game.elect();
    c.send("snapshot", { full: this.game.state });
  }
  onLeave(c: Client) {
    const id = this.users.get(c.sessionId);
    if (id) this.game.remove(id);
    this.users.delete(c.sessionId);
    for(const key of this.rates.keys())if(key.startsWith(c.sessionId+':'))this.rates.delete(key);
  }
  onDispose() {
    this.bots?.dispose();
    if(this.game){codes.delete(this.game.state.roomCode);liveRooms.delete(this.game.state.roomCode);}
  }
}
const app = express();
app.disable("x-powered-by");
const origins = (process.env.SHOOTER_ORIGINS ?? "http://127.0.0.1:5173").split(
  ",",
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !origins.includes(origin)) {
    res.sendStatus(403);
    return;
  }
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  if(origin)res.setHeader('Access-Control-Allow-Credentials','true');
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
const accounts=new Accounts(process.env.SHOOTER_ACCOUNTS_DB??(process.env.NODE_ENV==='test'?':memory:':resolve('data/users.sqlite')));
app.use('/account',accountRoutes(accounts));
app.get('/rooms',async(req,res)=>{
 try{await identity(req.headers.authorization?.replace(/^Bearer /,''));res.setHeader('Cache-Control','no-store');res.json({rooms:[...liveRooms.values()].filter(r=>!r.training&&['waiting','playing'].includes(r.game.state.phase)).map(r=>({code:r.game.state.roomCode,mapId:r.game.state.mapId,phase:r.game.state.phase,players:r.game.state.players.filter(p=>!p.departed).length,capacity:8,joinable:r.game.state.players.filter(p=>!p.departed).length<8,host:r.game.player(r.game.state.host)?.name??'Spieler'}))});}catch{res.sendStatus(401);}
});
app.get("/rooms/:code", async (req, res) => {
  try {
    await identity(req.headers.authorization?.replace(/^Bearer /, ""));
    const id = codes.get(String(req.params.code));
    const target=id?[...liveRooms.values()].find(r=>r.roomId===id):undefined;
    if (!id||target?.game.state.operation.config.kind==='solo') {
      res.sendStatus(404);
      return;
    }
    res.json({ roomId:id,mapId:target?.game.state.mapId });
  } catch {
    res.sendStatus(401);
  }
});
app.get("/health", (_req, res) =>
  res.json({ ok: true, version: 1, persistence: !!store.pool }),
);
app.get("/stats", async (req, res) => {
  try {
    const u = await identity(
      req.headers.authorization?.replace(/^Bearer /, ""),
    );
    res.json(await store.stats(u.id));
  } catch {
    res
      .status(503)
      .json({ error: "Statistik nicht verfügbar oder Zugang abgelaufen" });
  }
});
const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
    maxPayload: 4096,
    verifyClient: (info, done) =>
      done(origins.includes(info.origin), 403, "Origin rejected"),
  }),
});
gameServer.define("altstadt", CityRoom);
// Room code lookup uses the normal matchmaking endpoint with metadata filtering.
// Build map caches before accepting players so first-time generation cannot stall a live match.
for(const map of mapIds){const navigation=await createNavigation(map);navigation.dispose();}
await gameServer.listen(Number(process.env.PORT ?? 2567), process.env.BIND_HOST ?? "0.0.0.0");
console.info("Altstadt multiplayer listening", process.env.PORT ?? 2567);
