import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from '../node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { createCharacterAnimator } from '../character-motion.js';

const bytes=await fs.readFile(new URL('../assets/characters/campus-traveler.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
test('Blender asset contains a human-sized skinned character and all movement clips',()=>{
  const skinned=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o);});
  assert.ok(skinned.length>0);assert.equal(skinned[0].skeleton.bones.length,18);
  assert.deepEqual(gltf.animations.map(a=>a.name).sort(),['Fall','Idle','Jump','Land','Run','Talk','Tired','Walk']);
  const size=new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
  assert.ok(size.y>1.6&&size.y<1.9,`height ${size.y}`);
});
test('all animations remain finite and inside plausible character bounds',()=>{
  for(const clip of gltf.animations){
    const model=clone(gltf.scene),mixer=new THREE.AnimationMixer(model);mixer.clipAction(clip).play();
    for(let i=0;i<12;i++){
      mixer.setTime(clip.duration*i/12);model.updateMatrixWorld(true);
      model.traverse(object=>{if(object.isSkinnedMesh)object.computeBoundingBox();});
      const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
      assert.ok([size.x,size.y,size.z].every(Number.isFinite),clip.name);
      assert.ok(size.y>1.2&&size.y<2.2&&size.x<1.5&&size.z<1.6,`${clip.name}: ${size.toArray()}`);
    }
  }
});
test('NPC skeleton clones can animate without moving the original player rig',()=>{
  const model=clone(gltf.scene);const original=gltf.scene.getObjectByName('Thigh_L');
  const before=original.quaternion.clone();const mixer=new THREE.AnimationMixer(model);
  mixer.clipAction(gltf.animations.find(a=>a.name==='Run')).play();mixer.setTime(.15);
  assert.ok(original.quaternion.equals(before));
  assert.ok(!model.getObjectByName('Thigh_L').quaternion.equals(before));
});

test('backpedaling reverses the existing stride smoothly across the phase wrap',()=>{
  const model=clone(gltf.scene),animator=createCharacterAnimator(model,gltf.animations);
  const rotations=[];
  for(let i=0;i<90;i++){
    const previous=animator.getState().phase;
    animator.update(1/60,'Walk',{speed:5.4,backward:true});
    const phase=animator.getState().phase;
    assert.ok(phase>=0&&phase<1);
    assert.ok(Math.abs(((previous-phase+1)%1)-1/64)<1e-10);
    rotations.push(model.getObjectByName('Thigh_L').quaternion.clone());
  }
  assert.ok(rotations.every(q=>q.toArray().every(Number.isFinite)));
  assert.ok(rotations.some(q=>q.angleTo(rotations[50])>.2),'backward walk has visible leg swing');
});

test('unlimited sprint keeps actual leg bones moving and transitions smoothly back to walking',()=>{
  const model=clone(gltf.scene),animator=createCharacterAnimator(model,gltf.animations),rotations=[];
  for(let i=0;i<1200;i++){
    animator.update(1/60,'Run',{speed:10});
    if(i>1100)rotations.push(model.getObjectByName('Thigh_L').quaternion.x);
    const sum=Object.values(animator.getState().weights).reduce((a,b)=>a+b,0);
    assert.ok(Math.abs(sum-1)<.00001);
  }
  assert.ok(Math.max(...rotations)-Math.min(...rotations)>.2,'running legs continue after 20 seconds');
  for(let i=0;i<60;i++)animator.update(1/60,'Walk',{speed:5.4});
  assert.equal(animator.getState().action,'Walk');
});

test('facial shapes change geometry and remain independent between characters',()=>{
  const a=clone(gltf.scene),b=clone(gltf.scene),animator=createCharacterAnimator(a,gltf.animations);
  for(const expression of ['Blink','Smile','Tired','Talk']){
    let changed=false;
    a.traverse(o=>{
      const index=o.morphTargetDictionary?.[expression];if(index===undefined)return;
      const deltas=o.geometry.morphAttributes.position[index].array;
      changed ||= deltas.some(n=>Math.abs(n)>.001);
    });
    assert.ok(changed,`${expression} has nonzero vertex deltas`);
    for(let i=0;i<60;i++)animator.update(1/60,'Idle',{expression});
    assert.ok(animator.getState().expressions[expression]>.99);
    b.traverse(o=>{if(o.morphTargetInfluences)assert.ok(o.morphTargetInfluences.every(n=>n===0));});
  }
});
