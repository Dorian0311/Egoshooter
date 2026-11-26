import type {Player,Snapshot} from './game.ts';
import type {Corpse,BodyPartItem} from './remains.ts';
type EntityDelta<T extends {id:string}>={id:string}&Partial<T>&{_clear?:(keyof T)[]};
export type SnapshotPacket={
 full?:Snapshot;
 patch?:Partial<Omit<Snapshot,'players'|'corpses'|'bodyParts'>>;
 players?:EntityDelta<Player>[];
 removed?:string[];
 corpses?:EntityDelta<Corpse>[];
 removedCorpses?:string[];
 bodyParts?:EntityDelta<BodyPartItem>[];
 removedBodyParts?:string[];
};
type WireFields=Map<string,string|undefined>;
type WireEntities=Map<string,WireFields>;
type WireSnapshot={root:WireFields;players:WireEntities;corpses:WireEntities;bodyParts:WireEntities};
const entityGroups=new Set(['players','corpses','bodyParts']);

function captureWire(current:Snapshot):WireSnapshot {
 const captureEntities=(entities:readonly {id:string}[]):WireEntities=>new Map(entities.map(entity=>[
  entity.id,new Map(Object.entries(entity).map(([key,value])=>[key,JSON.stringify(value)])),
 ]));
 const root:WireFields=new Map();
 for(const [key,value] of Object.entries(current))if(!entityGroups.has(key))root.set(key,JSON.stringify(value));
 return {root,players:captureEntities(current.players),corpses:captureEntities(current.corpses??[]),bodyParts:captureEntities(current.bodyParts??[])};
}

function entityDifference<T extends {id:string}>(previous:WireEntities,next:WireEntities,current:T[]){
 const changed:EntityDelta<T>[]=[];
 for(const entity of current){
  const before=previous.get(entity.id);
  if(!before){changed.push(entity);continue;}
  const now=next.get(entity.id)!;
  const delta={id:entity.id} as EntityDelta<T>,cleared:(keyof T)[]=[];
  for(const key of new Set([...before.keys(),...now.keys()])){
   if(before.get(key)===now.get(key)&&before.has(key)===now.has(key))continue;
   const field=key as keyof T;
   if(entity[field]===undefined)cleared.push(field);
   else Object.assign(delta,{[field]:entity[field]});
  }
  if(cleared.length)delta._clear=cleared;
  if(Object.keys(delta).length>1)changed.push(delta);
 }
 return {changed,removed:[...previous.keys()].filter(id=>!next.has(id))};
}
function applyEntities<T extends {id:string}>(previous:T[],changed:EntityDelta<T>[]|undefined,removed:string[]|undefined):T[]{
 if(!changed?.length&&!removed?.length)return previous;
 const deleted=new Set(removed),result=previous.filter(entity=>!deleted.has(entity.id));
 if(!changed?.length)return result;
 const indices=new Map(result.map((entity,index)=>[entity.id,index]));
 for(const delta of changed){
  const {_clear,...values}=delta;
  const index=indices.get(delta.id);
  const entity=index===undefined?values as T:{...result[index],...values};
  for(const key of _clear??[])Object.assign(entity,{[key]:undefined});
  if(index===undefined){indices.set(delta.id,result.length);result.push(entity);}
  else result[index]=entity;
 }
 return result;
}
function wireDifference(previous:WireSnapshot,next:WireSnapshot,current:Snapshot):SnapshotPacket{
 const patch:SnapshotPacket['patch']={};
 for(const [key,signature] of next.root)if(previous.root.get(key)!==signature)Object.assign(patch,{[key]:current[key as keyof Snapshot]});
 const players=entityDifference(previous.players,next.players,current.players),corpses=entityDifference(previous.corpses,next.corpses,current.corpses??[]),bodyParts=entityDifference(previous.bodyParts,next.bodyParts,current.bodyParts??[]);
 return {patch,players:players.changed,removed:players.removed,...(corpses.changed.length?{corpses:corpses.changed}:{}),...(corpses.removed.length?{removedCorpses:corpses.removed}:{}),...(bodyParts.changed.length?{bodyParts:bodyParts.changed}:{}),...(bodyParts.removed.length?{removedBodyParts:bodyParts.removed}:{} )};
}
export function difference(previous:Snapshot,current:Snapshot):SnapshotPacket{
 return wireDifference(captureWire(previous),captureWire(current),current);
}

/** Keep only immutable wire comparisons between broadcasts of the mutable game state. */
export function createSnapshotPublisher(send:(packet:SnapshotPacket)=>void){
 let previous:WireSnapshot|undefined;
 return (current:Snapshot)=>{
  const next=captureWire(current);
  send(previous?wireDifference(previous,next,current):{full:current});
  previous=next;
 };
}
/** Network snapshots share unchanged data. Treat current and previous snapshots as immutable. */
export function mergeSnapshot(previous:Snapshot|null,packet:SnapshotPacket):Snapshot|null{
 if(packet.full)return packet.full;if(!previous)return null;
 return {...previous,...packet.patch,players:applyEntities(previous.players,packet.players,packet.removed),corpses:applyEntities(previous.corpses??[],packet.corpses,packet.removedCorpses),bodyParts:applyEntities(previous.bodyParts??[],packet.bodyParts,packet.removedBodyParts)};
}
