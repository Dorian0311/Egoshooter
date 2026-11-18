import * as T from 'three';
import type {World} from '../shared/world';
import {insideBuilding} from '../shared/interiors';
import {designSound,type SoundName,type FootMaterial} from './battleSoundDesign';

type Surface='footstep'|'metal'|'wood'|'stone'|'glass';
type Position={x:number;y:number;z:number};
type Voice={source:AudioBufferSourceNode;stop:()=>void};
type Engine={source:AudioBufferSourceNode;gain:GainNode;filter:BiquadFilterNode;pan:PannerNode};
export type StepState=Position&{distance:number;grounded:boolean;life?:number};

export function footstepMaterial(world:World,p:Position):FootMaterial{
 const support=world.boxes.find(b=>Math.abs(p.x-b.x)<=b.w/2&&Math.abs(p.z-b.z)<=b.d/2&&Math.abs(p.y-(b.y+b.h/2))<.32);
 if(support&&['truck','container','fence','metal'].includes(support.kind??''))return 'metal';
 if(support?.kind==='stair'||support?.kind==='floor'&&insideBuilding(world,p.x,p.z)>=0)return 'wood';
 if(insideBuilding(world,p.x,p.z)>=0||support)return 'stone';
 return world.id==='cologne'?'stone':'earth';
}

/** Distance-based cadence ignores walls, jumps, teleports and respawns. */
export function advanceFootstep(previous:StepState|undefined,p:Position&{grounded:boolean;hp:number;crouching:boolean;sprinting:boolean;life?:number},eligible=true){
 const travel=previous?Math.hypot(p.x-previous.x,p.z-previous.z):0;
 const reset=!previous||!eligible||!p.hp||p.life!==previous.life||!p.grounded||!previous.grounded||travel>3||Math.abs(p.y-previous.y)>1;
 let distance=reset?0:previous.distance+travel;
 const stride=p.crouching?.95:p.sprinting?1.85:1.45,step=distance>=stride;
 if(step)distance%=stride;
 return {state:{x:p.x,y:p.y,z:p.z,distance,grounded:p.grounded,life:p.life},step};
}

export function weaponSound(weapon:number,name=''):SoundName{
 if(weapon===4)return 'saw';if(weapon===5)return 'throw';if(weapon===6)return 'swing';
 if(weapon<4)return (['rifle','pistol','smg','g36'] as const)[weapon]??'rifle';
 if(/pistol|p38|luger|colt|revolver|m1911|tt.?33|webley/i.test(name))return 'pistol';
 if(/maschinenpistole|\bmp\s?\d|thompson|sten|ppsh|pps.?43|grease|beretta|\bm3\b/i.test(name))return 'smg';
 if(/sturm|g36|stg|fg\s?42|automatic|\bbar\b|bren|\bmg\s?\d/i.test(name))return 'g36';
 return 'rifle';
}

