import {getWorld} from '../shared/world';
import {modeLabels,difficultyLabels,missionLabels,conditionLabels} from '../shared/operationConfig';
import type {Snapshot} from '../shared/game';
export type LocalBest={key:string;label:string;matches:number;wins:number;kills:number;headshots:number;deaths:number;waves:number;updated:string};
const storageKey='eiserne-front-best-v1';
export function readBests():LocalBest[]{try{const data=JSON.parse(localStorage.getItem(storageKey)??'[]');return Array.isArray(data)?data.filter(x=>x&&typeof x.key==='string'&&typeof x.label==='string'&&['kills','headshots','deaths','waves','wins','matches'].every(key=>Number.isFinite(x[key])&&x[key]>=0)).slice(0,200):[];}catch{return [];}}
export function saveBest(s:Snapshot,id:string){
 if(s.operation.config.kind==='multiplayer'||!s.matchId)return;const p=s.players.find(p=>p.id===id);if(!p)return;
 const c=s.operation.config,key=[s.mapId,c.kind,c.mode,c.difficulty,s.operation.condition,...(c.mode==='battle'?[c.battleStyle,c.battleStyle==='team'?4:c.enemies]:c.mode==='mission'?[c.mission]:[])].join(':'),records=readBests(),old=records.find(r=>r.key===key);
 const record:LocalBest={key,label:[getWorld(s.mapId).name,c.kind==='coop'?'Koop':'Einzelspieler',modeLabels[c.mode],difficultyLabels[c.difficulty],c.mode==='mission'?missionLabels[c.mission]:c.mode==='battle'?c.battleStyle==='team'?'4 gegen 4':`Allein gegen ${c.enemies}`:'',conditionLabels[s.operation.condition]].filter(Boolean).join(' · '),matches:(old?.matches??0)+1,wins:(old?.wins??0)+Number(s.operation.result==='success'),kills:Math.max(old?.kills??0,p.kills),headshots:Math.max(old?.headshots??0,p.headshots),deaths:Math.min(old?.deaths??p.deaths,p.deaths),waves:Math.max(old?.waves??0,s.operation.completedWaves),updated:new Date().toISOString()};
 try{localStorage.setItem(storageKey,JSON.stringify([record,...records.filter(r=>r.key!==key)].slice(0,200)));}catch{/* Bestwerte bleiben optional; voller Browser-Speicher unterbricht keinen Einsatz. */}
}
