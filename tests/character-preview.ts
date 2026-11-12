import {defaultUniform,uniforms,type UniformId} from '../shared/uniforms.ts';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {createMaterials} from '../client/materials.ts';
import {loadHuman,createHuman} from '../client/humanoid.ts';
import {makePlayer} from '../shared/game.ts';
const canvas=document.querySelector('canvas')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;
const scene=new T.Scene();scene.background=new T.Color('#53616a');scene.fog=new T.Fog('#53616a',8,18);
const camera=new T.PerspectiveCamera(35,1,.05,30);camera.position.set(2.1,1.5,-3.7);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,.95,0);controls.update();controls.enableDamping=true;
scene.add(new T.HemisphereLight('#dae4ed','#494a45',1.5));const key=new T.DirectionalLight('#fff0d8',3.5);key.position.set(-2,4,-3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.normalBias=.01;scene.add(key);
const rim=new T.DirectionalLight('#b6d6ed',2);rim.position.set(3,2,2);scene.add(rim);
const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.4;room.dispose();pmrem.dispose();
const floor=new T.Mesh(new T.CircleGeometry(8,64),new T.MeshStandardMaterial({color:'#545c5e',roughness:.85}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const materials=createMaterials(renderer);let human:ReturnType<typeof createHuman>|null=null;
let reviewRequest=0;let reviewPlayer=makePlayer('test','Preview','de'),lastFrame=performance.now();
async function select(variant:string,uniformId?:UniformId){const request=++reviewRequest;const team=variant==='de'?'de':'fr',map=variant==='fr'?'alpine':'cologne';const id=uniformId??defaultUniform(team,map);const data=await loadHuman(id);if(request!==reviewRequest)return;if(human){scene.remove(human.group);human.dispose();}document.querySelector("aside p")!.textContent=uniforms[id].detail;document.querySelector<HTMLSelectElement>("#uniform-review")!.value=id;human=createHuman(data,team,map,materials.get(team==='de'?'#232629':map==='cologne'?'#6c7250':'#7a795e'),id);scene.add(human.group);const p=makePlayer('test','Preview',team);p.x=p.z=0;reviewPlayer=p;human.update(p,0,1/60);}
select('de');document.querySelectorAll<HTMLButtonElement>('button[data-variant]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.variant!)));
function frame(){const now=performance.now(),dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;reviewPlayer.x+=dt*1.4;human?.update(reviewPlayer,now,dt);const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}frame();

document.querySelector('#face-detail')!.addEventListener('click',()=>{controls.target.set(0,1.48,0);camera.position.set(.32,1.6,-1.05);controls.update();});

document.querySelector<HTMLSelectElement>('#uniform-review')!.onchange=e=>{const id=(e.target as HTMLSelectElement).value as UniformId;void select(id.startsWith('de-')?'de':id.startsWith('fr-')?'fr':'us',id);};
