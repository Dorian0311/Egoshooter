import React,{useEffect,useRef} from 'react';
import {CharacterGallery} from './CharacterGallery';
import type {UniformId} from '../shared/uniforms';
import {getWorld,type MapId} from '../shared/world';

export function CharacterPicker({map,value,onSelect,onClose}:{map:MapId;value:UniformId|'';onSelect:(id:UniformId)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
 return <dialog className="character-picker" ref={dialog} onCancel={onClose} aria-labelledby="character-picker-title">
  <header><div><h2 id="character-picker-title">Figur für deinen Einsatz</h2><small>{getWorld(map).name}</small></div><button onClick={onClose} aria-label="Charakterauswahl schließen">×</button></header>
  <CharacterGallery compact actionLabel="Mit dieser Figur starten" team="de" map={map} value={value} onChange={onSelect}/>
 </dialog>;
}
