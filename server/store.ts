import pg from "pg";
import type { Snapshot } from "../shared/game.ts";
export class Store {
  pool: pg.Pool | null;
  constructor() {
    this.pool = process.env.DATABASE_URL
      ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 })
      : null;
  }
  async init() {
    await this.pool?.query(
      `CREATE TABLE IF NOT EXISTS shooter_matches(id text PRIMARY KEY, finished_at timestamptz NOT NULL DEFAULT now(), result jsonb NOT NULL); CREATE TABLE IF NOT EXISTS shooter_scores(player_id text PRIMARY KEY,name text NOT NULL,wins integer NOT NULL DEFAULT 0,kills integer NOT NULL DEFAULT 0,deaths integer NOT NULL DEFAULT 0,matches integer NOT NULL DEFAULT 0); ALTER TABLE shooter_scores ADD COLUMN IF NOT EXISTS headshots integer NOT NULL DEFAULT 0`,
    );
  }
  async save(s: Snapshot) {
    if (!this.pool) throw Error("Keine Ergebnisdatenbank konfiguriert");
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const r = await c.query(
        "INSERT INTO shooter_matches(id,result) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id",
        [s.matchId, JSON.stringify(s)],
      );
      if (r.rowCount)
        for (const p of s.players)
          await c.query(
            "INSERT INTO shooter_scores(player_id,name,wins,kills,deaths,matches,headshots) VALUES($1,$2,$3,$4,$5,1,$6) ON CONFLICT(player_id) DO UPDATE SET name=EXCLUDED.name,wins=shooter_scores.wins+EXCLUDED.wins,kills=shooter_scores.kills+EXCLUDED.kills,deaths=shooter_scores.deaths+EXCLUDED.deaths,matches=shooter_scores.matches+1,headshots=shooter_scores.headshots+EXCLUDED.headshots",
            [p.id, p.name, s.winner === p.team ? 1 : 0, p.kills, p.deaths,p.headshots],
          );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async stats(id: string) {
    if (!this.pool) throw Error("Datenbank nicht verfügbar");
    const [board, profile, history] = await Promise.all([
      this.pool.query(
        "SELECT name,wins,kills,deaths,matches,headshots FROM shooter_scores ORDER BY wins DESC,kills DESC,player_id LIMIT 50",
      ),
      this.pool.query(
        "SELECT name,wins,kills,deaths,matches,headshots FROM shooter_scores WHERE player_id=$1",
        [id],
      ),
      this.pool.query(
        "SELECT id,finished_at,result FROM shooter_matches WHERE result->'players' @> $1::jsonb ORDER BY finished_at DESC LIMIT 20",
        [JSON.stringify([{ id }])],
      ),
    ]);
    return {
      leaderboard: board.rows,
      profile: profile.rows[0] ?? null,
      history: history.rows,
    };
  }
}
