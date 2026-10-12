import test from 'node:test';
import assert from 'node:assert/strict';
import {createMouseLook, rotateLook, smoothLook, orbitOffset, followDistance} from '../camera-controls.js';

function fixture(request) {
  const doc=new EventTarget(), win=new EventTarget(), canvas=new EventTarget();
  let playing=true, releases=0; const states=[], movements=[];
  doc.pointerLockElement=null;
  doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
  canvas.requestPointerLock=request??(()=>{doc.pointerLockElement=canvas;doc.dispatchEvent(new Event('pointerlockchange'));});
  const controls=createMouseLook(canvas,{doc,win,isPlaying:()=>playing,
    onMove:(...delta)=>movements.push(delta),onState:s=>states.push(s),
    onReleased:()=>{releases++;playing=false;}});
  const move=(dx,dy)=>win.dispatchEvent(Object.assign(new Event('mousemove'),{movementX:dx,movementY:dy,clientX:500,clientY:300}));
  return {doc,canvas,controls,states,movements,move,get releases(){return releases;},stop:()=>{playing=false;}};
}

test('locked input continues through many revolutions with constant cursor coordinates',()=>{
  const f=fixture();f.controls.lock();let yaw=0,pitch=.35;
  for(let i=0;i<4000;i++)f.move(10,0);
  for(const [dx,dy] of f.movements)({yaw,pitch}=rotateLook(yaw,pitch,dx,dy));
  assert.equal(f.movements.length,4000);assert.ok(Math.abs(yaw+108)<1e-8);
  const a=orbitOffset(yaw,pitch,5.5),b=orbitOffset(yaw+Math.PI*2,pitch,5.5);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-10);
  f.controls.unlock();f.move(500,500);assert.equal(f.movements.length,4000);
});

test('denied pointer capture stays unlocked and a fresh click can recover',async()=>{
  const f=fixture(()=>Promise.reject(new Error('Denied')));f.controls.lock();await Promise.resolve();
  assert.equal(f.states.at(-1),'denied');f.move(50,0);assert.equal(f.movements.length,0);
  f.canvas.requestPointerLock=()=>{f.doc.pointerLockElement=f.canvas;f.doc.dispatchEvent(new Event('pointerlockchange'));};
  f.canvas.dispatchEvent(new Event('click'));f.move(50,0);
  assert.equal(f.states.at(-1),'locked');assert.deepEqual(f.movements,[[50,0]]);f.controls.unlock();
});

test('legacy capture errors are reported; duplicate pending requests are suppressed',()=>{
  let requests=0;const f=fixture(()=>{requests++;});f.controls.lock();f.controls.lock();
  assert.equal(requests,1);f.doc.dispatchEvent(new Event('pointerlockerror'));
  assert.equal(f.states.at(-1),'denied');f.controls.unlock();
});

test('user release pauses once, intentional release does not, and late capture cannot trap cursor',()=>{
  const f=fixture();f.controls.lock();f.doc.exitPointerLock();
  assert.equal(f.releases,1);f.controls.lock();assert.equal(f.doc.pointerLockElement,null);
  const g=fixture();g.controls.lock();g.controls.unlock();assert.equal(g.releases,0);
  g.stop();g.doc.pointerLockElement=g.canvas;g.doc.dispatchEvent(new Event('pointerlockchange'));
  assert.equal(g.doc.pointerLockElement,null);
});

test('orbit keeps its radius through angle boundaries and rapid 180 degree turns',()=>{
  for(const angle of [0,Math.PI-.001,Math.PI+.001,2*Math.PI-.001,2*Math.PI+.001,40*Math.PI]){
    const v=orbitOffset(angle,.35,5.5);assert.ok(Math.abs(Math.hypot(v.x,v.y,v.z)-5.5)<1e-10);
  }
  const a=orbitOffset(2*Math.PI-.001,.35,5.5),b=orbitOffset(2*Math.PI+.001,.35,5.5);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.011);
  assert.equal(followDistance(5.5,1,1/60),1);
  assert.ok(followDistance(1,5.5,1/60)>1&&followDistance(1,5.5,1/60)<2);
});

test('pitch permits broad up/down views without pole flips and invalid deltas are ignored',()=>{
  assert.equal(rotateLook(0,0,0,1e6).pitch,1.35);
  assert.equal(rotateLook(0,0,0,-1e6).pitch,-.65);
  assert.deepEqual(rotateLook(2,.35,NaN,Infinity),{yaw:2,pitch:.35});
});

test('shared body/camera smoothing behaves consistently at 30, 60 and 144 fps',()=>{
  const end=[];
  for(const fps of [30,60,144]){
    let yaw=0,pitch=.35;
    for(let i=0;i<fps/2;i++)({yaw,pitch}=smoothLook(yaw,pitch,Math.PI,.9,1/fps));
    end.push([yaw,pitch]);
  }
  for(const result of end){assert.ok(Math.abs(result[0]-end[0][0])<1e-12);assert.ok(Math.abs(result[1]-end[0][1])<1e-12);}
  const first=smoothLook(0,.35,Math.PI,.9,1/60);
  assert.ok(first.yaw>0&&first.yaw<Math.PI*.5,'mouse change is eased rather than snapped');
});

test('multi-turn smoothing never reverses at angle seams and leaves the camera behind the shared heading',()=>{
  let yaw=Math.PI*2-.03,pitch=.35;
  for(let i=0;i<300;i++){
    const last=yaw;({yaw,pitch}=smoothLook(yaw,pitch,Math.PI*7,1.2,1/60));
    assert.ok(yaw>=last&&yaw<=Math.PI*7);
    const offset=orbitOffset(yaw,pitch,5.5);
    const forward={x:-Math.sin(yaw),z:-Math.cos(yaw)};
    assert.ok((offset.x*forward.x+offset.z*forward.z)/Math.hypot(offset.x,offset.z)<-.999999);
  }
  assert.ok(Math.abs(yaw-Math.PI*7)<1e-10);
});
