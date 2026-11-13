import {GameSettingsPanel} from './GameSettingsPanel';
import {MatchScoreboard} from './MatchScoreboard';
import {loadSettings,settingsKey} from './gameSettings';
import {weapons,SAW_POWER_MS,SAW_RECOVERY_MS,SPRINT_DURATION_MS} from '../shared/game';
import {uniforms,uniformOptions,type UniformId} from '../shared/uniforms.ts';
import {CharacterGallery} from './CharacterGallery';
import {CharacterPicker} from './CharacterPicker';
import {LiveRooms} from './LiveRooms';
import './mapCards.css';
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Client, type Room } from "@colyseus/sdk";
import { mergeSnapshot, type SnapshotPacket } from "../shared/protocol.ts";
import type { Snapshot } from "../shared/game.ts";
import {getWorld,mapIds,type MapId} from "../shared/world.ts";
import { createScene } from "./scene.ts";
import {graphicsPresets,graphicsStorageKey,parseGraphicsQuality,type GraphicsQuality} from './graphicsSettings.ts';
import "./style.css";
import './crosshair.css';
import "./combatUI.css";
import './lobby.css';
const CommanderEasterEgg=lazy(()=>import('./CommanderEasterEgg'));
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
  account,onLogout,
}: {
  accessToken?: string;
  account?:{id:string;username:string};onLogout?:()=>void;
  onClose?: () => void;
}) {
  const [settings,setSettings]=useState(loadSettings),[settingsOpen,setSettingsOpen]=useState(false);
  const [killfeed,setKillfeed]=useState<{key:number;killer:string;victim:string;weapon:string;headshot:boolean;mine:boolean;friendly:boolean;at:number}[]>([]);
  const [damage,setDamage]=useState<{angle:number;at:number}|null>(null),[deathReason,setDeathReason]=useState('');
  const feedSequence=useRef(0);
  const [headshotAt,setHeadshotAt]=useState(0);
  const keyLabel=(action:keyof typeof settings.bindings)=>settings.bindings[action].replace('Key','').replace('Digit','');
  const [graphicsQuality,setGraphicsQuality]=useState<GraphicsQuality>(()=>{
    try{return parseGraphicsQuality(localStorage.getItem(graphicsStorageKey));}catch{return 'auto';}
  });
  const [access, setAccess] = useState<Access | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selectedMap,setSelectedMap]=useState<MapId>("storm"),
    [preferredUniform,setPreferredUniform]=useState<UniformId | "">(()=>{try{const saved=localStorage.getItem('altstadt-character');return saved&&Object.hasOwn(uniforms,saved)?saved as UniformId:"";}catch{return "";}}),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [code, setCode] = useState(
      new URLSearchParams(location.search).get("stadt") ?? "",
    ),
    [stats, setStats] = useState<Stats | null>(null),
    [connection, setConnection] = useState(""),
    [hitFeedback,setHitFeedback]=useState<string|null>(null);
  const [showCommander,setShowCommander]=useState(false);
  const gameRoot=useRef<HTMLDivElement>(null);
  const [fullscreen,setFullscreen]=useState(false),[hudNotice,setHudNotice]=useState('');
  useEffect(()=>{const changed=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
  async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await gameRoot.current?.requestFullscreen({navigationUI:'hide'});}catch{setHudNotice('Vollbild ist in diesem Browserfenster nicht verfügbar.');}}
  const [startIntent,setStartIntent]=useState<{create:boolean;training:boolean}|null>(null);
  const [scoreboardOpen,setScoreboardOpen]=useState(false),[scoreboardHeld,setScoreboardHeld]=useState(false);
  const tabAssigned=Object.values(settings.bindings).includes('Tab');
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      if(e.code==='Escape'){setScoreboardOpen(false);setScoreboardHeld(false);return;}
      if(e.code!=='Tab'||snapshot?.phase!=='playing'||settingsOpen||tabAssigned)return;
      const target=e.target;
      if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target instanceof HTMLSelectElement||target instanceof HTMLElement&&target.isContentEditable)return;
      e.preventDefault();setScoreboardHeld(true);
    };
    const up=(e:KeyboardEvent)=>{if(e.code==='Tab')setScoreboardHeld(false);};
    const blur=()=>setScoreboardHeld(false);
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};
  },[snapshot?.phase,settingsOpen,tabAssigned]);
  useEffect(()=>{
    const toggle=(e:KeyboardEvent)=>{if(e.ctrlKey&&e.altKey&&e.code==='KeyN'&&!e.repeat&&(!snapshot||snapshot.phase==='waiting'||snapshot.phase==='finished')){e.preventDefault();setShowCommander(v=>!v);}};
    window.addEventListener('keydown',toggle);return()=>window.removeEventListener('keydown',toggle);
  },[snapshot?.phase]);
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
        if (!accessToken&&!account)
          throw Error(
            "Bitte über das IT-Glücksrad anmelden und Strg+Alt+G drücken.",
          );
        const response = await fetch(account?"/game/account/ticket":"/api/shooter/ticket", {
          method: "POST",credentials:"include",
          headers: account?{}:{ Authorization: `Bearer ${accessToken}` },
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
  }, [accessToken,account?.id]);
  useEffect(() => {
    if (snapshot && canvas.current && !scene.current) {
      scene.current = createScene(canvas.current, (i) => room.current?.send("input", i),snapshot.mapId,graphicsQuality,settings,id=>room.current?.send("interact",id));
      scene.current.setEnabled(!settingsOpen&&!connection);
      if (accessRef.current && last.current)
        scene.current.update(last.current, accessRef.current.playerId);
    }
    return ()=>{scene.current?.dispose();scene.current=null;};
  }, [!!snapshot,snapshot?.mapId]);
  useEffect(()=>{
    scene.current?.setQuality(graphicsQuality);
    try{localStorage.setItem(graphicsStorageKey,graphicsQuality);}catch{/* Session-only preference if storage is unavailable. */}
  },[graphicsQuality]);
  useEffect(()=>{scene.current?.setSettings(settings);try{localStorage.setItem(settingsKey,JSON.stringify(settings));}catch{/* Session only. */}},[settings]);
  useEffect(()=>{scene.current?.setEnabled(!settingsOpen&&!connection);},[settingsOpen,connection,!!snapshot]);
  useEffect(()=>{try{localStorage.setItem('altstadt-character',preferredUniform);}catch{/* Session only. */}},[preferredUniform]);
  useEffect(()=>{if(!snapshot&&preferredUniform&&!uniformOptions('de',selectedMap).includes(preferredUniform))setPreferredUniform('');},[selectedMap,preferredUniform,!!snapshot]);
  function message(e: unknown) {
    return e instanceof Error ? e.message : "Verbindung fehlgeschlagen";
  }
  async function refreshAccess() {
    const response = await fetch(account?"/game/account/ticket":"/api/shooter/ticket", {
      method: "POST",credentials:"include",
      headers: account?{}:{ Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok)
      throw Error("Spielzugang abgelaufen oder nicht verfügbar");
    const value = (await response.json()) as Access;
    setAccess(value);
    accessRef.current = value;
    return value;
  }
  async function connect(create: boolean,training=false,chosenUniform=preferredUniform) {
    if (!access || busy) return;
    if (!chosenUniform) {setError("Bitte wähle zuerst deinen Charakter aus.");return;}
    setBusy(true);
    setError("");
    try {
      const access = await refreshAccess();
      const client = new Client(access.serverUrl);
      let r: Room;
      if (create)
        r = await client.create("altstadt", { ticket: access.ticket,mapId:selectedMap,training,uniform:chosenUniform });
      else {
        const response = await fetch(
          `${access.serverUrl.replace(/^ws/, "http")}/rooms/${encodeURIComponent(code.toUpperCase())}`,
          { headers: { Authorization: `Bearer ${access.ticket}` } },
        );
        if (!response.ok)
          throw Error("Raum nicht gefunden oder nicht zugänglich");
        const info = await response.json();
        r = await client.joinById(info.roomId, { ticket: access.ticket,uniform:chosenUniform });
      }
      r.reconnection.minUptime = 0;
      room.current = r;setKillfeed([]);setDamage(null);setDeathReason('');setConnection('');
      r.onMessage("snapshot", (packet: SnapshotPacket) => {
        const s = mergeSnapshot(last.current, packet);
        if (!s) return;
        for(const event of s.events){if(event.type==='hit'&&event.id===access.playerId){setHitFeedback(event.hitZone??'body');if(feedbackTimer.current)clearTimeout(feedbackTimer.current);feedbackTimer.current=setTimeout(()=>setHitFeedback(null),220);}}
        const own=s.players.find(p=>p.id===access.playerId);
        if(own?.hp)setDeathReason('');
        const newKills=s.events.filter(e=>e.type==='kill').map(e=>({key:++feedSequence.current,killer:s.players.find(p=>p.id===e.id)?.name??'Spieler',victim:s.players.find(p=>p.id===e.target)?.name??'Spieler',weapon:weapons[e.weapon??0].name,headshot:e.hitZone==='head',mine:e.id===access.playerId,friendly:s.players.find(p=>p.id===e.id)?.team===own?.team,at:s.now}));
        setKillfeed(old=>[...old.filter(e=>s.now-e.at<6500),...newKills].slice(-4));
        for(const event of s.events){
          if(event.type==='hit'&&event.target===access.playerId&&own){const attacker=s.players.find(p=>p.id===event.id);if(attacker)setDamage({angle:(Math.atan2(attacker.x-own.x,-(attacker.z-own.z))+own.yaw)*180/Math.PI,at:s.now});}
          if(event.type==='kill'&&event.id===access.playerId&&event.hitZone==='head')setHeadshotAt(s.now);
          if(event.type==='kill'&&event.target===access.playerId)setDeathReason(`Besiegt von ${s.players.find(p=>p.id===event.id)?.name??'Spieler'} mit ${weapons[event.weapon??0].name}`);
        }
        last.current = s;
        setSnapshot(s);
        scene.current?.update(s, access.playerId);
      });
      r.send("uniform",chosenUniform);
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
        if(room.current!==r)return;
        setConnection("Verbindung beendet. Bitte Raum erneut öffnen.");
      });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function leaveGame(){const current=room.current;room.current=null;setSettingsOpen(false);setSnapshot(null);last.current=null;setConnection('');setError('');await current?.leave();}
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
    <div ref={gameRoot} className={`city-app ${active?"city-playing":""} ${!snapshot?"city-lobby":""}`}>
      {snapshot && <canvas ref={canvas} className="city-canvas" />}
      {showCommander&&(!snapshot||snapshot.phase==='waiting'||snapshot.phase==='finished')&&<Suspense fallback={null}><CommanderEasterEgg onClose={()=>setShowCommander(false)}/></Suspense>}
      {settingsOpen&&<GameSettingsPanel value={settings} onChange={setSettings} onClose={()=>setSettingsOpen(false)} graphics={{value:graphicsQuality,onChange:setGraphicsQuality}} onLeave={snapshot?()=>void leaveGame():undefined}/>}
      {startIntent&&!snapshot&&<CharacterPicker map={selectedMap} value={preferredUniform} onClose={()=>setStartIntent(null)} onSelect={id=>{const intent=startIntent;setPreferredUniform(id);setStartIntent(null);void connect(intent.create,intent.training,id);}}/>}
      {snapshot&&(scoreboardOpen||scoreboardHeld)&&<MatchScoreboard snapshot={snapshot} playerId={access?.playerId} onClose={()=>{setScoreboardOpen(false);setScoreboardHeld(false);}}/>}
      {snapshot&&<nav className="game-toolbar" aria-label="Spielbedienung">
        <button aria-expanded={scoreboardOpen||scoreboardHeld} onClick={()=>setScoreboardOpen(v=>!v)}>Rangliste{!tabAssigned?' · Tab':''}</button>
        <button onClick={()=>{document.exitPointerLock();setSettingsOpen(true);}}>Einstellungen</button>
        <button aria-label="Vollbild umschalten" aria-pressed={fullscreen} onClick={()=>void toggleFullscreen()}>{fullscreen?'↙ Fenstermodus':'⛶ Vollbild'}</button>
      </nav>}
      {hudNotice&&<div className="hud-notice" role="status" onClick={()=>setHudNotice('')}>{hudNotice}</div>}
      {!snapshot&&account&&<div className="lobby-profile"><strong>{account.username}</strong><button onClick={onLogout}>Abmelden</button></div>}
      {!snapshot ? (
        <main className="city-entry">
          <div className="lobby-wordmark"><strong>EISERNE FRONT</strong><span>OPERATION 1945</span><small>TAKTISCHER MULTIPLAYER · TEAM-DEATHMATCH</small></div>
          <div className="city-kicker">
            VIER SCHAUPLÄTZE. DEINE TAKTIK.
          </div>
          <h1>
            <span>Vier Fronten.</span>
            <br />
            <em>Dein Einsatz.</em>
          </h1>
          <p>
            Inselposten, Güterviertel, Rheinbrücke und Gebirgspass.
            <br />
            Vier Karten. Taktische Gefechte mit bis zu acht Spielern.
          </p>
          <div className="city-map-picker">{mapIds.map(id=><button key={id} aria-pressed={selectedMap===id} className={`city-map-${id} ${selectedMap===id?"selected":""}`} onClick={()=>setSelectedMap(id)}><span className={`map-preview map-preview-${id}`} aria-hidden="true"/><span className="map-card-copy"><strong>{getWorld(id).name}</strong><small>{getWorld(id).subtitle}</small></span></button>)}</div>
          {import.meta.env.DEV&&import.meta.env.VITE_SHOOTER_PREVIEW===true&&<button className="city-primary city-solo" disabled={!access||busy} onClick={()=>setStartIntent({create:true,training:true})}>Alleine testen · bewegliches Trainingsziel</button>}
          <div className="city-actions">
            <button
              disabled={!access || busy}
              onClick={() => setStartIntent({create:true,training:false})}
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
                onClick={() => setStartIntent({create:false,training:false})}
              >
                Beitreten
              </button>
            </div>
          </div>
          <LiveRooms access={access} onRefreshTicket={refreshAccess} onJoin={room=>{setCode(room.code);setSelectedMap(room.mapId);setStartIntent({create:false,training:false});}}/>
          <button className="city-text" onClick={()=>setSettingsOpen(true)}>Einstellungen</button>
          <button className="city-text" onClick={() => void showStats()}>
            Community-Rangliste & persönliche Statistik
          </button>
          <aside><a href="https://polyhaven.com" target="_blank" rel="noreferrer">Powered by Poly Haven · CC0-Materialien</a> · <a href="/shooter/models/realistic/CREDITS.txt" target="_blank" rel="noreferrer">Modellnachweise</a><br/>
            {keyLabel("forward")}/{keyLabel("left")}/{keyLabel("back")}/{keyLabel("right")} Bewegung · Maus Zielen · {keyLabel("reload")} Nachladen · {keyLabel("weapon1")}/{keyLabel("weapon2")}/{keyLabel("weapon3")}/{keyLabel("weapon4")} Waffen · {keyLabel("crouch")} Ducken · {keyLabel("sprint")} Sprint · {keyLabel("interact")} Benutzen · Esc Maus freigeben
          </aside>
        </main>
      ) : (
        <>
          <div className="city-score">
            <strong>{getWorld(snapshot.mapId).allyCode??'DE'} {snapshot.scores.de}</strong>
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
                    : `${snapshot.winner === "de" ? getWorld(snapshot.mapId).ally??"Deutschland" : getWorld(snapshot.mapId).opponent} gewinnt`
                  : snapshot.phase === "countdown"
                    ? `Start in ${Math.max(0, Math.ceil((snapshot.startsAt - snapshot.now) / 1000))}`
                    : "Dein Team wartet."}
              </h2>
              <div className="city-teams">
                {(["de", "fr"] as const).map((t) => (
                  <div key={t}>
                    <button
                      disabled={snapshot.phase !== "waiting"}
                      onClick={() => {if(me?.team!==t)setPreferredUniform("");room.current?.send("team", t);}}
                    >
                      {t === "de" ? (getWorld(snapshot.mapId).ally??"Deutschland").toUpperCase() : getWorld(snapshot.mapId).opponent.toUpperCase()}{" "}
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
                <CharacterGallery compact team={me.team} map={snapshot.mapId} value={preferredUniform===me.uniform?me.uniform:""} onChange={id=>{setPreferredUniform(id);room.current?.send('uniform',id);}}/>
              )}
              {snapshot.phase === "waiting" && (
                <button
                  className="city-primary"
                  disabled={!me || !preferredUniform || preferredUniform!==me.uniform}
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
              {settings.headshotSlowMotion&&headshotAt>0&&snapshot.now-headshotAt<850&&<div className="headshot-cinematic" key={headshotAt}><div><strong>KOPFTREFFER</strong><small>ZEITLUPE</small></div></div>}
              <section className="combat-feed live-killfeed" aria-label="Live-Abschüsse"><header><span>ABSCHÜSSE</span><small>● LIVE</small></header><div role="log" aria-live="polite">{killfeed.length===0?<p className="killfeed-empty">Noch keine Abschüsse</p>:killfeed.map(item=><div key={item.key} className={`killfeed-entry ${item.mine?'is-mine':item.friendly?'is-friendly':'is-enemy'}`}><strong>{item.killer}</strong><span className="killfeed-weapon" title={item.weapon}>{item.headshot?'◎':'▸'}</span><b>{item.victim}</b></div>)}</div></section>
              {damage&&snapshot.now-damage.at<850&&<div className="damage-direction" aria-label="Beschussrichtung" style={{transform:`translate(-50%,-50%) rotate(${damage.angle}deg)`}}><span>▼</span></div>}
              {me?.uniform==='leatherface'&&<div className={`saw-power ${snapshot.now<me.powerUntil?'is-active':''}`}>
                <strong>{snapshot.now<me.powerUntil?'POWERMODUS':snapshot.now<me.powerReadyAt?'ERHOLUNG':'KETTENSÄGE BEREIT'}</strong>
                <progress max={1} value={snapshot.now<me.powerUntil?(me.powerUntil-snapshot.now)/SAW_POWER_MS:snapshot.now<me.powerReadyAt?1-(me.powerReadyAt-snapshot.now)/SAW_RECOVERY_MS:1}/>
                <small>{snapshot.now<me.powerUntil?`${((me.powerUntil-snapshot.now)/1000).toFixed(1)} s Schub`:snapshot.now<me.powerReadyAt?`${Math.ceil((me.powerReadyAt-snapshot.now)/1000)} s bis zum nächsten Schub`:'Angriff halten · 2,2 s Schub · 7 s Erholung'}</small>
              </div>}
              <div className="city-hud"><strong>{me?.hp??0}<small>GESUNDHEIT</small></strong></div>
              <div className="personal-score" aria-label="Eigene Abschüsse und Tode"><span><b>{me?.kills??0}</b> KILLS</span><span><b>{me?.deaths??0}</b> TODE</span></div>
              <div className={`sprint-meter ${me?.sprinting?'is-sprinting':''}`} aria-label="Sprint-Ausdauer">
                <div><span>{me?.sprinting?'SPRINT':me?.sprintExhausted?'ERHOLUNG':(me?.stamina??SPRINT_DURATION_MS)<SPRINT_DURATION_MS?'AUSDAUER':'SPRINT BEREIT'}</span><small>{((me?.stamina??SPRINT_DURATION_MS)/1000).toFixed(1)} s</small></div>
                <progress aria-label="Verbleibende Sprint-Ausdauer" max={SPRINT_DURATION_MS} value={me?.stamina??SPRINT_DURATION_MS}/>
              </div>
              {!me?.hp && (
                <div className="city-respawn">
                  {deathReason&&<small className="death-reason">{deathReason}</small>}
                  Gefallen · Wiedereinstieg in{" "}
                  {Math.max(
                    0,
                    Math.ceil(((me?.respawnAt ?? 0) - snapshot.now) / 1000),
                  )}{" "}
                  s
                </div>
              )}
              <div className="city-hint">
                Klicken zum Spielen · Maus bewegen zum Umsehen · Esc Maus freigeben
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
                  ? `${getWorld(m.result.mapId??"cologne").ally??'Deutschland'} gewinnt`
                  : `${getWorld(m.result.mapId??"cologne").opponent} gewinnt`}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
