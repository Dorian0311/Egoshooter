import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {terrainHeight} from '../shared/terrain';
import {getWorld} from '../shared/world';
import {createTerrainGeometry} from '../client/battleTerrain';
import {createHuman} from '../client/humanoid';
import {makePlayer} from '../shared/game';

test('terrain has genuine relief and matches the shared height field at every rendered vertex',()=>{
 const island=getWorld('storm'),war=getWorld('frontline');
 assert.ok(terrainHeight(-62,62,island)>2);assert.ok(terrainHeight(-20,48,war)<-.1);
 for(const world of [island,war]){
  for(const b of world.buildings)assert.equal(terrainHeight(b.x,b.z,world),0);
  for(const point of [...world.spawns.de,...world.spawns.fr])assert.equal(terrainHeight(point[0],point[1],world),0);
  const geometry=createTerrainGeometry(world),p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
  for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getY(i)-terrainHeight(p.getX(i),p.getZ(i),world))<.0001);assert.ok(n.getY(i)>.3);}
  geometry.dispose();
 }
});
test('imported motion clips are normalized and produce finite walk/crouch poses on the actual rig',()=>{
 const motion=JSON.parse(readFileSync('public/shooter/animations/locomotion.json','utf8'));
 for(const clip of Object.values(motion.clips) as {rotations:Record<string,number[]>}[])for(const values of Object.values(clip.rotations))for(let i=0;i<values.length;i+=4)assert.ok(Math.abs(Math.hypot(...values.slice(i,i+4))-1)<.00001);
 const data=JSON.parse(readFileSync('public/shooter/characters/humanoid.json','utf8'));
 const human=createHuman({...data,motion},'fr','storm',new T.MeshStandardMaterial(),'task-sand'),p=makePlayer('motion','M','fr',0,getWorld('storm'));
 const foot=human.group.getObjectByName('foot.L')!,before=foot.quaternion.clone();
 for(let n=0;n<90;n++){human.group.position.x=n/60*3.6;p.x=human.group.position.x;human.update(p,n*1000/60,1/60);}
 assert.ok(foot.quaternion.angleTo(before)>.05);
 p.crouching=true;for(let n=0;n<60;n++)human.update(p,n*1000/60,1/60);
 human.group.updateMatrixWorld(true);const head=human.group.getObjectByName('head')!.getWorldPosition(new T.Vector3());
 assert.ok(head.y> .8&&head.y<1.6,`crouch head ${head.y}`);assert.ok(human.group.userData.hasCrouchAnimation);
 human.dispose();
});
