import React from 'react';
import type {GameEvent} from '../shared/game';
import {bodyPartLabels} from '../shared/injuries';

export type ReceivedHit={key:string;at:number;zone:string;loss:number;bearing?:number};

export function receivedHit(event:GameEvent,key:string,at:number):ReceivedHit{
 const zone=event.bodyPart?bodyPartLabels[event.bodyPart]:event.hitZone==='head'?'Kopf':event.hitZone==='legs'?'Beine':'Körper';
 return {key,at,zone,loss:event.healthLoss??event.damage??0,bearing:event.bearing};
}

const directions=['Vorne','Vorne rechts','Rechts','Hinten rechts','Hinten','Hinten links','Links','Vorne links'];
const relativeAngle=(bearing:number,yaw:number)=>(bearing+yaw)*180/Math.PI;
const directionLabel=(angle:number)=>directions[((Math.round(angle/45)%8)+8)%8];
const damageDisplay=new Intl.NumberFormat('de-DE',{maximumFractionDigits:1});

export function HitReport({hits,now,yaw,summary=false}:{hits:ReceivedHit[];now:number;yaw:number;summary?:boolean}){
 const recent=hits.filter(hit=>now-hit.at<4000);
 if(!recent.length)return null;
 const latest=recent[0];
 return <>
  {!summary&&latest.bearing!==undefined&&now-latest.at<850&&<div className="damage-direction" aria-hidden="true"
   style={{transform:`translate(-50%,-50%) rotate(${relativeAngle(latest.bearing,yaw)}deg)`}}><span>▼</span></div>}
  <ol className={summary?'received-hits received-hits-summary':'received-hits'} aria-label="Erlittener Schaden">
   {recent.map(hit=><li key={hit.key}>
    <strong>{damageDisplay.format(hit.loss)} Schaden</strong>
    <span>{hit.zone}</span>
    <span>{hit.bearing===undefined?'':directionLabel(relativeAngle(hit.bearing,yaw))}</span>
   </li>)}
  </ol>
 </>;
}
