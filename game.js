import * as THREE from 'three';
import { buildCampus } from './campus-world.js';
import { createAtmosphere } from './atmosphere.js';
import { GUIDE, BOARD, MEMORY_SPOTS, QUEST_ROUTES, campusArea } from './campus-layout.js';
import { drawCampusMap } from './campus-map.js';
import { START, moveWithCollision, freshProgress, sanitizeProgress, collectMemory, finishQuest } from './logic.js';
import { upgradeAvatar } from './avatar.js';
import { updateEnergy, movementAction, resolveKeyCode, WALK_SPEED, RUN_SPEED } from './motion.js';
import { createMouseLook, rotateLook, smoothLook, orbitOffset, followDistance } from './camera-controls.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('error').classList.remove('hidden'); $('error').textContent = '无法启动 3D 图形。请使用支持 WebGL 2 的桌面浏览器，并开启硬件加速。' + e.message; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const atmosphere=createAtmosphere(scene,renderer);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 2400);
scene.add(new THREE.HemisphereLight('#e2f3ff', '#758560', 1.2));
const sun = new THREE.DirectionalLight('#fff0ca', 2.8);
sun.position.set(-150, 350, 180); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -340; sun.shadow.camera.right = 340;
sun.shadow.camera.top = 280; sun.shadow.camera.bottom = -280; sun.shadow.camera.far = 850;
sun.shadow.normalBias = 0.06; sun.shadow.bias = -0.0002; scene.add(sun);scene.add(sun.target);
const obstacles = [], occluders = [], structures = [];
const colors = { grass: '#97ad74', path: '#d4cbbb', brick: '#aa6751', cream: '#e6ddc8', trim: '#f4eddb', roof: '#466467', glass: '#56818a', bark: '#79664c', gold: '#d9ad52' };
const mats = new Map();
function mat(color, extra = {}) { const key = color + JSON.stringify(extra); if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: .87, ...extra })); return mats.get(key); }
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function box(x, y, z, w, h, d, color, parent = scene, cast = true) {
  const mesh = new THREE.Mesh(boxGeo, typeof color === 'string' ? mat(color) : color); mesh.position.set(x,y,z); mesh.scale.set(w,h,d);
  mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(x,y,z,r,h,color,parent=scene,vertices=12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,vertices),mat(color)); mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function sphere(x,y,z,r,color,parent=scene) { const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),mat(color));mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh; }
function obstacle(x,z,w,d) { obstacles.push({ minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2 }); }
function solid(x,y,z,w,h,d,color) { const m=box(x,y,z,w,h,d,color);obstacle(x,z,w,d);occluders.push(m);return m; }
function plane(x,z,w,d,color,y=.02) { return box(x,y,z,w,.06,d,color,scene,false); }
function label(text, x,y,z, width=10, bg='#244b48', fg='#f6e9c9', size=38) {
  const c=document.createElement('canvas');c.width=768;c.height=128;const ctx=c.getContext('2d');
  if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#ccb983';ctx.lineWidth=3;ctx.strokeRect(7,7,c.width-14,c.height-14);}
  ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`500 ${size}px "Microsoft YaHei",sans-serif`;ctx.fillText(text,384,66);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));sprite.position.set(x,y,z);sprite.scale.set(width,width/6,1);scene.add(sprite);return sprite;
}
let seed=26;
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}

// Real development-campus feature outlines; source and scale live in campus-data.js.
const campus=buildCampus(scene);obstacles.push(...campus.obstacles);occluders.push(...campus.occluders);

label('大连理工大学 · 开发区校区',4,4.35,207.8,21,'#d8cbb3','#36564c',35);
label('书 韵 广 场',20,2.8,116,9,null,'#fff8da');
label('涌 泉 湖',-34,2.4,58,9,null,'#fff8da');
label('思 源 湖',-24,2.4,-5,9,null,'#fff8da');
label('西 北 田 径 场',-132,3,-50,12,null,'#fff8da');

