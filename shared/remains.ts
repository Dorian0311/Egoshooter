import {makePlayer,hitPlayer,type Game,type Player,type Team} from './game';
import {armCount,eyePosition,freshInjuries,hasLost,isCrawling,limbBits,type BodyPart} from './injuries';
import {getWorld,ground,withinPlayArea} from './world';
import {safeNear,type Point} from './operations';
import type {UniformId} from './uniforms';
import {rockSurface} from './rocks';

export type LooseBodyPart=Exclude<BodyPart,'body'>;
export type Corpse=Point&{id:string;sourceId:string;sourceLife:number;name:string;uniform:UniformId;team:Team;kind:Player['kind'];yaw:number;pitch:number;crouching:boolean;createdAt:number;lost:number;carrierId:string|null;shield:number;harvesterId:string|null;harvestUntil:number;medicalUntil:number;tentId:string|null};
export type BodyPartItem=Point&{id:string;corpseId:string|null;sourceId:string;sourceLife:number;name:string;uniform:UniformId;team:Team;kind:Player['kind'];part:LooseBodyPart;yaw:number;pitch:number;roll:number;vx:number;vy:number;vz:number;spinX:number;spinY:number;spinZ:number;state:'ground'|'flying'|'held';carrierId:string|null;throwerId:string|null;spawnedAt:number};
export type AidTent=Point&{id:string;team:Team};
export const CORPSE_SHIELD=150,HARVEST_MS=3000,MEDICAL_MS=8000;
export function corpseHeadPoint(c:Corpse):Point{return {x:c.x+Math.sin(c.yaw)*1.5,y:c.y+.22,z:c.z+Math.cos(c.yaw)*1.5};}

