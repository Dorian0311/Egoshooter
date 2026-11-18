import {makePlayer,move,neutral,hitPlayer,rayBox,type Game,type Player,type Team,type GameEvent} from './game';
import {getWorld,ground,withinPlayArea,type World} from './world';
import {wandererPose} from './wanderers';
import {residentCast,residentName} from './residentProfiles';
import {rockBlocks,rayRock} from './rocks';
import {freshInjuries,armCount,eyeHeight,eyePosition,isCrawling,hasLost,limbBits,type BodyPart} from './injuries';
import {parseOperation,type OperationConfig,type Condition} from './operationConfig';
import {Remains} from './remains';
import {weapons} from './weapons';

export type Point={x:number;y:number;z:number};
type BotNoise={point:Point;team:Team;range:number;decoy:boolean};
export type Pickup=Point&{id:string;kind:'gift'|'bandage';taken:boolean};
export type Projectile=Point&{id:string;owner:string;life:number;vx:number;vy:number;vz:number;spawnedAt:number;expires:number};
export type Treatment={kind:'bandage'|'revive'|'sabotage'|'harvest';target:string;targetLife?:number;started:number;until:number;x:number;z:number};
export const MEDKIT_HEAL=50,MEDKIT_DURATION=4000;
export type OperationState={config:OperationConfig;condition:Condition;wave:number;completedWaves:number;remaining:number;nextWaveAt:number;result:'success'|'failure'|null;paused:boolean;objective:{point:Point;extract:Point;stage:'target'|'extract'|'complete';progress:number}};
const safeCache=new Map<World,Point[]>();
export function walkable(world:World,x:number,y:number,z:number){
 return withinPlayArea(x,z,world)&&ground(x,z,world)>-3.5&&!world.boxes.some(b=>b.kind==='rock'?rockBlocks(b,x,y,z,1.75,.4):y+1.75>b.y-b.h/2+.04&&y<b.y+b.h/2-.29&&Math.abs(x-b.x)<b.w/2+.4&&Math.abs(z-b.z)<b.d/2+.4);
}
export function safePoints(world:World){
 let points=safeCache.get(world);if(points)return points;
 points=[];const extent=(world.playArea?.halfSize??73)-5;
 for(let x=-extent;x<=extent;x+=8)for(let z=-extent;z<=extent;z+=8){const y=ground(x,z,world);if(walkable(world,x,y,z))points.push({x,y,z});}
 if(!points.length)throw Error('Keine begehbaren Einsatzpunkte auf dieser Karte');
 safeCache.set(world,points);return points;
}
export function safeNear(world:World,x:number,z:number){return safePoints(world).reduce((a,b)=>Math.hypot(a.x-x,a.z-z)<Math.hypot(b.x-x,b.z-z)?a:b);}
export function createOperation(config:unknown,world:World,random:()=>number):OperationState{
 const c=parseOperation(config),conditions:Condition[]=['standard','fog','night','routes'];
 return {config:c,condition:c.condition==='random'?conditions[Math.min(3,Math.floor(random()*4))]:c.condition,wave:0,completedWaves:0,remaining:0,nextWaveAt:0,result:null,paused:false,objective:{point:{...safeNear(world,24,12)},extract:{...safeNear(world,...world.spawns.de[0] as [number,number])},stage:'target',progress:0}};
}
export function initialPickups(world:World):Pickup[]{
 const points=safePoints(world).filter(p=>[...world.spawns.de,...world.spawns.fr].every(s=>Math.hypot(p.x-s[0],p.z-s[1])>12));
 return Array.from({length:12},(_,i)=>({...points[Math.floor((i+.5)*points.length/12)],id:`pickup-${i}`,kind:i%3!==2?'gift':'bandage',taken:false}));
}
export class Operation {
 readonly remains:Remains;
 private projectileSequence=0;
 private waveSpawned=0;
 private waveDefeated=0;
 private participants=1;
 private lastTick=0;
 private residentTime=new Map<string,number>();
 private nextGesture=new Map<string,number>();
 private botNoises:BotNoise[]=[];
 constructor(readonly game:Game){this.remains=new Remains(game);}
 get config(){return this.game.state.operation.config;}
 get pve(){return this.config.kind!=='multiplayer';}
 get humans(){return this.game.state.players.filter(p=>p.kind==='human'&&!p.departed);}
 actors(){return [...this.game.state.players,...this.game.state.npcs];}
 actor(id:string){return this.game.player(id)??this.game.state.npcs.find(p=>p.id===id);}
 recordNoise(event:GameEvent){
  if(!this.pve||this.game.state.phase!=='playing')return;
  const decoy=event.type==='impact'&&event.weapon===6;
  if(!decoy&&event.type!=='shot'&&event.type!=='throw'&&event.type!=='melee')return;
  const source=this.actor(event.id);
  if(!source||decoy&&!event.point)return;
  const [x,y,z]=decoy?event.point!:[source.x,source.y,source.z];
  this.botNoises.push({point:{x,y,z},team:source.team,range:decoy?32:event.type==='shot'?60:14,decoy});
  if(this.botNoises.length>64)this.botNoises.shift();
 }
 takeBotNoises(){return this.botNoises.splice(0);}
 configureBots(){
  if(!this.pve)return;
  const g=this.game,s=g.state;s.players=s.players.filter(p=>p.kind!=='bot');
  const allies=this.config.mode==='battle'&&this.config.battleStyle==='team'?3:0;
  const enemies=this.config.mode==='training'?1:this.config.mode==='battle'?this.config.enemies:4;
  for(let n=0;n<allies+enemies;n++){const p=g.add(`bot-${n}`,n<allies?`Verbündeter ${n+1}`:`Gegner ${n-allies+1}`);p.kind='bot';p.team=n<allies?'de':'fr';const fresh=makePlayer(p.id,p.name,p.team,n,getWorld(s.mapId));Object.assign(p,fresh,{kind:'bot',ready:true});}
 }
 onStart(){
  const g=this.game,s=g.state,o=s.operation,w=getWorld(s.mapId);this.lastTick=s.now;this.participants=this.humans.length;
  o.wave=o.completedWaves=o.remaining=o.nextWaveAt=0;o.result=null;o.paused=false;o.objective.stage='target';o.objective.progress=0;
  s.pickups=initialPickups(w);s.projectiles=[];s.npcs=[];this.residentTime.clear();this.nextGesture.clear();this.botNoises=[];
  this.remains.reset();
  if(w.id==='cologne'||w.id==='alpine')for(let n=0;n<residentCast.length;n++){const id=`resident-${n}`,p=makePlayer(id,residentName(id),'de',n,w);Object.assign(p,{kind:'resident',protectedUntil:0});s.npcs.push(p);this.residentTime.set(p.id,0);this.nextGesture.set(p.id,s.now+6000+n*3500);}
  if(o.condition==='routes'&&s.interiors){for(const key of Object.keys(s.interiors.doors))s.interiors.doors[key]=!key.endsWith('--1');}
  if(!this.pve)return;
  s.persistence='practice';
  if(this.config.mode==='training'||this.config.mode==='survival')s.endsAt=0;
  if(this.config.mode==='mission')s.endsAt=s.now+480000;
  if(this.config.mode==='training'){const human=this.humans[0],bot=s.players.find(p=>p.kind==='bot');if(human&&bot)Object.assign(bot,safeNear(w,human.x+16,human.z));}
  if(this.config.mode==='mission'||this.config.mode==='battle'){
   const enemies=s.players.filter(p=>p.kind==='bot'&&p.team==='fr'),placed:Point[]=[];
   for(const [index,bot] of enemies.entries()){
    const point=this.enemyStart(w,index,placed);
    Object.assign(bot,point);
    placed.push(point);
   }
  }
  if(this.config.mode==='survival')this.startWave();
 }
 private enemyStart(world:World,index:number,occupied:Point[]){
  const humans=this.humans.filter(p=>p.connected&&p.hp>0);
  const origin=world.spawns.fr[index%world.spawns.fr.length],points=safePoints(world);
  let best=points[0],bestScore=-Infinity;
  for(const point of points){
   const fromHumans=Math.min(...humans.map(p=>Math.hypot(point.x-p.x,point.z-p.z)));
   const fromBots=Math.min(...occupied.map(p=>Math.hypot(point.x-p.x,point.z-p.z)));
   const score=-Math.hypot(point.x-origin[0],point.z-origin[1])
    -Math.max(0,25-fromHumans)*10-Math.max(0,16-fromBots)*10;
   if(score>bestScore){best=point;bestScore=score;}
  }
  return best;
 }
 private startWave(){
  const s=this.game.state,o=s.operation;o.wave++;o.nextWaveAt=0;this.waveDefeated=this.waveSpawned=0;
  o.remaining=[2,4,6,8,10][o.wave-1]*(this.config.kind==='coop'?this.participants:1);
  for(const p of s.players.filter(p=>p.kind==='bot'&&p.team==='fr')){p.hp=0;p.respawnAt=Number.MAX_SAFE_INTEGER;p.connected=false;}
  this.fillWave();
 }
 private spawn(p:Player,index:number){
  const s=this.game.state,w=getWorld(s.mapId),occupied=s.players.filter(q=>q.kind==='bot'&&q.team===p.team&&q.hp>0&&q.connected);
  const point=this.enemyStart(w,index,occupied);
  const fresh=makePlayer(p.id,p.name,p.team,index,w);
  Object.assign(p,fresh,point,{kind:'bot',life:p.life+1,seq:p.seq,ready:true,connected:true,kills:p.kills,deaths:p.deaths,headshots:p.headshots,protectedUntil:s.now+2000});
  this.game.inputs.delete(p.id);
 }
 private fillWave(){
  const s=this.game.state,total=[2,4,6,8,10][s.operation.wave-1]*(this.config.kind==='coop'?this.participants:1);
  for(const p of s.players.filter(p=>p.kind==='bot'&&p.team==='fr'&&!p.hp))if(this.waveSpawned<total&&(!p.connected||s.now>=p.respawnAt)){this.spawn(p,this.waveSpawned++);}
 }
 beforeTick(now:number){
  const g=this.game,s=g.state,dt=Math.min(.1,Math.max(0,(now-this.lastTick)/1000));this.lastTick=now;
  for(const p of this.actors()){
   if(p.downedUntil&&now>=p.downedUntil){p.downedUntil=0;this.finalDeath(p,p.injuries.source,p.injuries.weapon,'body',[p.x,p.y+.4,p.z]);}
   if(p.hp>0&&p.injuries.bleeding){p.hp=Math.max(0,p.hp-5*dt*this.woundCount(p));if(!p.hp)this.fall(p,p.injuries.source,p.injuries.weapon,'body',[p.x,p.y+eyeHeight(p),p.z]);}
   this.updateTreatment(p);
  }
  for(let n=0;n<s.npcs.length;n++){const p=s.npcs[n];if(!p.hp)continue;const t=(this.residentTime.get(p.id)??0)+dt*(p.gestureUntil>now?0:isCrawling(p)?.3:1);this.residentTime.set(p.id,t);const pose=wandererPose(n,t);const dx=pose.x-p.x,dz=pose.z-p.z;
   if(t<.2){p.x=pose.x;p.z=pose.z;p.y=ground(p.x,p.z,getWorld(s.mapId));}
   else if(now>=(this.nextGesture.get(p.id)??Infinity)&&!isCrawling(p)&&armCount(p)>0){const observer=this.humans.find(q=>q.hp>0&&Math.hypot(q.x-p.x,q.z-p.z)<16);if(observer){p.gestureUntil=now+2200;p.yaw=Math.atan2(p.x-observer.x,p.z-observer.z);this.nextGesture.set(p.id,now+24000+n*2100);}else this.nextGesture.set(p.id,now+2000);}
   if(pose.walking&&p.gestureUntil<=now&&t>=.2)move(p,{...neutral(p.seq+1),forward:.2,yaw:Math.atan2(-dx,-dz),time:now},Math.min(dt,1/30),g.world(),now);
  }
  this.updateProjectiles(dt);
  this.remains.update(dt);
 }
 afterTick(){
  const g=this.game,s=g.state,o=s.operation;if(!this.pve||s.phase!=='playing')return;
  if(['survival','mission'].includes(this.config.mode)&&!this.humans.some(p=>p.hp>0&&p.connected)&&!this.remains.hasPendingRecovery()){this.finish(false);return;}
  if(this.config.mode==='survival'){
   if(o.nextWaveAt){if(s.now>=o.nextWaveAt){for(const p of this.humans){p.ammoByWeapon=weapons.map(w=>w.mag);p.ammo=p.ammoByWeapon[p.weapon];}this.startWave();}return;}
   o.remaining=[2,4,6,8,10][o.wave-1]*(this.config.kind==='coop'?this.participants:1)-this.waveDefeated;
   if(!o.remaining){o.completedWaves=o.wave;if(o.wave===5)this.finish(true);else o.nextWaveAt=s.now+10000;}else this.fillWave();
  }
  if(this.config.mode==='mission'){
   const objective=o.objective,point=objective.stage==='extract'?objective.extract:objective.point;
   if(this.config.mission==='hold'&&this.humans.some(p=>p.hp>0&&Math.hypot(p.x-point.x,p.z-point.z)<5)&&!s.players.some(p=>p.kind==='bot'&&p.hp>0&&Math.hypot(p.x-point.x,p.z-point.z)<7))objective.progress=Math.min(90000,objective.progress+1000/30);
   if(this.config.mission==='hold'&&objective.progress>=90000)this.finish(true);
   if(objective.stage==='extract'&&this.humans.some(p=>p.hp>0&&Math.hypot(p.x-point.x,p.z-point.z)<3))this.finish(true);
   if(s.now>=s.endsAt)this.finish(false);
  }
 }
 finish(success:boolean){const s=this.game.state;if(s.phase==='finished')return;s.phase='finished';s.winner=success?'de':'fr';s.operation.result=success?'success':'failure';s.persistence='practice';if(success&&this.config.mode==='mission')s.operation.objective.stage='complete';}
 private woundCount(p:Player){return [2,4,8,16].filter(bit=>p.injuries.bleeding&bit).length;}
 damage(target:Player,source:string,weapon:number,damage:number,part:BodyPart,point:[number,number,number],saw=false,origin?:Pick<Point,'x'|'z'>){
  const g=this.game,s=g.state,attacker=this.actor(source);if(!target.hp||target.protectedUntil>s.now&&source!==''||target.id===source||target.kind!=='resident'&&attacker?.team===target.team)return false;
  const bit=limbBits[part];if(bit&&target.injuries.lost&bit)return false;
  damage=this.remains.absorb(target,source,damage,point);if(damage<=0)return true;
  const healthLoss=saw&&part==='head'?target.hp:Math.min(target.hp,damage);
  target.injuries.lastDamageAt=s.now;target.hp-=healthLoss;target.treatment=undefined;
  const zone=part==='head'?'head':part.startsWith('leg')?'legs':'body';
  const from=origin??attacker,dx=from?from.x-point[0]:0,dz=from?from.z-point[2]:0;
  const bearing=Math.hypot(dx,dz)>.0001?Math.atan2(dx,-dz):undefined;
  g.emit({type:'hit',id:source,target:target.id,weapon,damage,healthLoss,bearing,hitZone:zone,bodyPart:part,point});
  target.injuries.damage[part]=(target.injuries.damage[part]??0)+damage;
  if(part!=='body'&&(saw||part==='head'&&!target.hp||part!=='head'&&target.injuries.damage[part]!>=45)){
   target.injuries.lost|=bit;if(part!=='head')target.injuries.bleeding|=bit;
   target.injuries.source=source;target.injuries.weapon=weapon;
   this.remains.sever(target,part,point,source,weapon);
   g.emit({type:'sever',id:source,target:target.id,weapon,bodyPart:part,hitZone:zone,point});
  }
  if(!target.hp)this.fall(target,source,weapon,part,point);
  return true;
 }
 private fall(p:Player,source:string,weapon:number,part:BodyPart,point:[number,number,number]){
  const s=this.game.state;p.injuries.source=source;p.injuries.weapon=weapon;
  if(this.config.kind==='coop'&&p.kind==='human'&&part!=='head'&&!p.downedUntil){p.downedUntil=s.now+30000;p.respawnAt=Number.MAX_SAFE_INTEGER;p.injuries.bleeding=0;this.game.emit({type:'down',id:source,target:p.id,weapon,point});return;}
  this.finalDeath(p,source,weapon,part,point);
 }
 private finalDeath(p:Player,source:string,weapon:number,part:BodyPart,point:[number,number,number]){
  const g=this.game,s=g.state,attacker=this.actor(source);p.hp=0;p.downedUntil=0;p.diedAt=s.now;p.deaths++;p.injuries.bleeding=0;
  this.remains.recordDeath(p);
  p.respawnAt=p.kind==='resident'||p.kind==='human'&&['survival','mission'].includes(this.config.mode)?Number.MAX_SAFE_INTEGER:s.now+5000;
  if(p.kind!=='resident'&&attacker&&attacker.id!==p.id&&attacker.team!==p.team){attacker.kills++;if(part==='head')attacker.headshots++;s.scores[attacker.team]++;}
  if(this.config.mode==='survival'&&p.kind==='bot'&&p.team==='fr')this.waveDefeated++;
  g.emit({type:'kill',id:source,target:p.id,weapon,bodyPart:part,hitZone:part==='head'?'head':part.startsWith('leg')?'legs':'body',point});
 }
 interact(p:Player,value:string):boolean|undefined{
  const g=this.game,s=g.state;if(!p.hp||!p.connected||s.phase!=='playing')return false;
  if(p.kind!=='human')return /^(throw|bandage|pickup-|revive:|heal:|objective|part:|corpse:|tent:)/.test(value)?false:undefined;
  const remains=this.remains.interact(p,value);if(remains!==undefined)return remains;
  if(value==='throw')return p.heldPart?this.remains.throwPart(p):this.throwStar(p);
  if(value==='bandage'||value.startsWith('heal:')){const target=value==='bandage'?p:g.player(value.slice(5));if(p.bandages<1||!target||!target.hp||target.departed||!target.connected||target.team!==p.team||target.kind==='resident'||target.hp>=100&&!target.injuries.bleeding||p.treatment||target!==p&&!this.inReach(p,target))return false;p.treatment={kind:'bandage',target:target.id,targetLife:target.life,started:s.now,until:s.now+MEDKIT_DURATION,x:p.x,z:p.z};return true;}
  if(value.startsWith('pickup-')){const pickup=s.pickups.find(q=>q.id===value);if(!pickup||pickup.taken||!this.inReach(p,pickup))return false;pickup.taken=true;if(pickup.kind==='gift')p.stars+=3;else p.bandages++;g.emit({type:'pickup',id:p.id,target:pickup.id,point:[pickup.x,pickup.y,pickup.z]});return true;}
  if(value.startsWith('revive:')){const target=g.player(value.slice(7));if(this.config.kind!=='coop'||!target?.downedUntil||target.downedUntil<=s.now||target.team!==p.team||!this.inReach(p,target)||p.treatment)return false;p.treatment={kind:'revive',target:target.id,targetLife:target.life,started:s.now,until:s.now+4000,x:p.x,z:p.z};return true;}
  if(value==='objective'&&this.config.mode==='mission'){
   const o=s.operation.objective;if(o.stage!=='target'||!this.inReach(p,o.point))return false;
   if(this.config.mission==='documents'){o.stage='extract';return true;}
   if(this.config.mission==='sabotage'&&!p.treatment){p.treatment={kind:'sabotage',target:'objective',started:s.now,until:s.now+5000,x:p.x,z:p.z};return true;}
   return false;
  }
  return undefined;
 }
 inReach(p:Player,q:Point){const eye=eyePosition(p),o=[eye.x,eye.y,eye.z],v=[q.x-o[0],q.y+.5-o[1],q.z-o[2]],length=Math.hypot(...v);return length<2.7&&(length<.01||this.obstacleDistance(o,v.map(n=>n/length))>length-.25);}
 private updateTreatment(p:Player){
  const t=p.treatment;if(!t)return;if(t.kind==='harvest'){this.remains.updateHarvest(p);return;}const s=this.game.state,input=s.now-(this.game.received.get(p.id)??0)<300?this.game.inputs.get(p.id):undefined,target=t.kind!=='sabotage'?this.game.player(t.target):undefined;
  if(!p.hp||!p.connected||Math.hypot(p.x-t.x,p.z-t.z)>.15||p.injuries.lastDamageAt>t.started||!!input&&(input.fire||Math.hypot(input.forward,input.side)>.01)||t.kind!=='sabotage'&&(!target||target.life!==t.targetLife||!target.connected||target.departed||target.team!==p.team||target.injuries.lastDamageAt>t.started||target!==p&&!this.inReach(p,target))||t.kind==='bandage'&&(!target?.hp||p.bandages<1)||t.kind==='revive'&&!target?.downedUntil||t.kind==='sabotage'&&!this.inReach(p,s.operation.objective.point)){p.treatment=undefined;return;}
  if(s.now<t.until)return;p.treatment=undefined;
  if(t.kind==='bandage'&&target){if(target.hp>=100&&!target.injuries.bleeding)return;p.bandages--;const healed=Math.min(MEDKIT_HEAL,100-target.hp);target.hp+=healed;target.injuries.bleeding=0;this.game.emit({type:'heal',id:p.id,target:target.id,damage:healed,point:[target.x,target.y+1,target.z]});}
  if(t.kind==='revive'&&target){target.hp=30;target.downedUntil=0;target.injuries.bleeding=0;target.protectedUntil=s.now+1000;this.game.emit({type:'revive',id:p.id,target:target.id,point:[target.x,target.y,target.z]});}
  if(t.kind==='sabotage'&&s.operation.objective.stage==='target'){s.operation.objective.progress=5000;s.operation.objective.stage='extract';}
 }
 obstacleDistance(o:number[],d:number[],radius=0){let distance=150;for(const b of this.game.world().boxes)distance=Math.min(distance,b.kind==='rock'?rayRock(b,o,d):rayBox(o,d,[b.x-b.w/2-radius,b.y-b.h/2-radius,b.z-b.d/2-radius],[b.x+b.w/2+radius,b.y+b.h/2+radius,b.z+b.d/2+radius]));return distance;}
 private throwStar(p:Player){
  const s=this.game.state;if(!p.stars||armCount(p)<1||p.carriedCorpse&&armCount(p)<2||s.now<p.throwAt||p.treatment)return false;
  p.stars--;p.throwAt=s.now+750;p.protectedUntil=0;
  const dx=-Math.sin(p.yaw)*Math.cos(p.pitch),dy=Math.sin(p.pitch),dz=-Math.cos(p.yaw)*Math.cos(p.pitch);
  const eye=eyePosition(p),hand=hasLost(p,'armR')?-1:1,right={x:Math.cos(p.yaw)*hand*.16,z:-Math.sin(p.yaw)*hand*.16},offset=[dx*.35+right.x,dy*.35-.10,dz*.35+right.z],distance=Math.hypot(...offset),safe=Math.min(distance,Math.max(0,this.obstacleDistance([eye.x,eye.y,eye.z],offset.map(n=>n/distance))-.03));
  s.projectiles.push({id:`star-${++this.projectileSequence}`,owner:p.id,life:p.life,x:eye.x+offset[0]*safe/distance,y:eye.y+offset[1]*safe/distance,z:eye.z+offset[2]*safe/distance,vx:dx*24,vy:dy*24,vz:dz*24,spawnedAt:s.now,expires:s.now+3000});
  this.game.emit({type:'throw',id:p.id,weapon:5,point:[p.x,p.y+eyeHeight(p),p.z]});return true;
 }
 private updateProjectiles(dt:number){
  const s=this.game.state;
  s.projectiles=s.projectiles.filter(p=>{
   if(s.now>=p.expires)return false;
   const o=[p.x,p.y,p.z],delta=[p.vx*dt,(p.vy-4.9*dt)*dt,p.vz*dt],length=Math.hypot(...delta);if(length<1e-8)return true;const d=delta.map(v=>v/length);
   let distance=Math.min(length,this.obstacleDistance(o,d,.045)),target:Player|undefined,part:BodyPart='body';
   const world=getWorld(s.mapId),steps=Math.max(1,Math.ceil(length/.12));
   for(let step=1;step<=steps;step++){const along=Math.min(distance,length*step/steps),x=p.x+d[0]*along,y=p.y+d[1]*along,z=p.z+d[2]*along;if(y<=ground(x,z,world)+.025){let lo=Math.max(0,along-length/steps),hi=along;for(let n=0;n<8;n++){const mid=(lo+hi)/2;if(p.y+d[1]*mid<=ground(p.x+d[0]*mid,p.z+d[2]*mid,world)+.025)hi=mid;else lo=mid;}distance=hi;break;}if(along>=distance)break;}
   for(const actor of this.actors()){if(!actor.hp||actor.id===p.owner)continue;const hit=hitPlayer(o,d,actor);if(hit&&hit.distance<distance){target=actor;part=hit.part;distance=hit.distance;}}
   p.x+=d[0]*distance;p.y+=d[1]*distance;p.z+=d[2]*distance;p.vy-=9.8*dt;
   const hitFloor=p.y<=ground(p.x,p.z,getWorld(s.mapId)),blocked=distance<length-.00001;
   if(target){this.damage(target,p.owner,5,part==='head'?100:part.startsWith('leg')?30:40,part,[p.x,p.y,p.z],false,{x:o[0],z:o[2]});return false;}
   if(blocked||hitFloor){this.game.emit({type:'impact',id:p.owner,weapon:5,point:[p.x,p.y,p.z]});return false;}
   return withinPlayArea(p.x,p.z,getWorld(s.mapId));
  });
 }
}
