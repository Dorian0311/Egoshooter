import type {Player,Snapshot} from './game';

export const historicalAwards={
 infantry:{name:'Infanterie-Sturmabzeichen',reason:'Drei Abschüsse im Einsatz'},
 wound:{name:'Verwundetenabzeichen in Schwarz',reason:'Verwundet und am Rundenende noch am Leben'},
 cross:{name:'Eisernes Kreuz II. Klasse (1939)',reason:'Sieg mit mindestens fünf Abschüssen'},
 merit:{name:'Kriegsverdienstkreuz II. Klasse',reason:'Missionsziel im Einzelspieler oder Koop erreicht'},
} as const;

export function earnedHistoricalAwards(snapshot:Snapshot,player:Player|undefined){
 const earned:(keyof typeof historicalAwards)[]=[];
 if(snapshot.phase!=='finished'||snapshot.mapId==='storm'||player?.kind!=='human'||player.team!=='de'||player.departed)return earned;
 if(player.kills>=3)earned.push('infantry');
 if(player.hp>0&&!player.downedUntil&&player.injuries.lastDamageAt>0)earned.push('wound');
 if(snapshot.winner==='de'&&player.kills>=5)earned.push('cross');
 if(snapshot.operation.config.mode==='mission'&&snapshot.operation.result==='success')earned.push('merit');
 return earned;
}
