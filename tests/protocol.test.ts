import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../shared/game.ts";
import { difference, mergeSnapshot } from "../shared/protocol.ts";
test("delta snapshots reconstruct joins, updates and leaves", () => {
  const g = new Game("ABC234");
  g.add("a", "Anna");
  const before = structuredClone(g.state);
  g.add("b", "Bruno");
  g.player("a")!.x = 22;
  const packet = difference(before, g.state);
  assert.deepEqual(mergeSnapshot(before, packet), g.state);
  const second = structuredClone(g.state);
  g.remove("b");
  assert.deepEqual(mergeSnapshot(second, difference(second, g.state)), g.state);
  assert.equal(mergeSnapshot(null, {}), null);
});
