import React,{useEffect,useRef,useState} from 'react';
import './releaseNotes.css';

const release='themenwelten-und-lichtspiele-2026-11-25';
const storageKey='eiserne-front-changelog';
let acknowledgedInSession=false;
const changes=[
 ['Zwei Themenwelten','Wähle in der Lobby zwischen Island und 2. Weltkrieg. Köln, die Alpen und Operation Abendrot bieten historische Ausrüstung. Bonusfiguren und Sprengrennwagen gehören zur Insel.'],
 ['Union-Lichtspiele','Im Güterviertel von Operation Abendrot steht am Platz der Alten Mühle ein begehbares Kino. Sechs historische Propagandaplakate hängen in den Schaukästen. Im Saal siehst du das Archivfoto von 1935.'],
 ['Gewehr 43 mit ZF4','Das neue Gewehr ergänzt den Karabiner 98k mit ZF39. Wähle es für einen deiner fünf Waffenplätze. Halte die rechte Maustaste für den vierfachen Zoom.'],
 ['Luftschutzzeichen und Auszeichnungen','In Köln und im Güterviertel findest du LSR- und NA-Markierungen. Nach historischen Gefechten zeigt die Ergebnisansicht verdiente Auszeichnungen.'],
 ['Inselparcours','Die Küstenroute führt durch eine Unterführung. Den Sprengrennwagen kannst du im Inseltraining über den Parcours steuern.'],
] as const;

export function ReleaseNotes(){
 const [open,setOpen]=useState(()=>{if(acknowledgedInSession)return false;try{return localStorage.getItem(storageKey)!==release;}catch{return true;}});
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(!open)return;const element=dialog.current;element?.showModal();return()=>element?.close();},[open]);
 const dismiss=()=>{acknowledgedInSession=true;try{localStorage.setItem(storageKey,release);}catch{/* Keep the acknowledgement for this app session. */}setOpen(false);};
 if(!open)return null;
 return <dialog ref={dialog} className="release-notes" aria-labelledby="release-notes-title" onCancel={event=>{event.preventDefault();dismiss();}}>
  <header><span>UPDATE · 25. NOVEMBER 2026</span><h2 id="release-notes-title">Neu in Eiserne Front</h2><p>Die Änderungen seit der letzten Meldung. Die genannten Tasten entsprechen der Standardbelegung.</p></header>
  <div className="release-notes-content">{changes.map(([title,description])=><section key={title}><h3>{title}</h3><p>{description}</p></section>)}</div>
  <footer><button autoFocus className="release-notes-ack" onClick={dismiss}>Verstanden · zur App</button></footer>
 </dialog>;
}
