import type {Snapshot} from '../shared/game';
export type ReplayFrame={snapshot:Snapshot;playerId:string};
export type Highlight={id:string;title:string;frames:ReplayFrame[]};
export class HighlightRecorder {
 private match='';
 private ring:ReplayFrame[]=[];
 private seen=new Set<string>();
 private pending:{clip:Highlight;until:number}[]=[];
 clips:Highlight[]=[];
 push(snapshot:Snapshot,playerId:string,ownership:'copy'|'immutable'='copy'){
  if(!snapshot.matchId||!['playing','finished'].includes(snapshot.phase))return;
  if(snapshot.matchId!==this.match){this.match=snapshot.matchId;this.ring=[];this.seen.clear();this.pending=[];this.clips=[];}
  const frame={snapshot:ownership==='immutable'?snapshot:structuredClone(snapshot),playerId};this.ring.push(frame);while(this.ring.length>200||this.ring[0]?.snapshot.now<snapshot.now-6000)this.ring.shift();
  for(const p of this.pending){p.clip.frames.push(frame);if(snapshot.now>=p.until||snapshot.phase==='finished'){this.clips=[p.clip,...this.clips].slice(0,3);}}
  this.pending=this.pending.filter(p=>snapshot.now<p.until&&snapshot.phase!=='finished');
  for(const e of snapshot.events){if(!e.eventId||this.seen.has(e.eventId))continue;this.seen.add(e.eventId);if(this.seen.size>2048)this.seen.delete(this.seen.values().next().value!);if(e.id!==playerId||!['kill','revive'].includes(e.type))continue;
   const title=e.type==='revive'?'Rettung':e.hitZone==='head'?'Kopftreffer':e.weapon===5?'Wurfstern-Treffer':'Abschuss';
   this.pending.push({clip:{id:e.eventId,title,frames:[...this.ring]},until:snapshot.now+4000});this.pending=this.pending.slice(-3);
  }
 }
 finish(){for(const p of this.pending)this.clips=[p.clip,...this.clips].slice(0,3);this.pending=[];return this.clips;}
}
