import * as T from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {createWeaponModels} from '../client/weaponModels';
import {weapons} from '../shared/game';
const samples:unknown[]=[];
for(let id=7;id<=12;id++){
  const section=document.createElement('section'),title=document.createElement('h2');title.textContent=weapons[id].name;section.append(title);document.querySelector('main')!.append(section);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(740,400);renderer.toneMapping=T.ACESFilmicToneMapping;section.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#697b83');
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();scene.add(new T.HemisphereLight(0xe5edff,0x746448,1.8));
  const key=new T.DirectionalLight(0xffedda,2);key.position.set(2,4,2);scene.add(key);
  const camera=new T.PerspectiveCamera(66,740/400,.01,10),parent=new T.Group();scene.add(camera);camera.add(parent);
  const models=createWeaponModels(parent),deadline=performance.now()+60000;
  while(!models.update('de','storm',id)){if(performance.now()>deadline)throw Error('Weapon failed to load: '+id);await new Promise(resolve=>setTimeout(resolve,50));}
  models.animatePose(0);renderer.render(scene,camera);
  const muzzle=models.muzzleLocal();samples.push({id,muzzle:muzzle.toArray(),finite:muzzle.toArray().every(Number.isFinite)});
}
Object.assign(window,{germanWeaponFps:samples});document.body.dataset.ready='true';
