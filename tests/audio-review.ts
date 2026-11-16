import * as T from 'three';
import {createBattleAudio} from '../client/battleAudio';
import {designSound,soundDurations,type SoundName} from '../client/battleSoundDesign';

const camera=new T.PerspectiveCamera(),context=new AudioContext(),output=context.createGain(),analyser=context.createAnalyser();
output.connect(analyser);analyser.connect(context.destination);analyser.fftSize=2048;
const audio=createBattleAudio(()=>context,()=>output,camera);
const status=document.querySelector<HTMLOutputElement>('#status')!;
const labels:Record<SoundName,string>={rifle:'Karabiner',pistol:'Pistole',smg:'Maschinenpistole',g36:'Sturmgewehr',stone:'Steintreffer',wood:'Holztreffer',metal:'Metalltreffer',glass:'Glasbruch','step-stone':'Schritt · Stein','step-wood':'Schritt · Holz','step-metal':'Schritt · Metall','step-earth':'Schritt · Erde',flesh:'Körpertreffer',sever:'Körperteil abreißen',harvest:'Körperteil ernten',body:'Körper aufprallen',swing:'Körperteil schwingen',throw:'Werfen','reload-out':'Magazin entnehmen','reload-in':'Magazin einsetzen',bolt:'Durchladen',equip:'Waffenwechsel',door:'Tür',confirm:'Trefferbestätigung',hurt:'Eigener Treffer',pickup:'Aufheben',bandage:'Verbinden',saw:'Kettensäge'};
document.querySelector('#start')!.addEventListener('click',async()=>{await context.resume();await audio.load();audio.listener();status.value='Audio aktiv';});
document.querySelector('#stop')!.addEventListener('click',()=>audio.clear());
for(const name of Object.keys(soundDurations) as SoundName[]){const button=document.createElement('button');button.textContent=labels[name];button.dataset.sound=name;button.addEventListener('click',async()=>{
 await context.resume();const position=document.querySelector<HTMLSelectElement>('#position')!.value,volume=Number(document.querySelector<HTMLInputElement>('#volume')!.value);
 const point=position==='left'?new T.Vector3(-3,0,-1):position==='right'?new T.Vector3(3,0,-1):position==='far'?new T.Vector3(0,0,-30):undefined;
 audio.effect(name,point,volume,.98,position==='wall');status.value=labels[name];
});document.querySelector('#sounds')!.append(button);}
const review={audio,context,output,analyser,camera,designSound,soundDurations,T};
Object.assign(window,{audioReview:review});
