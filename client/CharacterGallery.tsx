import React,{useEffect,useRef,useState} from 'react';
import {uniforms,uniformOptions,type UniformId} from '../shared/uniforms';
import {ModelPreview} from './ModelPreview';
import type {MapId} from '../shared/world';
import './characterGallery.css';
type Props={team:'de'|'fr';map:MapId;value:UniformId|'';onChange:(id:UniformId)=>void;compact?:boolean;actionLabel?:string};
export function CharacterGallery({team,map,value,onChange,compact=false,actionLabel}:Props){
 const ids=uniformOptions(team,map),[browsed,setBrowsed]=useState<UniformId>(value||ids[0]);
 const current=ids.includes(browsed)?browsed:ids[0],index=ids.indexOf(current),selected=value===current;
 const rail=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(value&&ids.includes(value))setBrowsed(value);},[value,team,map]);
 useEffect(()=>{rail.current?.querySelector('[aria-current="true"]')?.scrollIntoView({block:'nearest',inline:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},[current]);
 const step=(amount:number)=>setBrowsed(ids[(index+amount+ids.length)%ids.length]);
 return <section className={`character-gallery${compact?' character-gallery-compact':''}`} aria-label="Charakter-Slider" aria-roledescription="Karussell" onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}}}>
  <div className="character-gallery-heading"><div><span>WÄHLE DEINEN SPIELSTIL</span><h2>Dein nächster Einsatz.</h2></div><span className="character-counter">{String(index+1).padStart(2,'0')} <small>/ {String(ids.length).padStart(2,'0')}</small></span></div>
  <div className="model-slider">
   <ModelPreview key={current} id={current} team={team} map={map}/>
   <button className="model-prev" aria-label="Vorheriger Charakter" onClick={()=>step(-1)}>‹</button><button className="model-next" aria-label="Nächster Charakter" onClick={()=>step(1)}>›</button>
   <div className="model-caption" aria-live="polite"><span>{current==='leatherface'?'NAHKAMPF · POWERMODUS':current.startsWith('task-')?'TAKTISCHE EINHEIT':current.includes('-')?'HISTORISCHE UNIFORM':'BONUS-CHARAKTER'}</span><h3>{uniforms[current].name.replace(/^(Bonus|Heer|France|US Army) · /,'')}</h3><p>{uniforms[current].detail}</p><button className={selected?'model-selected':'model-select'} aria-pressed={selected} onClick={()=>onChange(current)}>{actionLabel??(selected?'✓ Für den Einsatz ausgewählt':'Diesen Charakter auswählen ↗')}</button></div>
  </div>
  <div ref={rail} className="model-rail" aria-label="Charaktere">{ids.map((id,n)=><button key={id} aria-current={id===current?'true':undefined} aria-pressed={value===id} onClick={()=>setBrowsed(id)}><small>{String(n+1).padStart(2,'0')}</small>{uniforms[id].name.replace(/^(Bonus|Heer|France|US Army) · /,'')}{value===id&&<span> ✓</span>}</button>)}</div>
  {current==='de-greatcoat'&&<a href="/shooter/characters/greatcoat/CREDITS.txt" target="_blank" rel="noreferrer">Modell: That one larry · CC BY 4.0</a>}
 </section>;
}
