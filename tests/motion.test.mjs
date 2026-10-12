import test from 'node:test';
import assert from 'node:assert/strict';
import { updateEnergy, movementAction } from '../motion.js';

test('holding sprint through depletion gives an uninterrupted recovery walk, then resumes running', () => {
  let value=100,exhausted=false,emptyAt=-1,restartedAt=-1;
  for(let i=0;i<480;i++) {
    const result=updateEnergy(value,exhausted,true,1/60);
    ({value,exhausted}=result);
    if(exhausted && emptyAt<0) emptyAt=i;
    if(emptyAt>=0 && restartedAt<0) {
      if(result.sprint) restartedAt=i;
      else assert.equal(movementAction({grounded:true,speed:5.4,sprint:false,exhausted,landing:0}),'Walk');
    }
  }
  assert.ok(emptyAt>270 && emptyAt<300);
  assert.ok(restartedAt-emptyAt>=107,`recovery lasted ${restartedAt-emptyAt} frames`);
});
test('zero stamina and repeated Shift input cannot interrupt recovery', () => {
  let state={value:0,exhausted:false};
  for(let i=0;i<100;i++) {
    state=updateEnergy(state.value,state.exhausted,i%2===0,1/60);
    assert.equal(state.sprint,false);
    assert.ok(state.value>=0 && state.value<=100);
  }
  assert.equal(movementAction({grounded:true,speed:0,exhausted:true,landing:0}),'Tired');
});
test('airborne and landing poses take priority, while blocked movement rests', () => {
  const state={grounded:false,speed:10,sprint:true,exhausted:false,landing:0};
  assert.equal(movementAction({...state,velocityY:2}),'Jump');
  assert.equal(movementAction({...state,velocityY:-2}),'Fall');
  assert.equal(movementAction({...state,grounded:true,landing:.1}),'Land');
  assert.equal(movementAction({...state,grounded:true,speed:0}),'Idle');
});
