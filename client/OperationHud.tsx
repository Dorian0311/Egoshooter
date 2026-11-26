import React from 'react';
import type {Snapshot,Player} from '../shared/game';
import {modeLabels,missionLabels,conditionLabels} from '../shared/operationConfig';
import {bodyPartLabels,limbBits,type BodyPart} from '../shared/injuries';
import './remainsHud.css';
export function OperationHud({snapshot:s,player:p,throwKey,bandageKey}:{snapshot:Snapshot;player?:Player;throwKey:string;bandageKey:string}){
 const o=s.operation,point=o.objective.stage==='extract'?o.objective.extract:o.objective.point;
 const distance=p&&o.config.mode==='mission'?Math.round(Math.hypot(point.x-p.x,point.z-p.z)):0;
 const held=p?.heldPart?s.bodyParts.find(part=>part.id===p.heldPart):undefined,carried=p?.carriedCorpse?s.corpses.find(corpse=>corpse.id===p.carriedCorpse):undefined;
 const patient=carried?s.players.find(q=>q.id===carried.sourceId&&q.life===carried.sourceLife&&!q.hp):undefined;
 const nearestTent=p&&patient&&o.config.kind==='coop'?s.aidTents.filter(t=>t.team===p.team).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]:undefined;
 const medical=p?s.corpses.find(corpse=>corpse.sourceId===p.id&&corpse.sourceLife===p.life&&corpse.medicalUntil>s.now):undefined;
 return <aside className="operation-hud" aria-label="Einsatz und Vorräte"><strong>{o.config.kind==='multiplayer'?'Mehrspieler':`${o.config.kind==='coop'?'KOOP · ':''}${modeLabels[o.config.mode]}`} · {conditionLabels[o.condition]}</strong>
  {o.config.mode==='survival'&&<span>Welle {o.wave}/5 · {o.nextWaveAt?`Nächste Welle in ${Math.max(0,Math.ceil((o.nextWaveAt-s.now)/1000))} s`:`${o.remaining} Gegner verbleiben`}</span>}
  {o.config.mode==='mission'&&<span>{o.objective.stage==='extract'?'Extraktion erreichen':missionLabels[o.config.mission]} · {distance} m {o.config.mission==='hold'&&`· ${Math.floor(o.objective.progress/1000)}/90 s`}</span>}
  <span>[{throwKey}] Wurfsterne: {p?.stars??0} · [{bandageKey}] Medkits: {p?.bandages??0}</span>
  {held&&<span className="carried-remains">{bodyPartLabels[held.part]} · {held.name}<br/>Angriff: Schlagen · [{throwKey}]: Werfen · 1–4: Ablegen</span>}
  {carried&&<span className="carried-remains">Du trägst {carried.name} · E: ablegen</span>}
  {carried&&patient&&o.config.kind==='coop'&&nearestTent&&<strong className="medical-progress">Erste-Hilfe-Zelt · {Math.round(Math.hypot(nearestTent.x-p!.x,nearestTent.z-p!.z))} m · E: zur Behandlung ablegen</strong>}
  {medical&&<strong className="medical-progress">Behandlung im Erste-Hilfe-Zelt · Rückkehr in {Math.max(0,Math.ceil((medical.medicalUntil-s.now)/1000))} s</strong>}
  {!!p?.injuries.lost&&<small>Verletzt: {(Object.keys(limbBits) as BodyPart[]).filter(part=>limbBits[part]&&p.injuries.lost&limbBits[part]).map(part=>bodyPartLabels[part]).join(', ')}</small>}
  {!!p?.injuries.bleeding&&<strong className="operation-bleeding">Blutverlust · Medkit verwenden oder Hilfe suchen</strong>}
  {p?.treatment&&<span role="status">{p.treatment.kind==='bandage'?p.treatment.target===p.id?'Selbstbehandlung':`${s.players.find(q=>q.id===p.treatment!.target)?.name??'Mitspieler'} behandeln`:p.treatment.kind==='revive'?'Wiederbeleben':p.treatment.kind==='harvest'?'Kopf lösen · ziehen und drehen':'Sabotage'} · {Math.max(0,Math.ceil((p.treatment.until-s.now)/1000))} s · stillhalten</span>}
  {!!p?.downedUntil&&<strong>Verwundet · Hilfe möglich: {Math.max(0,Math.ceil((p.downedUntil-s.now)/1000))} s</strong>}
  {o.paused&&<strong>Verbindung wird wiederhergestellt · Einsatz pausiert</strong>}
 </aside>;
}