export function createBattleAudio(context:()=>AudioContext|null,output:()=>AudioNode|null,camera:T.Camera){
 const buffers=new Map<string,AudioBuffer>(),voices=new Set<Voice>(),engines=new Map<string,Engine>();
 const sequences=new Map<SoundName,number>();let disposed=false,mix:DynamicsCompressorNode|undefined,limiter:WaveShaperNode|undefined,mixSink:AudioNode|null=null;
 let reloadVoices:Voice[]=[];
 const direction=new T.Vector3(),position=new T.Vector3(),up=new T.Vector3(),rotation=new T.Quaternion();
 function sink(){const audio=context(),target=output();if(!audio||!target||disposed)return;
  if(!mix){mix=audio.createDynamicsCompressor();mix.threshold.value=-13;mix.knee.value=8;mix.ratio.value=8;mix.attack.value=.003;mix.release.value=.16;
   limiter=audio.createWaveShaper();const curve=new Float32Array(4097);
   for(let i=0;i<curve.length;i++){const x=i/2048-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.65?a:.65+.33*Math.tanh((a-.65)/.33));}
   limiter.curve=curve;mix.connect(limiter);
  }
  if(target!==mixSink){limiter!.disconnect();limiter!.connect(target);mixSink=target;}return mix;
 }
 function buffer(name:SoundName,variant:number){const audio=context();if(!audio)return;const key=`${name}:${variant}`;let cached=buffers.get(key);
  if(!cached){const data=designSound(name,audio.sampleRate,variant);cached=audio.createBuffer(1,data.length,audio.sampleRate);cached.getChannelData(0).set(data);buffers.set(key,cached);}return cached;
 }
 function panner(point:Position){const audio=context()!,pan=audio.createPanner();pan.panningModel='equalpower';pan.distanceModel='inverse';pan.refDistance=3;pan.maxDistance=110;pan.rolloffFactor=1.25;pan.positionX.value=point.x;pan.positionY.value=point.y;pan.positionZ.value=point.z;return pan;}
 function play(name:SoundName,point:Position|undefined,volume:number,rate=1,muffled=false,delay=0,echo=false):Voice|undefined{
  const audio=context(),target=sink();if(!audio||audio.state!=='running'||!target||disposed||volume<=0)return;
  if(point&&camera.position.distanceToSquared(new T.Vector3(point.x,point.y,point.z))>110*110)return;
  if(voices.size>=64){if(point)return;voices.values().next().value?.stop();}
  const sequence=sequences.get(name)??0;sequences.set(name,sequence+1);
  const source=audio.createBufferSource(),gain=audio.createGain(),filter=audio.createBiquadFilter(),nodes:AudioNode[]=[source,gain,filter];
  source.buffer=buffer(name,sequence%4)??null;if(!source.buffer)return;
  source.playbackRate.value=rate*(.975+(sequence*7%11)*.005);filter.type='lowpass';filter.frequency.value=muffled?1050:18000;
  gain.gain.value=volume*(muffled?.38:1);source.connect(filter).connect(gain);
  let tail:AudioNode=gain;if(point){const pan=panner(point);nodes.push(pan);gain.connect(pan);tail=pan;}tail.connect(target);
  if(echo){const reflection=audio.createDelay(.2),level=audio.createGain();reflection.delayTime.value=.078;level.gain.value=.12;nodes.push(reflection,level);tail.connect(reflection).connect(level).connect(target);}
  let stopped=false;
  const voice:Voice={source,stop(){if(stopped)return;stopped=true;source.stop();for(const node of nodes)node.disconnect();voices.delete(voice);}};
  voices.add(voice);source.onended=()=>{stopped=true;for(const node of nodes)node.disconnect();voices.delete(voice);};source.start(audio.currentTime+delay);return voice;
 }
 function effect(name:SoundName,point:Position|undefined,volume:number,rate=1,muffled=false){return !!play(name,point,volume,rate,muffled);}
 function cancelReload(){for(const voice of reloadVoices)voice.stop();reloadVoices=[];}
 function stopEngine(id:string){const engine=engines.get(id);if(!engine)return;engine.source.stop();engine.source.disconnect();engine.gain.disconnect();engine.filter.disconnect();engine.pan.disconnect();engines.delete(id);}
 return {
  async load(){if(disposed)return;for(const name of ['rifle','pistol','smg','g36','step-stone','step-earth','sever'] as const)for(let n=0;n<4;n++)buffer(name,n);buffer('rc-engine',0);buffer('rc-warning',0);},
  sample(surface:Surface,point:T.Vector3|undefined,volume:number,rate=1){return effect(surface==='footstep'?'step-stone':surface,point,volume,rate);},
  effect,
  shot(weapon:number,point:T.Vector3|undefined,volume:number,muffled:boolean,name='',indoors=false){effect(weaponSound(weapon,name),point,volume*(weapon===0?.85:weapon===4?.28:.6),1,muffled);if(indoors)play('stone',point,volume*.09,.7,muffled,.055,true);},
  footstep(material:FootMaterial,point:T.Vector3|undefined,volume:number,sprinting=false,crouching=false,muffled=false){effect(`step-${material}`,point,volume*(crouching?.35:sprinting?1:.7),sprinting?1.06:crouching?.9:1,muffled);},
  reload(weapon:number,duration:number,volume:number){cancelReload();if(weapon===4)return;reloadVoices=[play('reload-out',undefined,volume*.21),play('reload-in',undefined,volume*.25,1,false,duration*.62),play('bolt',undefined,volume*.22,1,false,Math.max(.2,duration-.28))].filter((v):v is Voice=>!!v);},
  cancelReload,
  engines(actors:{id:string;point:T.Vector3;active:boolean;muffled:boolean;carSpeed?:number}[],volume:number){
   const audio=context(),target=sink();if(!audio||audio.state!=='running'||!target)return;
   const present=new Set<string>();
   for(const actor of actors){if(volume<=0||camera.position.distanceToSquared(actor.point)>45*45)continue;present.add(actor.id);let engine=engines.get(actor.id);
    const car=actor.carSpeed!==undefined,load=Math.min(1,Math.abs(actor.carSpeed??0)/5.5);
    if(!engine){const source=audio.createBufferSource(),gain=audio.createGain(),filter=audio.createBiquadFilter(),pan=panner(actor.point);source.buffer=buffer(car?'rc-engine':'saw',0)??null;source.loop=true;gain.gain.value=0;source.connect(filter).connect(gain).connect(pan).connect(target);source.start();engine={source,gain,filter,pan};engines.set(actor.id,engine);}
    engine.source.playbackRate.setTargetAtTime(car?.95+load*1.65:actor.active?1.9:.85,audio.currentTime,.08);
    engine.gain.gain.setTargetAtTime(volume*(car?.035+load*.07:actor.active?.23:.065)*(actor.muffled?.35:1),audio.currentTime,.06);
    engine.filter.frequency.setTargetAtTime(actor.muffled?650:car?2100+load*1800:actor.active?6500:2200,audio.currentTime,.06);
    engine.pan.positionX.value=actor.point.x;engine.pan.positionY.value=actor.point.y;engine.pan.positionZ.value=actor.point.z;
   }
   for(const id of engines.keys())if(!present.has(id))stopEngine(id);
  },
  listener(){const audio=context();if(!audio||disposed)return;camera.getWorldPosition(position);camera.getWorldDirection(direction);camera.getWorldQuaternion(rotation);up.set(0,1,0).applyQuaternion(rotation);const listener=audio.listener;
   listener.positionX.value=position.x;listener.positionY.value=position.y;listener.positionZ.value=position.z;listener.forwardX.value=direction.x;listener.forwardY.value=direction.y;listener.forwardZ.value=direction.z;listener.upX.value=up.x;listener.upY.value=up.y;listener.upZ.value=up.z;
  },
  clear(){cancelReload();for(const voice of [...voices])voice.stop();for(const id of engines.keys())stopEngine(id);},
  dispose(){this.clear();disposed=true;buffers.clear();mix?.disconnect();limiter?.disconnect();mix=undefined;limiter=undefined;mixSink=null;},
 };
}
