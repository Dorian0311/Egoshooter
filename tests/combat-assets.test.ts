import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('CC0 combat hand trajectories are bounded, moving and small enough for shared runtime use',()=>{
 const data=readFileSync('public/shooter/animations/combat-hands.json'),library=JSON.parse(data.toString()),provenance=JSON.parse(readFileSync('public/shooter/animations/combat-hands-provenance.json','utf8'));assert.ok(data.length<20000);assert.equal(library.license,'CC0-1.0');assert.equal(createHash('sha256').update(data).digest('hex'),provenance.output.sha256);
 for(const name of ['swing','carry','interact','pickup']){const clip=library.clips[name];assert.ok(clip.duration>.1&&clip.frames>10);for(const hand of [clip.left,clip.right]){assert.equal(hand.length,clip.frames*3);assert.ok(hand.every((value:number)=>Number.isFinite(value)&&Math.abs(value)<2));let travel=0;for(let n=3;n<hand.length;n+=3)travel+=Math.hypot(hand[n]-hand[n-3],hand[n+1]-hand[n-2],hand[n+2]-hand[n-1]);assert.ok(travel>.02,`${name} static hand path`);}}
});
