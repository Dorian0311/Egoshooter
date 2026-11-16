import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../shared/game.ts";
import { difference, mergeSnapshot } from "../shared/protocol.ts";
test("delta snapshots reconstruct joins, updates and leaves", () => {
  const g = new Game("ABC234");
  g.add("a", "Anna");
  const before = structuredClone(g.state);
  g.add("b", "Bruno");
  g.player("a")!.x = 22;
  const packet = difference(before, g.state);
  assert.deepEqual(mergeSnapshot(before, packet), g.state);
  const second = structuredClone(g.state);
  g.remove("b");
  assert.deepEqual(mergeSnapshot(second, difference(second, g.state)), g.state);
  assert.equal(mergeSnapshot(null, {}), null);
});

test('persistent corpse and body-part ownership replicate as entity deltas without retransmitting the graveyard',()=>{
 const g=new Game('REMAINS');g.add('a','Anna');g.add('b','Bruno');g.ready('a',true,1000);g.ready('b',true,1000);g.tick(4000);g.player('b')!.protectedUntil=0;
 const before=structuredClone(g.state);g.operation.damage(g.player('b')!,'a',0,50,'armL',[0,1,0]);g.operation.damage(g.player('b')!,'a',0,100,'body',[0,1,0]);
 assert.equal(g.state.corpses.length,1);assert.ok(g.state.bodyParts.length>0);const packet=difference(before,g.state);assert.ok(!Object.hasOwn(packet.patch!,'corpses'));assert.ok(!Object.hasOwn(packet.patch!,'bodyParts'));assert.deepEqual(mergeSnapshot(before,packet),g.state);
 const second=structuredClone(g.state),corpse=g.state.corpses[0],part=g.state.bodyParts[0];corpse.carrierId='a';corpse.shield=125;part.carrierId='a';part.state='held';g.player('a')!.heldPart=part.id;
 const carrying=difference(second,g.state);assert.deepEqual(carrying.corpses,[{id:corpse.id,carrierId:'a',shield:125}]);assert.deepEqual(mergeSnapshot(second,carrying),g.state);
 const third=structuredClone(g.state);g.state.corpses=[];g.state.bodyParts=[];assert.deepEqual(mergeSnapshot(third,difference(third,g.state)),g.state);
});

test('moving one retained item does not resend hundreds of static remains',()=>{
 const g=new Game('LOAD');g.add('a','Anna');g.add('b','Bruno');g.ready('a',true,1000);g.ready('b',true,1000);g.tick(4000);g.player('b')!.protectedUntil=0;g.operation.damage(g.player('b')!,'a',0,50,'armL',[0,1,0]);g.operation.damage(g.player('b')!,'a',0,100,'body',[0,1,0]);
 const corpse=g.state.corpses[0],part=g.state.bodyParts[0];g.state.corpses=Array.from({length:120},(_,n)=>({...corpse,id:`corpse-${n}`}));g.state.bodyParts=Array.from({length:500},(_,n)=>({...part,id:`part-${n}`}));const previous=structuredClone(g.state);g.state.bodyParts[23].x+=.4;
 const packet=difference(previous,g.state);assert.equal(packet.bodyParts?.length,1);assert.equal(packet.corpses,undefined);assert.ok(JSON.stringify(packet).length<500);assert.deepEqual(mergeSnapshot(previous,packet),g.state);
});

test('completed treatment clears across a serialized wire packet instead of leaving a stuck progress indicator',()=>{
 const g=new Game('HEALWIRE');g.add('a','Anna');g.add('b','Bruno');g.ready('a',true,1000);g.ready('b',true,1000);g.tick(4000);const p=g.player('a')!;p.bandages=1;p.hp=50;g.interact('a','bandage');const previous=structuredClone(g.state);for(let now=4033;now<=8060;now+=33)g.tick(now);assert.equal(p.treatment,undefined);
 const packet=JSON.parse(JSON.stringify(difference(previous,g.state)));const rebuilt=mergeSnapshot(previous,packet)!;assert.equal(rebuilt.players.find(p=>p.id==='a')!.treatment,undefined);assert.equal(rebuilt.players.find(p=>p.id==='a')!.hp,100);
});

test('removing an optional entity property also clears it across JSON serialization',()=>{
 const g=new Game('DELETEWIRE');const p=g.add('a','Anna');p.treatment={kind:'bandage',target:'a',targetLife:p.life,started:0,until:4000,x:p.x,z:p.z};const previous=structuredClone(g.state);delete p.treatment;
 const packet=JSON.parse(JSON.stringify(difference(previous,g.state)));assert.equal(mergeSnapshot(previous,packet)!.players[0].treatment,undefined);
});
