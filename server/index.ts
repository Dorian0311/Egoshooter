import express from "express";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { Room, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import type { Client } from "@colyseus/core";
import {validMap} from "../shared/world.ts";
import { Game,neutral } from "../shared/game.ts";
import { difference } from "../shared/protocol.ts";
import { identity } from "./auth.ts";
import { Store } from "./store.ts";
const store = new Store();
await store.init();
const codes = new Map<string, string>();
export class CityRoom extends Room {
  maxClients = 8;
  game!: Game;
  users = new Map<string, string>();
  rates = new Map<string, { at: number; count: number }>();
  training=false;
  trainingSeq=0;
  trainingWaypoint=0;
  saving = false;
  baseline: Game["state"] | null = null;
  onCreate(options:{mapId?:unknown;training?:unknown}={}) {
    if(options.training===true&&process.env.SHOOTER_LOCAL_TRAINING!=='true')throw Error('Training ist in dieser Umgebung nicht freigeschaltet');
    this.training=options.training===true;
    if (codes.size >= 32) throw Error("Server ausgelastet");
    let code: string;
    do {
      code = Array.from(
        randomBytes(6),
        (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32],
      ).join("");
    } while (codes.has(code));
    codes.set(code, this.roomId);
    this.game = new Game(
      code,
      process.env.NODE_ENV === "test" ? 15000 : 600000,
      validMap(options.mapId)?options.mapId:"cologne",
    );
    this.game.state.training=this.training;
    this.setMetadata({ code });
    this.onMessage("sync", (c) => {
      if (this.limit(c, 10)) c.send("snapshot", { full: this.game.state });
    });
    this.onMessage("input", (c, v) => {
      const id = this.users.get(c.sessionId);
      if (id && this.limit(c, 100)) this.game.input(id, v);
    });
    this.onMessage("ready", (c, v) => {
      if (typeof v === "boolean" && this.limit(c, 10))
        this.game.ready(this.users.get(c.sessionId) ?? "", v, Date.now());
    });
    this.onMessage("map",(c,v)=>{if(this.limit(c,10))this.game.selectMap(this.users.get(c.sessionId)??"",v);});
    this.onMessage("uniform",(c,v)=>{if(this.limit(c,10))this.game.selectUniform(this.users.get(c.sessionId)??"",v);});
    this.onMessage("team", (c, v) => {
      if ((v === "de" || v === "fr") && this.limit(c, 10))
        this.game.team(this.users.get(c.sessionId) ?? "", v);
    });
    this.onMessage("rematch", (c) => {
      if (this.limit(c, 10) && !this.saving)
        this.game.rematch(this.users.get(c.sessionId) ?? "");
    });
    this.setSimulationInterval(() => {
      this.game.tick(Date.now());
      if(this.training)this.updateTraining();
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
      this.broadcast(
        "snapshot",
        this.baseline
          ? difference(this.baseline, this.game.state)
          : { full: this.game.state },
      );
      this.baseline = structuredClone(this.game.state);
      this.game.state.events = [];
    }, 50);
  }
  updateTraining(){
    const state=this.game.state,bot=this.game.player('local-training-target'),human=state.players.find(p=>p.id!=='local-training-target'&&p.connected);
    if(!bot||!human)return;
    if(state.phase==='waiting'){if(!bot.ready)this.game.ready(bot.id,true,Date.now());return;}
    if(state.phase!=='playing'||!bot.hp)return;
    const base=state.mapId==='cologne'?{x:-49,z:-19}:{x:-48,z:0};
    if(Math.hypot(bot.x-human.x,bot.z-human.z)>28){Object.assign(bot,{x:human.x+16,z:human.z,y:human.y,vy:0,protectedUntil:0});this.game.history=[];this.trainingWaypoint=0;}
    const points=[{x:base.x,z:base.z},{x:base.x+5,z:base.z},{x:base.x+5,z:base.z-3},{x:base.x-3,z:base.z-3}];
    let goal=points[this.trainingWaypoint%points.length];let dx=goal.x-bot.x,dz=goal.z-bot.z;
    if(Math.hypot(dx,dz)<.35){this.trainingWaypoint++;goal=points[this.trainingWaypoint%points.length];dx=goal.x-bot.x;dz=goal.z-bot.z;}
    this.game.input(bot.id,{...neutral(++this.trainingSeq),forward:1,yaw:Math.atan2(-dx,-dz),time:state.now});
  }
  limit(c: Client, max: number) {
    const now = Date.now();
    let r = this.rates.get(c.sessionId);
    if (!r || now - r.at >= 1000) {
      r = { at: now, count: 0 };
      this.rates.set(c.sessionId, r);
    }
    return ++r.count <= max;
  }
  async onAuth(_c: Client, options: { ticket?: unknown }) {
    return identity(options.ticket);
  }
  onJoin(c: Client) {
    const user = c.auth as { id: string; name: string };
    if (this.game.state.phase !== "waiting")
      throw Error("Match bereits gestartet");
    this.game.add(user.id, user.name);
    if(this.training&&!this.game.player("local-training-target")){this.game.add("local-training-target","Trainingsziel");this.game.ready("local-training-target",true,Date.now());}
    this.users.set(c.sessionId, user.id);
    c.send("snapshot", { full: this.game.state });
  }
  async onDrop(c: Client) {
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
    const p = this.game.player(this.users.get(c.sessionId) ?? "");
    if (p) p.connected = true;
    c.send("snapshot", { full: this.game.state });
  }
  onLeave(c: Client) {
    const id = this.users.get(c.sessionId);
    if (id) this.game.remove(id);
    this.users.delete(c.sessionId);
    this.rates.delete(c.sessionId);
  }
  onDispose() {
    codes.delete(this.game.state.roomCode);
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
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.get("/rooms/:code", async (req, res) => {
  try {
    await identity(req.headers.authorization?.replace(/^Bearer /, ""));
    const id = codes.get(String(req.params.code));
    if (!id) {
      res.sendStatus(404);
      return;
    }
    res.json({ roomId: id });
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
await gameServer.listen(Number(process.env.PORT ?? 2567), process.env.BIND_HOST ?? "0.0.0.0");
console.info("Altstadt multiplayer listening", process.env.PORT ?? 2567);
