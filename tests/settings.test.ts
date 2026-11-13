import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,parseSettings} from '../client/gameSettings';
test('settings clamp corrupt stored values and reject duplicate bindings',()=>{
 const value=parseSettings({sensitivity:Infinity,fov:999,volume:-3,bindings:{...defaultSettings.bindings,forward:'KeyS'}});
 assert.equal(value.sensitivity,1);assert.equal(value.fov,100);assert.equal(value.volume,0);assert.deepEqual(value.bindings,defaultSettings.bindings);
 assert.deepEqual(parseSettings(null),defaultSettings);
});
test('settings preserve valid preferences and remapped keys',()=>{
 const value={...defaultSettings,sensitivity:1.7,volume:0,bindings:{...defaultSettings.bindings,reload:'KeyF'}};
 assert.deepEqual(parseSettings(value),value);
});
test('adding interaction preserves earlier custom bindings',()=>{
 const {interact,...oldBindings}=defaultSettings.bindings;
 const parsed=parseSettings({bindings:{...oldBindings,reload:'KeyE'}});
 assert.equal(parsed.bindings.reload,'KeyE');assert.equal(parsed.bindings.interact,'KeyF');
});

test('sprint mode tolerates older settings and preserves toggle preference',()=>{
 assert.equal(parseSettings({}).sprintMode,'hold');
 assert.equal(parseSettings({sprintMode:'toggle'}).sprintMode,'toggle');
 assert.equal(parseSettings({sprintMode:'invalid'}).sprintMode,'hold');
});
