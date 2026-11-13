import React,{useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import './commanderEasterEgg.css';
export default function CommanderEasterEgg({onClose}:{onClose:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),close=useRef<HTMLButtonElement>(null);const [error,setError]=useState('');
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;close.current?.focus();
  let stopped=false,frame=0,root:T.Group|undefined;
  const renderer=new T.WebGLRenderer({canvas:canvas.current!,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.01,30);camera.position.set(.5,1.1,-3.6);
  const controls=new OrbitControls(camera,canvas.current!);controls.target.set(0,.9,0);controls.enablePan=false;controls.minDistance=2;controls.maxDistance=5;controls.update();
  scene.add(new T.HemisphereLight(0xeaf0ff,0x75806c,3));const light=new T.DirectionalLight(0xffedda,4);light.position.set(-2,3,-3);scene.add(light);
  const dispose=(group:T.Group)=>{group.traverse(o=>{if(!(o instanceof T.Mesh))return;o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v instanceof T.Texture)v.dispose();m.dispose();}});};
  void new GLTFLoader().loadAsync('/shooter/characters/bonus/commander.glb').then(g=>{if(stopped){dispose(g.scene);return;}root=g.scene;scene.add(g.scene);}).catch(()=>{if(!stopped)setError('Modell konnte nicht geladen werden.');});
  const draw=()=>{if(stopped)return;const c=canvas.current!;renderer.setSize(c.clientWidth,c.clientHeight,false);camera.aspect=c.clientWidth/Math.max(1,c.clientHeight);camera.updateProjectionMatrix();renderer.render(scene,camera);frame=requestAnimationFrame(draw);};draw();
  const keys=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose();}if(e.key==='Tab'){e.preventDefault();close.current?.focus();}};window.addEventListener('keydown',keys);
  return()=>{stopped=true;cancelAnimationFrame(frame);window.removeEventListener('keydown',keys);controls.dispose();if(root)dispose(root);renderer.dispose();renderer.forceContextLoss();previous?.focus();};
 },[]);
 return <div className="commander-backdrop" onClick={onClose}><section className="commander-dialog" role="dialog" aria-modal="true" aria-labelledby="commander-title" onClick={e=>e.stopPropagation()}><span>EASTER EGG ENTDECKT</span><h2 id="commander-title">Commander · 1946</h2><p>Fiktive Spielfigur aus Wolfenstein: The Old Blood</p><button ref={close} onClick={onClose} aria-label="Figurenvorschau schließen">Schließen ×</button><canvas ref={canvas} aria-label="Commander Ganzkörpervorschau"/>{error&&<p role="alert">{error}</p>}<small>Ziehen zum Drehen · Mausrad zum Zoomen · Esc zum Schließen</small></section></div>;
}

