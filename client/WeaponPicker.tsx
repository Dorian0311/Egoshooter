import React,{useEffect,useRef,useState} from 'react';
import {historicalWeaponIds,weapons,validLoadout,type Loadout,type WeaponId} from '../shared/weapons';
import {uniforms,type UniformId} from '../shared/uniforms';
import './weaponPicker.css';

const kindLabels={rifle:'Gewehr',pistol:'Pistole',smg:'Maschinenpistole',assault:'Sturmgewehr',lmg:'Maschinengewehr',melee:'Nahkampf',special:'Spezial'};
const descriptions:Partial<Record<WeaponId,string>>={0:'Präziser Repetierer für große Entfernungen.',1:'Kompakte Seitenwaffe mit kurzem Nachladen.',2:'Schnelle Feuerstöße auf kurze Distanz.',7:'Vielseitig auf mittlere Entfernung.',8:'Halbautomatisches Gewehr mit kräftigen Einzelschüssen.',9:'Hohe Feuerrate, starkes Streuen und langes Nachladen.',10:'Kontrollierbare Maschinenpistole mit Holzschaft.',11:'Schnelle Seitenwaffe für den Nahbereich.',12:'Kräftiges automatisches Gewehr.',13:'Repetierbüchse mit ZF39-Zielfernrohr für weite Distanzen.',16:'Halbautomatisches Scharfschützengewehr mit 4×-Zoom. Rechte Maustaste zum Zielen halten.'};
function savedSelection(uniform:UniformId):WeaponId[]{
  try{const value:unknown=JSON.parse(localStorage.getItem('altstadt-loadout')??'null');if(validLoadout(value,uniform)&&value.every(id=>historicalWeaponIds.includes(id)||id===4))return [...value];}catch{/* Choose a new loadout when storage is unavailable. */}
  return [];
}
export function WeaponPicker({uniform,busy,error,onBack,onClose,onStart}:{uniform:UniformId;busy:boolean;error:string;onBack:()=>void;onClose:()=>void;onStart:(loadout:Loadout)=>void}){
  const dialog=useRef<HTMLDialogElement>(null),[selected,setSelected]=useState<WeaponId[]>(()=>savedSelection(uniform));
  useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
  const ids:readonly WeaponId[]=uniform==='leatherface'?[...historicalWeaponIds,4]:historicalWeaponIds;
  function toggle(id:WeaponId){setSelected(old=>old.includes(id)?old.filter(w=>w!==id):old.length<5?[...old,id]:old);}
  function start(){if(!validLoadout(selected,uniform)||busy)return;try{localStorage.setItem('altstadt-loadout',JSON.stringify(selected));}catch{/* Session only. */}onStart([...selected]);}
  return <dialog ref={dialog} className="weapon-picker" aria-labelledby="weapon-picker-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
    <header><div><small>SCHRITT 2 VON 2 · {uniforms[uniform].name}</small><h2 id="weapon-picker-title">Deine fünf Waffen</h2></div><button disabled={busy} onClick={onClose} aria-label="Waffenauswahl schließen">×</button></header>
    <p>Wähle genau fünf Waffen. Die Reihenfolge deiner Auswahl bestimmt die Plätze auf den Tasten 1–5.</p>
    <ol className="loadout-slots" aria-label="Gewählte Waffen">{Array.from({length:5},(_,slot)=><li key={slot}><b>{slot+1}</b><span>{selected[slot]===undefined?'Noch frei':weapons[selected[slot]].name}</span></li>)}</ol>
    <div className="weapon-selection-count" role="status">{selected.length} / 5 ausgewählt{selected.length===5?' · Bereit für den Einsatz':' · Noch '+(5-selected.length)+' auswählen'}</div>
    <div className="weapon-picker-content">
      <div className="weapon-catalog">{ids.map(id=>{const w=weapons[id],slot=selected.indexOf(id),chosen=slot>=0;return <button key={id} className={chosen?'chosen':''} title={descriptions[id]??'Leatherfaces charakteristische Kettensäge.'} aria-pressed={chosen} disabled={busy||!chosen&&selected.length===5} onClick={()=>toggle(id)}>
        <div className="weapon-card-heading"><small>{kindLabels[w.kind]}</small><b>{chosen?'✓ '+(slot+1):'+'}</b></div>
        <img className="weapon-card-image" src={`/shooter/lobby/weapons/${id===16?8:id}.webp`} alt="" width={384} height={144}/>
        <strong>{w.name}{id===16&&' · 4× Zoom'}</strong>
        <span>{w.kind!=='melee'&&`${w.mag} Schuss · `}{w.damage} Schaden · {w.range}{'\u00a0'}m</span>
      </button>;})}</div>
      {uniform==='leatherface'&&<p className="weapon-note">Die Kettensäge ist optional. Auch Leatherface kann zwischen seinen fünf gewählten Waffen wechseln.</p>}
      <p className="weapon-note">Bei Armverlust oder beim Tragen eines Körpers steht eine Notfallpistole bereit.</p>
    </div>
    {error&&<p className="weapon-picker-error" role="alert">{error}</p>}
    <footer><button disabled={busy} onClick={onBack}>← Charakter ändern</button><button className="loadout-start" disabled={busy||!validLoadout(selected,uniform)} onClick={start}>{busy?'Verbinde …':'Mit diesen 5 Waffen starten ↗'}</button></footer>
  </dialog>;
}
