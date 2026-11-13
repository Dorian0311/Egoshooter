import React,{useEffect,useRef,useState} from 'react';
import {defaultSettings,validBinding,type Action,type GameSettings} from './gameSettings';
import {graphicsPresets,type GraphicsQuality} from './graphicsSettings';
const labels:Record<Action,string>={forward:'Vorwärts',back:'Rückwärts',left:'Links',right:'Rechts',jump:'Springen',reload:'Nachladen',sprint:'Sprint',crouch:'Ducken',interact:'Benutzen',weapon1:'Gewehr',weapon2:'Pistole',weapon3:'Maschinenpistole',weapon4:'G36'};
export function GameSettingsPanel({value,onChange,onClose,graphics,onLeave}:{value:GameSettings;onChange:(value:GameSettings)=>void;onClose:()=>void;onLeave?:()=>void;graphics?:{value:GraphicsQuality;onChange:(value:GraphicsQuality)=>void}}){
  const dialog=useRef<HTMLDialogElement>(null),[notice,setNotice]=useState('');
  useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
  return <dialog className="game-settings" ref={dialog} onCancel={onClose} aria-labelledby="settings-title">
    <div className="settings-heading"><h2 id="settings-title">Dein Spielgefühl</h2><button onClick={onClose} aria-label="Einstellungen schließen">×</button></div>
    <p>Änderungen werden automatisch gespeichert. Das Multiplayer-Spiel läuft weiter.</p>
    {graphics&&<label className="settings-sprint">Grafikqualität<select aria-label="Grafikqualität" value={graphics.value} onChange={e=>graphics.onChange(e.target.value as GraphicsQuality)}>{(Object.keys(graphicsPresets) as GraphicsQuality[]).map(key=><option key={key} value={key}>{graphicsPresets[key].label}</option>)}</select></label>}
    {([['sensitivity','Mausempfindlichkeit',.2,3,.05],['aimSensitivity','Empfindlichkeit beim Zielen',.2,1.5,.05],['fov','Sichtfeld',60,100,1],['volume','Lautstärke',0,1,.05]] as const).map(([key,label,min,max,step])=><label className="settings-range" key={key}>{label}<output>{key==='fov'?`${value[key]}°`:key==='volume'?`${Math.round(value[key]*100)} %`:`${value[key].toFixed(2)}×`}</output><input type="range" min={min} max={max} step={step} value={value[key]} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}/></label>)}
    <label className="settings-toggle"><input type="checkbox" checked={value.headshotSlowMotion} onChange={e=>onChange({...value,headshotSlowMotion:e.target.checked})}/> Kopfzerplatzen in Zeitlupe bei eigenen Kopftreffern</label>
    <label className="settings-sprint">Sprint-Verhalten <select aria-label="Sprint-Verhalten" value={value.sprintMode} onChange={e=>onChange({...value,sprintMode:e.target.value==='toggle'?'toggle':'hold'})}><option value="hold">Taste gedrückt halten</option><option value="toggle">Mit Tastendruck umschalten</option></select></label>
    <p>3,2 Sekunden Sprint · kurze Erholungspause · 4 Sekunden zum vollständigen Aufladen. Die Sprint-Taste lässt sich unten ändern.</p>
    {onLeave&&<button onClick={onLeave}>Einsatz verlassen · zur Lobby</button>}
    <h3>Tastenbelegung</h3><p>Feld anklicken und gewünschte Taste drücken. Esc schließt dieses Menü.</p>
    <div className="settings-bindings">{(Object.keys(labels) as Action[]).map(action=><label key={action}>{labels[action]}<input aria-label={labels[action]} readOnly value={value.bindings[action].replace('Key','').replace('Digit','')} onKeyDown={e=>{
      if(e.code==='Escape'||e.code==='Tab')return;e.preventDefault();
      if(!validBinding(e.code)){setNotice('Bitte eine Buchstaben-, Zahlen-, Pfeil-, Umschalt-, Strg- oder Leertaste wählen.');return;}
      const other=(Object.keys(labels) as Action[]).find(k=>k!==action&&value.bindings[k]===e.code);
      if(other){setNotice(`Diese Taste ist bereits für „${labels[other]}“ belegt.`);return;}
      setNotice('');onChange({...value,bindings:{...value.bindings,[action]:e.code}});
    }}/></label>)}</div><p role="status">{notice}</p>
    <div className="settings-heading"><button onClick={()=>{onChange({...defaultSettings,bindings:{...defaultSettings.bindings}});setNotice('Standardwerte wiederhergestellt.');}}>Zurücksetzen</button><button onClick={onClose}>Fertig</button></div>
  </dialog>;
}
