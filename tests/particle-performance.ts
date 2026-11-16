import * as T from 'three';
import {createHitEffects} from '../client/hitEffects';
const renderer=new T.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setClearColor('#16221a');const camera=new T.PerspectiveCamera(45,innerWidth/innerHeight,.01,50);camera.position.set(0,1.6,4);camera.lookAt(0,1.3,0);
const scene=new T.Scene();scene.add(new T.HemisphereLight('#f1f3ed','#42352e',3));let active:ReturnType<typeof createHitEffects>|undefined;
async function burst(legacy=false){active?.dispose();const legacyModule='/artifacts/movement-combat-20261116/baseline-hit-effects.ts',module=legacy?await import(/* @vite-ignore */ legacyModule):null;active=module?module.createHitEffects(scene):createHitEffects(scene);for(let n=0;n<20;n++)active!.emit({type:'kill',id:'a',hitZone:'head',point:[n*.005,1.3,0]});const start=performance.now();renderer.render(scene,camera);return {drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,cpuMs:performance.now()-start};}
Object.assign(window,{particleReview:{burst}});
