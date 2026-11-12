"use client";
import {lazy,Suspense,useEffect,useState} from 'react';
const Shooter=lazy(()=>import('../shooter/client/App'));
export function ShooterGate({accessToken}:{accessToken?:string}){
  const [open,setOpen]=useState(false);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.ctrlKey&&event.altKey&&event.code==='KeyG'&&!event.repeat){event.preventDefault();setOpen(v=>!v);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  return open?<Suspense fallback={<div role="status">Altstadt wird geladen …</div>}><Shooter accessToken={accessToken} onClose={()=>setOpen(false)}/></Suspense>:null;
}
