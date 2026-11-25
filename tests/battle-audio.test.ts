import {test} from 'node:test';
import assert from 'node:assert/strict';
import {designSound,soundDurations,type SoundName} from '../client/battleSoundDesign';
import {advanceFootstep,footstepMaterial,weaponSound} from '../client/battleAudio';
import type {World} from '../shared/world';

test('all foley variations are finite, bounded, audible and click-free at both sample rates',()=>{
 for(const rate of [44100,48000])for(const name of Object.keys(soundDurations) as SoundName[])for(let variant=0;variant<4;variant++){
  const data=designSound(name,rate,variant);let energy=0,peak=0;
  assert.equal(data.length,Math.ceil(soundDurations[name]*rate));
  for(const value of data){assert.ok(Number.isFinite(value),name);energy+=value*value;peak=Math.max(peak,Math.abs(value));}
  assert.ok(peak<=.921&&peak>.05,`${name}: ${peak}`);assert.ok(Math.sqrt(energy/data.length)>.005,name);
  assert.ok(data[0]===0);if(name!=='saw'&&name!=='rc-engine')assert.ok(data.at(-1)===0);
  else assert.ok(Math.abs(data.at(-1)!-data[0])<.05,'engine loop seam');
 }
});

test('weapon families and organic effects have different waveforms and variations',()=>{
 const names:SoundName[]=['rifle','pistol','smg','g36','flesh','sever','harvest','step-stone','step-earth','step-wood','step-metal'];
 const fingerprints=names.map(name=>Buffer.from(designSound(name,44100).buffer).toString('base64'));
 assert.equal(new Set(fingerprints).size,names.length);
 for(const name of names)assert.notDeepEqual(designSound(name,44100,0),designSound(name,44100,1));
 assert.ok(soundDurations.harvest>soundDurations.sever&&soundDurations.sever>soundDurations.flesh);
 for(const [id,name,family] of [[0,'Karabiner 98k','rifle'],[1,'Luger P08','pistol'],[2,'MP 40','smg'],[3,'G36','g36'],[4,'Kettensäge','saw'],[5,'Wurfstern','throw'],[6,'Körperteil','swing'],[7,'StG 44','g36'],[8,'Gewehr 43','rifle'],[9,'MG 42','g36'],[10,'MP 34','smg'],[11,'Walther P38','pistol'],[12,'FG 42','g36']] as const)assert.equal(weaponSound(id,name),family,name);
});

const actor={x:0,y:0,z:0,hp:100,grounded:true,crouching:false,sprinting:false};
test('foot cadence follows distance and resets for air, death, teleports and disabled control',()=>{
 let state=advanceFootstep(undefined,actor).state;
 for(let n=0;n<30;n++){const next=advanceFootstep(state,actor);assert.equal(next.step,false);state=next.state;}
 let next=advanceFootstep(state,{...actor,x:.8});assert.equal(next.step,false);state=next.state;
 next=advanceFootstep(state,{...actor,x:1.5});assert.equal(next.step,true);assert.ok(next.state.distance<.1);
 for(const p of [{...actor,x:8},{...actor,x:2,grounded:false},{...actor,x:2,hp:0}])assert.equal(advanceFootstep(state,p).step,false);
 assert.equal(advanceFootstep(state,{...actor,x:2},false).step,false);
 assert.equal(advanceFootstep({...state,grounded:false},{...actor,x:2}).step,false);
 assert.equal(advanceFootstep(state,{...actor,x:1.2,crouching:true}).step,true);
 assert.equal(advanceFootstep(state,{...actor,x:1.7,sprinting:true}).step,false);
});

test('foot material comes from the supporting floor, not surrounding props',()=>{
 const world:World={id:'frontline',name:'test',subtitle:'',opponent:'',opponentCode:'',spawns:{de:[],fr:[]},buildings:[],boxes:[{x:0,y:1,z:0,w:2,h:2,d:2,kind:'container'}]};
 assert.equal(footstepMaterial(world,actor),'stone');assert.equal(footstepMaterial(world,{...actor,z:12}),'earth');
 assert.equal(footstepMaterial(world,{...actor,y:2}),'metal');
 world.boxes[0].kind='stair';assert.equal(footstepMaterial(world,{...actor,y:2}),'wood');
 world.boxes=[];world.id='cologne';assert.equal(footstepMaterial(world,actor),'stone');
 world.buildings=[{x:0,z:0,w:10,d:10,upper:true,name:'test'}];world.boxes=[{x:0,y:3.9,z:0,w:8,h:.2,d:8,kind:'floor'}];
 assert.equal(footstepMaterial(world,{...actor,y:4}),'wood');assert.equal(footstepMaterial(world,actor),'stone');
});
