import React,{useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {uniforms,type UniformId} from '../shared/uniforms';
import {makePlayer} from '../shared/game';
import {loadHuman,createHuman} from './humanoid';
import type {MapId} from '../shared/world';

export function ModelPreview({id,team,map}:{id:UniformId;team:'de'|'fr';map:MapId}){
 const canvas=useRef<HTMLCanvasElement>(null),[status,setStatus]=useState('Modell wird geladen …');
 useEffect(()=>{
  let stopped=false,raf=0,human:ReturnType<typeof createHuman>|undefined,renderer:T.WebGLRenderer|undefined;
  const surface=canvas.current!,scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.01,50);
  const material=new T.MeshStandardMaterial({color:uniforms[id].color});
  let dragging=false,previous=0,rotation=-.12;
  const down=(e:PointerEvent)=>{dragging=true;previous=e.clientX;surface.setPointerCapture(e.pointerId);};
  const drag=(e:PointerEvent)=>{if(dragging){rotation+=(e.clientX-previous)*.012;previous=e.clientX;}};
  const up=()=>{dragging=false;};
  surface.addEventListener('pointerdown',down);surface.addEventListener('pointermove',drag);surface.addEventListener('pointerup',up);surface.addEventListener('pointercancel',up);
  setStatus('Modell wird geladen …');
  try{
   renderer=new T.WebGLRenderer({canvas:surface,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
   scene.add(new T.HemisphereLight(0xe8f4ff,0x65715e,3));
   const key=new T.DirectionalLight(0xffe9cd,4);key.position.set(-3,4,-4);scene.add(key);
   const rim=new T.DirectionalLight(0x92caff,4);rim.position.set(3,3,2);scene.add(rim);
   void loadHuman(id).then(data=>{
    if(stopped)return;
    human=createHuman(data,team,map,material,id);scene.add(human.group);human.update(makePlayer('preview','Preview',team),0,1/60);
    human.group.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(human.group,true),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
    const pivot=new T.Group();scene.remove(human.group);pivot.add(human.group);human.group.position.sub(center);scene.add(pivot);
    let last=performance.now();const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame=(now:number)=>{
     if(stopped||!renderer)return;
     if(document.hidden||now-last<1000/30){raf=requestAnimationFrame(frame);return;}
     const dt=Math.min((now-last)/1000,.05);last=now;
     if(!dragging&&!reduced)rotation+=dt*.12;pivot.rotation.y=rotation;
     const width=surface.clientWidth||600,height=surface.clientHeight||400;
     if(surface.width!==Math.floor(width*renderer.getPixelRatio())||surface.height!==Math.floor(height*renderer.getPixelRatio()))renderer.setSize(width,height,false);camera.aspect=width/height;
     const distance=Math.max(size.y,Math.hypot(size.x,size.z)/camera.aspect)/(2*Math.tan(T.MathUtils.degToRad(16)))*1.18;
     camera.position.set(0,.02,-distance);camera.lookAt(0,0,0);camera.updateProjectionMatrix();renderer.render(scene,camera);raf=requestAnimationFrame(frame);
    };setStatus('');raf=requestAnimationFrame(frame);
   }).catch(()=>{if(!stopped)setStatus('Modell nicht verfügbar. Du kannst die Figur trotzdem auswählen.');});
  }catch{setStatus('Die 3D-Vorschau ist auf diesem Gerät nicht verfügbar.');}
  return()=>{stopped=true;cancelAnimationFrame(raf);surface.removeEventListener('pointerdown',down);surface.removeEventListener('pointermove',drag);surface.removeEventListener('pointerup',up);surface.removeEventListener('pointercancel',up);human?.dispose();material.dispose();renderer?.dispose();renderer?.forceContextLoss();};
 },[id,team,map]);
 return <div className="model-stage"><div className="model-orbit"/><canvas ref={canvas} aria-label={`Drehbare 3D-Vorschau: ${uniforms[id].name}`} />{status&&<span className="model-status" role="status">{status}</span>}<span className="model-drag-hint">360° · Zum Drehen ziehen</span></div>;
}
