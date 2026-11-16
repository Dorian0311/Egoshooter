import React,{useEffect,useRef,useState} from 'react';
import './releaseNotes.css';

const release='npc-weapons-audio-details-2026-11-16';
const storageKey='eiserne-front-changelog';
let acknowledgedInSession=false;
const changes=[
 ['Stadtbewohner ersetzt','Neues texturiertes Modell mit Sakko, langer Hose und Lederschuhen. Beine und Arme bewegen sich beim Gehen; Bewohner zeigen gelegentlich einen Mittelfinger. Verdrehte Ruhehände und fehlerhafte Haarflächen wurden korrigiert. Kroenen und Deadpool bleiben spielbar.'],
 ['Sechs neue deutsche Waffen','StG 44, Gewehr 43, MG 42, MP 34, Walther P38 und FG 42 ergänzen Karabiner 98k, Luger P08 und MP 40. Die neuen Waffen besitzen eigene Spielwerte und Modelle aus der Erst- und Drittperson.'],
 ['Charakter → fünf Waffen → Einsatz','Vor dem Beitreten oder Erstellen wählst du zuerst die Figur und danach genau fünf unterschiedliche Waffen. Tasten 1–5 wechseln deine gewählten Plätze; die Belegung ist umstellbar. Die Auswahl funktioniert auch auf schmalen Bildschirmen.'],
 ['Ausrüstung bleibt erhalten','Die gewählten fünf Waffen bleiben bei Respawn, Kartenwechsel und Wiederherstellung im Koop-Sanitätszelt erhalten. Die Zeltbehandlung setzte die Auswahl zuvor versehentlich zurück.'],
 ['Munitionsnachschub korrigiert','Zwischen Überlebenswellen werden auch die neuen Waffen vollständig aufgefüllt. Ein Fehler ließ ihre Munition nach dem Wellenwechsel fehlen und verhinderte weitere Schüsse.'],
 ['Pistolen beim Tragen und bei Armverlust','Eine gewählte Walther P38 wird jetzt wie die Luger P08 berücksichtigt. Der Wechsel zur P38 legt eine getragene Leiche nicht mehr ab. Ohne gewählte Pistole bleibt die P08 als Notfallwaffe verfügbar.'],
 ['Gefechtssound überarbeitet','Unterschiedliche Schüsse je Waffenart, Nachladen und Waffenhandhabung sowie Schritte auf verschiedenen Untergründen. Neue Treffer-, Kettensägen-, Abtrennungs- und Körperteilgeräusche ergänzen den Kampf. Abgebrochene Nachlade- und Kettensägenaktionen stoppen ihren Sound.'],
 ['Ortung und Lautstärke','Geräusche lassen sich links und rechts orten; Entfernung und verdeckte Schallquellen beeinflussen die Lautstärke. Gleichzeitige Sounds werden begrenzt und der Gesamtpegel gegen Übersteuerung abgesichert.'],
 ['Grafiklast reduziert','Das neue Bewohner-Modell und die Drittpersonen-Waffen wurden für weniger Zeichenaufwand optimiert. Leichen und abgetrennte Teile der Bewohner behalten Kleidung und Aussehen des neuen Modells. Der Gang bleibt prozedural animiert.'],
] as const;

export function ReleaseNotes(){
 const [open,setOpen]=useState(()=>{if(acknowledgedInSession)return false;try{return localStorage.getItem(storageKey)!==release;}catch{return true;}});
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(!open)return;const element=dialog.current;element?.showModal();return()=>element?.close();},[open]);
 const dismiss=()=>{acknowledgedInSession=true;try{localStorage.setItem(storageKey,release);}catch{/* Keep the acknowledgement for this app session. */}setOpen(false);};
 if(!open)return null;
 return <dialog ref={dialog} className="release-notes" aria-labelledby="release-notes-title" onCancel={event=>{event.preventDefault();dismiss();}}>
  <header><span>UPDATE · 16. NOVEMBER 2026</span><h2 id="release-notes-title">Neu in Eiserne Front</h2><p>Die konkreten Änderungen an Stadtbewohnern, Waffen, Sound und Spielregeln.</p></header>
  <div className="release-notes-content">{changes.map(([title,description])=><section key={title}><h3>{title}</h3><p>{description}</p></section>)}</div>
  <footer><button autoFocus className="release-notes-ack" onClick={dismiss}>Verstanden · zur App</button></footer>
 </dialog>;
}
