import React,{useEffect,useRef,useState} from 'react';
import {createScene} from './scene';
import {defaultSettings,type GameSettings} from './gameSettings';
import type {Highlight} from './highlights';
export function HighlightPlayer({clip,settings,onClose}:{clip:Highlight;settings:GameSettings;onClose:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),player=useRef<ReturnType<typeof createScene>|null>(null),restart=useRef<()=>void>(()=>{}),record=useRef<MediaRecorder|null>(null),[status,setStatus]=useState(''),[exporting,setExporting]=useState(false),aborted=useRef(false);
 const mime=typeof MediaRecorder!=='undefined'?['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type)):undefined;
 useEffect(()=>{
  if(!canvas.current||!clip.frames.length)return;const first=clip.frames[0];let running=true,index=0,started=0,raf=0;
  const scene=createScene(canvas.current,()=>{},first.snapshot.mapId,'performance',{...defaultSettings,...settings},()=>{},undefined,true);player.current=scene;scene.setEnabled(false);scene.startAudio();
  restart.current=()=>{started=0;index=0;scene.resetReplay();};
  const frame=(time:number)=>{if(!running)return;if(!started)started=time;const elapsed=time-started,start=first.snapshot.now;while(index<clip.frames.length&&clip.frames[index].snapshot.now-start<=elapsed){const f=clip.frames[index++];scene.update({...f.snapshot,phase:'playing'},f.playerId);}if(index===clip.frames.length){if(record.current?.state==='recording')record.current.stop();}raf=requestAnimationFrame(frame);};raf=requestAnimationFrame(frame);
  return()=>{aborted.current=true;running=false;cancelAnimationFrame(raf);if(record.current?.state==='recording')record.current.stop();record.current=null;scene.dispose();player.current=null;};
 },[clip.id]);
 async function exportClip(){
  if(!mime||!canvas.current||!player.current)return;try{
   aborted.current=false;setExporting(true);setStatus('Video wird lokal aufgenommen …');const playback=player.current;await playback.startAudio();
   const sourceCanvas=canvas.current,exportCanvas=document.createElement('canvas');exportCanvas.width=1280;exportCanvas.height=720;const context=exportCanvas.getContext('2d');if(!context)throw Error('Videoexport nicht verfügbar.');const copy=()=>{context.fillStyle='#000';context.fillRect(0,0,1280,720);const scale=Math.min(1280/sourceCanvas.width,720/sourceCanvas.height),w=sourceCanvas.width*scale,h=sourceCanvas.height*scale;context.drawImage(sourceCanvas,(1280-w)/2,(720-h)/2,w,h);};
   const stream=exportCanvas.captureStream(0),track=stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack,audio=playback.audioStream();if(audio)for(const t of audio.getAudioTracks())stream.addTrack(t.clone());
   const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3_000_000}),chunks:BlobPart[]=[];let failed=false;record.current=recorder;
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onerror=()=>{failed=true;playback.capture();setStatus('Videoaufnahme fehlgeschlagen.');setExporting(false);for(const t of stream.getTracks())t.stop();};
   recorder.onstop=()=>{playback.capture();for(const t of stream.getTracks())t.stop();const blob=new Blob(chunks,{type:mime});if(record.current!==recorder)return;if(aborted.current||failed){record.current=null;return;}if(!blob.size){record.current=null;setExporting(false);setStatus('Der Browser hat keine Videodaten geliefert. Bitte erneut versuchen.');return;}const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`Eiserne-Front-${clip.title}.webm`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);record.current=null;setExporting(false);setStatus('Clip lokal gespeichert.');};
   recorder.start(250);playback.capture(()=>{copy();if(typeof track.requestFrame==='function')track.requestFrame();});restart.current();
  }catch(e){setExporting(false);setStatus(e instanceof Error?e.message:'Aufnahme nicht verfügbar.');}
 }
 return <section className="highlight-player" role="dialog" aria-modal="true" aria-label="Höhepunkt wiedergeben"><nav className="highlight-controls"><strong>{clip.title}</strong><button disabled={exporting} onClick={()=>restart.current()}>Wiederholen</button><button disabled={!mime||exporting} onClick={()=>void exportClip()}>720p-WebM speichern</button><span role="status">{status||(!mime?'Videoexport wird von diesem Browser nicht unterstützt.':'Lokal · kein Upload')}</span><button onClick={onClose}>Schließen ×</button></nav><canvas ref={canvas}/></section>;
}
