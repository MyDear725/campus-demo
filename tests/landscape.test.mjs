import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCampus } from '../campus-world.js';
import { QUEST_ROUTES } from '../campus-layout.js';
import { moveWithCollision } from '../logic.js';

const scene=new THREE.Scene(),campus=buildCampus(scene);
test('new tree colliders leave direct and keyboard-steered quest routes walkable',()=>{
  for(const [name,route] of Object.entries(QUEST_ROUTES))for(const keyboard of [false,true]){
    let p={x:route[0][0],z:route[0][1]};
    for(const [x,z] of route.slice(1)){
      let steps=0;
      while(Math.hypot(p.x-x,p.z-z)>.15&&steps++<3000){
        let dx=x-p.x,dz=z-p.z;
        if(keyboard){dx=Math.abs(dx)>.065?Math.sign(dx):0;dz=Math.abs(dz)>.065?Math.sign(dz):0;}
        const distance=Math.hypot(dx,dz)||1;
        p=moveWithCollision(p,dx/distance*.1,dz/distance*.1,campus.obstacles);
      }
      assert.ok(steps<3000,`${name}, keyboard=${keyboard}: blocked at ${p.x},${p.z}`);
    }
  }
});
test('environment geometry and animated quality modes remain valid',()=>{
  assert.ok(campus.landscape.stats.trees>400);
  const water=campus.landscape.water,reflectingMaterial=water.material;
  campus.landscape.setQuality(false);assert.notEqual(water.material,reflectingMaterial);
  campus.landscape.update(34);assert.ok(water.material.normalMap.offset.x>0);
  campus.landscape.setQuality(true);assert.equal(water.material,reflectingMaterial);
  campus.landscape.update(35);assert.ok(water.material.uniforms.time.value>0);
  scene.traverse(object=>{
    const positions=object.geometry?.attributes.position?.array;
    if(positions)assert.ok(positions.every(Number.isFinite),object.name||object.type);
  });
});
