import * as T from 'three';
type Surface='footstep'|'metal'|'wood'|'stone'|'glass';
export function createBattleAudio(context:()=>AudioContext|null,output:()=>AudioNode|null,camera:T.Camera){
 const buffers=new Map<string,AudioBuffer[]>();let loading:Promise<void>|undefined,sequence=0,disposed=false;
 function spatial(source:AudioNode,point:T.Vector3|undefined,volume:number){const audio=context(),sink=output();if(!audio||!sink)return;const gain=audio.createGain();gain.gain.value=volume;source.connect(gain);
  if(point){const pan=audio.createPanner();pan.panningModel='HRTF';pan.distanceModel='inverse';pan.refDistance=4;pan.maxDistance=100;pan.rolloffFactor=1.1;pan.positionX.value=point.x;pan.positionY.value=point.y;pan.positionZ.value=point.z;gain.connect(pan).connect(sink);}else gain.connect(sink);
 }
 return {
  load(){if(loading)return loading;const audio=context();if(!audio)return Promise.resolve();loading=fetch('/shooter/audio/manifest.json').then(r=>{if(!r.ok)throw Error('Audio manifest unavailable');return r.json();}).then(async manifest=>{await Promise.all(Object.entries(manifest as Record<string,string[]>).map(async([key,files])=>{const decoded=await Promise.all(files.map(async file=>{const response=await fetch(file);if(!response.ok)throw Error('Audio unavailable');return audio.decodeAudioData(await response.arrayBuffer());}));if(!disposed)buffers.set(key,decoded);}));}).catch(()=>{/* Existing synthesised feedback remains available if samples cannot load. */});return loading;},
  sample(surface:Surface,point:T.Vector3|undefined,volume:number,rate=1){const audio=context(),options=buffers.get(surface);if(!audio||audio.state!=='running'||!options?.length||disposed)return false;const source=audio.createBufferSource();source.buffer=options[sequence++%options.length];source.playbackRate.value=rate;spatial(source,point,volume);source.start();return true;},
  shot(weapon:number,point:T.Vector3|undefined,volume:number,muffled:boolean){const audio=context();if(!audio||audio.state!=='running'||disposed||volume<=0)return;
   const duration=weapon===0?.30:weapon===1?.12:.16,buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate),data=buffer.getChannelData(0);
   let seed=(++sequence*1664525+1013904223)>>>0;for(let n=0;n<data.length;n++){seed=(seed*1664525+1013904223)>>>0;const t=n/audio.sampleRate;data[n]=((seed/0xffffffff)*2-1)*Math.exp(-t/(weapon===0?.065:.025));}
   const source=audio.createBufferSource(),filter=audio.createBiquadFilter();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=muffled?850:weapon===0?4200:weapon===1?6500:5200;source.connect(filter);spatial(filter,point,volume*(weapon===0?.65:.40)*(muffled?.3:1));source.start();
  },
  listener(){const audio=context();if(!audio)return;const p=camera.position,d=new T.Vector3();camera.getWorldDirection(d);const up=camera.up;audio.listener.positionX.value=p.x;audio.listener.positionY.value=p.y;audio.listener.positionZ.value=p.z;audio.listener.forwardX.value=d.x;audio.listener.forwardY.value=d.y;audio.listener.forwardZ.value=d.z;audio.listener.upX.value=up.x;audio.listener.upY.value=up.y;audio.listener.upZ.value=up.z;},
  dispose(){disposed=true;buffers.clear();},
 };
}
