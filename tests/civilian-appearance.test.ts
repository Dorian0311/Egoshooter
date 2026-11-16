import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createHuman} from '../client/humanoid';
import {makePlayer} from '../shared/game';

const source=()=>JSON.parse(readFileSync(new URL('../public/shooter/characters/humanoid.json',import.meta.url),'utf8'));
test('civilian clothing retains the full body, covers the feet and uses distinct fabric colors',()=>{
 const data=source(),human=createHuman(data,'de','cologne',new T.MeshStandardMaterial(),'de-field',true);
 const body=human.group.children.find(o=>o instanceof T.SkinnedMesh) as T.SkinnedMesh;
 assert.equal(body.geometry.getAttribute('position').count,data.positions.length/3);
 const colors=body.geometry.getAttribute('color');assert.equal(colors.count,data.positions.length/3);
 const samples=new Map<string,number[]>();for(let i=0;i<data.categories.length;i++){if(data.categories[i]!==0)continue;const y=data.positions[i*3+1];if(y>1.1&&y<1.3)samples.set('jacket',[colors.getX(i),colors.getY(i),colors.getZ(i)]);if(y>.5&&y<.7)samples.set('trousers',[colors.getX(i),colors.getY(i),colors.getZ(i)]);}
 assert.notDeepEqual(samples.get('jacket'),samples.get('trousers'));
 const shoes:T.Object3D[]=[];human.group.traverse(o=>{if(o.name==='civilian-leather-shoe')shoes.push(o);});assert.equal(shoes.length,2);
 for(const shoe of shoes){const size=new T.Box3().setFromObject(shoe).getSize(new T.Vector3());assert.ok(size.x<.16&&size.y<.22&&size.z<.29,'work shoes stay within human foot proportions');assert.ok(shoe.parent?.name.startsWith('foot.'));}
 human.dispose();
});

test('civilian spawn does not invent movement and restoring a gesture leaves an unarmed figure',()=>{
 const human=createHuman(source(),'de','cologne',new T.MeshStandardMaterial(),'de-field',true),player=makePlayer('resident-2','Bewohner','de');player.kind='resident';player.x=100;player.z=90;
 human.update(player,1000,1/60,1000);assert.equal(human.group.getObjectByName('upperleg01.L')!.rotation.x,0);
 player.gestureUntil=2500;human.update(player,1200,1/60,1200);player.gestureUntil=0;human.update(player,3000,1/60,3000);
 assert.equal(human.group.getObjectByName('held-weapon')?.visible,false);
 const hand=human.group.getObjectByName('wrist.R')!;human.group.updateMatrixWorld(true);const position=hand.getWorldPosition(new T.Vector3());assert.ok(position.y<1.1,'relaxed hand remains beside the hip');
 human.dispose();
});