// Low-poly, original avatar with articulated limbs.
function character(coat='#365c68',scarf='#d69852'){
  const g=new THREE.Group();
  const body=box(0,1.15,0,.55,.65,.32,coat,g);body.rotation.z=0;
  box(0,.86,0,.56,.18,.36,coat,g);cylinder(0,1.55,0,.11,.15,'#e4bb97',g);
  sphere(0,1.79,0,.24,'#ebc5a1',g);const hair=sphere(0,1.91,.015,.25,'#3d3936',g);hair.scale.set(1,.7,1);
  box(0,1.76,.19,.39,.2,.11,'#3d3936',g);box(0,1.49,-.02,.61,.12,.37,scarf,g);
  const tail=box(.17,1.24,.24,.18,.48,.07,scarf,g);tail.rotation.x=-.2;
  box(0,1.13,.22,.34,.42,.16,'#b5946b',g);box(0,1.34,.22,.29,.05,.16,'#d3b98e',g);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const a=new THREE.Group();a.position.set(side*.36,1.41,0);g.add(a);box(0,-.25,0,.17,.5,.19,coat,a);sphere(0,-.53,0,.09,'#e4bb97',a);arms.push(a);
    const l=new THREE.Group();l.position.set(side*.16,.82,0);g.add(l);box(0,-.31,0,.2,.61,.22,'#384951',l);box(0,-.67,-.07,.24,.16,.38,'#e5d7bd',l);legs.push(l);
  }
  scene.add(g);return {g,arms,legs,tail};
}
const hero=character();hero.g.position.set(START.x,.1,START.z);
const guide=character('#e5d5b3','#6c9588');guide.g.position.set(GUIDE.x,.1,GUIDE.z);guide.g.rotation.y=Math.PI;
label('校园向导 · 小岚',GUIDE.x,3.3,GUIDE.z,5,null,'#fff5d8',38);
// One quiet background student adds scale without requiring crowd AI.
const student=character('#9c6754','#e8c89b');student.g.position.set(63,.1,-40);student.g.rotation.y=.9;
Promise.all([upgradeAvatar(hero),upgradeAvatar(guide,'guide'),upgradeAvatar(student,'student')]).then(()=>{
  canvas.dataset.character='blender-skinned';
}).catch(error=>{canvas.dataset.character='fallback';console.error('Character model failed to load',error);toast('角色模型加载失败，请刷新重试。');});

const memories=MEMORY_SPOTS.map((spot,i)=>({...spot,name:['求知的记忆','相遇的记忆','热爱的记忆'][i],color:['#89cfc7','#edc774','#e7a28b'][i],text:['「求知」——在图书馆与书韵广场之间，让好奇心照亮更远的路。','「相遇」——涌泉湖边的风，记得那些并肩前行的人。','「热爱」——田径场上的每次奔跑，都是青春留下的回声。'][i]}));
for(const m of memories){
  cylinder(m.x,.2,m.z,.7,.4,'#bfb9a3');
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.48),mat(m.color,{metalness:.3,roughness:.2,emissive:m.color,emissiveIntensity:.4}));gem.position.set(m.x,1.75,m.z);scene.add(gem);m.mesh=gem;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.8,.025,6,48),new THREE.MeshBasicMaterial({color:m.color}));ring.rotation.x=Math.PI/2;ring.position.set(m.x,.48,m.z);scene.add(ring);m.ring=ring;
  m.label=label('◇ '+m.name,m.x,3,m.z,5,null,'#fff6d9',37);
}
const board={...BOARD,name:'校园导览牌'};solid(board.x,1.25,board.z,2.6,2.5,.25,colors.roof);label('校园导览 · 按 E 查看',BOARD.x,1.8,BOARD.z+.2,3.5,'#244b48','#efe4c6',30);
const guideMarker=new THREE.Mesh(new THREE.OctahedronGeometry(.22),new THREE.MeshBasicMaterial({color:'#f7d88c'}));guideMarker.position.set(GUIDE.x,2.8,GUIDE.z);scene.add(guideMarker);

// Batch repeated static architecture while retaining the collision ray meshes.
scene.updateMatrixWorld(true);
const batches=new Map();
for(const mesh of [...scene.children]){
  if(!mesh.isMesh||mesh.geometry!==boxGeo)continue;
  const key=mesh.material.uuid+'-'+mesh.castShadow;
  if(!batches.has(key))batches.set(key,[]);
  batches.get(key).push(mesh);
}
for(const list of batches.values()){
  const batch=new THREE.InstancedMesh(boxGeo,list[0].material,list.length);
  batch.castShadow=list[0].castShadow;batch.receiveShadow=true;
  list.forEach((mesh,index)=>{batch.setMatrixAt(index,mesh.matrixWorld);scene.remove(mesh);});
  batch.computeBoundingSphere();scene.add(batch);
}

