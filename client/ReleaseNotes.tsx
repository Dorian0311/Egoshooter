import React,{useEffect,useRef,useState} from 'react';
import './releaseNotes.css';

const release='combat-and-vehicles-2026-11-18';
const storageKey='eiserne-front-changelog';
let acknowledgedInSession=false;
const changes=[
 ['Rennwagen und Stielraketen','In jedem Gebäude stehen pro Runde ein Sprengrennwagen und eine Stielrakete bereit. Mit E übernimmst du den Wagen, mit WASD fährst du ihn und mit Linksklick zündest du. Die Kamera folgt dem Wagen. Stielraketen nimmst du mit E auf und startest sie mit B.'],
 ['Motor, Warnsignal und Parcours','Der Motorsound folgt der Geschwindigkeit. Vor der Zündung ertönen drei Warntöne und eine Lampe blinkt. Im Trainingsmodus kannst du auf jeder Karte vier Tore fahren und deine Bestzeit im selben Einsatz verbessern.'],
 ['Zielfernrohr und neue Bewegungen','Der Karabiner 98k mit ZF39 steht in der Waffenauswahl. Rechtsklick öffnet das Zielfernrohr. Geduckt streut die Waffe weniger und schlägt weniger zurück. Halte X zum Kriechen.'],
 ['Sichtbarere Schüsse','Breitere Leuchtspuren, kräftigere Mündungsblitze und Funken machen Schüsse und Einschläge besser erkennbar. Rauch und Funken werden gebündelt gezeichnet und Explosionsobjekte wiederverwendet.'],
 ['Funkwache und Innenräume','Die Anzeige liest ihre Abmessungen bei Größenänderungen. Der Renderer aktualisiert nur ausgerüstete Waffen im sichtbaren Szenenbaum. Einschlagmarken werden gemeinsam pro Bild aktualisiert.'],
 ['Koop, Trefferanzeige und Schritte','Gegner reagieren auf Schüsse und Ablenkungen, feuern in Salven und starten mit mehr Abstand. Die Trefferanzeige nennt Schaden, Körperregion und Richtung. Schritte anderer Figuren sind räumlich hörbar.'],
 ['Bewohner, Medkits und Lobby','Vier Bewohner haben leichter erkennbare Kleidung und eigene Sprüche. Medkits stecken in rot-weißen Kisten. Die Waffenauswahl zeigt Vorschaubilder, und die Lobby blendet den Scrollbalken aus.'],
] as const;

export function ReleaseNotes(){
 const [open,setOpen]=useState(()=>{if(acknowledgedInSession)return false;try{return localStorage.getItem(storageKey)!==release;}catch{return true;}});
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(!open)return;const element=dialog.current;element?.showModal();return()=>element?.close();},[open]);
 const dismiss=()=>{acknowledgedInSession=true;try{localStorage.setItem(storageKey,release);}catch{/* Keep the acknowledgement for this app session. */}setOpen(false);};
 if(!open)return null;
 return <dialog ref={dialog} className="release-notes" aria-labelledby="release-notes-title" onCancel={event=>{event.preventDefault();dismiss();}}>
  <header><span>UPDATE · 18. NOVEMBER 2026</span><h2 id="release-notes-title">Neu in Eiserne Front</h2><p>Die Änderungen seit der letzten Meldung. Die genannten Tasten entsprechen der Standardbelegung.</p></header>
  <div className="release-notes-content">{changes.map(([title,description])=><section key={title}><h3>{title}</h3><p>{description}</p></section>)}</div>
  <footer><button autoFocus className="release-notes-ack" onClick={dismiss}>Verstanden · zur App</button></footer>
 </dialog>;
}
