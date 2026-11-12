import {uniforms,uniformOptions,type UniformId} from '../shared/uniforms.ts';
import React, { useEffect, useRef, useState } from "react";
import { Client, type Room } from "@colyseus/sdk";
import { mergeSnapshot, type SnapshotPacket } from "../shared/protocol.ts";
import type { Snapshot } from "../shared/game.ts";
import {getWorld,mapIds,type MapId} from "../shared/world.ts";
import { createScene } from "./scene.ts";
import {graphicsPresets,graphicsStorageKey,parseGraphicsQuality,type GraphicsQuality} from './graphicsSettings.ts';
import "./style.css";
type Score = {
  name: string;
  wins: number;
  kills: number;
  deaths: number;
  matches: number;
  headshots:number;
};
type Stats = {
  leaderboard: Score[];
  profile: Score | null;
  history: { id: string; finished_at: string; result: Snapshot }[];
};
type Access = { ticket: string; serverUrl: string; playerId: string };
export default function App({
  accessToken,
  onClose,
}: {
  accessToken?: string;
  onClose?: () => void;
}) {
  const [graphicsQuality,setGraphicsQuality]=useState<GraphicsQuality>(()=>{
    try{return parseGraphicsQuality(localStorage.getItem(graphicsStorageKey));}catch{return 'auto';}
  });
  const [access, setAccess] = useState<Access | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selectedMap,setSelectedMap]=useState<MapId>("cologne"),
    [preferredUniform,setPreferredUniform]=useState<UniformId>("de-panzer"),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [code, setCode] = useState(
      new URLSearchParams(location.search).get("stadt") ?? "",
    ),
    [stats, setStats] = useState<Stats | null>(null),
    [connection, setConnection] = useState(""),
    [hitFeedback,setHitFeedback]=useState<string|null>(null);
  const feedbackTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const room = useRef<Room | null>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<ReturnType<typeof createScene> | null>(null),
    accessRef = useRef<Access | null>(null),
    last = useRef<Snapshot | null>(null);
  useEffect(() => {
    let alive = true;
    async function boot() {
      try {
        if (!accessToken)
          throw Error(
            "Bitte über das IT-Glücksrad anmelden und Strg+Alt+G drücken.",
          );
        const response = await fetch("/api/shooter/ticket", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok)
          throw Error(
            response.status === 404
              ? "Shooter noch nicht freigeschaltet."
              : "Spielzugang nicht verfügbar.",
          );
        const value = (await response.json()) as Access;
        if (alive) {
          setAccess(value);
          accessRef.current = value;
        }
      } catch (e) {
        if (alive) setError(message(e));
      }
    }
    void boot();
    return () => {
      alive = false;
      if(feedbackTimer.current)clearTimeout(feedbackTimer.current);
      scene.current?.dispose();
      scene.current = null;
      void room.current?.leave();
      room.current = null;
    };
  }, [accessToken]);
  useEffect(() => {
    if (snapshot && canvas.current && !scene.current) {
      scene.current = createScene(canvas.current, (i) => room.current?.send("input", i),snapshot.mapId,graphicsQuality);
      if (accessRef.current && last.current)
        scene.current.update(last.current, accessRef.current.playerId);
    }
    return ()=>{scene.current?.dispose();scene.current=null;};
  }, [!!snapshot,snapshot?.mapId]);
  useEffect(()=>{
    scene.current?.setQuality(graphicsQuality);
    try{localStorage.setItem(graphicsStorageKey,graphicsQuality);}catch{/* Session-only preference if storage is unavailable. */}
  },[graphicsQuality]);
  function message(e: unknown) {
    return e instanceof Error ? e.message : "Verbindung fehlgeschlagen";
  }
  async function refreshAccess() {
    const response = await fetch("/api/shooter/ticket", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok)
      throw Error("Spielzugang abgelaufen oder nicht verfügbar");
    const value = (await response.json()) as Access;
    setAccess(value);
    accessRef.current = value;
    return value;
  }
  async function connect(create: boolean,training=false) {
    if (!access || busy) return;
    setBusy(true);
    setError("");
    try {
      const access = await refreshAccess();
      const client = new Client(access.serverUrl);
      let r: Room;
      if (create)
        r = await client.create("altstadt", { ticket: access.ticket,mapId:selectedMap,training });
      else {
        const response = await fetch(
          `${access.serverUrl.replace(/^ws/, "http")}/rooms/${encodeURIComponent(code.toUpperCase())}`,
          { headers: { Authorization: `Bearer ${access.ticket}` } },
        );
        if (!response.ok)
          throw Error("Raum nicht gefunden oder nicht zugänglich");
        const info = await response.json();
        r = await client.joinById(info.roomId, { ticket: access.ticket });
      }
      r.reconnection.minUptime = 0;
      room.current = r;
      r.onMessage("snapshot", (packet: SnapshotPacket) => {
        const s = mergeSnapshot(last.current, packet);
        if (!s) return;
        for(const event of s.events){if(event.type==='hit'&&event.id===access.playerId){setHitFeedback(event.hitZone??'body');if(feedbackTimer.current)clearTimeout(feedbackTimer.current);feedbackTimer.current=setTimeout(()=>setHitFeedback(null),220);}}
        last.current = s;
        setSnapshot(s);
        scene.current?.update(s, access.playerId);
      });
      r.send("uniform",preferredUniform);
      r.send("sync");
      if(training)r.send("ready",true);
      r.onError((_code: number, msg?: string) =>
        setError(msg ?? "Netzwerkfehler"),
      );
      r.onDrop(() =>
        setConnection("Verbindung wird wiederhergestellt … (10 s)"),
      );
      r.onReconnect(() => setConnection(""));
      r.onLeave(() => {
        setConnection("Verbindung beendet. Bitte Raum erneut öffnen.");
      });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function showStats() {
    if (!access) return;
    try {
      const access = await refreshAccess();
      const response = await fetch(
        `${access.serverUrl.replace(/^ws/, "http")}/stats`,
        { headers: { Authorization: `Bearer ${access.ticket}` } },
      );
      if (!response.ok) throw Error("Statistik derzeit nicht verfügbar");
      setStats(await response.json());
    } catch (e) {
      setError(message(e));
    }
  }
  const me = snapshot?.players.find((p) => p.id === access?.playerId),
    active = snapshot?.phase === "playing";
  return (
    <div className={`city-app ${active?"city-playing":""} ${!snapshot?"city-lobby":""}`}>
      {snapshot && <canvas ref={canvas} className="city-canvas" />}
      <header className="city-top">
        <span className="city-brand">
          A<span>1945</span>
        </span>
        <span>
          ALTSTADT <small>1945 · TAKTISCHES TEAM-DEATHMATCH</small>
        </span>
        <label className="city-graphics">Grafik
          <select aria-label="Grafikqualität" value={graphicsQuality} onChange={e=>setGraphicsQuality(parseGraphicsQuality(e.target.value))}>
            {(Object.keys(graphicsPresets) as GraphicsQuality[]).map(value=><option key={value} value={value}>{graphicsPresets[value].label}</option>)}
          </select>
        </label>
        <button
          onClick={() => {
            if (onClose) onClose();
            else location.reload();
          }}
        >
          Schließen ×
        </button>
      </header>
      {!snapshot ? (
        <main className="city-entry">
          <div className="city-kicker">
            ZWEI SCHAUPLÄTZE. DEINE TAKTIK.
          </div>
          <h1>
            Brücke oder
            <br />
            <em>Gebirgspass.</em>
          </h1>
          <p>
            Köln am Rhein. Die Festungen der Alpen.
            <br />
            Spiele mit bis zu sieben Kollegen an historischen Schauplätzen.
          </p>
          <div className="city-map-picker">{mapIds.map(id=><button key={id} aria-pressed={selectedMap===id} className={`city-map-${id} ${selectedMap===id?"selected":""}`} onClick={()=>setSelectedMap(id)}>{getWorld(id).name}<small>{getWorld(id).subtitle}</small></button>)}</div>
          <label className="city-uniform-choice">Startfigur / Uniform
            <select value={preferredUniform} onChange={e=>setPreferredUniform(e.target.value as UniformId)}>
              {uniformOptions('de',selectedMap).map(id=><option key={id} value={id}>{uniforms[id].name}</option>)}
            </select>
            <small>Weitere Fraktionen und Uniformen wählst du im Einsatzraum.</small>
            {preferredUniform==='de-greatcoat'&&<a href="/shooter/characters/greatcoat/CREDITS.txt" target="_blank" rel="noreferrer">Modell: That one larry · CC BY 4.0</a>}
          </label>
          {import.meta.env.DEV&&import.meta.env.VITE_SHOOTER_PREVIEW===true&&<button className="city-primary city-solo" disabled={!access||busy} onClick={()=>void connect(true,true)}>Alleine testen · bewegliches Trainingsziel</button>}
          <div className="city-actions">
            <button
              disabled={!access || busy}
              onClick={() => void connect(true)}
            >
              Einsatz erstellen ↗
            </button>
            <div>
              <input
                aria-label="Raum-Code"
                placeholder="RAUM-CODE"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""),
                  )
                }
              />
              <button
                disabled={!access || busy || code.length !== 6}
                onClick={() => void connect(false)}
              >
                Beitreten
              </button>
            </div>
          </div>
          <button className="city-text" onClick={() => void showStats()}>
            Community-Rangliste & persönliche Statistik
          </button>
          <aside><a href="https://polyhaven.com" target="_blank" rel="noreferrer">Powered by Poly Haven · CC0-Materialien</a><br/>
            WASD Bewegung · Maus Zielen · R Nachladen · 1/2/3/4 Waffen (4: G36 modern) · C Ducken ·
            Umschalt Sprint · Esc Maus freigeben
          </aside>
        </main>
      ) : (
        <>
          <div className="city-score">
            <strong>DE {snapshot.scores.de}</strong>
            <span>
              {active
                ? `${Math.floor(Math.max(0,snapshot.endsAt-snapshot.now)/60000)}:${String(Math.floor(Math.max(0,snapshot.endsAt-snapshot.now)/1000)%60).padStart(2,"0")}`
                : "ALTSTADT"}
              <small>50 ABSCHÜSSE · 10 MINUTEN</small>
            </span>
            <strong>{snapshot.scores.fr} {getWorld(snapshot.mapId).opponentCode}</strong>
          </div>
          {snapshot.phase !== "playing" && (
            <section className="city-panel">
              <div className="city-kicker">EINSATZRAUM {snapshot.roomCode}</div><p>{getWorld(snapshot.mapId).name}</p>{snapshot.phase==="waiting"&&snapshot.host===access?.playerId&&<label>Karte <select value={snapshot.mapId} onChange={e=>room.current?.send("map",e.target.value)}>{mapIds.map(id=><option key={id} value={id}>{getWorld(id).name}</option>)}</select></label>}
              <h2>
                {snapshot.phase === "finished"
                  ? snapshot.winner === "draw"
                    ? "Unentschieden"
                    : `${snapshot.winner === "de" ? "Deutschland" : getWorld(snapshot.mapId).opponent} gewinnt`
                  : snapshot.phase === "countdown"
                    ? `Start in ${Math.max(0, Math.ceil((snapshot.startsAt - snapshot.now) / 1000))}`
                    : "Dein Team wartet."}
              </h2>
              <div className="city-teams">
                {(["de", "fr"] as const).map((t) => (
                  <div key={t}>
                    <button
                      disabled={snapshot.phase !== "waiting"}
                      onClick={() => room.current?.send("team", t)}
                    >
                      {t === "de" ? "DEUTSCHLAND" : getWorld(snapshot.mapId).opponent.toUpperCase()}{" "}
                      {me?.team === t ? "●" : ""}
                    </button>
                    {snapshot.players
                      .filter((p) => p.team === t)
                      .map((p) => (
                        <p key={p.id}>
                          {p.name}
                          <small>
                            {snapshot.phase === "finished"
                              ? `${p.kills} / ${p.deaths}`
                              : p.connected
                                ? p.ready
                                  ? "BEREIT"
                                  : "WARTET"
                                : "VERBINDUNG …"}
                          </small>
                        </p>
                      ))}
                  </div>
                ))}
              </div>
              {snapshot.phase === "waiting" && me && (
                <label className="city-uniform-choice">Figur / Uniform für deinen Einsatz
                  <select value={me.uniform} onChange={e=>room.current?.send('uniform',e.target.value)}>
                    {uniformOptions(me.team,snapshot.mapId).map(id=><option key={id} value={id}>{uniforms[id].name}</option>)}
                  </select>
                  <small>{uniforms[me.uniform]?.detail}</small>
                  {me.uniform==='de-greatcoat'&&<a href="/shooter/characters/greatcoat/CREDITS.txt" target="_blank" rel="noreferrer">Modell: That one larry · CC BY 4.0</a>}
                </label>
              )}
              {snapshot.phase === "waiting" && (
                <button
                  className="city-primary"
                  onClick={() => room.current?.send("ready", !me?.ready)}
                >
                  {me?.ready
                    ? "Bereitschaft zurücknehmen"
                    : "Bereit für den Einsatz"}
                </button>
              )}
              {snapshot.phase === "finished" && (
                <>
                  <p>
                    Ergebnisse:{" "}
                    {snapshot.persistence === "practice"
                      ? "Training · nicht gewertet"
                      : snapshot.persistence === "saved"
                      ? "gespeichert"
                      : snapshot.persistence === "failed"
                        ? "Speichern fehlgeschlagen – nicht gewertet"
                        : "werden gespeichert …"}
                  </p>
                  {snapshot.host === access?.playerId && (
                    <button onClick={() => room.current?.send("rematch")}>
                      Revanche im selben Raum
                    </button>
                  )}
                </>
              )}
              <button
                className="city-text"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `${location.origin}${location.pathname}?stadt=${snapshot.roomCode}`,
                  );
                }}
              >
                Einladungslink kopieren
              </button>
            </section>
          )}
          {active && (
            <>
              <div className={`city-crosshair ${hitFeedback?"city-hit city-hit-"+hitFeedback:""}`}><i/><i/><i/><i/><b/></div>
              <div className="city-hud">
                <strong>
                  {me?.hp ?? 0}
                  <small>GESUNDHEIT</small>
                </strong>
                <span>
                  {me?.weapon === 3 ? "HK G36 · MODERN" : me?.weapon === 0 ? (me?.team === "de" ? "KAR98K" : snapshot.mapId === "cologne" ? "M1 GARAND" : "REPETIERGEWEHR") : me?.weapon === 1 ? "PISTOLE" : me?.team === "de" ? "MP40" : snapshot.mapId === "cologne" ? "THOMPSON" : "MAS-38"}
                  <small>
                    {me?.reloadAt
                      ? "NACHLADEN …"
                      : `${me?.ammo ?? 0} SCHUSS · R NACHLADEN`}
                  </small>
                </span>
                <strong>
                  {me?.kills ?? 0}
                  <small>ABSCHÜSSE</small>
                </strong>
              </div>
              {!me?.hp && (
                <div className="city-respawn">
                  Gefallen · Wiedereinstieg in{" "}
                  {Math.max(
                    0,
                    Math.ceil(((me?.respawnAt ?? 0) - snapshot.now) / 1000),
                  )}{" "}
                  s
                </div>
              )}
              <div className="city-hint">
                Klicken zum Spielen · Maus bewegen zum Umsehen · Esc Pause
              </div>
            </>
          )}
        </>
      )}
      {(error || connection) && (
        <div role="alert" className="city-error">
          {error || connection}
          {connection && (
            <button
              onClick={() => {
                scene.current?.dispose();
                scene.current = null;
                void room.current?.leave();
                room.current = null;
                last.current = null;
                setSnapshot(null);
                setConnection("");
              }}
            >
              Zur Lobby
            </button>
          )}
        </div>
      )}
      {stats !== null && (
        <section className="city-stats">
          <button onClick={() => setStats(null)}>Schließen ×</button>
          <h2>Community & Verlauf</h2>
          <p>
            {stats.profile
              ? `${stats.profile.matches} Einsätze · ${stats.profile.wins} Siege · ${stats.profile.kills} Abschüsse`
              : "Du hast noch keine gewerteten Einsätze."}
          </p>
          <table>
            <thead>
              <tr>
                <th>Spieler</th>
                <th>Siege</th>
                <th>Abschüsse</th>
                <th>Tode</th>
                <th>Einsätze</th>
              </tr>
            </thead>
            <tbody>
              {stats.leaderboard.map((p, index) => (
                <tr key={index}>
                  <td>{p.name}</td>
                  <td>{p.wins}</td>
                  <td>{p.kills}</td>
                  <td>{p.deaths}</td>
                  <td>{p.matches}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Deine letzten Einsätze</h3>
          {stats.history.map((m) => (
            <p key={m.id}>
              {new Date(m.finished_at).toLocaleString("de-DE")} ·{" "}
              {m.result.scores.de} : {m.result.scores.fr} ·{" "}
              {m.result.winner === "draw"
                ? "Unentschieden"
                : m.result.winner === "de"
                  ? "Deutschland gewinnt"
                  : `${getWorld(m.result.mapId??"cologne").opponent} gewinnt`}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
