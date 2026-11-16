import React from 'react';
import type {Snapshot,Player} from '../shared/game';
import {modeLabels,missionLabels,conditionLabels} from '../shared/operationConfig';
import {bodyPartLabels,limbBits,type BodyPart} from '../shared/injuries';
export function OperationHud({snapshot:s,player:p,throwKey,bandageKey}:{snapshot:Snapshot;player?:Player;throwKey:string;bandageKey:string}){
 const o=s.operation,point=o.objective.stage==='extract'?o.objective.extract:o.objective.point,distance=p?Math.round(Math.hypot(point.x-p.x,point.z-p.z)):0;
 return <aside className="operation-hud" aria-label="Einsatz und Vorräte"><strong>{o.config.kind==='multiplayer'?'Mehrspieler':`${o.config.kind==='coop'?'KOOP · ':''}${modeLabels[o.config.mode]}`} · {conditionLabels[o.condition]}</strong>
  {o.config.mode==='survival'&&<span>Welle {o.wave}/5 · {o.nextWaveAt?`Nächste Welle in ${Math.max(0,Math.ceil((o.nextWaveAt-s.now)/1000))} s`:`${o.remaining} Gegner verbleiben`}</span>}
  {o.config.mode==='mission'&&<span>{o.objective.stage==='extract'?'Extraktion erreichen':missionLabels[o.config.mission]} · {distance} m {o.config.mission==='hold'&&`· ${Math.floor(o.objective.progress/1000)}/90 s`}</span>}
  <span>[{throwKey}] Wurfsterne: {p?.stars??0} · [{bandageKey}] Verbände: {p?.bandages??0}</span>
  {!!p?.injuries.lost&&<small>Verletzt: {(Object.keys(limbBits) as BodyPart[]).filter(part=>limbBits[part]&&p.injuries.lost&limbBits[part]).map(part=>bodyPartLabels[part]).join(', ')}</small>}
  {!!p?.injuries.bleeding&&<strong className="operation-bleeding">Blutverlust · Verband verwenden oder Hilfe suchen</strong>}
  {p?.treatment&&<span role="status">{p.treatment.kind==='bandage'?'Verbinden':p.treatment.kind==='revive'?'Wiederbeleben':'Sabotage'} · {Math.max(0,Math.ceil((p.treatment.until-s.now)/1000))} s · stillhalten</span>}
  {!!p?.downedUntil&&<strong>Verwundet · Hilfe möglich: {Math.max(0,Math.ceil((p.downedUntil-s.now)/1000))} s</strong>}
  {o.paused&&<strong>Verbindung wird wiederhergestellt · Einsatz pausiert</strong>}
 </aside>;
}
