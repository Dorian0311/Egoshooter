import React,{useEffect,useState} from 'react';
import {getWorld,validMap,type MapId} from '../shared/world';
export type OpenRoom={code:string;mapId:MapId;phase:'waiting'|'playing';players:number;capacity:number;joinable:boolean;host:string};
type Access={ticket:string;serverUrl:string};
export function LiveRooms({access,onJoin,onRefreshTicket}:{access:Access|null;onJoin:(room:OpenRoom)=>void;onRefreshTicket:()=>Promise<Access>}){
 const [rooms,setRooms]=useState<OpenRoom[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  if(!access)return;let alive=true;
  async function load(){
   try{
    let current=access!;
    const request=(token:Access)=>fetch(token.serverUrl.replace(/^ws/,'http')+'/rooms',{headers:{Authorization:'Bearer '+token.ticket}});
    let response=await request(current);
    if(response.status===401){current=await onRefreshTicket();response=await request(current);}
    if(!response.ok)throw Error('Die Einsatzliste ist gerade nicht erreichbar.');
    const data=await response.json();if(alive){setRooms((Array.isArray(data.rooms)?data.rooms:[]).filter((r:OpenRoom)=>validMap(r.mapId)&&typeof r.code==='string'));setError('');}
   }catch(e){if(alive)setError(e instanceof Error?e.message:'Verbindung fehlgeschlagen.');}finally{if(alive)setLoading(false);}
  }
  void load();const timer=setInterval(()=>{if(!document.hidden)void load();},5000);
  return()=>{alive=false;clearInterval(timer);};
 },[access?.serverUrl,access?.ticket,refresh]);
 return <section className="live-rooms" aria-label="Laufende und offene Spiele"><header><h2>Einsätze</h2><small>● LIVE</small><button aria-label="Einsatzliste aktualisieren" onClick={()=>setRefresh(v=>v+1)}>↻</button></header>
  {error?<p role="status">{error}</p>:loading?<p role="status">Offene Einsätze werden gesucht …</p>:rooms.length===0?<p>Noch kein offener Einsatz. Erstelle den ersten oder starte ein Training.</p>:<div className="live-room-list">{rooms.map(room=><button key={room.code} className="live-room" disabled={!room.joinable} onClick={()=>onJoin(room)}><span className={`room-preview map-preview-${room.mapId}`}/><span><strong>{getWorld(room.mapId).name}</strong><small>{room.phase==='playing'?'Im Gefecht':'Wartet auf Spieler'} · {room.host} · {room.code}</small></span><b>{room.players}/{room.capacity}<small>{room.joinable?'BEITRETEN ↗':'VOLL'}</small></b></button>)}</div>}
 </section>;
}
