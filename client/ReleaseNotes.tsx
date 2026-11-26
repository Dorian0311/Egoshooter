import React,{useEffect,useRef,useState} from 'react';
import './releaseNotes.css';

const release='island-zeitreise-grafik-2026-11-26';
const storageKey='eiserne-front-changelog';
let acknowledgedInSession=false;
const changes=[
 ['Island und Zeitreise','In der Lobby wählst du die Insel oder eine der drei historischen Karten. Kroenen ist in beiden Welten spielbar. Die übrigen Bonusfiguren und die Sprengrennwagen gehören zur Insel.'],
 ['Begehbare Harbour Road','Östlich der Radarstation liegen Palm Diner, Harbour Supply und Coast Records. Durch die offenen Eingänge gelangst du zu Sitznischen, Warenregalen und Plattenkisten. Die Läden haben eigene Böden, gerahmte Drucke, Verpackungen und Einrichtung. Pendelleuchten werfen warme Lichtkegel, und die Schaufenster haben profilierte Rahmen.'],
 ['Post vom Hafenamt','Die Geschäfte auf Island haben neue Aushänge. Außen an der Ostwand des Diners kannst du am Nachlassschalter mit E einen Bescheid ziehen. Auf Island hat die MP 40 einen Katzenaufsatz mit gedämpftem Schuss.'],
 ['Licht, Küste und Inselstraße','Ein fotografierter Himmel bestimmt Tageslicht und Reflexionen. Die Harbour Road führt durch eine ausgeschilderte Hafeneinfahrt zum Anleger und zum Hafenmeisterbüro. Hinter dem Anleger liegen Hafenkräne und ein Frachter. Am Ufer rollen gestaffelte Wellen mit schmalen Schaumkanten über nassen Sand, entlang der Straße wachsen Sträucher. Die Harbour Road hat einen Zebrastreifen, Straßenabläufe und einen Schachtdeckel. Felsen haben verwitterte Oberflächen. Werkstätten und Depots tragen Dachaufbauten, Fensterrahmen und Fallrohre.'],
 ['Historische Architektur','In Köln und im Güterviertel findest du Bahnhofsuhren, eiserne Vordächer und gemauerte Gesimse. Der Deutzer Bahnhof hat ein neues Vordach, Wandlaternen und eine Abfahrtstafel am Vorplatz. Hinter den Straßen setzen sich die Häuserzeilen bis zum Horizont fort. Die Kölner Eisenbahnbrücke hat ausgearbeitete Stahlbögen und Querverbände. Am Rheinufer stehen Kaimauern mit Hochwassermarken, Auslässen und Landungstreppen. Die Wasseroberfläche zeigt Strömungsrippel. Natursteinplatten, Rinnen und Fahrspuren verbinden Kino und Güterbahnhof. Beladene Handkarren stehen im Güterhof. Über dem Kölner Rheinufer ragen die beiden gotischen Domtürme mit Maßwerk und abgestuften Spitzen auf. In den Alpen liegen gestaffelte Kalkgrate mit Schneefeldern hinter den Kasernen. Unterhalb der Grate stehen Fichten. Schneeverwehungen, Radspuren und festgetretene Wege verbinden die Kasernen mit der Passstraße. Auf den Dächern liegt ungleichmäßig verteilter Schnee.'],
 ['Uniformen und Hände','Jacken und Hosen haben sichtbare Nähte und Falten. Auf Island tragen Figuren Tarnstoff, geformte Schutzwesten und gebogene Schutzgläser. Die beiden Island-Uniformen haben eigene Gesichter mit unterschiedlichem Bartwuchs, geformte Rucksäcke und sichtbare Schultergurte. Helme und Stiefel werfen vollständigere Schatten. Zeitreise-Uniformen tragen flach anliegendes Gurtzeug und geformte Taschen. In der Egoansicht siehst du Gewebestruktur, Ärmelbündchen und Details an den Händen. Hautfalten, Knöchel und abgenutzte Bündchen reflektieren unterschiedlich.'],
 ['Union-Lichtspiele','Im Güterviertel von Operation Abendrot steht am Platz der Alten Mühle das begehbare Kino mit Art-déco-Portal und KINO-Schriftpfeiler. Sechs historische Propagandaplakate hängen in den Schaukästen. Im Saal läuft das Archivfoto von 1935.'],
 ['Zielfernrohre und historische Ausrüstung','Das Gewehr 43 mit ZF4 ergänzt den Karabiner 98k mit ZF39. Halte die rechte Maustaste für den vierfachen Zoom. Du kannst beim Zielen mit der linken Maustaste schießen.'],
 ['Zeichen und Auszeichnungen','In Köln und im Güterviertel findest du historische Luftschutzzeichen. Nach historischen Gefechten zeigt die Ergebnisansicht verdiente Auszeichnungen.'],
 ['Lobby und Fahrparcours','Die Spielauswahl nutzt auf großen Bildschirmen mehr Breite. Die Einsatzsteuerung sitzt unten. Im Inseltraining führt der Rennwagenparcours an der Küste durch eine Unterführung.'],
 ['Flüssigeres Umsehen','Beim Blick auf geschlossene Ladenwände spart der Renderer verdeckte Teile der Insel aus. Der Modus „Flüssig“ passt die interne Auflösung an die GPU-Auslastung an. Leuchtspuren werden gemeinsam gezeichnet. Staub und Metallfunken sehen unterschiedlich aus. Uniformteile werden gemeinsam gezeichnet. Entfernte Standardfiguren nutzen beim normalen Blick ein leichteres Körpermodell. Das Spiel erstellt abgelegte Figuren mit weniger Rechenarbeit. Bots können den zuvor versperrten Ausrüstungspunkt auf Island erreichen. HUD und Menüs bleiben scharf.'],
] as const;

export function ReleaseNotes(){
 const [open,setOpen]=useState(()=>{if(acknowledgedInSession)return false;try{return localStorage.getItem(storageKey)!==release;}catch{return true;}});
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(!open)return;const element=dialog.current;element?.showModal();return()=>element?.close();},[open]);
 const dismiss=()=>{acknowledgedInSession=true;try{localStorage.setItem(storageKey,release);}catch{/* Keep the acknowledgement for this app session. */}setOpen(false);};
 if(!open)return null;
 return <dialog ref={dialog} className="release-notes" aria-labelledby="release-notes-title" onCancel={event=>{event.preventDefault();dismiss();}}>
  <header><span>UPDATE · 26. NOVEMBER 2026</span><h2 id="release-notes-title">Neu in Eiserne Front</h2><p>Alle Spieländerungen seit dem 24. November. Die genannten Tasten entsprechen der Standardbelegung.</p></header>
  <div className="release-notes-content">{changes.map(([title,description])=><section key={title}><h3>{title}</h3><p>{description}</p></section>)}</div>
  <footer><button autoFocus className="release-notes-ack" onClick={dismiss}>Verstanden · zur App</button></footer>
 </dialog>;
}
