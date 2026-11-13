import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,move,neutral,makePlayer,STEP,SAW_POWER_MS,SAW_RECOVERY_MS,weaponDamage,weapons} from '../shared/game';
import {getWorld} from '../shared/world';
function duel(){
 const game=new Game('SAW123'),a=game.add('a','Leatherface'),b=game.add('b','Target');
 game.selectUniform('a','leatherface');game.ready('a',true,1000);game.ready('b',true,1000);game.tick(4000);
 Object.assign(a,{x:8,z:8,y:0,yaw:0,pitch:0,protectedUntil:0});Object.assign(b,{x:8,z:6.4,y:0,protectedUntil:0});return {game,a,b};
}
test('Leatherface keeps only the saw through start, forged weapon switches, reload and respawn',()=>{
 const {game,a}=duel();assert.equal(a.weapon,4);
 game.input(a.id,{...neutral(1),weapon:3,reload:true});game.tick(4033);assert.equal(a.weapon,4);assert.equal(a.reloadAt,0);
 a.hp=0;a.respawnAt=4100;game.tick(4100);game.tick(4133);assert.equal(a.weapon,4);assert.equal(a.uniform,'leatherface');
});
test('other characters cannot equip the saw through network inputs',()=>{
 const {game,b}=duel();game.input(b.id,{...neutral(1),weapon:4,fire:true});game.tick(4033);assert.notEqual(b.weapon,4);assert.equal(game.state.events.some(e=>e.type==='melee'&&e.id===b.id),false);
});
test('saw is close range, directional and cadence limited; kills score once',()=>{
 const {game,a,b}=duel(),input={...neutral(1),fire:true};
 b.z=4;game.shoot(a,input,4000);assert.equal(b.hp,100);
 b.z=9.5;game.shoot(a,input,4320);assert.equal(b.hp,100);
 b.z=6.4;game.shoot(a,input,4640);assert.equal(b.hp,62);
 game.shoot(a,input,4700);assert.equal(b.hp,62);
 game.shoot(a,input,4960);game.shoot(a,input,5280);assert.equal(b.hp,0);assert.equal(a.kills,1);assert.equal(a.headshots,0);
 game.shoot(a,input,5600);assert.equal(a.kills,1);assert.equal(game.state.events.filter(e=>e.type==='shot').length,0);
});
test('saw honors spawn protection, friendlies and solid walls',()=>{
 const {game,a,b}=duel(),input=neutral(1);b.protectedUntil=5000;game.shoot(a,input,4000);assert.equal(b.hp,100);
 b.protectedUntil=0;b.team=a.team;game.shoot(a,input,4320);assert.equal(b.hp,100);
 b.team='fr';
 const wall=getWorld().boxes.find(w=>w.kind!=='rock'&&w.d<.8&&w.w>3&&w.h>2)!;assert.ok(wall);
 Object.assign(a,{x:wall.x,z:wall.z+.7,y:wall.y-wall.h/2,yaw:0});Object.assign(b,{x:wall.x,z:wall.z-.7,y:a.y});game.shoot(a,input,4640);assert.equal(b.hp,100);
});
test('power boost expires under held attack and cannot restart before recovery',()=>{
 const p=makePlayer('a','A','de');Object.assign(p,{uniform:'leatherface',x:8,z:8});
 const world={...getWorld(),boxes:[]},input={...neutral(),forward:1,fire:true};
 move(p,input,STEP,world,1000);assert.equal(p.powerUntil,1000+SAW_POWER_MS);assert.equal(p.powerReadyAt,1000+SAW_POWER_MS+SAW_RECOVERY_MS);
 assert.ok(Math.abs(8-p.z-9.2*STEP)<1e-6);
 let z=p.z;move(p,input,STEP,world,p.powerUntil);assert.ok(Math.abs(z-p.z-4.3*STEP)<1e-6);
 const ready=p.powerReadyAt;move(p,input,STEP,world,ready-1);assert.equal(p.powerReadyAt,ready);
 move(p,input,STEP,world,ready);assert.equal(p.powerUntil,ready+SAW_POWER_MS);
 z=p.z;move(p,{...input,fire:false},STEP,world,ready+33);assert.ok(Math.abs(z-p.z-4.3*STEP)<1e-6);
});
test('weapon roles favor SMG close-up and G36 range',()=>{
 assert.ok(weapons[2].damage/weapons[2].interval>weapons[3].damage/weapons[3].interval);
 assert.ok(weaponDamage(2,80)<weaponDamage(3,80));
 assert.ok(weapons[2].spread>weapons[3].spread);assert.ok(weapons[3].recoil>weapons[2].recoil);
});
