// Behaviour reference: Mugen87/Dive (MIT). Movement and combat remain in our authoritative Game.
import {neutral,rayBox,type Game,type Player} from '../shared/game';
import {difficultyRules} from '../shared/operationConfig';
import {safeNear,safePoints,type Point} from '../shared/operations';
import {eyeHeight} from '../shared/injuries';
import {getWorld} from '../shared/world';
import {interiorFixtures} from '../shared/interiors';
import {weapons,type WeaponId} from '../shared/weapons';
import type {Navigation} from './navigation';
type Investigation={point:Point;until:number;decoy:boolean};
type Brain={
 life:number;seq:number;seenAt:number;acquired:number;memory?:Point;investigation?:Investigation;
 target:string;path:Point[];door?:string;replanAt:number;patrol:number;lastX:number;lastZ:number;stuck:number;
 weapon:WeaponId;ammo:number;shots:number;pauseUntil:number;
};
export class Bots {
 private brains=new Map<string,Brain>();
 private heardPositions=new Map<string,Point>();
 constructor(readonly game:Game,readonly navigation:Navigation){}
 update(now:number){
  const g=this.game,s=g.state,noises=g.operation.takeBotNoises();if(s.phase!=='playing'||s.operation.nextWaveAt)return;this.navigation.sync(s.interiors);
  const config=s.operation.config,rules=difficultyRules[config.difficulty],world=getWorld(s.mapId),points=safePoints(world),bots=s.players.filter(p=>p.kind==='bot'&&p.hp>0&&p.connected);
  let replans=0;
  for(const p of bots){
   let b=this.brains.get(p.id);
   if(!b||b.life!==p.life){
    b={life:p.life,seq:p.seq,seenAt:0,acquired:now,target:'',path:[],replanAt:0,
     patrol:Number(p.id.replace(/\D/g,''))||0,lastX:p.x,lastZ:p.z,stuck:0,
     weapon:p.weapon,ammo:p.ammo,shots:0,pauseUntil:0};
    this.brains.set(p.id,b);
   }
   b.seq=Math.max(b.seq,p.seq)+1;
   // Ammo drops only when a shot actually leaves the currently equipped gun.
   if(p.weapon===b.weapon&&p.ammo<b.ammo){
    b.shots+=b.ammo-p.ammo;
    if(b.shots>=rules.burstSize){
     const stagger=(b.patrol*137+b.seq*31)%240;
     b.pauseUntil=now+Math.max(rules.burstPause,weapons[p.weapon].interval+250)+stagger;
     b.shots=0;
    }
   }
   b.weapon=p.weapon;b.ammo=p.ammo;
   const training=config.mode==='training',opponents=s.players.filter(q=>q.team!==p.team&&q.hp>0&&q.connected&&!q.departed);
   let visible:Player|undefined,nearest=Infinity;
   const vision=Math.min(rules.vision,s.operation.condition==='fog'?25:s.operation.condition==='night'?rules.vision*.6:rules.vision);
   for(const q of opponents){const dx=q.x-p.x,dz=q.z-p.z,distance=Math.hypot(dx,dz);if(distance>vision)continue;const angle=Math.atan2(-dx,-dz),difference=Math.atan2(Math.sin(angle-p.yaw),Math.cos(angle-p.yaw));if(Math.abs(difference)>Math.PI/3&&distance>5)continue;
    const delta=[dx,q.y+eyeHeight(q)-p.y-eyeHeight(p),dz],length=Math.hypot(...delta),limit=length-.2;if(g.operation.obstacleDistance([p.x,p.y+eyeHeight(p),p.z],delta.map(v=>v/length),0,limit)<limit)continue;if(distance<nearest){visible=q;nearest=distance;}
   }
   if(b.investigation&&now>=b.investigation.until){b.investigation=undefined;b.replanAt=0;}
   if(visible){
    if(b.target!==visible.id){b.acquired=now;b.replanAt=0;}
    b.target=visible.id;b.seenAt=now;b.memory={x:visible.x,y:visible.y,z:visible.z};b.investigation=undefined;
   }else if(!training){
    b.target='';
    let heard:typeof noises[number]|undefined,heardDistance=Infinity;
    for(const noise of noises){
     const distance=Math.hypot(noise.point.x-p.x,noise.point.y-p.y,noise.point.z-p.z);
     if(noise.team===p.team||distance>=noise.range)continue;
     if(!heard||noise.decoy&&!heard.decoy||noise.decoy===heard.decoy&&distance<heardDistance){heard=noise;heardDistance=distance;}
    }
    if(heard&&(!b.investigation?.decoy||heard.decoy)){
     if(!b.investigation||heard.decoy&&!b.investigation.decoy)b.replanAt=0;
     b.investigation={point:heard.point,until:now+(heard.decoy?5000:3500),decoy:heard.decoy};
    }else if(!b.investigation&&now-b.seenAt>=2000){
     const walker=opponents.find(q=>{
      const old=this.heardPositions.get(q.id),range=q.crouching?5:q.sprinting?20:10;
      return q.grounded&&old&&Math.hypot(q.x-old.x,q.z-old.z)>.025&&Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z)<range;
     });
     if(walker){
      b.investigation={point:{x:Math.round(walker.x/3)*3,y:walker.y,z:Math.round(walker.z/3)*3},until:now+1500,decoy:false};
      b.replanAt=0;
     }
    }
   }
   let goal:Point;
   if(training){const human=g.operation.humans[0],offsets=[[14,0],[10,6],[17,7],[12,-6]],offset=offsets[b.patrol%4];goal=safeNear(world,(human?.x??-45)+offset[0],(human?.z??0)+offset[1]);if(Math.hypot(goal.x-p.x,goal.z-p.z)<1)b.patrol++;}
   else if(b.investigation)goal=b.investigation.point;
   else if(b.memory&&now-b.seenAt<6000){goal=b.memory;
    if(p.hp<40){const cover=points.filter(q=>Math.hypot(q.x-p.x,q.z-p.z)<12&&Math.hypot(q.x-goal.x,q.z-goal.z)>8).find(q=>{const v=[goal.x-q.x,goal.y+1.5-q.y,goal.z-q.z],length=Math.hypot(...v),limit=length-1;return g.operation.obstacleDistance([q.x,q.y+1.5,q.z],v.map(n=>n/length),0,limit)<limit;});if(cover)goal=cover;}
    else if(visible&&Math.abs(p.y-goal.y)<1&&b.patrol%2&&nearest>12)goal=safeNear(world,goal.x+Math.cos(p.yaw)*7,goal.z-Math.sin(p.yaw)*7);
   }else{
    if(config.mode==='mission'){
     const center=s.operation.objective.point,angle=b.patrol*Math.PI/2;
     goal=safeNear(world,center.x+Math.cos(angle)*14,center.z+Math.sin(angle)*14);
    }else goal=points[(b.patrol*37+19)%points.length];
    if(Math.hypot(goal.x-p.x,goal.z-p.z)<2)b.patrol+=config.mode==='mission'?3:1;
   }
   if(now>=b.replanAt&&replans<1){
    replans++;
    b.path=this.navigation.path(p,goal);b.replanAt=now+650;b.door=undefined;
    const end=b.path.at(-1);
    if(!end||Math.hypot(end.x-goal.x,end.z-goal.z)>2||Math.abs(end.y-goal.y)>1){
     // A closed door removes connectivity. Route to its reachable side before asking the
     // normal interaction system to open it; do not walk into an arbitrary outside wall.
     let best=Infinity;
     for(const f of interiorFixtures(world)){if(f.type!=='door'||s.interiors?.doors[f.id])continue;const building=world.buildings[f.building],inside=(q:Point)=>Math.abs(q.x-building.x)<building.w/2&&Math.abs(q.z-building.z)<building.d/2;
      if(!inside(goal)&&!inside(p))continue;
      for(const side of [-1,1]){const point={x:f.box.x,y:0,z:f.box.z+side*1.5},path=this.navigation.path(p,point),last=path.at(-1);if(!last||Math.hypot(last.x-point.x,last.z-point.z)>.8)continue;let cost=Math.hypot(point.x-goal.x,point.z-goal.z);for(let n=1;n<path.length;n++)cost+=Math.hypot(path[n].x-path[n-1].x,path[n].z-path[n-1].z);if(cost<best){best=cost;b.path=path;b.door=f.id;}}
     }
    }
   }
   while(b.path.length&&Math.hypot(b.path[0].x-p.x,b.path[0].z-p.z)<.6)b.path.shift();
   const waypoint=b.path[0],dx=(waypoint?.x??p.x)-p.x,dz=(waypoint?.z??p.z)-p.z,length=Math.hypot(dx,dz),aim=visible??b.memory;
   const error=rules.error*Math.PI/180,aimYaw=aim?Math.atan2(p.x-aim.x,p.z-aim.z):p.yaw;
   const door=interiorFixtures(world).find(f=>f.type==='door'&&!s.interiors?.doors[f.id]&&Math.hypot(f.box.x+1.7-p.x,f.box.z-p.z)<2.7&&(f.id===b.door||length>.1&&rayBox([p.x,p.y+1,p.z],[dx/length,0,dz/length],[f.box.x-f.box.w/2,f.box.y-f.box.h/2,f.box.z-f.box.d/2],[f.box.x+f.box.w/2,f.box.y+f.box.h/2,f.box.z+f.box.d/2])<length+.2));
   const yaw=door?Math.atan2(p.x-door.box.x-1.7,p.z-door.box.z):visible?aimYaw+Math.sin(now*.002+b.patrol)*error:length>.1?Math.atan2(-dx,-dz):Math.hypot(goal.x-p.x,goal.z-p.z)>1?Math.atan2(p.x-goal.x,p.z-goal.z):p.yaw;
   if(door&&g.interact(p.id,door.id))b.replanAt=0;
   const pitch=visible?Math.atan2(visible.y+1.15-p.y-eyeHeight(p),Math.max(.1,nearest))+Math.cos(now*.0017+b.patrol)*error:0;
   const forward=length>.1?-(dx*Math.sin(yaw)+dz*Math.cos(yaw))/length:0,side=length>.1?(dx*Math.cos(yaw)-dz*Math.sin(yaw))/length:0;
   const hold=!training&&!!visible&&Math.abs(p.y-visible.y)<.4&&nearest<16&&p.hp>=40;
   const motion=training?(config.difficulty==='easy'?.45:config.difficulty==='hard'?1:.7):1;
   const fire=!door&&!training&&!!visible&&now-b.acquired>=rules.reaction&&now>=b.pauseUntil;
   g.input(p.id,{...neutral(b.seq),time:s.now,forward:door?0:hold?0:forward*motion,side:door?0:hold?Math.sin(now*.001+b.patrol)*.35:side*motion,yaw,pitch:Math.max(-1.4,Math.min(1.4,pitch)),aim:!!visible,sprint:!visible&&length>8,fire,reload:p.ammo===0,jump:!!waypoint&&p.grounded&&b.stuck>4&&waypoint.y-p.y>.25,weapon:nearest>25?0:2});
   if(Math.hypot(p.x-b.lastX,p.z-b.lastZ)<.015&&length>.5)b.stuck++;else b.stuck=0;b.lastX=p.x;b.lastZ=p.z;
   if(b.stuck>20){const door=interiorFixtures(world).find(f=>f.type==='door'&&!s.interiors?.doors[f.id]&&Math.hypot(f.box.x-p.x,f.box.z-p.z)<3);if(door)g.interact(p.id,door.id);else{b.patrol++;b.memory=undefined;b.investigation=undefined;}b.replanAt=0;b.stuck=0;}
  }
  for(const p of s.players)this.heardPositions.set(p.id,{x:p.x,y:p.y,z:p.z});
 }
 dispose(){this.navigation.dispose();this.brains.clear();}
}
