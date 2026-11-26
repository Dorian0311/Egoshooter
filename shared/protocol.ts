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
const sameWireValue=(before:unknown,after:unknown)=>Object.is(before,after)||JSON.stringify(before)===JSON.stringify(after);
function entityDifference<T extends {id:string}>(previous:T[],current:T[]){
 const old=new Map(previous.map(entity=>[entity.id,entity])),ids=new Set(current.map(entity=>entity.id)),changed:EntityDelta<T>[]=[];
 for(const entity of current){const before=old.get(entity.id);if(!before){changed.push(entity);continue;}const delta={id:entity.id} as EntityDelta<T>,cleared:(keyof T)[]=[];for(const key of new Set([...Object.keys(before),...Object.keys(entity)]) as Set<keyof T>)if(!sameWireValue(before[key],entity[key])||Object.hasOwn(entity,key)!==Object.hasOwn(before,key)){if(entity[key]===undefined)cleared.push(key);else Object.assign(delta,{[key]:entity[key]});}if(cleared.length)delta._clear=cleared;if(Object.keys(delta).length>1)changed.push(delta);}
 return {changed,removed:previous.filter(entity=>!ids.has(entity.id)).map(entity=>entity.id)};
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
export function difference(previous:Snapshot,current:Snapshot):SnapshotPacket{
 const patch:SnapshotPacket['patch']={};
 for(const key of Object.keys(current) as (keyof Snapshot)[]){if(key==='players'||key==='corpses'||key==='bodyParts')continue;if(!sameWireValue(previous[key],current[key]))Object.assign(patch,{[key]:current[key]});}
 const players=entityDifference(previous.players,current.players),corpses=entityDifference(previous.corpses??[],current.corpses??[]),bodyParts=entityDifference(previous.bodyParts??[],current.bodyParts??[]);
 return {patch,players:players.changed,removed:players.removed,...(corpses.changed.length?{corpses:corpses.changed}:{}),...(corpses.removed.length?{removedCorpses:corpses.removed}:{}),...(bodyParts.changed.length?{bodyParts:bodyParts.changed}:{}),...(bodyParts.removed.length?{removedBodyParts:bodyParts.removed}:{} )};
}
/** Network snapshots share unchanged data. Treat current and previous snapshots as immutable. */
export function mergeSnapshot(previous:Snapshot|null,packet:SnapshotPacket):Snapshot|null{
 if(packet.full)return packet.full;if(!previous)return null;
 return {...previous,...packet.patch,players:applyEntities(previous.players,packet.players,packet.removed),corpses:applyEntities(previous.corpses??[],packet.corpses,packet.removedCorpses),bodyParts:applyEntities(previous.bodyParts??[],packet.bodyParts,packet.removedBodyParts)};
}
