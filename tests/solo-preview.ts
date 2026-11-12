// Run against the local preview harness; no production credentials required.
import assert from "node:assert/strict";
import { Client } from "@colyseus/sdk";
import { mergeSnapshot, type SnapshotPacket } from "../shared/protocol.ts";
import type { Snapshot } from "../shared/game.ts";

for (const mapId of ["cologne", "alpine"]) {
  const origin = mapId === "cologne" ? "http://127.0.0.1:5173" : "http://localhost:5173";
  const response = await fetch(`${origin}/api/shooter/ticket`);
  assert.equal(response.status, 200);
  const access = await response.json() as { ticket: string; serverUrl: string };
  assert.equal(access.serverUrl, `${origin}/game`);
  const client = new Client(access.serverUrl, {
    headers: { Origin: origin },
  });
  const room = await client.create("altstadt", { ticket: access.ticket, mapId, training: true });
  let snapshot: Snapshot | null = null;
  room.onMessage("snapshot", (packet: SnapshotPacket) => {
    snapshot = mergeSnapshot(snapshot, packet);
  });
  async function until(check: (s: Snapshot) => boolean) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (snapshot && check(snapshot)) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw Error(`Solo preview timeout: ${mapId}`);
  }
  try {
    room.send("sync");
    room.send("ready", true);
    await until(s => s.phase === "playing");
    const state = snapshot as unknown as Snapshot;
    assert.equal(state.training, true);
    assert.equal(state.mapId, mapId);
    assert.equal(state.players.length, 2);
    const target = state.players.find(p => p.id === "local-training-target")!;
    const { x, z } = target;
    await until(s => s.players.some(p => p.id === target.id && Math.hypot(p.x - x, p.z - z) > .2));
    console.info(`Solo training verified: ${mapId}, countdown and moving target`);
  } finally {
    await room.leave();
  }
}
