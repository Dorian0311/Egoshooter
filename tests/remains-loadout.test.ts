import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,neutral} from '../shared/game';
import {fallbackSidearm,weapons,type Loadout} from '../shared/weapons';
import {limbBits} from '../shared/injuries';

const p38Loadout:Loadout=[11,7,8,9,10];
function setup(coop=false,loadout:Loadout=p38Loadout){
 const g=new Game('LOADOUT-REMAINS',600000,'cologne',()=>.5,{kind:coop?'coop':'multiplayer',mode:coop?'mission':'battle',mission:'documents'});
 g.add('a','Anna');g.add('b','Bruno');assert.ok(g.selectLoadout('a',loadout));assert.ok(g.selectLoadout('b',loadout));
 if(coop)g.operation.configureBots();for(const p of g.state.players)g.ready(p.id,true,1000);g.tick(4000);
 for(const p of g.state.players)Object.assign(p,{x:8,y:0,z:p.id==='a'?8:6,yaw:0,protectedUntil:0});return g;
}
function corpse(g:Game){const b=g.player('b')!;g.operation.damage(b,'',0,100,'body',[b.x,1,b.z]);if(b.downedUntil)g.tick(b.downedUntil+1);return g.state.corpses.find(c=>c.sourceId==='b')!;}

test('sidearm selection retains an equipped selected pistol and preserves the P08 emergency rule',()=>{
 assert.equal(fallbackSidearm(p38Loadout,7),11);
 const both:Loadout=[0,1,11,7,8];assert.equal(fallbackSidearm(both,11),11);assert.equal(fallbackSidearm(both,1),1);
 assert.equal(fallbackSidearm([7,8,9,10,12],7),1);
});

test('corpse carrying keeps the selected P38 usable through subsequent inputs without dropping the shield',()=>{
 const g=setup(),a=g.player('a')!,body=corpse(g);assert.ok(g.interact('a',`corpse:carry:${body.id}`));assert.equal(a.weapon,11);
 g.input('a',{...neutral(1),weapon:11,fire:true,time:g.state.now});g.tick(g.state.now+33);
 assert.equal(a.weapon,11);assert.equal(a.carriedCorpse,body.id);assert.equal(body.carrierId,a.id);assert.equal(a.ammoByWeapon[11],7);
 assert.ok(g.state.events.some(e=>e.type==='shot'&&e.id==='a'&&e.weapon===11));
});

test('carrying without a selected pistol still grants the existing P08 emergency sidearm',()=>{
 const g=setup(false,[7,8,9,10,12]),a=g.player('a')!,body=corpse(g);assert.ok(g.interact('a',`corpse:carry:${body.id}`));g.tick(g.state.now+33);
 assert.equal(a.weapon,1);assert.equal(a.ammo,8);assert.equal(a.carriedCorpse,body.id);
});

test('losing an arm switches from a rifle to the selected P38 and permits its one-handed shot',()=>{
 const g=setup(),a=g.player('a')!;g.input('a',{...neutral(1),weapon:7,time:g.state.now});g.tick(4033);assert.equal(a.weapon,7);
 a.injuries.lost|=limbBits.armL;g.tick(4400);assert.equal(a.weapon,11);
 g.input('a',{...neutral(2),weapon:11,fire:true,time:g.state.now});g.tick(4433);
 assert.equal(a.weapon,11);assert.equal(a.ammoByWeapon[11],7);assert.ok(g.state.events.some(e=>e.type==='shot'&&e.id==='a'&&e.weapon===11));
});

test('medical-tent recovery preserves all five selected weapons and refills their magazines',()=>{
 const g=setup(true),a=g.player('a')!,b=g.player('b')!,selected=[...b.loadout];b.ammoByWeapon.fill(0);b.ammo=0;const body=corpse(g);
 Object.assign(a,{x:body.x,y:0,z:body.z+.5});assert.ok(g.interact('a',`corpse:carry:${body.id}`));const tent=g.state.aidTents.find(t=>t.team===a.team)!;
 Object.assign(a,{x:tent.x,y:tent.y,z:tent.z+1});g.tick(g.state.now+500);assert.ok(g.interact('a',`tent:deposit:${tent.id}`));g.tick(g.state.now+8001);
 assert.equal(b.hp,100);assert.deepEqual(b.loadout,selected);assert.equal(b.weapon,selected[0]);assert.equal(b.ammo,weapons[selected[0]].mag);
 assert.deepEqual(b.ammoByWeapon,weapons.map(w=>w.mag));
});

test('a completed survival wave refills every catalogue weapon and the selected StG44 remains fireable',()=>{
 const g=new Game('LOADOUT-WAVES',600000,'cologne',()=>.5,{kind:'solo',mode:'survival'}),a=g.add('a','Anna');
 assert.ok(g.selectLoadout('a',[7,8,9,10,11]));g.operation.configureBots();g.ready('a',true,1000);g.tick(4000);
 for(const bot of g.state.players.filter(p=>p.kind==='bot'&&p.hp)){bot.protectedUntil=0;g.operation.damage(bot,'a',0,100,'head',[bot.x,bot.y+1.6,bot.z]);}
 g.tick(4033);const next=g.state.operation.nextWaveAt;assert.ok(next>g.state.now);a.ammoByWeapon.fill(0);a.ammo=0;g.tick(next);
 assert.equal(g.state.operation.wave,2);assert.deepEqual(a.ammoByWeapon,weapons.map(w=>w.mag));assert.equal(a.ammo,30);
 g.input(a.id,{...neutral(1),weapon:7,fire:true,time:g.state.now});g.tick(g.state.now+33);
 assert.equal(a.ammo,29);assert.ok(g.state.events.some(e=>e.type==='shot'&&e.id===a.id&&e.weapon===7));
});
