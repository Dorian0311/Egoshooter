import type { Player, Snapshot } from "./game.ts";
export type SnapshotPacket = {
  full?: Snapshot;
  patch?: Partial<Omit<Snapshot, "players">>;
  players?: ({ id: string } & Partial<Player>)[];
  removed?: string[];
};
export function difference(
  previous: Snapshot,
  current: Snapshot,
): SnapshotPacket {
  const patch: Partial<Omit<Snapshot, "players">> = {};
  for (const key of Object.keys(current) as (keyof Snapshot)[]) {
    if (key === "players") continue;
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key]))
      Object.assign(patch, { [key]: current[key] });
  }
  const players: ({ id: string } & Partial<Player>)[] = [];
  for (const player of current.players) {
    const old = previous.players.find((p) => p.id === player.id);
    if (!old) {
      players.push(player);
      continue;
    }
    const delta: { id: string } & Partial<Player> = { id: player.id };
    for (const key of Object.keys(player) as (keyof Player)[]) {
      if (JSON.stringify(old[key]) !== JSON.stringify(player[key]))
        Object.assign(delta, { [key]: player[key] });
    }
    if (Object.keys(delta).length > 1) players.push(delta);
  }
  return {
    patch,
    players,
    removed: previous.players
      .filter((p) => !current.players.some((q) => q.id === p.id))
      .map((p) => p.id),
  };
}
export function mergeSnapshot(
  previous: Snapshot | null,
  packet: SnapshotPacket,
): Snapshot | null {
  if (packet.full) return packet.full;
  if (!previous) return null;
  const players = previous.players
    .filter((p) => !packet.removed?.includes(p.id))
    .map((p) => ({ ...p }));
  for (const delta of packet.players ?? []) {
    const p = players.find((p) => p.id === delta.id);
    if (p) Object.assign(p, delta);
    else players.push(delta as Player);
  }
  return { ...previous, ...packet.patch, players };
}
