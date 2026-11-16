import * as T from 'three';
import {loadHuman,createHuman} from '../client/humanoid';
import {createAnatomy} from '../client/anatomy';
import {uniforms,type UniformId} from '../shared/uniforms';
import {makePlayer} from '../shared/game';
import {isCrawling} from '../shared/injuries';
const canvas=document.querySelector('canvas')!,select=document.querySelector<HTMLSelectElement>('#character')!,status=document.querySelector<HTMLOutputElement>('#status')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.setClearColor('#172119');renderer.toneMapping=T.ACESFilmicToneMapping;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,innerWidth/innerHeight,.01,20);camera.position.set(0,1.2,3.5);camera.lookAt(0,.9,0);scene.add(new T.HemisphereLight('#e9f3ff','#635a48',2));const light=new T.DirectionalLight('#fff4de',3.5);light.position.set(2,3,3);scene.add(light);
const ground=new T.Mesh(new T.CircleGeometry(1.5,40),new T.MeshStandardMaterial({color:'#3d4937',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;scene.add(ground);
let human:ReturnType<typeof createHuman>|undefined,anatomy:ReturnType<typeof createAnatomy>|undefined,token=0,previous=0,dead=false;
const player=makePlayer('review','Figur','de');
for(const [id,entry]of Object.entries(uniforms))select.add(new Option(entry.name,id));
select.value=new URLSearchParams(location.search).get('character')??'kroenen';
async function show(){const request=++token;status.value='Lädt …';const id=select.value as UniformId,data=await loadHuman(id);if(request!==token)return;anatomy?.dispose();if(human){human.group.removeFromParent();human.dispose();}human=createHuman(data,'de','storm',new T.MeshStandardMaterial(),id);scene.add(human.group);human.group.rotation.y=Math.PI;anatomy=createAnatomy(human.group);player.uniform=id;player.injuries.lost=0;status.value=`Bereit · ${id}`;}
select.onchange=()=>void show();document.querySelector<HTMLButtonElement>('#arm')!.onclick=()=>{player.injuries.lost|=2;status.value=`Bereit · ${select.value} · Maske ${player.injuries.lost}`;};document.querySelector<HTMLButtonElement>('#leg')!.onclick=()=>{player.injuries.lost|=16;status.value=`Bereit · ${select.value} · Maske ${player.injuries.lost}`;};document.querySelector<HTMLButtonElement>('#reset')!.onclick=()=>{player.injuries.lost=0;status.value=`Bereit · ${select.value}`;};
function frame(time:number){if(dead)return;const dt=Math.min(.1,(time-previous)/1000);previous=time;if(human){human.update(player,time,dt);human.group.rotation.set(0,Math.PI,0);human.group.position.set(0,0,0);if(isCrawling(player)){human.group.rotateX(-Math.PI/2);human.group.position.set(0,.32,-1.05);}anatomy?.setLost(player.injuries.lost);}renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);void show();
window.addEventListener('pagehide',()=>{dead=true;anatomy?.dispose();human?.dispose();ground.geometry.dispose();(ground.material as T.Material).dispose();renderer.dispose();renderer.forceContextLoss();});
