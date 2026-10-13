import * as THREE from 'three';
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';
import { buildCampus } from './campus-world.js';
import { createAtmosphere } from './atmosphere.js';
import { drawCampusMap } from './campus-map.js';
const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('world'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();const atmosphere=createAtmosphere(scene,renderer);scene.add(new THREE.HemisphereLight('#eef6ff','#647459',1.2));
const sun=new THREE.DirectionalLight('#fff1d4',2.8);sun.position.set(-160,360,160);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-330,right:330,top:280,bottom:-280,far:900});sun.shadow.normalBias=.2;scene.add(sun);
const campus=buildCampus(scene);
const camera=new THREE.PerspectiveCamera(47,innerWidth/innerHeight,1,2400);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,28);controls.enableDamping=true;controls.minDistance=4;controls.maxDistance=1300;controls.maxPolarAngle=Math.PI*.48;
function setView(name){document.getElementById('building-view').value='';document.getElementById('environment-view').value='';Object.assign(sun.shadow.camera,{left:-330,right:330,top:280,bottom:-280,far:900});sun.shadow.camera.updateProjectionMatrix();sun.position.set(-160,360,160);sun.target.position.set(0,0,0);document.body.classList.toggle('plan',name==='flat');for(const id of ['aerial','north','flat'])document.getElementById(id).setAttribute('aria-pressed',String(id===name));if(name==='flat')return;
  const fit=Math.max(1,1.45/(innerWidth/innerHeight));if(name==='north')camera.position.set(0,760*fit,28.1);else camera.position.set(230*fit,440*fit,490*fit);controls.target.set(0,0,28);controls.update();}
for(const id of ['aerial','north','flat'])document.getElementById(id).onclick=()=>setView(id);
const buildingSelect=document.getElementById('building-view');
for(const b of campus.buildings){const option=document.createElement('option');option.value=b.id;option.textContent=b.name.replace('大连理工大学','');buildingSelect.append(option);}
buildingSelect.onchange=()=>{
 const b=campus.buildings.find(b=>b.id===Number(buildingSelect.value));if(!b)return;
 document.body.classList.remove('plan');for(const id of ['aerial','north','flat'])document.getElementById(id).setAttribute('aria-pressed','false');
 const x=(b.bounds.minX+b.bounds.maxX)/2,z=(b.bounds.minZ+b.bounds.maxZ)/2;
 const w=b.bounds.maxX-b.bounds.minX,d=b.bounds.maxZ-b.bounds.minZ,extent=Math.max(w,d);
 controls.target.set(x,b.height*.4,z);camera.position.set(x+extent*.65,b.height+extent*.34,z+extent*.95);controls.update();
 sun.position.set(x-65,110,z+60);sun.target.position.set(x,0,z);scene.add(sun.target);
 Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,far:250});sun.shadow.camera.updateProjectionMatrix();
 document.body.dataset.building=String(b.id);
};
document.getElementById('environment-view').onchange=e=>{
 if(!e.target.value)return;document.body.classList.remove('plan');buildingSelect.value='';
 for(const id of ['aerial','north','flat'])document.getElementById(id).setAttribute('aria-pressed','false');
 const views={teaching:{position:[66,9,-73],target:[59,1,-96]},teachingA:{position:[59,3,-95],target:[58.3,3,-105.4]},teachingB:{position:[56,3,-83],target:[47,3,-84]},teachingC:{position:[66,3,-96],target:[75,3,-91.5]},boundary:{position:[52,4.2,198],target:[72,1.1,212]},secondary:{position:[20,2.8,80],target:[28,.5,57]},crossing:{position:[125,4,29],target:[151,1,12]},garden:{position:[6.5,2.3,193],target:[12.9,.5,190]},lake:{position:[-2,5.5,61],target:[-26,3,21]},avenue:{position:[3,3.2,197],target:[2,3,155]},sky:{position:[60,18,119],target:[-60,24,-80]}};
 const view=views[e.target.value];camera.position.fromArray(view.position);controls.target.fromArray(view.target);controls.update();
 const [x,,z]=view.target;sun.position.set(x-65,110,z+60);sun.target.position.set(x,0,z);scene.add(sun.target);
 Object.assign(sun.shadow.camera,{left:-90,right:90,top:90,bottom:-90,far:260});sun.shadow.camera.updateProjectionMatrix();
};
drawCampusMap(document.getElementById('plan').getContext('2d'),1200,900,{expanded:true});setView('aerial');
const clock=new THREE.Clock();
renderer.setAnimationLoop(()=>{const time=clock.getElapsedTime();campus.landscape.update(time,camera);atmosphere.update(time);if(!document.body.classList.contains('plan')){controls.update();renderer.render(scene,camera);}document.body.dataset.map='ready';document.body.dataset.renderStats=JSON.stringify({buildings:campus.buildings.length,environment:campus.landscape.stats,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
