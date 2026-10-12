import test from 'node:test';
import assert from 'node:assert/strict';
import { collides, moveWithCollision, freshProgress, sanitizeProgress, collectMemory, finishQuest, MEMORY_IDS } from '../logic.js';
const wall=[{minX:2,maxX:3,minZ:-10,maxZ:10}];
test('fast movement cannot tunnel through buildings',()=>{const p=moveWithCollision({x:0,z:0},20,0,wall);assert.ok(p.x<1.58);assert.ok(p.x>1.3);});
test('diagonal movement slides along walls',()=>{const p=moveWithCollision({x:1.5,z:0},2,4,wall);assert.ok(p.x<1.58);assert.ok(p.z>3.9);});
test('campus boundary keeps player inside',()=>{const p=moveWithCollision({x:309,z:0},10,0,[]);assert.ok(p.x<=309.57);assert.equal(collides(311,0,[]),true);});
test('quest requires acceptance, unique memories, then delivery',()=>{const p=freshProgress();assert.equal(collectMemory(p,'knowledge'),false);assert.equal(finishQuest(p),false);p.started=true;assert.equal(collectMemory(p,'knowledge'),true);assert.equal(collectMemory(p,'knowledge'),false);assert.equal(collectMemory(p,'invalid'),false);assert.equal(finishQuest(p),false);MEMORY_IDS.forEach(id=>collectMemory(p,id));assert.equal(finishQuest(p),true);assert.equal(p.completed,true);assert.equal(p.collected.length,3);});
test('corrupt and inconsistent saves cannot skip quest',()=>{assert.deepEqual(sanitizeProgress(null),freshProgress());assert.deepEqual(sanitizeProgress({started:false,collected:MEMORY_IDS,completed:true}),freshProgress());assert.deepEqual(sanitizeProgress({started:true,collected:['knowledge','knowledge','wrong'],completed:true}),{started:true,collected:['knowledge'],completed:false});});
