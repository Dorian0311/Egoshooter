import React from 'react';
import type {Snapshot} from '../shared/game';
import {getWorld} from '../shared/world';
import './matchScoreboard.css';

export function MatchScoreboard({snapshot,playerId,onClose}:{snapshot:Snapshot;playerId?:string;onClose:()=>void}){
 const world=getWorld(snapshot.mapId);
 const players=[...snapshot.players].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths||a.name.localeCompare(b.name,'de')||a.id.localeCompare(b.id));
 return <section className="match-scoreboard" aria-label="Rangliste des aktuellen Einsatzes">
  <header><div><span>AKTUELLER EINSATZ</span><h2>Rangliste</h2><p>{world.name}</p></div><button onClick={onClose} aria-label="Rangliste schließen">Schließen ×</button></header>
  <div className="match-scoreboard-scroll"><table>
   <thead><tr><th scope="col">Platz</th><th scope="col">Spieler</th><th scope="col">Team</th><th scope="col">Kills</th><th scope="col">Tode</th></tr></thead>
   <tbody>{players.map((p,index)=><tr key={p.id} className={p.id===playerId?'is-me':''}>
    <td>{index+1}</td><th scope="row">{p.name}{p.id===playerId&&<small>DU</small>}{!p.connected&&<small>GETRENNT</small>}</th>
    <td>{p.team==='de'?world.allyCode??'DE':world.opponentCode}</td><td className="score-kills">{p.kills}</td><td>{p.deaths}</td>
   </tr>)}</tbody>
  </table></div>
  <footer>Live aktualisiert · Sortierung nach Kills, bei Gleichstand nach weniger Toden.</footer>
 </section>;
}
