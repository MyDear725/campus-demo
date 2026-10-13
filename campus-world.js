import * as THREE from 'three';
import { buildArchitecture } from './architecture.js';
import { buildLandscape } from './landscape.js';
import { buildFootbridge } from './footbridge.js';
import { CAMPUS_FEATURES, campusObstacles } from './campus-layout.js';

export function buildCampus(scene) {
  const world=new THREE.Group();scene.add(world);
  const obstacles=campusObstacles(),occluders=[],materials=new Map();
  const cube=new THREE.BoxGeometry(1,1,1),disc=new THREE.CylinderGeometry(1,1,1,16);
  function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.85}));return materials.get(color);}
  function mesh(geo,color,x=0,y=0,z=0){const m=new THREE.Mesh(geo,material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;world.add(m);return m;}
  function box(x,y,z,w,h,d,color){const m=mesh(cube,color,x,y,z);m.scale.set(w,h,d);return m;}
  function shape(points){const s=new THREE.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();return s;}
  function surface(points,color,y=.06){const m=mesh(new THREE.ShapeGeometry(shape(points)),color,0,y,0);m.rotation.x=-Math.PI/2;m.castShadow=false;return m;}
  function ribbon(points,width,color,y=.04,closed=false){
    const path=closed?[...points,points[0]]:points;
    for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1];const m=box((a[0]+b[0])/2,y,(a[1]+b[1])/2,Math.hypot(dx,dz)+width*.2,.08,width,color);m.rotation.y=-Math.atan2(dz,dx);m.castShadow=false;}
    for(const [x,z] of path){const m=mesh(disc,color,x,y,z);m.scale.set(width/2,.08,width/2);m.castShadow=false;}
  }
  for(const f of CAMPUS_FEATURES){
    if(f.kind==='plaza'){
      surface(f.points,'#ded2b7',.1);
      for(let r=8;r<21;r+=4){const ring=mesh(new THREE.RingGeometry(r,r+.15,64),'#b8b3a4',24,.16,104);ring.rotation.x=-Math.PI/2;ring.castShadow=false;}
    }else if(f.kind==='track'){
      const x=-134,z=-104,w=56,d=92,r=w/2;
      const stadium=(rr,straight)=>{const pts=[];for(let i=0;i<=32;i++){const a=Math.PI+Math.PI*i/32;pts.push([x+rr*Math.cos(a),z-straight/2+rr*Math.sin(a)]);}for(let i=0;i<=32;i++){const a=Math.PI*i/32;pts.push([x+rr*Math.cos(a),z+straight/2+rr*Math.sin(a)]);}return pts;};
      surface(stadium(r,d-w),'#bd7764',.12);surface(stadium(r-7,d-w),'#82a17a',.17);
      for(let i=0;i<5;i++)ribbon(stadium(r-1-i*1.25,d-w),.14,'#eee2c6',.2,true);
      ribbon([[x-17,z-31],[x+17,z-31],[x+17,z+31],[x-17,z+31]],.14,'#eef0d5',.21,true);ribbon([[x-17,z],[x+17,z]],.12,'#eef0d5',.22);
      for(const zz of [z-31,z+31]){box(x-3,1.3,zz,.14,2.6,.14,'#e6e7da');box(x+3,1.3,zz,.14,2.6,.14,'#e6e7da');box(x,2.6,zz,6,.14,.14,'#e6e7da');}
      for(let i=0;i<4;i++)box(-169-i*1.8,.5+i*.6,-102,1.8,1+i*1.2,67,'#c4c8bb');
    }else if(f.kind==='court'){
      surface(f.points,'#b7806c',.1);const zs=f.points.map(p=>p[1]),xs=f.points.map(p=>p[0]);
      const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),count=f.name.includes('篮球')?4:2;
      for(let i=0;i<count;i++){const z=minZ+(i+.5)*(maxZ-minZ)/count,w=maxX-minX-3,d=(maxZ-minZ)/count-2;
        box((minX+maxX)/2,.17,z,w,.06,d,'#658f86').castShadow=false;
        ribbon([[minX+2,z-d/2+1],[maxX-2,z-d/2+1],[maxX-2,z+d/2-1],[minX+2,z+d/2-1]],.12,'#f0e6cf',.23,true);
        ribbon([[minX+2,z],[maxX-2,z]],.12,'#f0e6cf',.23);
      }
    }
  }
  const buildings=buildArchitecture(world,CAMPUS_FEATURES,{cube,occluders});
  // South gate: preserve an open, walkable passage through the official gate footprint.
  box(-7,2.2,207,1.4,4.4,1.4,'#d4c8b0');box(15,2.2,207,1.4,4.4,1.4,'#d4c8b0');box(4,4.4,207,24,.65,1.4,'#ddceb0');
  for(const x of [-7,15])obstacles.push({minX:x-.7,maxX:x+.7,minZ:206.3,maxZ:207.7});
  const footbridge=buildFootbridge(world,obstacles,occluders);
  const landscape=buildLandscape(scene,world,obstacles,occluders);
  // Freeze static repeated geometry into GPU instances, retaining original raycast meshes.
  world.updateMatrixWorld(true);const batches=new Map();
  for(const m of [...world.children]){
    if(!m.isMesh||![cube,disc].includes(m.geometry))continue;
    const key=m.geometry.uuid+m.material.uuid+m.castShadow;
    if(!batches.has(key))batches.set(key,[]);batches.get(key).push(m);
  }
  for(const list of batches.values()){
    const batch=new THREE.InstancedMesh(list[0].geometry,list[0].material,list.length);batch.castShadow=list[0].castShadow;batch.receiveShadow=true;
    list.forEach((m,i)=>{batch.setMatrixAt(i,m.matrixWorld);world.remove(m);});batch.computeBoundingSphere();world.add(batch);
  }
  return {obstacles,occluders,world,buildings,landscape,footbridge};
}