let progress=freshProgress();
try{progress=sanitizeProgress(JSON.parse(localStorage.getItem('campus-echo-v1')));}catch{}
let storageAvailable=true,qaRunning=false;
function save(){if(qaRunning)return;try{localStorage.setItem('campus-echo-v1',JSON.stringify(progress));}catch{if(storageAvailable)toast('浏览器未开放本地存储，本次进度仅在当前页面保留。');storageAvailable=false;}}
if(progress.started){$('start-button').innerHTML='继续旅程 <span>→</span>';$('saved-hint').textContent=`已保存 ${progress.collected.length} / 3 枚记忆 · 点击启程捕获鼠标`;}
let mode='start',yaw=0,pitch=.35,camDistance=5.5,velocityY=0,grounded=true,stamina=100,elapsed=0,stepPhase=0,toastTimer=0;
let targetYaw=yaw,targetPitch=pitch;
let exhausted=false,landing=0,playerAction='Idle',actualSpeed=0;
function turnView(dx,dy){({yaw:targetYaw,pitch:targetPitch}=rotateLook(targetYaw,targetPitch,dx,dy));}
function resetLook(heading=0,elevation=.35){yaw=targetYaw=heading;pitch=targetPitch=elevation;hero.g.rotation.y=yaw;}
function updateLook(dt){
  ({yaw,pitch}=smoothLook(yaw,pitch,targetYaw,targetPitch,dt));
  // Character forward is local -Z; camera remains on the same heading's +Z.
  hero.g.rotation.y=yaw;
}
let closest=null,dialogueQueue=[],dialogueCallback=null;
const keys=new Set(),clock=new THREE.Clock(),raycaster=new THREE.Raycaster();
let audioContext=null;
function chime(){try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();[523,659,784].forEach((freq,i)=>{const o=audioContext.createOscillator(),gain=audioContext.createGain();o.type='sine';o.frequency.value=freq;gain.gain.setValueAtTime(0,audioContext.currentTime+i*.09);gain.gain.linearRampToValueAtTime(.055,audioContext.currentTime+i*.09+.02);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+i*.09+.5);o.connect(gain);gain.connect(audioContext.destination);o.start(audioContext.currentTime+i*.09);o.stop(audioContext.currentTime+i*.09+.55);});}catch{}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=performance.now()+4000;}
const mouseLook=createMouseLook(canvas,{
  isPlaying:()=>mode==='play'&&!qaRunning,
  onMove:turnView,
  onReleased:()=>pause(),
  onState:state=>{
    canvas.dataset.mouseLook=state;
    canvas.classList.toggle('mouse-look',state==='locked');
    const hint=$('capture-hint');
    hint.classList.toggle('hidden',mode!=='play'||qaRunning||state==='locked'||state==='unlocked');
    $('capture-message').textContent=state==='denied'
      ?'未能捕获鼠标。点击重试；若仍失败，请在外部 Chrome / Edge 打开本页。'
      :'正在启用鼠标视角…';
  }
});
function unlock(){targetYaw=yaw;targetPitch=pitch;mouseLook.unlock();keys.clear();$('capture-hint').classList.add('hidden');}
function lock(){if(!qaRunning)mouseLook.lock();}
$('capture-retry').onclick=()=>{canvas.focus({preventScroll:true});lock();};
function play(){mode='play';$('start-screen').classList.add('hidden');$('pause-screen').classList.add('hidden');$('completion').classList.add('hidden');$('hud').classList.remove('hidden');keys.clear();canvas.focus({preventScroll:true});lock();updateQuest();}
function pause(){if(mode!=='play')return;mode='pause';unlock();$('pause-screen').classList.remove('hidden');$('interact').classList.add('hidden');}
function speak(speaker,lines,callback=null){mode='dialogue';unlock();$('speaker').textContent=speaker;dialogueQueue=[...lines];dialogueCallback=callback;$('dialogue').classList.remove('hidden');$('interact').classList.add('hidden');nextDialogue();}
function nextDialogue(){if(dialogueQueue.length){$('dialogue-text').textContent=dialogueQueue.shift();$('dialogue-next').innerHTML=(dialogueQueue.length?'继续':'收好这段记忆')+' <span>→</span>';return;}$('dialogue').classList.add('hidden');const cb=dialogueCallback;dialogueCallback=null;mode='play';cb?.();if(mode==='play')lock();updateQuest();}
function interact(){if(!closest||mode!=='play')return;
  if(closest.type==='guide'){
    if(!progress.started)speak('小岚 · 校园向导',['欢迎来到这里。我正在整理一封写给未来的信，但还少了三段最重要的校园记忆。','去图书馆前寻找「求知」，去涌泉湖畔寻找「相遇」，去西北田径场寻找「热爱」。靠近发光的记忆，按 E 就能收集。','不必赶路。记得看看树影，也听听自己的脚步。找到三段记忆后，回到这里找我。'],()=>{progress.started=true;save();toast('任务已开启：寻找三段校园记忆');});
    else if(progress.completed)speak('小岚 · 校园向导',['谢谢你。这封信已经寄给未来，接下来的路，属于自由漫步的你。']);
    else if(progress.collected.length===3)speak('小岚 · 校园向导',['求知让我们走向远方，相遇让路途有了温度，热爱让每一天都值得奔赴。','你带回的三段记忆，已经组成了一封完整的信。愿未来的你，仍然记得此刻的风。'],()=>{if(finishQuest(progress)){save();mode='complete';unlock();$('completion').classList.remove('hidden');chime();}});
    else speak('小岚 · 校园向导',[`你已经找到了 ${progress.collected.length} 段记忆。剩下的地点已标在右上角地图上，沿着道路走就能抵达。`]);
  }else if(closest.type==='memory'){
    const m=closest.data;
    if(!progress.started){toast('这枚记忆似乎在等待一封信。先到书韵广场找小岚。');return;}
    if(collectMemory(progress,m.id)){save();chime();updateQuest();speak(m.name,[m.text],()=>toast(progress.collected.length===3?'记忆已集齐 · 返回书韵广场找小岚':`记忆已保存 · ${progress.collected.length} / 3`));}
  }else speak('校园导览',['这里是开发区校区南门。图书馆与信息楼在东南部，两座湖在中部，教学楼在北部，田径场在西北。生活区在学府大街东侧。按 M 查看全校地图。','地物轮廓采用学校官方地图的开发区校区数据，道路对照卫星图补绘。为方便试玩，平面距离统一缩小到约一半；建筑高度和外立面为风格化示意。']);
}
function updateQuest(){
  for(const m of memories){const found=progress.collected.includes(m.id);m.mesh.visible=!found;m.ring.visible=!found;m.label.visible=!found;}
  $('quest-title').textContent=progress.completed?'这封信，已寄往未来':progress.started?'寻找散落的校园记忆':'一封写给未来的信';
  $('quest-description').textContent=progress.completed?'故事已完成。沿着熟悉的道路，继续自由漫步。':!progress.started?'前往书韵广场，与校园向导小岚交谈。':progress.collected.length===3?'三段记忆已集齐。返回书韵广场，将它们交给小岚。':'探索三个地点，靠近发光的记忆并按 E 收集。';
  $('quest-items').innerHTML=progress.started?memories.map(m=>`<div class="quest-item ${progress.collected.includes(m.id)?'done':''}"><span>${progress.collected.includes(m.id)?'◆':'◇'} ${m.name}</span><span>${progress.collected.includes(m.id)?'已收集':m.area}</span></div>`).join(''):'';
  guideMarker.visible=!progress.completed;
}
function nearestTarget(){if(!progress.started||progress.collected.length===3)return{...GUIDE,name:progress.completed?'自由探索':'校园向导'};return memories.filter(m=>!progress.collected.includes(m.id)).sort((a,b)=>Math.hypot(hero.g.position.x-a.x,hero.g.position.z-a.z)-Math.hypot(hero.g.position.x-b.x,hero.g.position.z-b.z))[0];}
function updateInteraction(){
  const p=hero.g.position,candidates=[{type:'guide',...GUIDE,name:'校园向导 · 小岚',action:progress.collected.length===3&&!progress.completed?'交付记忆':'交谈'},{type:'board',...board,action:'查看校园导览'},...memories.filter(m=>!progress.collected.includes(m.id)).map(m=>({type:'memory',...m,data:m,action:'收集记忆'}))];
  closest=candidates.map(c=>({...c,d:Math.hypot(p.x-c.x,p.z-c.z)})).filter(c=>c.d<3.3).sort((a,b)=>a.d-b.d)[0]||null;
  $('interact').classList.toggle('hidden',!closest||mode!=='play');if(closest){$('interact-name').textContent=closest.name;$('interact-action').textContent=closest.action;}
  const target=nearestTarget();$('distance').textContent=progress.completed?'漫步校园，发现更多风景':`${target.area||target.name} · ${Math.round(Math.hypot(p.x-target.x,p.z-target.z))} m`;
  $('area').textContent=campusArea(p.x,p.z);
}
$('start-button').onclick=()=>{play();toast('鼠标转动视角 · WASD 移动 · Esc 暂停');};$('pause').onclick=pause;$('resume').onclick=play;$('keep-exploring').onclick=play;$('dialogue-next').onclick=nextDialogue;
$('restart').onclick=()=>{progress=freshProgress();save();hero.g.position.set(START.x,.1,START.z);velocityY=0;grounded=true;stamina=100;exhausted=false;landing=0;resetLook();play();toast('新的旅程开始了');};
$('quality').onchange=e=>{const high=e.target.value==='high';campus.landscape.setQuality(high);renderer.shadowMap.enabled=high;renderer.setPixelRatio(high?Math.min(devicePixelRatio,1.6):1);scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});};
window.addEventListener('keydown',e=>{
  const code=resolveKeyCode(e);if(!code)return;
  if(!e.metaKey&&!e.ctrlKey&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyE','KeyM','KeyR','Escape'].includes(code))e.preventDefault?.();
  // Escape and pointerlockchange may arrive in either order. Never resume on Escape.
  if(code==='Escape'){if(mode==='play')pause();return;}
  if(mode==='dialogue'){if(!e.repeat&&['KeyE','Enter','Space'].includes(code))nextDialogue();return;}
  if(mode==='start'){if(!e.repeat&&['Enter','Space'].includes(code))$('start-button').click();return;}
  if(mode==='complete'){if(!e.repeat&&['Enter','Space'].includes(code))$('keep-exploring').click();return;}
  if(mode!=='play')return;keys.add(code);
  if(!e.repeat&&code==='KeyE')interact();
  if(!e.repeat&&code==='Space'&&grounded){velocityY=7.2;grounded=false;}
  if(!e.repeat&&code==='KeyM')document.querySelector('.map-panel').classList.toggle('expanded');
  if(!e.repeat&&code==='KeyR'){hero.g.position.set(START.x,.1,START.z);velocityY=0;grounded=true;landing=0;toast('已返回校园入口');}
});
window.addEventListener('keyup',e=>{const code=resolveKeyCode(e);if(code)keys.delete(code);});
window.addEventListener('blur',()=>{keys.clear();if(mode==='play')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')pause();});
canvas.addEventListener('wheel',e=>{if(mode==='play'){e.preventDefault();camDistance=THREE.MathUtils.clamp(camDistance+e.deltaY*.007,3,13);}},{passive:false});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

const mapCanvas=$('minimap'),ctx=mapCanvas.getContext('2d');
function drawMap(){
  const expanded=document.querySelector('.map-panel').classList.contains('expanded');
  const size=expanded?780:220;if(mapCanvas.width!==size){mapCanvas.width=size;mapCanvas.height=size;}
  drawCampusMap(ctx,size,size,{player:hero.g.position,yaw,memories,progress,expanded});
}
const targetV=new THREE.Vector3(),desired=new THREE.Vector3(),direction=new THREE.Vector3();
let cameraDistance=camDistance;
function updateCamera(dt){
  targetV.copy(hero.g.position);targetV.y+=1.55;
  direction.copy(orbitOffset(hero.g.rotation.y,pitch,1));
  // Stop the orbit at the ground without flattening its arc or flipping over.
  let limit=direction.y<0?Math.min(camDistance,(targetV.y-.35)/-direction.y):camDistance;
  raycaster.set(targetV,direction);raycaster.far=limit+.3;
  const hits=raycaster.intersectObjects(occluders,false);
  if(hits.length)limit=Math.min(limit,Math.max(.15,hits[0].distance-.3));
  cameraDistance=followDistance(cameraDistance,limit,dt);
  // Heading is already smoothed together with the body. Only ease radius here;
  // Cartesian interpolation would cut across the orbit and slip off the back.
  desired.copy(targetV).addScaledVector(direction,cameraDistance);
  camera.position.copy(desired);camera.lookAt(targetV);
}
let frameCount=0,lastMapTime=0,lookPreviewTime=0;
function stepPlayer(dt){
  if(mode==='play'){
    updateLook(dt);
    let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
    let right=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
    const moving=forward!==0||right!==0;
    const energy=updateEnergy(stamina,exhausted,moving&&(keys.has('ShiftLeft')||keys.has('ShiftRight')),dt);
    const sprint=energy.sprint;stamina=energy.value;exhausted=energy.exhausted;
    $('stamina-bar').style.width=stamina+'%';$('stamina-bar').classList.toggle('exhausted',exhausted);
    $('movement-status').textContent=exhausted?'体力恢复中 · 暂时步行':sprint?'奔跑中':'自由探索中';
    actualSpeed=0;landing=Math.max(0,landing-dt);
    if(moving){const n=Math.hypot(forward,right);forward/=n;right/=n;const speed=sprint?RUN_SPEED:WALK_SPEED;const dx=(right*Math.cos(yaw)-forward*Math.sin(yaw))*speed*dt;const dz=(-forward*Math.cos(yaw)-right*Math.sin(yaw))*speed*dt;
      const p=moveWithCollision(hero.g.position,dx,dz,obstacles);actualSpeed=Math.hypot(p.x-hero.g.position.x,p.z-hero.g.position.z)/Math.max(dt,.0001);hero.g.position.x=p.x;hero.g.position.z=p.z;
      stepPhase+=dt*(sprint?14:9);hero.legs[0].rotation.x=Math.sin(stepPhase)*.65;hero.legs[1].rotation.x=-Math.sin(stepPhase)*.65;hero.arms[0].rotation.x=-Math.sin(stepPhase)*.5;hero.arms[1].rotation.x=Math.sin(stepPhase)*.5;hero.tail.rotation.x=-.25-(sprint?.3:0)+Math.sin(stepPhase)*.1;
    }else for(const limb of [...hero.legs,...hero.arms])limb.rotation.x*=Math.exp(-dt*12);
    if(!grounded){velocityY-=19*dt;hero.g.position.y+=velocityY*dt;if(hero.g.position.y<=.1){hero.g.position.y=.1;velocityY=0;grounded=true;landing=.24;}hero.arms[0].rotation.x=-.5;hero.arms[1].rotation.x=-.5;}
    playerAction=movementAction({grounded,velocityY,speed:actualSpeed,sprint,exhausted,landing});
    hero.updateModel?.(dt,playerAction,{speed:actualSpeed,exhausted,backward:forward<0});
    updateInteraction();
  }
}
function tick(){
  requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.04);elapsed+=dt;frameCount++;
  if(mode==='play'&&lookPreviewTime>0){turnView(-190*dt,0);lookPreviewTime=Math.max(0,lookPreviewTime-dt);}
  stepPlayer(dt);
  if(['play','start','dialogue','complete'].includes(mode)){
    const guideTalking=mode==='dialogue'&&$('speaker').textContent.startsWith('小岚');
    guide.updateModel?.(dt,guideTalking?'Talk':'Idle',{smile:true,talking:guideTalking});student.updateModel?.(dt);
    if(mode!=='play')hero.updateModel?.(dt,exhausted?'Tired':'Idle',{exhausted,smile:mode==='dialogue'||mode==='complete'});
  }
  if(mode==='start'){
    camera.position.set(285+Math.sin(elapsed*.055)*12,330,440);camera.lookAt(0,0,20);
  }else{
    updateCamera(dt);
  }
  for(const m of memories){m.mesh.rotation.y=elapsed*.8;m.mesh.position.y=1.7+Math.sin(elapsed*1.7+m.x)*.18;m.ring.scale.setScalar(1+Math.sin(elapsed*2)*.07);}
  guideMarker.position.y=2.8+Math.sin(elapsed*2)*.12;guideMarker.rotation.y=elapsed;
  campus.landscape.update(elapsed);atmosphere.update(elapsed);
  const shadowExtent=mode==='start'?340:95;
  if(sun.shadow.camera.right!==shadowExtent){Object.assign(sun.shadow.camera,{left:-shadowExtent,right:shadowExtent,top:shadowExtent,bottom:-shadowExtent});sun.shadow.camera.updateProjectionMatrix();}
  const shadowX=mode==='start'?0:hero.g.position.x,shadowZ=mode==='start'?0:hero.g.position.z;
  sun.position.set(shadowX-150,350,shadowZ+180);sun.target.position.set(shadowX,0,shadowZ);
  if(toastTimer>0&&performance.now()>toastTimer){toastTimer=0;$('toast').classList.remove('visible');}
  if(elapsed-lastMapTime>.1){drawMap();lastMapTime=elapsed;const degrees=((yaw*180/Math.PI)%360+360)%360;$('compass-heading').textContent=['N','NW','W','SW','S','SE','E','NE'][Math.round(degrees/45)%8];canvas.dataset.diagnostics=JSON.stringify({mode,x:+hero.g.position.x.toFixed(2),y:+hero.g.position.y.toFixed(2),z:+hero.g.position.z.toFixed(2),yaw:+yaw.toFixed(4),facing:+hero.g.rotation.y.toFixed(4),targetYaw:+targetYaw.toFixed(4),pitch:+pitch.toFixed(2),mouseLook:canvas.dataset.mouseLook||'unlocked',cameraDistance:+cameraDistance.toFixed(2),grounded,stamina:Math.round(stamina),exhausted,action:hero.animationState?.().action,animationPhase:hero.animationState?.().phase,frames:frameCount,environment:campus.landscape.stats,quality:campus.landscape.quality,buildings:campus.buildings.length,drawCalls:renderer.info.render.calls,progress});}
  renderer.render(scene,camera);
}
updateQuest();drawMap();tick();
// Read-only diagnostics for smoke checks and performance inspection.
Object.defineProperty(window,'campusDemo',{value:Object.freeze({getState:()=>({mode,position:{x:hero.g.position.x,y:hero.g.position.y,z:hero.g.position.z},grounded,stamina,progress:JSON.parse(JSON.stringify(progress)),interactable:closest?.name||null,renderCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frames:frameCount,webgl:!!renderer.getContext()})})});

// Explicit developer-only integration runner. Uses the same simulation, collision,
// interaction and dialogue functions; never overwrites a player's saved progress.
if(new URLSearchParams(location.search).has('qa')){
  const preview=document.createElement('button');preview.textContent='演示背后跟随';preview.style.cssText='position:fixed;right:15px;bottom:65px;z-index:101;padding:10px 16px;background:#ead9b5;color:#25453e;border:1px solid #e0c48c';document.body.append(preview);
  preview.onclick=()=>{
    qaRunning=true;mode='play';unlock();resetLook();hero.g.position.set(START.x,.1,START.z);grounded=true;velocityY=0;
    for(const id of ['start-screen','pause-screen','dialogue','completion'])$(id).classList.add('hidden');
    $('hud').classList.remove('hidden');panel.classList.add('hidden');lookPreviewTime=4;preview.textContent='再次演示背后跟随';
  };

  const panel=document.createElement('div');panel.style.cssText='position:fixed;left:15px;bottom:15px;z-index:100;background:#173c37;color:#fff;padding:15px;max-width:650px;font:12px monospace;white-space:pre-wrap';
  const button=document.createElement('button');button.textContent='运行核心流程回归检查';button.style.cssText='padding:12px';panel.append(button);document.body.append(panel);
    button.onclick=()=>{
      if(!hero.modelReady){toast('角色模型加载中，请稍后再运行检查');return;}
    qaRunning=true;unlock();const lines=[];
    const check=(condition,text)=>{if(!condition)throw new Error(text);lines.push('PASS '+text);};
    const walk=(x,z)=>{
      mode='play';resetLook();let steps=0;
      while(Math.hypot(hero.g.position.x-x,hero.g.position.z-z)>.15&&steps++<3000){
        keys.clear();const dx=x-hero.g.position.x,dz=z-hero.g.position.z;
        if(Math.abs(dx)>.065)keys.add(dx>0?'KeyD':'KeyA');if(Math.abs(dz)>.065)keys.add(dz>0?'KeyS':'KeyW');
        stepPlayer(1/60);
      }
      keys.clear();check(steps<3000,`步行抵达 (${x}, ${z})`);
    };
    const finishDialogue=()=>{let i=0;while(mode==='dialogue'&&i++<8)nextDialogue();check(i<8,'对话能够结束');};
    try{
      progress=freshProgress();hero.g.position.set(START.x,.1,START.z);grounded=true;velocityY=0;stamina=100;exhausted=false;landing=0;mode='play';$('start-screen').classList.add('hidden');$('hud').classList.remove('hidden');
      resetLook();cameraDistance=camDistance=5.5;
      let orbitValid=true,behindValid=true;
      for(let i=0;i<1200;i++){
        turnView(10,0);stepPlayer(1/60);updateCamera(1/60);
        const offset=camera.position.clone().sub(targetV),expected=orbitOffset(yaw,pitch,5.5);
        behindValid&&=Math.abs(Math.sin(Math.atan2(offset.x,offset.z)-hero.g.rotation.y))<1e-8&&Math.cos(Math.atan2(offset.x,offset.z)-hero.g.rotation.y)>.999999;
        orbitValid&&=offset.distanceTo(new THREE.Vector3(expected.x,expected.y,expected.z))<1e-8;
      }
      check(yaw<-Math.PI*10&&orbitValid,'连续旋转超过五圈，真实镜头没有角度卡点或半径收缩');
      check(behindValid,'原地转向全过程中，人物与镜头同步且始终背对镜头');
      resetLook(yaw,-.65);updateCamera(1/60);check(camera.position.y>=.35-1e-8,'仰视时镜头不会钻入地面');
      resetLook();updateCamera(1/60);
      for(const key of ['KeyA','KeyD','KeyS']){
        const previous=hero.g.position.clone();keys.add(key);stepPlayer(1/60);keys.clear();updateCamera(1/60);
        check(hero.g.rotation.y===yaw&&Math.abs(yaw)<1e-9&&hero.g.position.distanceTo(previous)>.05,`${key} 横移或后退时保持背面视角`);
      }
      hero.g.position.set(START.x,.1,START.z);
      resetLook(Math.PI/2);const before=hero.g.position.clone();keys.add('KeyW');stepPlayer(1/60);keys.clear();
      check(hero.g.position.x<before.x-.05&&Math.abs(hero.g.position.z-before.z)<1e-8,'转向后 W 沿人物面朝方向前进');
      hero.g.position.set(START.x,.1,START.z);resetLook();
      turnView(400,0);stepPlayer(1/60);const pausedYaw=yaw;mode='pause';unlock();mode='play';stepPlayer(1/60);
      check(yaw===pausedYaw&&targetYaw===yaw,'暂停会清除未完成的转向，恢复时不突然转头');
      resetLook();
      raycaster.set(new THREE.Vector3(30,4,174),new THREE.Vector3(0,0,-1));raycaster.far=50;check(raycaster.intersectObjects(occluders,false).length>0,'信息楼实际轮廓能遮挡第三人称镜头');
      keys.add('KeyW');keys.add('ShiftLeft');stepPlayer(.1);keys.clear();check(stamina<100&&hero.g.position.z<START.z-.8,'奔跑加速并消耗体力');hero.g.position.set(START.x,.1,START.z);
      stamina=100;exhausted=false;hero.g.position.set(-270,.1,140);keys.add('KeyW');keys.add('ShiftLeft');
      for(let i=0;i<287;i++)stepPlayer(1/60);
      check(exhausted&&playerAction==='Walk','体力耗尽后按住 Shift 自动切换步行');
      const phases=[];let continuous=true;
      for(let i=0;i<80;i++){stepPlayer(1/60);continuous&&=playerAction==='Walk';phases.push(hero.animationState().phase);}
      check(continuous&&Math.max(...phases)-Math.min(...phases)>.5,'恢复期间保持连续走路动画，没有反复重置');
      keys.clear();stepPlayer(1/60);check(playerAction==='Tired','体力耗尽后停下播放疲劳喘息');
      keys.add('KeyW');keys.add('ShiftLeft');for(let i=0;i<40;i++)stepPlayer(1/60);
      check(!exhausted&&playerAction==='Run','体力恢复到门槛后重新允许奔跑');
      keys.clear();stamina=100;exhausted=false;hero.g.position.set(START.x,.1,START.z);
      velocityY=7.2;grounded=false;stepPlayer(1/60);check(hero.g.position.y>.1,'跳跃离地');for(let i=0;i<120;i++)stepPlayer(1/60);check(grounded&&hero.g.position.y===.1,'跳跃后正确落地');
      const follow=route=>route.forEach(([x,z])=>walk(x,z));
      follow(QUEST_ROUTES.toGuide);check(closest?.type==='guide','书韵广场向导可达');interact();finishDialogue();check(progress.started,'领取任务');
      follow(QUEST_ROUTES.toLibrary);check(closest?.data?.id==='knowledge','图书馆记忆可达');interact();finishDialogue();
      follow(QUEST_ROUTES.toLake);check(closest?.data?.id==='encounter','涌泉湖记忆可达');interact();finishDialogue();
      follow(QUEST_ROUTES.toTrack);check(closest?.data?.id==='passion','西北田径场记忆可达');interact();finishDialogue();check(progress.collected.length===3,'三枚记忆只收集一次');
      follow(QUEST_ROUTES.returnGuide);interact();finishDialogue();check(progress.completed&&mode==='complete','交付后出现完成界面');
      follow(QUEST_ROUTES.toLiving);check(Math.hypot(hero.g.position.x-173,hero.g.position.z-18)<.2,'可步行到学府大街东侧生活区');
      mode='complete';
      check(memories.every(m=>!m.mesh.visible),'收集物从场景隐藏');
      panel.textContent=lines.join('\n')+'\nALL PASSED';panel.id='qa-results';panel.dataset.status='passed';
    }catch(error){panel.textContent=lines.join('\n')+'\nFAIL '+error.message;panel.id='qa-results';panel.dataset.status='failed';console.error(error);}
  };
}
