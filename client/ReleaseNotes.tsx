import React,{useEffect,useRef,useState} from 'react';
import './releaseNotes.css';

const release='npc-weapons-audio-2026-11-16';
const storageKey='eiserne-front-changelog';
let acknowledgedInSession=false;
const changes=[
 ['Deutsche Waffen & Ausrüstung','Wähle zuerst deinen Charakter und dann genau fünf Waffen. Neu dabei: StG 44, Gewehr 43, MG 42, MP 34, Walther P38 und FG 42. Deine Ausrüstung liegt auf den Tasten 1–5.'],
 ['Neue Stadtbewohner','Stadtbewohner tragen jetzt ein detaillierteres Modell mit Sakko, eigener Gehbewegung und Gesten. Kroenen und Deadpool bleiben als spielbare Figuren erhalten.'],
 ['Neuer Gefechtssound','Überarbeitete Schüsse, materialabhängige Schritte, Nachladen, Treffer und Körperteilgeräusche. Räumliche Ortung, Distanzdämpfung und ein begrenzter Gesamtpegel ergänzen das Gefecht.'],
 ['Einzelspieler & Koop','Training, Bot-Gefechte, fünf Überlebenswellen und drei Missionen auf allen vier Karten. Koop für 2–4 Spieler mit Raumcode, Wiederbelebung und Zuschauen.'],
 ['Bots & Einsatzbedingungen','Drei Schwierigkeiten, Deckung, Flankieren, Sicht und Gehör sowie Wege durch Türen und über Treppen. Nebel, Nacht und wechselnde Zugänge sind vor dem Einsatz wählbar.'],
 ['Medkits & Erste Hilfe','H heilt dich um 50 Lebenspunkte und stoppt Blutungen. Mit E behandelst du nahe Mitspieler. Im Koop kannst du einen gefallenen Partner zum Erste-Hilfe-Zelt tragen: Nach acht Sekunden Behandlung kehrt er vollständig geheilt zurück.'],
 ['Leichen tragen & Schild','Leichen bleiben bis zum Einsatzende liegen. E hebt eine Leiche auf oder legt sie ab. Eine getragene Leiche schützt von vorn mit bis zu 150 Schildpunkten; der verbleibende Schild steht neben deiner Gesundheit.'],
 ['Körperteile als Waffen','Arme, Beine und Köpfe mit E aufheben, im Nahkampf einsetzen oder mit G werfen. Shift+E löst den Kopf einer Leiche nach drei Sekunden. Waffen 1–5 legen das getragene Körperteil ab.'],
 ['Geschenke & Wurfsterne','Acht Geschenkpakete mit je drei hakenkreuzförmigen Wurfsternen und vier Medkit-Fundstücke pro Karte. G wirft einen Wurfstern, wenn du kein Körperteil trägst. Tasten sind unter Einstellungen umbelegbar.'],
 ['Figuren & Bewegung','Kroenens schwarzer Ledermantel bewegt sich beim Laufen, Sprinten und Kämpfen mit. Figuren bewegen ihre Beine und halten ihre Waffe an den Griffen. Stadtbewohner zeigen gelegentlich einen Mittelfinger. Ein deutscher Kübelwagen steht im Lobbybild.'],
 ['Details & Höhepunkte','Überarbeitete Trennstellen, fliegende Körperteile und das Original-Gesicht deines besiegten Gegners. Optimierte Treffer- und Leicheneffekte, lokale PvE-Bestwerte sowie bis zu drei Höhepunkte mit 720p-WebM-Export und Spielaudio.'],
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
