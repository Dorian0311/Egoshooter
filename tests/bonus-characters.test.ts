import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../shared/game.ts';
import {difference,mergeSnapshot} from '../shared/protocol.ts';
import {uniformOptions,defaultUniform} from '../shared/uniforms.ts';

const ids=['deadpool','harley','rocket','homer','leatherface','commander'] as const;
test('bonus choices are valid for both factions and maps and synchronize',()=>{
 for(const map of ['cologne','alpine'] as const){
  const game=new Game('ABC234');game.add('a','A');game.add('b','B');game.selectMap('a',map);
  for(const team of ['de','fr'] as const){
   assert.ok(!ids.includes(defaultUniform(team,map) as typeof ids[number]));
   for(const id of ids)assert.ok(uniformOptions(team,map).includes(id));
  }
  for(const player of ['a','b'])for(const id of ids){
   const before=structuredClone(game.state);assert.equal(game.selectUniform(player,id),true);
   assert.equal(mergeSnapshot(before,difference(before,game.state))!.players.find(p=>p.id===player)!.uniform,id);
  }
  game.ready('a',true,1000);game.ready('b',true,1000);game.tick(4000);
  assert.equal(game.player('a')!.uniform,'commander');assert.equal(game.selectUniform('a','rocket'),false);
  game.player('a')!.hp=0;game.player('a')!.respawnAt=5000;game.tick(5000);
  assert.equal(game.player('a')!.uniform,'commander');game.state.phase='finished';game.rematch('a');
  assert.equal(game.player('a')!.uniform,'commander');
 }
});
test('embedded character assets stay inside geometry and download budgets',()=>{
 for(const id of ids){
  const bytes=readFileSync(`public/shooter/characters/bonus/${id}.glb`);
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.ok(bytes.length<3_000_000);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  let triangles=0,draws=0;
  for(const mesh of json.meshes)for(const primitive of mesh.primitives){
   triangles+=json.accessors[primitive.indices??primitive.attributes.POSITION].count/3;draws++;
   if(id!=='leatherface'&&id!=='commander'){assert.ok(primitive.attributes.JOINTS_0!==undefined);assert.ok(primitive.attributes.WEIGHTS_0!==undefined);}
  }
  assert.ok(triangles<=60000,`${id}: ${triangles}`);assert.ok(draws<=5);
  for(const image of json.images??[])assert.ok(image.bufferView!==undefined&&!image.uri);
  if(id!=='leatherface'&&id!=='commander')assert.ok(json.skins.length>0);
 }
});
