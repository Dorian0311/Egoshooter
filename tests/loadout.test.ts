import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Game,makePlayer,move,neutral,validInput,weapons} from '../shared/game';
import {eyeHeight,shotStability} from '../shared/injuries';
import {getWorld} from '../shared/world';
import {defaultLoadout,historicalWeaponIds,validLoadout,weaponSlot,type Loadout,type WeaponId} from '../shared/weapons';
import {createGermanWeapon} from '../client/germanWeaponModels';
import {parseSettings,defaultSettings} from '../client/gameSettings';

function match(loadout:Loadout){
  const game=new Game('LOAD05',600000,'storm'),a=game.add('a','A'),b=game.add('b','B');
  assert.equal(game.selectLoadout(a.id,loadout),true);
  game.ready(a.id,true,1000);game.ready(b.id,true,1000);game.tick(4000);
  return {game,a,b};
}
test('loadouts require five unique selectable weapons and character-compatible saw',()=>{
  assert.equal(historicalWeaponIds.length,11);assert.ok(historicalWeaponIds.every(id=>id!==3&&id!==4));
  for(const value of [null,[],[0,1,2,7],[0,1,2,7,8,9],[0,0,1,2,7],[0,1,2,5,6],[0,1,2,7,99],[0,1,2,7,'8'],[0,1,2,7,7.5]])assert.equal(validLoadout(value),false);
  assert.equal(validLoadout([7,8,9,10,11]),true);
  assert.equal(validLoadout([4,1,2,7,8],'de-field'),false);
  assert.equal(validLoadout([4,1,2,7,8],'leatherface'),true);
  const first=makePlayer('a','A','de'),second=makePlayer('b','B','fr');first.loadout[0]=9;
  assert.deepEqual(second.loadout,defaultLoadout);assert.deepEqual(defaultLoadout,[0,1,2,7,8]);
});
test('prone input lowers the eye and slows movement, keeps a player under cover, and restores standing when clear',()=>{
  const world={...getWorld('alpine'),boxes:[]};
  const player=makePlayer('crawl','Crawl','de',0,world);
  Object.assign(player,{x:0,y:0,z:0});
  assert.equal(validInput({...neutral(),prone:true}),true);
  assert.equal(validInput({...neutral(),prone:'yes'}),false);
  assert.equal(shotStability(player),1);
  move(player,{...neutral(),crouch:true});
  assert.ok(shotStability(player)<1);
  move(player,{...neutral(),prone:true,forward:1,sprint:true,jump:true},1/30,world);
  assert.ok(player.prone&&player.grounded&&!player.sprinting);
  assert.ok(player.z<0&&player.z>-.06);
  assert.equal(eyeHeight(player),.42);
  const ceiling={x:0,y:1,z:0,w:4,h:.4,d:4};
  move(player,neutral(),1/30,{...world,boxes:[ceiling]});
  assert.equal(player.prone,true);
  move(player,neutral(),1/30,world);
  assert.equal(player.prone,false);
  assert.equal(eyeHeight(player),1.6);
});
test('five chosen weapons survive round start and respawn; unselected switches are rejected',()=>{
  const selection:Loadout=[7,8,9,10,11],{game,a}=match(selection);
  selection[0]=0;assert.deepEqual(a.loadout,[7,8,9,10,11]);assert.equal(a.weapon,7);
  game.input(a.id,{...neutral(1),weapon:0});game.tick(4033);assert.equal(a.weapon,7);
  game.input(a.id,{...neutral(2),weapon:9});game.tick(4066);assert.equal(a.weapon,9);assert.equal(a.ammo,100);
  assert.equal(game.selectLoadout(a.id,defaultLoadout),false);
  a.ammo=2;a.hp=0;a.respawnAt=4100;game.tick(4100);assert.equal(a.weapon,7);assert.equal(a.ammo,weapons[7].mag);assert.equal(a.ammoByWeapon[9],100);assert.equal(a.ammoByWeapon[12],100);assert.deepEqual(a.loadout,[7,8,9,10,11]);
});
test('new weapon inputs, cadence, magazine accounting and reload use the selected catalog',()=>{
  for(const id of [7,8,9,10,11,12,13,16] as WeaponId[]){
    const selection=[id,...historicalWeaponIds.filter(w=>w!==id).slice(0,4)] as Loadout;
    const {game,a}=match(selection);assert.equal(validInput({...neutral(1),weapon:id}),true);
    game.shoot(a,{...neutral(1),weapon:id},4000);assert.equal(a.ammo,weapons[id].mag-1);assert.equal(a.fireAt,4000+weapons[id].interval);assert.equal(game.state.events.find(e=>e.type==='shot')?.weapon,id);
    game.shoot(a,{...neutral(2),weapon:id},4001);assert.equal(a.ammo,weapons[id].mag-1);
    game.input(a.id,{...neutral(3),weapon:id,reload:true});game.tick(4033);assert.equal(a.reloadAt,4033+weapons[id].reload);
    game.tick(a.reloadAt);assert.equal(a.ammo,weapons[id].mag);
  }
  for(const weapon of [-1,5,6,14,NaN,7.5])assert.equal(validInput({...neutral(1),weapon}),false);
});
test('Leatherface can select firearms, while saw use remains tied to its equipped slot',()=>{
  const {game,a}=match([0,1,2,7,8]);game.state.phase='waiting';
  assert.equal(game.selectUniform(a.id,'leatherface'),true);assert.equal(game.selectLoadout(a.id,[7,11,8,9,12]),true);
  assert.equal(a.weapon,7);game.state.phase='playing';game.input(a.id,{...neutral(1),weapon:11});game.tick(4033);assert.equal(a.weapon,11);
  assert.equal(weaponSlot(a.loadout,4),12);
});
test('changing themes replaces an Island-only character and loadout',()=>{
  const game=new Game('MAP005',600000,'storm'),a=game.add('a','A');
  game.selectUniform(a.id,'leatherface');game.selectLoadout(a.id,[4,7,8,9,11]);
  assert.equal(game.selectMap(a.id,'frontline'),true);
  assert.equal(a.uniform,'de-panzer');assert.deepEqual(a.loadout,defaultLoadout);assert.equal(a.weapon,0);
  assert.equal(game.selectLoadout(a.id,[3,7,8,9,11]),false);
});
test('every new weapon has finite, distinct geometry and a muzzle outside its bounds origin',()=>{
  const signatures=new Set<string>();
  for(let id=7;id<=13;id++){
    const model=createGermanWeapon(id),bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());
    assert.ok(size.x>0&&size.y>.05&&size.z>.2);assert.ok(model.userData.muzzle.every(Number.isFinite));
    signatures.add(size.toArray().join(','));
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();model.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
  assert.equal(signatures.size,7);
});
test('the fifth slot preserves older custom key bindings',()=>{
  const {weapon5,...previous}=defaultSettings.bindings;
  const parsed=parseSettings({bindings:{...previous,reload:'Digit5'}});
  assert.equal(parsed.bindings.reload,'Digit5');assert.notEqual(parsed.bindings.weapon5,'Digit5');assert.equal(new Set(Object.values(parsed.bindings)).size,Object.keys(parsed.bindings).length);
});
