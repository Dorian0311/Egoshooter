import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  move,
  neutral,
  validInput,
  rayBox,
  makePlayer,
} from "../shared/game.ts";
import { buildings, boxes } from "../shared/world.ts";
function started() {
  const g = new Game("ABC234");
  g.add("a", "Anna");
  g.add("b", "Bruno");
  g.ready("a", true, 1000);
  g.ready("b", true, 1000);
  g.tick(4000);
  return g;
}
test("ready starts a server countdown, match and host rematch", () => {
  const g = started();
  assert.equal(g.state.phase, "playing");
  assert.equal(g.state.endsAt, 604000);
  g.tick(604000);
  assert.equal(g.state.winner, "draw");
  g.rematch("b");
  assert.equal(g.state.phase, "finished");
  g.rematch("a");
  assert.equal(g.state.phase, "waiting");
});
test("capacity, unique accounts and balanced teams", () => {
  const g = new Game("ABC234");
  for (let i = 0; i < 8; i++) g.add(String(i), "Player");
  assert.equal(g.count("de"), 4);
  assert.equal(g.count("fr"), 4);
  assert.throws(() => g.add("9", "Ninth"));
  assert.equal(g.team("0", "fr"), false);
  assert.throws(() => g.add("0", "Duplicate"));
});
test("invalid, duplicate and future inputs cannot move authoritatively", () => {
  const g = started(),
    p = g.player("a")!;
  assert.equal(validInput({ ...neutral(), forward: Infinity }), false);
  g.input("a", { ...neutral(1), forward: 100 });
  assert.equal(g.inputs.size, 0);
  g.input("a", { ...neutral(2), time: 999999 });
  assert.equal(g.inputs.get("a")!.time, 4000);
  g.input("a", neutral(1));
  assert.equal(g.inputs.get("a")!.seq, 2);
  assert.equal(p.hp, 100);
});
test("movement speed normalized, walls and map boundary block players", () => {
  const p = makePlayer("a", "A", "de");
  p.x = 0;
  p.z = 0;
  for (let n = 0; n < 30; n++) move(p, { ...neutral(), forward: 1, side: 1 });
  assert.ok(Math.hypot(p.x, p.z) <= 4.31);
  p.x = 72.9;
  p.z = 0;
  for (let n = 0; n < 60; n++) move(p, { ...neutral(), side: 1 });
  assert.ok(p.x <= 73);
  const wall = boxes.find((b) => b.kind === "wall")!;
  p.x = wall.x;
  p.z = wall.z + 2;
  p.y = 0;
  for (let n = 0; n < 60; n++) move(p, { ...neutral(), forward: 1 });
  assert.ok(p.z > wall.z + 0.2);
});
test("server verifies hits, cadence, friendly fire, death and respawn", () => {
  const g = started(),
    a = g.player("a")!,
    b = g.player("b")!;
  Object.assign(a, { x: 8, z: 8, yaw: 0, pitch:-.07, protectedUntil: 0 });
  Object.assign(b, { x: 8, z: 0, protectedUntil: 0 });
  g.history = [];
  const i = { ...neutral(1), fire: true, time: 4000 };
  g.shoot(a, i, 4000);
  assert.equal(b.hp, 35);
  g.shoot(a, i, 4001);
  assert.equal(b.hp, 35);
  g.shoot(a, i, 5100);
  assert.equal(b.hp, 0);
  assert.equal(g.state.scores.de, 1);
  assert.equal(b.respawnAt, 10100);
  g.tick(10100);
  assert.equal(b.hp, 100);
  b.team = "de";
  a.fireAt = 0;
  a.yaw = 0;
  b.x = 8;
  b.z = 0;
  b.protectedUntil = 0;
  g.shoot(a, i, 12000);
  assert.equal(b.hp, 100);
});
test("walls occlude rays and all six buildings have open entrance corridors", () => {
  assert.equal(buildings.length, 6);
  assert.equal(buildings.filter((b) => b.upper).length, 3);
  assert.equal(rayBox([0, 1, 0], [0, 0, -1], [-1, 0, -6], [1, 3, -5]), 5);
  for (const b of buildings) {
    for (let z = b.z - b.d / 2 - 1; z <= b.z + b.d / 2 + 1; z += 0.25) {
      assert.ok(
        !boxes.some(
          (w) =>
            w.kind === "wall" &&
            Math.abs(b.x - w.x) < w.w / 2 + 0.34 &&
            Math.abs(z - w.z) < w.d / 2 + 0.34 &&
            w.y - w.h / 2 < 1.75,
        ),
        `door blocked at ${b.name}`,
      );
    }
  }
});
test("weapon switching preserves ammunition; stale input stops movement", () => {
  const g = started(),
    p = g.player("a")!;
  p.ammo = 1;
  g.input("a", { ...neutral(1), weapon: 1 });
  g.tick(4033);
  g.input("a", { ...neutral(2), weapon: 0 });
  g.tick(4066);
  assert.equal(p.ammo, 1);
  g.input("a", { ...neutral(3), forward: 1 });
  g.tick(4100);
  const x = p.x,
    z = p.z;
  g.tick(4500);
  assert.equal(p.x, x);
  assert.equal(p.z, z);
});
