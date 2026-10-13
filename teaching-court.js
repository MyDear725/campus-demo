import * as THREE from 'three';
import { TEACHING_COURT } from './teaching-layout.js';
import { surfaceTexture, waterNormals } from './nature-materials.js';

export function buildTeachingCourt(world,{collect,strip,box,materials,obstacles}){
  const {points,fountain:f}=TEACHING_COURT;
  const stone=new THREE.MeshStandardMaterial({color:'#d8d1bd',map:surfaceTexture('paving'),roughness:.86});
  const inset=new THREE.MeshStandardMaterial({color:'#8e9893',roughness:.83});
  const bronze=new THREE.MeshStandardMaterial({color:'#79664a',metalness:.5,roughness:.45});
  function cylinder(x,y,z,r,h,mat){const g=new THREE.CylinderGeometry(r,r,h,64);g.translate(x,y,z);collect(g,mat,true);}
  function ring(x,z,r,w,y,mat){const g=new THREE.RingGeometry(r,r+w,96);g.rotateX(-Math.PI/2);g.translate(x,y,z);collect(g,mat);}
  const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  const paving=new THREE.ShapeGeometry(shape);paving.rotateX(-Math.PI/2);paving.translate(0,.125,0);
  const pos=paving.attributes.position;for(let i=0;i<pos.count;i++)paving.attributes.uv.setXY(i,pos.getX(i)/3,pos.getZ(i)/3);
  collect(paving,stone);strip([...points,points[0]],.3,inset,.14);
  // All approaches stay flush with existing player ground height.
  for(const route of TEACHING_COURT.routes)strip(route,3.4,stone,.135);
  for(const r of [4.2,6.2,8.1])ring(f.x,f.z,r,.12,.15,inset);
  // A low circular basin with an open water surface and a real raised rim.
  cylinder(f.x,.22,f.z,f.radius,.36,inset);
  ring(f.x,f.z,f.radius-.4,.55,.64,stone);
  const rim=new THREE.CylinderGeometry(f.radius+.15,f.radius+.15,.38,96,1,true);rim.translate(f.x,.45,f.z);collect(rim,stone,true);
  const innerRim=new THREE.CylinderGeometry(f.radius-.4,f.radius-.4,.35,96,1,true);innerRim.scale(-1,1,1);innerRim.translate(f.x,.45,f.z);collect(innerRim,inset);
  const normals=waterNormals();normals.repeat.set(2,2);
  const waterMat=new THREE.MeshStandardMaterial({color:'#45918e',metalness:.3,roughness:.18,normalMap:normals,normalScale:new THREE.Vector2(.12,.12)});
  const water=new THREE.Mesh(new THREE.CircleGeometry(f.radius-.41,96),waterMat);water.rotation.x=-Math.PI/2;water.position.set(f.x,.48,f.z);water.name='teaching-fountain-water';world.add(water);
  cylinder(f.x,.66,f.z,.36,.65,bronze);cylinder(f.x,1,f.z,.48,.12,stone);
  const jetMat=new THREE.MeshPhysicalMaterial({color:'#bce5e9',roughness:.14,metalness:.08,transparent:true,opacity:.72,depthWrite:false});
  const arcs=[];
  const curveAt=(angle,t)=>new THREE.Vector3(f.x+Math.cos(angle)*(2.1*t),1.04+3.8*t-4.4*t*t,f.z+Math.sin(angle)*(2.1*t));
  for(let j=0;j<8;j++){
    const angle=j*Math.PI/4;arcs.push(angle);
    const curve=new THREE.CatmullRomCurve3(Array.from({length:25},(_,i)=>curveAt(angle,i/24)));
    const jet=new THREE.Mesh(new THREE.TubeGeometry(curve,24,.026,5,false),jetMat);world.add(jet);
    cylinder(f.x+Math.cos(angle)*.14,1.08,f.z+Math.sin(angle)*.14,.035,.16,bronze);
    ring(f.x+Math.cos(angle)*2.1,f.z+Math.sin(angle)*2.1,.12,.045,.491,jetMat);
  }
  const spray=new THREE.InstancedMesh(new THREE.SphereGeometry(.029,5,3),jetMat,96);spray.name='teaching-fountain-spray';spray.instanceMatrix.setUsage(THREE.DynamicDrawUsage);spray.frustumCulled=false;world.add(spray);
  const dummy=new THREE.Object3D();
  const collisionPoints=Array.from({length:32},(_,i)=>[f.x+(f.radius+.15)*Math.cos(i*Math.PI/16),f.z+(f.radius+.15)*Math.sin(i*Math.PI/16)]);
  obstacles.push({name:'教学广场喷泉池',points:collisionPoints});
  // Edge furniture deliberately leaves all three entrance axes open.
  for(const {x,z,angle} of [{x:48,z:-99,angle:0},{x:69.8,z:-78,angle:Math.PI/2}]){
    const tx=Math.cos(angle),tz=-Math.sin(angle),nx=Math.sin(angle),nz=Math.cos(angle);
    for(let j=-2;j<=2;j++)box(x+nx*j*.12,.51,z+nz*j*.12,2.8,.1,.095,materials.wood,angle);
    for(const d of [-1,1])box(x+tx*d,.27,z+tz*d,.15,.48,.6,materials.steel,angle);
    for(let j=0;j<3;j++)box(x+nx*.35,.78+j*.15,z+nz*.35,2.8,.1,.09,materials.wood,angle);
    const ends=[-1.45,1.45].map(d=>[x+tx*d,z+tz*d]);obstacles.push({name:'教学广场长椅',segment:ends,thickness:.8});
  }
  for(const [x,z] of [[45.7,-100.4],[70.9,-75.3]]){
    cylinder(x,.4,z,.9,.65,stone);cylinder(x,.73,z,.76,.035,materials.soil||inset);
    for(let j=0;j<20;j++){
      const a=j*2.4,r=.65*Math.sqrt((j+.5)/20),xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r;
      const leaf=new THREE.IcosahedronGeometry(.25,1);leaf.scale(1,.65,1);leaf.translate(xx,.87,zz);collect(leaf,materials.grass,true);
      const bud=new THREE.SphereGeometry(.09,5,4);bud.translate(xx,1.02+(j%3)*.035,zz);collect(bud,newFlowerMaterial(j));
    }
    obstacles.push({name:'教学广场花钵',minX:x-.85,maxX:x+.85,minZ:z-.85,maxZ:z+.85});
  }
  function update(time){
    normals.offset.set(time*.017,time*.009);
    for(let i=0;i<96;i++){const t=(time*.65+(i%12)/12)%1,p=curveAt(arcs[Math.floor(i/12)],t);dummy.position.copy(p);dummy.scale.setScalar(.75+.4*Math.sin(t*Math.PI));dummy.updateMatrix();spray.setMatrixAt(i,dummy.matrix);}
    spray.instanceMatrix.needsUpdate=true;
  }
  update(0);
  return {update,setQuality(high){spray.count=high?96:48;},stats:{teachingEntrances:3,fountains:1}};
}
const petalMaterials=['#e6d9b9','#977aab','#c7a6bb'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.8}));
function newFlowerMaterial(i){return petalMaterials[i%petalMaterials.length];}