/** Shared item ownership, life identities and ballistics; visual detail never decides combat. */
export class Remains {
 private fallingCorpses=new Map<string,number>();
 constructor(readonly game:Game){}
 reset(){this.fallingCorpses.clear();const s=this.game.state,w=getWorld(s.mapId);s.corpses=[];s.bodyParts=[];s.aidTents=(['de','fr'] as const).map(team=>{const spawn=w.spawns[team][0],point=safeNear(w,spawn[0]+(team==='de'?5:-5),spawn[1]+5);return {...point,id:`aid-${team}`,team};});}
 private id(p:Player){return `${this.game.state.matchId}:corpse:${p.id}:${p.life}`;}
 private point(p:Player){return {x:p.x-Math.sin(p.yaw)*.55,y:p.y+.2,z:p.z-Math.cos(p.yaw)*.55};}
 private corpse(id:string){return this.game.state.corpses.find(c=>c.id===id);}
 private item(id:string){return this.game.state.bodyParts.find(c=>c.id===id);}
 private support(x:number,z:number,ceiling:number){const world=this.game.world();let y=ground(x,z,world);for(const box of world.boxes){if(Math.abs(x-box.x)>box.w/2+.075||Math.abs(z-box.z)>box.d/2+.075)continue;const top=box.kind==='rock'?rockSurface(box,x,z):box.y+box.h/2;if(top<=ceiling+.01)y=Math.max(y,top);}return y;}
 private releaseReservation(p:Player){if(p.treatment?.kind==='harvest'){const corpse=this.corpse(p.treatment.target);if(corpse?.harvesterId===p.id){corpse.harvesterId=null;corpse.harvestUntil=0;}}p.treatment=undefined;}
 release(p:Player){this.dropPart(p);this.dropCorpse(p);this.releaseReservation(p);}
 recordDeath(p:Player){
  const s=this.game.state,id=this.id(p);this.dropPart(p);this.dropCorpse(p);this.releaseReservation(p);if(s.corpses.some(c=>c.id===id))return;
  s.corpses.push({id,sourceId:p.id,sourceLife:p.life,name:p.name,uniform:p.uniform,team:p.team,kind:p.kind,x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,crouching:p.crouching,createdAt:s.now,lost:p.injuries.lost,carrierId:null,shield:CORPSE_SHIELD,harvesterId:null,harvestUntil:0,medicalUntil:0,tentId:null});
  if(p.y>this.support(p.x,p.z,p.y+.05)+.05)this.fallingCorpses.set(id,p.vy);
  for(const item of s.bodyParts)if(item.sourceId===p.id&&item.sourceLife===p.life)item.corpseId=id;
 }
 sever(p:Player,part:BodyPart,point:[number,number,number],source:string,weapon:number){
  if(part==='body')return;const s=this.game.state,id=`${s.matchId}:part:${p.id}:${p.life}:${part}`;if(s.bodyParts.some(q=>q.id===id))return;
  const attacker=this.game.operation.actor(source),dx=attacker?point[0]-attacker.x:Math.sin(p.yaw),dz=attacker?point[2]-attacker.z:Math.cos(p.yaw),length=Math.max(.001,Math.hypot(dx,dz)),force=weapon===4?2.8:4.2;
  s.bodyParts.push({id,corpseId:s.corpses.some(c=>c.id===this.id(p))?this.id(p):null,sourceId:p.id,sourceLife:p.life,name:p.name,uniform:p.uniform,team:p.team,kind:p.kind,part,x:point[0],y:point[1],z:point[2],yaw:p.yaw,pitch:0,roll:0,vx:dx/length*force,vy:2.8,vz:dz/length*force,spinX:3.2,spinY:1.8,spinZ:part.startsWith('leg')?2.8:4.1,state:'flying',carrierId:null,throwerId:null,spawnedAt:s.now});
  if(armCount(p)<1){this.dropPart(p);this.dropCorpse(p);}
 }
 interact(p:Player,value:string):boolean|undefined{
  if(!/^(part:|corpse:|tent:)/.test(value))return undefined;
  if(p.kind!=='human'||!p.hp||!p.connected||p.departed||p.treatment)return false;
  if(value==='part:drop')return this.dropPart(p);
  if(value==='corpse:drop')return this.dropCorpse(p);
  if(value.startsWith('part:pickup:')){const item=this.item(value.slice(12));if(!item||item.state==='held'||item.carrierId||armCount(p)<1||!this.game.operation.inReach(p,item))return false;this.dropPart(p);this.dropCorpse(p);item.state='held';item.carrierId=p.id;item.throwerId=null;item.vx=item.vy=item.vz=0;p.heldPart=item.id;this.game.emit({type:'part-pickup',id:p.id,target:item.id,bodyPart:item.part,weapon:6,point:[item.x,item.y,item.z]});return true;}
  if(value.startsWith('corpse:carry:')){const corpse=this.corpse(value.slice(13));if(!corpse||corpse.carrierId||corpse.harvesterId||corpse.medicalUntil||armCount(p)<1||isCrawling(p)||!this.game.operation.inReach(p,corpse))return false;this.dropCorpse(p);this.dropPart(p);corpse.carrierId=p.id;p.carriedCorpse=corpse.id;p.corpseShield=corpse.shield;p.sprinting=false;p.weapon=1;p.ammo=p.ammoByWeapon[1];this.game.emit({type:'corpse-carry',id:p.id,target:corpse.id});return true;}
  if(value.startsWith('corpse:harvest:')){const corpse=this.corpse(value.slice(15));if(!corpse||corpse.carrierId||corpse.harvesterId||corpse.medicalUntil||corpse.lost&1||armCount(p)<1||p.carriedCorpse||!this.game.operation.inReach(p,corpseHeadPoint(corpse)))return false;const head=corpseHeadPoint(corpse);corpse.harvesterId=p.id;corpse.harvestUntil=this.game.state.now+HARVEST_MS;p.treatment={kind:'harvest',target:corpse.id,targetLife:corpse.sourceLife,started:this.game.state.now,until:corpse.harvestUntil,x:p.x,z:p.z};this.game.emit({type:'harvest-start',id:p.id,target:corpse.id,bodyPart:'head',point:[head.x,head.y,head.z]});return true;}
  if(value.startsWith('tent:deposit:'))return this.deposit(p,value.slice(13));
  return false;
 }
 dropPart(p:Player){const item=p.heldPart?this.item(p.heldPart):undefined;p.heldPart=null;if(!item||item.carrierId!==p.id)return false;const q=this.point(p),floor=this.support(q.x,q.z,p.y+.3),falling=p.y-floor>.3;Object.assign(item,q,{y:falling?q.y:floor+.10,state:falling?'flying':'ground',carrierId:null,throwerId:null,vx:0,vy:0,vz:0,spawnedAt:this.game.state.now});return true;}
 dropCorpse(p:Player){const corpse=p.carriedCorpse?this.corpse(p.carriedCorpse):undefined;p.carriedCorpse=null;p.corpseShield=0;if(!corpse||corpse.carrierId!==p.id)return false;const q=this.point(p),floor=this.support(q.x,q.z,p.y+.3),falling=p.y-floor>.3;Object.assign(corpse,q,{y:falling?p.y:floor,yaw:p.yaw,carrierId:null});if(falling)this.fallingCorpses.set(corpse.id,0);else this.fallingCorpses.delete(corpse.id);this.game.emit({type:'corpse-drop',id:p.id,target:corpse.id});return true;}
 throwPart(p:Player){const s=this.game.state,item=p.heldPart?this.item(p.heldPart):undefined;if(!item||item.carrierId!==p.id||!p.hp||armCount(p)<1||p.treatment||s.now<p.throwAt)return false;
  const eye=eyePosition(p),direction=[-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch)],speed=item.part==='head'?13:item.part.startsWith('leg')?10:12;
  const offset=.32,allowed=Math.min(offset,Math.max(0,this.game.operation.obstacleDistance([eye.x,eye.y,eye.z],direction,.06)-.04));
  Object.assign(item,{x:eye.x+direction[0]*allowed,y:eye.y+direction[1]*allowed-.12,z:eye.z+direction[2]*allowed,vx:direction[0]*speed,vy:direction[1]*speed+1.3,vz:direction[2]*speed,state:'flying',carrierId:null,throwerId:p.id,spawnedAt:s.now,pitch:0,roll:0,spinX:7.5,spinY:2.3,spinZ:3.1});p.heldPart=null;p.throwAt=s.now+850;p.protectedUntil=0;this.game.emit({type:'part-throw',id:p.id,target:item.id,bodyPart:item.part,weapon:6,point:[item.x,item.y,item.z]});return true;
 }
 swing(p:Player,now:number){const item=p.heldPart?this.item(p.heldPart):undefined;if(!item||item.carrierId!==p.id||p.fireAt>now||p.treatment||!p.hp||armCount(p)<1)return false;p.fireAt=now+800;p.protectedUntil=0;const range=item.part==='head'?1.65:item.part.startsWith('leg')?2.65:2.25,origin=eyePosition(p);let nearest=range,target:Player|undefined;
  for(const q of this.game.operation.actors()){if(q.id===p.id||!q.hp)continue;const dx=q.x-origin.x,dy=q.y+(isCrawling(q)?.3:1)-origin.y,dz=q.z-origin.z,length=Math.hypot(dx,dy,dz);if(length>nearest||length<.001||(-Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz)/Math.max(.001,Math.hypot(dx,dz))<.3||this.game.operation.obstacleDistance([origin.x,origin.y,origin.z],[dx/length,dy/length,dz/length])<length-.2)continue;nearest=length;target=q;}
  this.game.emit({type:'part-melee',id:p.id,target:item.id,weapon:6,bodyPart:item.part});if(target)this.game.operation.damage(target,p.id,6,item.part.startsWith('leg')?40:item.part==='head'?30:32,'body',[target.x,target.y+1,target.z]);return true;
 }
 absorb(p:Player,source:string,damage:number,point:[number,number,number]){const corpse=p.carriedCorpse?this.corpse(p.carriedCorpse):undefined,attacker=this.game.operation.actor(source);if(!corpse||corpse.carrierId!==p.id||corpse.shield<=0||!attacker)return damage;const dx=attacker.x-p.x,dz=attacker.z-p.z,length=Math.hypot(dx,dz);if(length<.01||(-Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz)/length<.25)return damage;const absorbed=Math.min(damage,corpse.shield);corpse.shield-=absorbed;p.corpseShield=corpse.shield;p.treatment=undefined;this.game.emit({type:'shield',id:source,target:p.id,damage:absorbed,point});return damage-absorbed;}
 updateHarvest(p:Player){const t=p.treatment;if(t?.kind!=='harvest')return;const s=this.game.state,corpse=this.corpse(t.target),input=s.now-(this.game.received.get(p.id)??0)<300?this.game.inputs.get(p.id):undefined;
  if(!p.hp||!p.connected||p.departed||armCount(p)<1||!corpse||corpse.harvesterId!==p.id||corpse.sourceLife!==t.targetLife||corpse.lost&1||corpse.carrierId||corpse.medicalUntil||!this.game.operation.inReach(p,corpseHeadPoint(corpse))||Math.hypot(p.x-t.x,p.z-t.z)>.15||p.injuries.lastDamageAt>t.started||input&&(input.fire||Math.hypot(input.forward,input.side)>.01)){this.releaseReservation(p);return;}
  if(s.now<t.until)return;corpse.lost|=1;corpse.harvesterId=null;corpse.harvestUntil=0;p.treatment=undefined;const head=corpseHeadPoint(corpse),source={...makePlayer(corpse.sourceId,corpse.name,corpse.team),life:corpse.sourceLife,uniform:corpse.uniform,kind:corpse.kind};this.sever(source,'head',[head.x,head.y,head.z],p.id,6);const item=s.bodyParts.find(i=>i.sourceId===corpse.sourceId&&i.sourceLife===corpse.sourceLife&&i.part==='head');if(item){this.dropPart(p);Object.assign(item,{corpseId:corpse.id,state:'held',carrierId:p.id,throwerId:null,vx:0,vy:0,vz:0});p.heldPart=item.id;}this.game.emit({type:'harvest',id:p.id,target:corpse.id,weapon:6,bodyPart:'head',point:[head.x,head.y,head.z]});
 }
 private deposit(p:Player,id:string){const s=this.game.state,tent=s.aidTents.find(t=>t.id===id),corpse=p.carriedCorpse?this.corpse(p.carriedCorpse):undefined,patient=corpse?this.game.player(corpse.sourceId):undefined;if(s.operation.config.kind!=='coop'||!tent||tent.team!==p.team||!corpse||corpse.carrierId!==p.id||corpse.kind!=='human'||corpse.team!==p.team||!patient||patient.hp>0||!patient.connected||patient.departed||patient.life!==corpse.sourceLife||!this.game.operation.inReach(p,tent))return false;
  p.carriedCorpse=null;p.corpseShield=0;Object.assign(corpse,{x:tent.x,y:tent.y,z:tent.z,carrierId:null,tentId:tent.id,medicalUntil:s.now+MEDICAL_MS});this.game.emit({type:'medical-start',id:p.id,target:corpse.id,point:[tent.x,tent.y,tent.z]});return true;
 }
 hasPendingRecovery(){const s=this.game.state;return s.corpses.some(c=>{const p=this.game.player(c.sourceId);return c.medicalUntil>s.now&&p?.connected&&!p.departed&&!p.hp&&p.life===c.sourceLife;});}
 update(dt:number){const g=this.game,s=g.state,w=getWorld(s.mapId);
  for(const [id,velocity]of this.fallingCorpses){const corpse=this.corpse(id);if(!corpse||corpse.carrierId||corpse.medicalUntil){this.fallingCorpses.delete(id);continue;}const step=Math.min(.1,Math.max(0,dt)),floor=this.support(corpse.x,corpse.z,corpse.y+.01),speed=velocity-9.8*step;corpse.y=Math.max(floor,corpse.y+speed*step);if(corpse.y<=floor)this.fallingCorpses.delete(id);else this.fallingCorpses.set(id,speed);}
  for(const p of g.operation.actors()){if(!p.hp||!p.connected||p.departed||armCount(p)<1){this.dropPart(p);this.dropCorpse(p);}if(p.carriedCorpse)p.corpseShield=this.corpse(p.carriedCorpse)?.shield??0;}
  for(const corpse of [...s.corpses]){if(corpse.harvesterId){const p=g.player(corpse.harvesterId);if(!p?.treatment||p.treatment.kind!=='harvest'||p.treatment.target!==corpse.id){corpse.harvesterId=null;corpse.harvestUntil=0;}}
   if(!corpse.medicalUntil)continue;const patient=g.player(corpse.sourceId),tent=s.aidTents.find(t=>t.id===corpse.tentId);if(!patient||!patient.connected||patient.departed||patient.hp>0||patient.life!==corpse.sourceLife||!tent){corpse.medicalUntil=0;corpse.tentId=null;continue;}if(s.now<corpse.medicalUntil)continue;
   const fresh=makePlayer(patient.id,patient.name,patient.team,0,w);Object.assign(patient,fresh,{x:tent.x,y:tent.y,z:tent.z,life:patient.life+1,uniform:patient.uniform,ready:true,kills:patient.kills,deaths:patient.deaths,headshots:patient.headshots,stars:patient.stars,bandages:patient.bandages,seq:patient.seq,protectedUntil:s.now+2000,injuries:freshInjuries()});g.inputs.delete(patient.id);s.corpses=s.corpses.filter(c=>c.id!==corpse.id);g.emit({type:'medical-revive',id:patient.id,target:patient.id,point:[tent.x,tent.y,tent.z]});
  }
  for(const item of s.bodyParts){if(item.state!=='flying')continue;const duration=Math.min(.1,Math.max(0,dt));for(let remaining=duration;remaining>0&&item.state==='flying';){const h=Math.min(remaining,1/60);remaining-=h;const origin=[item.x,item.y,item.z],delta=[item.vx*h,(item.vy-4.9*h)*h,item.vz*h],length=Math.hypot(...delta);if(length<1e-8)continue;const direction=delta.map(n=>n/length);let distance=Math.min(length,g.operation.obstacleDistance(origin,direction,.075)),target:Player|undefined,part:BodyPart='body',terrainHit=false;
    if(item.throwerId)for(const q of g.operation.actors()){if(!q.hp||q.id===item.throwerId)continue;const hit=hitPlayer(origin,direction,q);if(hit&&hit.distance<distance){distance=hit.distance;target=q;part=hit.part;}}
    for(let i=1;i<=Math.ceil(length/.12);i++){const d=Math.min(distance,i*.12);if(item.y+direction[1]*d<=ground(item.x+direction[0]*d,item.z+direction[2]*d,w)+.1){distance=d;terrainHit=true;break;}if(d>=distance)break;}
    item.x+=direction[0]*distance;item.y+=direction[1]*distance;item.z+=direction[2]*distance;item.vy-=9.8*h;item.pitch+=item.spinX*h;item.yaw+=item.spinY*h;item.roll+=item.spinZ*h;
    if(target){g.operation.damage(target,item.throwerId!,6,item.part.startsWith('leg')?40:item.part==='head'?35:30,part,[item.x,item.y,item.z]);item.throwerId=null;item.vx*=-.15;item.vz*=-.15;item.vy=1;}
    const blocked=distance<length-.00001&&!target,top=blocked&&!terrainHit&&item.vy<0?g.world().boxes.find(b=>Math.abs(item.x-b.x)<b.w/2+.075&&Math.abs(item.z-b.z)<b.d/2+.075&&Math.abs(item.y-(b.y+b.h/2+.075))<.11):undefined;
    if(terrainHit&&!target||top||item.y<=ground(item.x,item.z,w)+.10||!withinPlayArea(item.x,item.z,w)||s.now-item.spawnedAt>10000){item.y=top?top.y+top.h/2+.10:ground(item.x,item.z,w)+.10;item.state='ground';item.vx=item.vy=item.vz=0;item.throwerId=null;item.pitch=Math.PI/2;item.roll=0;}
    else if(blocked){item.x-=direction[0]*.01;item.y-=direction[1]*.01;item.z-=direction[2]*.01;item.vx*= -.22;item.vz*= -.22;item.vy*=.35;item.throwerId=null;}

   }
  }
 }
}
