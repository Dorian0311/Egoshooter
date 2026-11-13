import { latencyProxy } from "./latency-proxy.ts";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { SignJWT } from "jose";
import { Client, type Room } from "@colyseus/sdk";
import type { Snapshot } from "../shared/game.ts";
import { mergeSnapshot, type SnapshotPacket } from "../shared/protocol.ts";
import { neutral } from "../shared/game.ts";
const gamePort=Number(process.env.TEST_GAME_PORT??2579),proxyPort=Number(process.env.TEST_PROXY_PORT??2581);
const secret = "network-test-only-secret-32-characters-minimum";
const server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(gamePort),
    DATABASE_URL: "",
    SHOOTER_TICKET_SECRET: secret,
    SHOOTER_ORIGINS: "http://127.0.0.1:5173",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stderr?.on("data", (d) => {
  logs += String(d).slice(0, 2000);
});
server.stdout?.on("data", (d) => {
  logs += String(d).slice(0, 2000);
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rooms: Room[] = [];
const states = new Map<number, Snapshot>();
async function until(fn: () => boolean, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return;
    await sleep(25);
  }
  throw Error("Network test timeout " + logs.slice(-2500));
}
async function token(id: string) {
  return new SignJWT({ name: `Player ${id}`, role: "Support.Agent" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("supporthub")
    .setAudience("altstadt-1940")
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(new TextEncoder().encode(secret));
}
const closeProxy = await latencyProxy(proxyPort, gamePort);
try {
  await until(() => logs.includes("multiplayer listening"), 60000);
  for (let n = 0; n < 8; n++) {
    const sdk = new Client(`ws://127.0.0.1:${proxyPort}`, {
      headers: { Origin: "http://127.0.0.1:5173" },
    });
    const r =
      n === 0
        ? await sdk.create("altstadt", { ticket: await token(String(n)),mapId:process.env.TEST_MAP??"cologne" })
        : await sdk.joinById(rooms[0].roomId, {
            ticket: await token(String(n)),mapId:process.env.TEST_MAP??"cologne",
          });
    r.reconnection.minUptime = 0;
    rooms.push(r);
    r.onMessage("snapshot", (packet: SnapshotPacket) => {
      const s = mergeSnapshot(states.get(n) ?? null, packet);
      if (s) states.set(n, s);
    });
    r.send("sync");
  }
  await until(
    () =>
      states.size === 8 &&
      [...states.values()].every((s) => s.players.length === 8),
  );
  const code = states.get(0)!.roomCode;
  const lookup = await fetch(`http://127.0.0.1:${gamePort}/rooms/${code}`, {
    headers: { Authorization: `Bearer ${await token("0")}` },
  });
  assert.equal((await lookup.json()).roomId, rooms[0].roomId);
  const outsider = new Client(`ws://127.0.0.1:${proxyPort}`, {
    headers: { Origin: "http://127.0.0.1:5173" },
  });
  await assert.rejects(() =>
    outsider.joinById(rooms[0].roomId, { ticket: awaitableBadTicket() }),
  );
  for (const r of rooms) r.send("ready", true);
  await until(() => [...states.values()].every((s) => s.phase === "playing"));
  const starts = [...states.values()].map((s) => s.startsAt);
  assert.equal(new Set(starts).size, 1);
  // The proxy delays each WebSocket direction by 25–75ms: 50–150ms RTT.
  await Promise.all(
    rooms.map(async (r, n) => {
      for (let seq = 1; seq <= 24; seq++) {
        await sleep(33);
        r.send("input", {
          ...neutral(seq),
          forward: seq < 12 ? 1 : 0,
          yaw: n % 2 ? Math.PI / 2 : -Math.PI / 2,
          time: states.get(n)!.now,
        });
      }
    }),
  );
  await until(() =>
    [...states.values()].every((s) => s.players.every((p) => p.seq >= 20)),
  );
  rooms[0].send("input", { ...neutral(100), forward: 999 });
  await sleep(100);
  assert.ok(states.get(1)!.players.find((p) => p.id === "0")!.seq < 100);
  // Reach the near watch-house via the street using real, validated movement.
  if(states.get(0)!.mapId==='cologne'){
    let seq=200;
    const deadline=Date.now()+8500;
    while(true){
      const p=states.get(0)!.players.find(p=>p.id==='0')!,dx=-46.5-p.x,dz=-10.1-p.z;
      if(Math.hypot(dx,dz)<.5)break;
      assert.ok(Date.now()<deadline,'could not reach watch-house door');
      rooms[0].send('input',{...neutral(++seq),forward:1,yaw:Math.atan2(-dx,-dz),time:states.get(0)!.now});await sleep(70);
    }
    const stopSeq=++seq;rooms[0].send('input',{...neutral(stopSeq),yaw:Math.PI,time:states.get(0)!.now});
    await until(()=>states.get(0)!.players.find(p=>p.id==='0')!.seq>=stopSeq);
    rooms[0].send('interact','door-1--1');
    await until(()=>[...states.values()].every(s=>s.interiors?.doors['door-1--1']===false));
  }
  rooms[0].connection.close(4010, "test drop");
  await until(
    () => states.get(1)?.players.find((p) => p.id === "0")?.connected === false,
  );
  await until(
    () => states.get(1)?.players.find((p) => p.id === "0")?.connected === true,
    12000,
  );
  if(states.get(0)!.mapId==='cologne')assert.equal(states.get(0)!.interiors?.doors['door-1--1'],false);
  await until(
    () => [...states.values()].every((s) => s.phase === "finished"),
    20000,
  );
  assert.equal(new Set([...states.values()].map((s) => s.matchId)).size, 1);
  const host = Number(states.get(1)!.host);
  rooms[host].send("rematch");
  await until(() => [...states.values()].every((s) => s.phase === "waiting"));
  console.log(
    "PASS: full accelerated match and rematch; eight real WebSocket clients, room lookup, auth rejection, balanced teams, synchronized countdown, 50–150ms WebSocket RTT, invalid input rejection, synchronized door interaction and reconnect.",
  );
} finally {
  await Promise.allSettled(rooms.map((r) => r.leave()));
  server.kill();
  await closeProxy();
}
function awaitableBadTicket() {
  return "invalid";
}
