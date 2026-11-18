import {residentProfile,residentRoles,type ResidentArchetype} from '../shared/residentProfiles';
const lines=[
 'Where the women at?',
 'I came for a drink. Apparently the bar is a crater.',
 'My retirement plan? Survive until Thursday.',
 'Great neighborhood. Terrible life expectancy.',
 'If I die, delete my browser history.',
 'That explosion voided my security deposit.',
 'The rent is killing me. The artillery is just competition.',
 'I ordered a wake-up call, not a fucking airstrike.',
 'Tell the undertaker I want a loyalty discount.',
 'Nice aim. The wall had it coming.',
 'My insurance calls this an outdoor activity.',
 'Where is the party? This funeral has terrible music.',
] as const;

export function residentSkinTone(id:string){return residentProfile(id).skinTone;}
/** Banter follows the role; shared ambient lines remain available for previews. */
export function residentLine(gestureUntil:number,id?:string){const pool=id?residentRoles[residentProfile(id).archetype].lines:lines;return pool[Math.abs(Math.floor(gestureUntil/1000))%pool.length];}

/** Optional local browser speech. Captions still work without an installed voice. */
export function createResidentVoice(){
 const speech=typeof window==='undefined'?undefined:window.speechSynthesis;
 let current:SpeechSynthesisUtterance|undefined,nextAt=0,disposed=false;
 function stop(){if(current){speech?.cancel();current=undefined;}}
 return {
  say(text:string,volume:number,now:number,archetype:ResidentArchetype='macho'){
   if(disposed||!speech||volume<=0||now<nextAt||speech.speaking)return;
   const voice=speech.getVoices().find(v=>v.localService&&/^en(?:-|$)/i.test(v.lang));
   if(!voice)return;
   const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;
   utterance.rate=residentRoles[archetype].rate;utterance.pitch=residentRoles[archetype].pitch;utterance.volume=Math.min(1,Math.max(0,volume));
   utterance.onend=utterance.onerror=()=>{if(current===utterance)current=undefined;};
   current=utterance;nextAt=now+6500;speech.speak(utterance);
  },
  stop,
  reset(){stop();nextAt=0;},
  dispose(){stop();disposed=true;},
 };
}
