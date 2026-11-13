export const defaultBindings={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',reload:'KeyR',sprint:'ShiftLeft',crouch:'KeyC',interact:'KeyE',weapon1:'Digit1',weapon2:'Digit2',weapon3:'Digit3',weapon4:'Digit4'};
export type Action=keyof typeof defaultBindings;
export type GameSettings={sensitivity:number;aimSensitivity:number;fov:number;volume:number;headshotSlowMotion:boolean;sprintMode:'hold'|'toggle';bindings:Record<Action,string>};
export const defaultSettings:GameSettings={sensitivity:1,aimSensitivity:.65,fov:72,volume:.7,headshotSlowMotion:true,sprintMode:'hold',bindings:{...defaultBindings}};
export const settingsKey='altstadt-game-settings-v1';
export function validBinding(code:string){return /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Control(Left|Right)|Space|Tab)$/.test(code);}
export function parseSettings(value:unknown):GameSettings{
  const v=value&&typeof value==='object'?value as Partial<GameSettings>:{};
  const clamp=(n:unknown,fallback:number,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
  const bindings={...defaultBindings};
  if(v.bindings&&typeof v.bindings==='object'){
    const entries=Object.keys(bindings) as Action[];
    const proposed=entries.map(k=>v.bindings?.[k]??defaultBindings[k]);
    if(!v.bindings.interact){const used=entries.filter(k=>k!=='interact').map(k=>v.bindings?.[k]??defaultBindings[k]);proposed[entries.indexOf('interact')]=['KeyE','KeyF','KeyG','KeyV','KeyB','KeyN','KeyM','KeyQ','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP'].find(k=>!used.includes(k))??'KeyE';}
    if(proposed.every(k=>typeof k==='string'&&validBinding(k))&&new Set(proposed).size===entries.length)entries.forEach((k,n)=>bindings[k]=proposed[n]);
  }
  return {sensitivity:clamp(v.sensitivity,1,.2,3),aimSensitivity:clamp(v.aimSensitivity,.65,.2,1.5),fov:clamp(v.fov,72,60,100),volume:clamp(v.volume,.7,0,1),headshotSlowMotion:typeof v.headshotSlowMotion==='boolean'?v.headshotSlowMotion:true,sprintMode:v.sprintMode==='toggle'?'toggle':'hold',bindings};
}
export function loadSettings():GameSettings{try{return parseSettings(JSON.parse(localStorage.getItem(settingsKey)??'null'));}catch{return parseSettings(null);}}
