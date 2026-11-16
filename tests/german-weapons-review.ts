import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {createGermanWeapon,germanWeaponNames} from '../client/germanWeaponModels';
import {prepareRealisticWeapon,realisticWeapons,realisticWeaponUrl,type RealisticWeapon} from '../client/realisticWeapons';
import {weapons} from '../shared/game';
const samples:unknown[]=[];
for(let id=7;id<=12;id++){
  const section=document.createElement('section'),title=document.createElement('h2');title.textContent=weapons[id].name;section.append(title);document.querySelector('main')!.append(section);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(740,320);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;section.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#687780');
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xe8f1ff,0x7a5b40,1.4));const light=new T.DirectionalLight(0xffe8d2,2.4);light.position.set(2,4,3);scene.add(light);
  const name=germanWeaponNames[id],imported=name in realisticWeapons;
  const model=imported?prepareRealisticWeapon((await new GLTFLoader().loadAsync(realisticWeaponUrl(name as RealisticWeapon))).scene,name as RealisticWeapon):createGermanWeapon(id);scene.add(model);
  const bounds=new T.Box3().setFromObject(model,true),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),aspect=740/320;
  const height=Math.max(size.y*1.45,(size.z+size.x*.25)/aspect*1.35),camera=new T.OrthographicCamera(-height*aspect/2,height*aspect/2,height/2,-height/2,.01,20);camera.position.copy(center).add(new T.Vector3(3,.9,1.15));camera.lookAt(center);camera.updateProjectionMatrix();renderer.render(scene,camera);
  let triangles=0;const materials=new Set<T.Material>(),textures=new Set<T.Texture>();model.traverse(o=>{if(o instanceof T.Mesh){triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}}});
  samples.push({id,name,imported,triangles,textures:textures.size,materials:materials.size,size:size.toArray()});
  const caption=document.createElement('p');caption.textContent=imported?'Texturiertes 3D-Modell · originale Formen und Oberflächen':'Neu modelliert · Holzmaserung, runder Schaft und offene Kühlbohrungen';section.append(caption);
}
Object.assign(window,{germanWeaponReview:samples});document.body.dataset.ready='true';
