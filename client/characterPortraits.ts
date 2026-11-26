import * as T from 'three';
import {loadHuman,createHuman} from './humanoid';
import {makePlayer} from '../shared/game';
import {uniforms,type UniformId} from '../shared/uniforms';

// Cache lightweight still images; never keep a gallery full of live WebGL scenes.
const cache=new Map<UniformId,Promise<string>>();
let queue:Promise<unknown>=Promise.resolve();
export function characterPortrait(id:UniformId):Promise<string>{
 const existing=cache.get(id);if(existing)return existing;
 const result=queue.then(()=>renderPortrait(id)).catch(error=>{cache.delete(id);throw error;});
 cache.set(id,result);queue=result.catch(()=>{});return result;
}
async function renderPortrait(id:UniformId){
 const data=await loadHuman(id),team=id.startsWith('fr-')||id==='us-field'||id==='task-sand'?'fr':'de',map=id.startsWith('task-')?'storm':id.startsWith('fr-')?'alpine':'cologne';
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(320,440);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
 const material=new T.MeshStandardMaterial({color:uniforms[id].color});
 let human:ReturnType<typeof createHuman>|undefined;
 try{
  human=createHuman(data,team,map,material,id);
  const scene=new T.Scene();scene.add(human.group);
  scene.add(new T.HemisphereLight(0xe7f2ff,0x677567,3));
  const key=new T.DirectionalLight(0xffeddb,4);key.position.set(-3,4,-4);scene.add(key);
  const rim=new T.DirectionalLight(0xa3cfff,3);rim.position.set(3,3,2);scene.add(rim);
  human.update(makePlayer('portrait','Portrait',team),0,1/60);
  // Allow asynchronously attached uniform accessories to settle without a render loop.
  await new Promise(resolve=>setTimeout(resolve,600));
  human.group.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(human.group,true),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
  const camera=new T.PerspectiveCamera(32,320/440,.01,50);
  const distance=Math.max(size.y,size.x/camera.aspect,size.z/camera.aspect)/(2*Math.tan(T.MathUtils.degToRad(16)))*1.22;
  camera.position.copy(center).add(new T.Vector3(.2,.03,-1).normalize().multiplyScalar(distance));camera.lookAt(center);
  renderer.render(scene,camera);return renderer.domElement.toDataURL('image/webp',.88);
 }finally{human?.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();}
}
