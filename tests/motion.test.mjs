import test from 'node:test';
import assert from 'node:assert/strict';
import { movementAction } from '../motion.js';

test('airborne and landing poses take priority, while blocked movement rests', () => {
  const state={grounded:false,speed:10,sprint:true,exhausted:false,landing:0};
  assert.equal(movementAction({...state,velocityY:2}),'Jump');
  assert.equal(movementAction({...state,velocityY:-2}),'Fall');
  assert.equal(movementAction({...state,grounded:true,landing:.1}),'Land');
  assert.equal(movementAction({...state,grounded:true,speed:0}),'Idle');
});
