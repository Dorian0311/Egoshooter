import * as T from 'three';
import {createGermanWeapon} from '../client/germanWeaponModels';
import {weapons} from '../shared/game';
for(let id=7;id<=12;id++){
  const section=document.createElement('section'),title=document.createElement('h2');title.textContent=weapons[id].name;section.append(title);document.querySelector('main')!.append(section);
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(620,220);renderer.setPixelRatio(1);section.append(renderer.domElement);
  const scene=new T.Scene(),model=createGermanWeapon(id);scene.add(model);scene.add(new T.HemisphereLight(0xe8f4ff,0x443327,2.4));const light=new T.DirectionalLight(0xffe3bd,3);light.position.set(-2,3,1);scene.add(light);
  const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3()),camera=new T.OrthographicCamera(-.73,.73,.26,-.26,.1,10);camera.position.copy(center).add(new T.Vector3(2,.5,.2));camera.lookAt(center);camera.updateProjectionMatrix();renderer.render(scene,camera);
}
document.body.dataset.ready='true';
