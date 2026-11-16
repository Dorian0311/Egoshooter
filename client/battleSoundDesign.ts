/** Original procedural foley. Built once per variation, never in the render loop. */
export type FootMaterial='stone'|'wood'|'metal'|'earth';
export type SoundName='rifle'|'pistol'|'smg'|'g36'|'stone'|'wood'|'metal'|'glass'|
 'step-stone'|'step-wood'|'step-metal'|'step-earth'|'flesh'|'sever'|'harvest'|
 'body'|'swing'|'throw'|'reload-out'|'reload-in'|'bolt'|'equip'|'door'|'confirm'|'hurt'|'pickup'|'bandage'|'saw';

export const soundDurations:Record<SoundName,number>={
 rifle:1.15,pistol:.65,smg:.45,g36:.85,stone:.3,wood:.34,metal:.65,glass:1.05,
 'step-stone':.24,'step-wood':.3,'step-metal':.4,'step-earth':.28,
 flesh:.34,sever:.85,harvest:1.35,body:.48,swing:.3,throw:.3,
 'reload-out':.3,'reload-in':.35,bolt:.32,equip:.28,door:.55,confirm:.09,hurt:.5,pickup:.25,bandage:.65,saw:1,
};

export function designSound(name:SoundName,sampleRate:number,variant=0):Float32Array{
 const out=new Float32Array(Math.ceil(soundDurations[name]*sampleRate));
 let seed=(0x9e3779b9+variant*7919+Object.keys(soundDurations).indexOf(name)*104729)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;};
 const variation=.94+random()*.12;
 function noise(at:number,length:number,amplitude:number,cutoff:number,decay=5,highpass=false,grain=0){
  const start=Math.round(at*sampleRate),count=Math.round(length*sampleRate),alpha=1-Math.exp(-2*Math.PI*cutoff/sampleRate);let low=0;
  for(let i=0;i<count&&i+start<out.length;i++){
   const white=random()*2-1;low+=alpha*(white-low);const t=i/count;
   const attack=Math.min(1,i/(sampleRate*.0015));
   const texture=grain?Math.pow(.5+.5*Math.sin(i/sampleRate*grain*2*Math.PI),2):1;
   out[start+i]+=(highpass?white-low:low)*amplitude*attack*Math.exp(-decay*t)*(1-t)*texture;
  }
 }
 function tone(at:number,length:number,amplitude:number,from:number,to=from,decay=5,grit=0){
  const start=Math.round(at*sampleRate),count=Math.round(length*sampleRate);let phase=0;
  for(let i=0;i<count&&i+start<out.length;i++){
   const t=i/count;phase+=2*Math.PI*(from*Math.pow(to/from,t))/sampleRate;
   out[start+i]+=Math.sin(phase+grit*Math.sin(phase*1.47))*amplitude*Math.min(1,i/(sampleRate*.001))*Math.exp(-decay*t)*(1-t);
  }
 }
 function clack(at:number,strength=1){noise(at,.035,.75*strength,4800);tone(at,.07,.23*strength,2100,1200,6);noise(at+.012,.06,.2*strength,900);}
 function wet(at:number,length:number,strength:number){
  noise(at,length,.46*strength,1500,2,false,37+random()*45);
  noise(at,length,.27*strength,420,2);
  const bubbles=Math.ceil(length*38);
  for(let n=0;n<bubbles;n++){const when=at+random()*length*.9;const f=180+random()*900;tone(when,.025+random()*.065,(.09+random()*.16)*strength,f,f*(.16+random()*.2),4,2);}
 }
 if(['rifle','pistol','smg','g36'].includes(name)){
  const rifle=name==='rifle',small=name==='pistol',auto=name==='smg',body=rifle?105:small?170:auto?155:125;
  noise(0,.016,1.5,1800,5,true); // supersonic crack
  noise(.002,rifle?.22:small?.095:.12,1.3,rifle?2800:4200,7);
  tone(.002,rifle?.24:.15,.95,body*variation,42,6,.3);
  noise(.012,rifle?.42:.24,.55,450,6);
  for(const [delay,level] of [[.055,.22],[.12,.13],[.205,.07]] as const)noise(delay,rifle?.65:.33,level,1900,5);
  clack(rifle?.24:.045,.21);if(rifle){clack(.52,.3);clack(.68,.22);}
 }else if(name.startsWith('step-')){
  const kind=name.slice(5);tone(0,.13,.6,kind==='wood'?125:kind==='metal'?180:85,42,6);
  noise(.003,.065,kind==='earth'?.32:.55,kind==='earth'?1600:4200,5);
  noise(.035,.17,.3,kind==='earth'?2800:1800,3,false,kind==='earth'?90:0);
  if(kind==='wood'){tone(.01,.21,.2,290,240,7,.4);tone(.018,.15,.1,620,450,6);}
  if(kind==='metal')for(const f of [390,710,1250])tone(.004,.32,.11,f,f*.96,7);
  if(kind==='earth')for(let i=0;i<14;i++)noise(.025+random()*.12,.009+random()*.02,.17,4000,4);
 }else if(name==='flesh'){tone(0,.14,.75,140,48,5,.8);wet(.005,.28,.85);noise(0,.028,.5,2900);}
 else if(name==='sever'||name==='harvest'){
  const harvest=name==='harvest',tear=harvest?.75:.38;
  wet(0,tear,1);noise(.01,tear,.8,2600,1.2,false,110);
  for(let i=0;i<(harvest?13:7);i++){const at=.025+i*tear/(harvest?14:8)+random()*.018;noise(at,.025,.7,3800);tone(at,.06,.3,320+random()*420,90,7,.8);}
  const snap=tear*.85;noise(snap,.045,1,5200);tone(snap,.2,.8,125,35,6);
  wet(snap+.04,harvest?.55:.4,.85);tone(snap+.11,.22,.35,85,30,4,.6);
 }else if(name==='body'){tone(0,.26,.9,100,32,5,.6);noise(0,.1,.6,550);wet(.02,.3,.55);noise(.15,.16,.16,1800);}
 else if(name==='glass'){
  noise(0,.13,.8,1800,5,true);
  for(let i=0;i<35;i++){const at=i===0?0:random()*.75,frequency=1800+random()*7000;tone(at,.025+random()*.13,(i===0?.5:.17)*(1-at),frequency,frequency*.98,7);noise(at,.018,.15,3600,5,true);}
 }else if(name==='metal'){clack(0,.9);for(const f of [330,780,1640,3100])tone(.002,.58,.22,f*variation,f*.97,6);}
 else if(name==='wood'||name==='door'){tone(0,.24,.8,155,65,5,.4);noise(.005,.15,.7,1600);if(name==='door'){tone(.03,.4,.15,290,115,3,1);clack(.18,.3);}}
 else if(name==='stone'){noise(0,.095,.9,4800);tone(0,.1,.65,190,60,7);for(let i=0;i<9;i++)noise(.025+random()*.18,.025,.15,3500);}
 else if(name==='swing'||name==='throw'){noise(0,.28,.65,name==='swing'?1800:3800,1,false,0);noise(.045,.16,.4,700,2);}
 else if(name==='reload-out'){clack(0,.65);noise(.06,.2,.45,2100,2);clack(.16,.3);}
 else if(name==='reload-in'){noise(0,.14,.4,1600,2);clack(.055,.85);tone(.055,.14,.3,280,130,5);clack(.17,.35);}
 else if(name==='bolt'||name==='equip'){clack(0,.7);noise(.025,.16,.45,2800,3);clack(name==='bolt'?.15:.1,.8);}
 else if(name==='confirm'){noise(0,.024,.4,2200,5,true);tone(0,.065,.18,1450,900,6);}
 else if(name==='hurt'){tone(0,.4,.7,62,30,5,.2);noise(0,.24,.3,380,5);}
 else if(name==='pickup'){noise(0,.2,.6,2400,3);clack(.08,.35);}
 else if(name==='bandage'){noise(0,.6,.5,2700,2,false,24);noise(.1,.25,.4,800,3);}
 else if(name==='saw'){
  // Integer harmonics and periodic modulation produce a seamless one-second engine loop.
  for(let i=0;i<out.length;i++){const t=i/sampleRate,phase=2*Math.PI*73*t;out[i]=(.4*Math.sin(phase)+.22*Math.sin(phase*2)+.15*Math.sin(phase*3)+.08*Math.sin(phase*7))*(.8+.2*Math.sin(2*Math.PI*29*t));}
 }
 // Preserve transients and headroom; silent tail and DC removal prevent clicks.
 if(name!=='saw'){
  let mean=0;for(const value of out)mean+=value;mean/=out.length;
  for(let i=0;i<out.length;i++){const fade=Math.min(1,i/(sampleRate*.001),(out.length-1-i)/(sampleRate*.012));out[i]=(out[i]-mean)*fade;}
 }
 let peak=0;for(const value of out)peak=Math.max(peak,Math.abs(value));
 const scale=peak>.92?.92/peak:1;for(let i=0;i<out.length;i++)out[i]*=scale;
 return out;
}
