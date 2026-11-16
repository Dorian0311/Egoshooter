import React,{useEffect,useRef,useState} from 'react';
import './releaseNotes.css';

const release='operations-2026-11-16';
const storageKey='eiserne-front-changelog';
let acknowledgedInSession=false;
const changes=[
 ['Einzelspieler & Koop','Training, Bot-Gefechte, fünf Überlebenswellen und drei Missionen auf allen vier Karten. Koop für 2–4 Spieler mit Raumcode, Wiederbelebung und Zuschauen.'],
 ['Bots & Missionen','Drei Schwierigkeiten, Deckung, Flankieren, Sicht und Gehör sowie Navigation über Treppen und durch Türen. Sabotage, Dokumente bergen und Stellung halten.'],
 ['Verletzungen & Versorgung','Stadtbewohner sind verwundbar. Gliedmaßenverlust, Blutverlust und Kriechen beeinflussen den Kampf. Verbände stoppen Blutungen; reduzierte Gewalteffekte sind einstellbar.'],
 ['Geschenke & Wurfsterne','Acht Geschenkpakete mit je drei hakenkreuzförmigen Wurfsternen und vier Verband-Fundstücke pro Karte. E: aufnehmen · G: werfen · H: verbinden. Alle Tasten sind umbelegbar.'],
 ['Kroenen & Kübelwagen','Karl Ruprecht Kroenen ist mit drehbarer 3D-Vorschau spielbar. Ein deutscher VW Kübelwagen Typ 82 ersetzt den amerikanischen Jeep im Lobbybild.'],
 ['Atmosphäre & Animationen','Nebel, Nacht und wechselnde Zugänge, zusätzliche Bewegungs- und Treffereffekte, neue Geräusche sowie einstellbare Kamerastöße.'],
 ['Bestwerte & Höhepunkte','Getrennte lokale PvE-Bestwerte und bis zu drei Höhepunkte pro Einsatz. Wiedergabe und 720p-WebM-Export mit Spielaudio bei Browser-Unterstützung.'],
] as const;

export function ReleaseNotes(){
 const [open,setOpen]=useState(()=>{if(acknowledgedInSession)return false;try{return localStorage.getItem(storageKey)!==release;}catch{return true;}});
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(!open)return;const element=dialog.current;element?.showModal();return()=>element?.close();},[open]);
 const dismiss=()=>{acknowledgedInSession=true;try{localStorage.setItem(storageKey,release);}catch{/* Keep the acknowledgement for this app session. */}setOpen(false);};
 if(!open)return null;
 return <dialog ref={dialog} className="release-notes" aria-labelledby="release-notes-title" onCancel={event=>{event.preventDefault();dismiss();}}>
  <header><span>UPDATE · 16. NOVEMBER 2026</span><h2 id="release-notes-title">Neu in Eiserne Front</h2><p>Mehr Einsätze. Neue Möglichkeiten für deinen nächsten Einsatz.</p></header>
  <div className="release-notes-content">{changes.map(([title,description])=><section key={title}><h3>{title}</h3><p>{description}</p></section>)}</div>
  <footer><button autoFocus className="release-notes-ack" onClick={dismiss}>Verstanden · zur App</button></footer>
 </dialog>;
}
