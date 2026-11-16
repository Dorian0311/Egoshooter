import React from 'react';
import {CORPSE_SHIELD} from '../shared/remains';
import type {UniformId} from '../shared/uniforms';
import {characterFaceUrl} from './characterPortraits';
import './remainsHud.css';

export function VictimFace({name,uniform,headshot}:{name:string;uniform:UniformId;headshot:boolean}){
 return <aside className="victim-confirmation" aria-label="Besiegter Gegner"><img src={characterFaceUrl(uniform)} alt={`Gesicht von ${name}`} width={80} height={80}/><div><small>{headshot?'KOPFTREFFER':'ABSCHUSS'}</small><strong>{name}</strong><span>Gegner ausgeschaltet</span></div></aside>;
}
export function CorpseShield({value}:{value:number}){
 return <div className="corpse-shield" aria-label="Leichenschild"><strong>{Math.ceil(value)}<small>SCHILD</small></strong><progress aria-label="Verbleibender Leichenschild" max={CORPSE_SHIELD} value={value}/><span>{value>0?'Schützt gegen Treffer von vorn':'Schild zerstört'}</span></div>;
}
