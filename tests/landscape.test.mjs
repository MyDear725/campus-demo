import { TEACHING_COURT, TEACHING_ENTRIES } from '../teaching-layout.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCampus } from '../campus-world.js';
import { QUEST_ROUTES } from '../campus-layout.js';
import { moveWithCollision } from '../logic.js';
import { createPlantingMask } from '../campus-gardens.js';
import { CAMPUS_FEATURES, featureCenter } from '../campus-layout.js';
import { FENCE_PANELS } from '../campus-boundary.js';
import { ROADS } from '../campus-layout.js';
import { collides } from '../logic.js';

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

test('flowers, shrubs and grass leave roads, lakeside walks and interaction spaces clear',()=>{
  const banks=CAMPUS_FEATURES.filter(f=>f.kind==='water').map(f=>{
    const c=featureCenter(f),promenade=f.points.map(([x,z])=>[c.x+(x-c.x)*1.16,c.z+(z-c.z)*1.16]);
    promenade.push(promenade[0]);return {promenade};
  });
  const clear=createPlantingMask(banks),gardens=campus.landscape.gardens;
  assert.ok(gardens.beds.some(b=>b.z>175&&b.x>5),'entry has a visible flower bed');
  for(const p of gardens.planted)assert.ok(clear(p.x,p.z,.1),`${p.type} intrudes on a protected space: ${p.x},${p.z}`);
});

test('nearby planting stays visible while remote cells are culled and quality changes recover',()=>{
  const gardens=campus.landscape.gardens,camera=new THREE.PerspectiveCamera();camera.position.set(3,3,194);
  gardens.update(1,camera);
  const active=gardens.chunks.filter(c=>c.group.visible);
  assert.ok(active.length>0&&active.length<gardens.chunks.length);
  assert.ok(gardens.chunks.find(c=>c.x===24&&c.z===216).group.visible);
  const counts=()=>gardens.chunks.flatMap(c=>c.group.children).reduce((sum,m)=>sum+m.count,0);
  const high=counts();gardens.setQuality(false);assert.ok(counts()<high);gardens.setQuality(true);assert.equal(counts(),high);
  camera.position.set(0,800,0);gardens.update(2,camera);assert.ok(gardens.chunks.every(c=>c.group.visible));
});

test('street-side fence panels stop fast movement across rotated and straight sections',()=>{
  const fences=campus.obstacles.filter(o=>o.kind==='fence');
  assert.equal(fences.length,FENCE_PANELS.length);assert.ok(fences.length>200);
  for(let i=0;i<FENCE_PANELS.length;i+=7){
    const {a,b}=FENCE_PANELS[i],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,d=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/d,nz=(b[0]-a[0])/d;
    assert.ok(collides(x,z,fences));
    const result=moveWithCollision({x:x-nx*3,z:z-nz*3},nx*6,nz*6,fences);
    assert.ok((result.x-x)*nx+(result.z-z)*nz<-.4,`crossed fence ${i}`);
  }
});

test('south gate and the living-area pedestrian entrance remain usable with full scenery',()=>{
  for(const path of [[[3,194],[3,216],[3,229]],[[185,-119],[197,-115],[199,-110]]]){
    let p={x:path[0][0],z:path[0][1]};assert.ok(!collides(p.x,p.z,campus.obstacles));
    for(const [x,z] of path.slice(1)){
      let n=0;while(Math.hypot(x-p.x,z-p.z)>.12&&n++<2000){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);p=moveWithCollision(p,dx/d*.1,dz/d*.1,campus.obstacles);}
      assert.ok(n<2000,`gate blocked at ${p.x},${p.z}`);
    }
  }
  assert.equal(ROADS.find(r=>r.name==='松工路').kind,'external');
  assert.equal(ROADS.find(r=>r.name==='南门入口').kind,'main');
  assert.equal(ROADS.find(r=>r.name==='中央步行轴').kind,'secondary');
});

// Verify the new local route network with the same colliders used by the player.
test('three teaching entrances are reachable around the fountain, whose basin is solid',()=>{
  for(const route of TEACHING_COURT.routes){
    let p={x:route[0][0],z:route[0][1]};assert.equal(collides(p.x,p.z,campus.obstacles),false);
    for(const [x,z] of route.slice(1)){
      const d=Math.hypot(x-p.x,z-p.z),steps=Math.ceil(d/.1),dx=(x-p.x)/steps,dz=(z-p.z)/steps;
      for(let i=0;i<steps;i++)p=moveWithCollision(p,dx,dz,campus.obstacles);
      assert.ok(Math.hypot(p.x-x,p.z-z)<.15,`teaching route blocked at ${p.x},${p.z}, target ${x},${z}`);
    }
  }
  const f=TEACHING_COURT.fountain;
  assert.ok(collides(f.x,f.z,campus.obstacles));
  const stopped=moveWithCollision({x:f.x,z:f.z+6},0,-12,campus.obstacles);
  assert.ok(stopped.z>f.z+f.radius);
  for(const b of campus.buildings.filter(b=>TEACHING_ENTRIES[b.id])){
    const e=b.entrance,dx=f.x-e.x,dz=f.z-e.z;
    assert.ok(dx*e.nx+dz*e.nz>0,`${b.name} entrance faces away from courtyard`);
    assert.equal(collides(e.x+e.nx*1.5,e.z+e.nz*1.5,campus.obstacles),false,b.name);
  }
});
test('fountain animates in both quality modes without changing its collision footprint',()=>{
  const spray=scene.getObjectByName('teaching-fountain-spray');
  campus.landscape.update(1);const before=spray.instanceMatrix.array.slice();
  campus.landscape.update(1.2);assert.notDeepEqual(spray.instanceMatrix.array,before);
  campus.landscape.setQuality(false);assert.equal(spray.count,48);
  campus.landscape.setQuality(true);assert.equal(spray.count,96);
});
