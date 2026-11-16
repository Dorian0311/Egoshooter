import * as T from 'three';
import {loadHuman,createHuman} from '../client/humanoid';
import {createAnatomy} from '../client/anatomy';
import {uniforms,type UniformId} from '../shared/uniforms';
import {makePlayer} from '../shared/game';

const renderer=new T.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(192,192);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
const scene=new T.Scene();scene.add(new T.HemisphereLight('#e5edff','#68685b',2.5));const key=new T.DirectionalLight('#fff0dc',3);key.position.set(-2,3,-4);scene.add(key);const rim=new T.DirectionalLight('#b3d8ff',1.8);rim.position.set(2,2,2);scene.add(rim);
async function renderFace(id:UniformId){
 if(!Object.hasOwn(uniforms,id))throw Error('Unknown figure');const team=id.startsWith('fr-')||id==='us-field'||id==='task-sand'?'fr':'de',map=id.startsWith('task-')?'storm':id.startsWith('fr-')?'alpine':'cologne';
 const material=new T.MeshStandardMaterial({color:uniforms[id].color}),data=await loadHuman(id),human=createHuman(data,team,map,material,id);let head:T.Group|undefined,anatomy:ReturnType<typeof createAnatomy>|undefined;
 try{scene.add(human.group);const player=makePlayer('portrait','Portrait',team);player.uniform=id;player.yaw=player.pitch=0;human.update(player,0,1/60,0);await new Promise(resolve=>setTimeout(resolve,650));human.group.updateWorldMatrix(true,true);anatomy=createAnatomy(human.group);head=anatomy.detach('head');if(!head)throw Error('No head geometry for '+id);human.group.removeFromParent();
  // Portraits show the actual face; the cut surface stays outside the crop.
  head.traverse(o=>{if(o.name.startsWith('wound-'))o.visible=false;});scene.add(head);head.updateWorldMatrix(true,true);const box=new T.Box3().setFromObject(head,true),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());center.y-=size.y*.09;
  const camera=new T.PerspectiveCamera(30,1,.005,20),distance=Math.max(size.y*.85,size.x*.95,size.z*.75)/(2*Math.tan(T.MathUtils.degToRad(15)))*1.07;camera.position.copy(center).add(new T.Vector3(.07,uniforms[id].headgear==='helmet'?-.18:.02,-1).normalize().multiplyScalar(distance));camera.lookAt(center);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/webp',.91);
 }finally{head?.removeFromParent();head?.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});anatomy?.dispose();human.group.removeFromParent();human.dispose();material.dispose();}
}
Object.assign(window,{faceExport:{ids:Object.keys(uniforms),render:renderFace}});
