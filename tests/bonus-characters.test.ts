import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../shared/game.ts';
import {difference,mergeSnapshot} from '../shared/protocol.ts';
import {uniformOptions,defaultUniform} from '../shared/uniforms.ts';

const ids=['deadpool','harley','rocket','homer','leatherface','commander','kroenen'] as const;
test('bonus choices are valid for both factions and maps and synchronize',()=>{
 for(const map of ['storm','cologne','frontline','alpine'] as const){
  const game=new Game('ABC234');game.add('a','A');game.add('b','B');game.selectMap('a',map);
  for(const team of ['de','fr'] as const){
   assert.ok(!ids.includes(defaultUniform(team,map) as typeof ids[number]));
   for(const id of ids)assert.equal(uniformOptions(team,map).includes(id),map==='storm'||id==='kroenen');
  }
  if(map!=='storm'){assert.equal(game.selectUniform('a','rocket'),false);continue;}
  for(const player of ['a','b'])for(const id of ids){
   const before=structuredClone(game.state);assert.equal(game.selectUniform(player,id),true);
   assert.equal(mergeSnapshot(before,difference(before,game.state))!.players.find(p=>p.id===player)!.uniform,id);
  }
  game.ready('a',true,1000);game.ready('b',true,1000);game.tick(4000);
  assert.equal(game.player('a')!.uniform,'kroenen');assert.equal(game.selectUniform('a','rocket'),false);
  game.player('a')!.hp=0;game.player('a')!.respawnAt=5000;game.tick(5000);
  assert.equal(game.player('a')!.uniform,'kroenen');game.state.phase='finished';game.rematch('a');
  assert.equal(game.player('a')!.uniform,'kroenen');
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

test('Kroenen UVs address painted atlas tiles rather than blank or repeated regions',()=>{
 const bytes=readFileSync('public/shooter/characters/bonus/kroenen.glb');
 const jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
 const attribute=doc.accessors[doc.meshes[0].primitives[0].attributes.TEXCOORD_0],view=doc.bufferViews[attribute.bufferView];
 const start=28+jsonLength+(view.byteOffset??0)+(attribute.byteOffset??0),stride=view.byteStride??8;
 for(let vertex=0;vertex<attribute.count;vertex++){
  const u=bytes.readFloatLE(start+vertex*stride),v=bytes.readFloatLE(start+vertex*stride+4);
  assert.ok(u>=0&&u<=1&&v>=0&&v<=1,`UV outside atlas at vertex ${vertex}`);
  assert.ok(Math.floor(v*1024/340)*3+Math.floor(u*1024/340)<=6,`Unpainted atlas tile at vertex ${vertex}`);
 }
});
