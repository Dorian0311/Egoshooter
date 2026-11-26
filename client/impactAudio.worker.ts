import {designSound} from './battleSoundDesign';

export type ImpactSound='glass'|'flesh'|'body'|'stone';
export type ImpactRequest={sampleRate:number;names:readonly ImpactSound[]};
export type ImpactResult={name:ImpactSound;variant:number;samples:Float32Array}|null;

self.onmessage=({data}:MessageEvent<ImpactRequest>)=>{
 for(let variant=0;variant<4;variant++)for(const name of data.names){
  const samples=designSound(name,data.sampleRate,variant);
  self.postMessage({name,variant,samples},{transfer:[samples.buffer]});
 }
 self.postMessage(null);
};
