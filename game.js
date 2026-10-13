import * as THREE from 'three';
import { buildCampus } from './campus-world.js';
import { createAtmosphere } from './atmosphere.js';
import { GUIDE, BOARD, MEMORY_SPOTS, DORMITORIES, QUEST_ROUTES, campusArea } from './campus-layout.js';
import { drawCampusMap } from './campus-map.js';
import { START, COLLEGES, GENDERS, ENROLLMENT_YEAR, findCollege, findGender, sanitizePlayerName, generateStudentId, parseStudentId, assignDormitory, enrollStudent, buildPrologueScript, completePrologue, freshSaveRegistry, sanitizeSaveRegistry, getSaveSlot, createSaveSlot, updateSaveSlot, deleteSaveSlot, moveWithCollision, freshProgress, sanitizeProgress, collectMemory, finishQuest, findDormitory, freshLifeState, sanitizeLifeState, advanceGameTime, formatGameClock, planSleepSchedule, executeSleep, daylightProfile } from './logic.js';
import { upgradeAvatar } from './avatar.js';
import { getFootbridgeElevation, constrainFootbridgeMovement } from './footbridge.js';
import { movementAction, resolveKeyCode, WALK_SPEED, RUN_SPEED } from './motion.js';
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
const hemiLight = new THREE.HemisphereLight('#e2f3ff', '#758560', 1.2);
scene.add(hemiLight);
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
const father=character('#3b5669','#d6bc8b');father.g.position.set(START.x-1.15,.1,START.z-2.2);father.g.rotation.y=Math.PI;
const mother=character('#a45b53','#f0dec0');mother.g.position.set(START.x+1.15,.1,START.z-2.2);mother.g.rotation.y=Math.PI;
const fatherLabel=label('父亲 · 送学陪伴',START.x-1.15,3.25,START.z-2.2,4.4,'#244b48','#ffe7a8',32);
const motherLabel=label('母亲 · 送学陪伴',START.x+1.15,3.25,START.z-2.2,4.4,'#244b48','#ffe7a8',32);
function setParentsStage(stage='hidden',spot=START){
  const visible=stage==='gate'||stage==='dorm';
  father.g.visible=visible;mother.g.visible=visible;
  fatherLabel.visible=visible;motherLabel.visible=visible;
  if(!visible)return;
  const zOffset=stage==='gate'?-2.2:-1.9;
  father.g.position.set(spot.x-1.1,.1,spot.z+zOffset);father.g.rotation.y=Math.PI;
  mother.g.position.set(spot.x+1.1,.1,spot.z+zOffset);mother.g.rotation.y=Math.PI;
  fatherLabel.position.set(spot.x-1.1,3.25,spot.z+zOffset);
  motherLabel.position.set(spot.x+1.1,3.25,spot.z+zOffset);
}
Promise.all([upgradeAvatar(hero),upgradeAvatar(guide,'guide'),upgradeAvatar(student,'student'),upgradeAvatar(father,'father'),upgradeAvatar(mother,'mother')]).then(()=>{
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
const dormSpots=DORMITORIES.map(d=>{
  cylinder(d.x,.16,d.z,.82,.32,'#c8bfa8');
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.45),mat('#f6c453',{metalness:.3,roughness:.2,emissive:'#e09a3e',emissiveIntensity:.45}));
  marker.position.set(d.x,1.85,d.z);scene.add(marker);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.03,6,48),new THREE.MeshBasicMaterial({color:'#f6c453'}));
  ring.rotation.x=Math.PI/2;ring.position.set(d.x,.42,d.z);scene.add(ring);
  const assignedLabel=label('⌂ 我的宿舍 · '+d.name,d.x,3.25,d.z,7.2,'#244b48','#ffe7a8',32);
  const normalLabel=label('◇ '+d.name,d.x,3.05,d.z,5.2,null,'#e8e2cf',32);
  return {...d,marker,ring,assignedLabel,normalLabel};
});

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

let progress=freshProgress(),life=freshLifeState(),saveRegistry=freshSaveRegistry();
try{progress=sanitizeProgress(JSON.parse(localStorage.getItem('campus-echo-v1')));}catch{}
try{
  const rawLife=localStorage.getItem('campus-echo-life-v1');
  if(rawLife)life=sanitizeLifeState(JSON.parse(rawLife));
}catch{}
try{
  const rawSaves=localStorage.getItem('campus-echo-saves-v1');
  if(rawSaves){
    saveRegistry=sanitizeSaveRegistry(JSON.parse(rawSaves));
  }else if(life.enrolled){
    createSaveSlot(saveRegistry,{life,progress});
    localStorage.setItem('campus-echo-saves-v1',JSON.stringify(saveRegistry));
  }
  const activeSlot=getSaveSlot(saveRegistry);
  if(activeSlot){
    life=sanitizeLifeState(activeSlot.life);
    progress=sanitizeProgress(activeSlot.progress);
    if(Number.isFinite(activeSlot.position?.x)&&Number.isFinite(activeSlot.position?.z)){
      hero.g.position.set(activeSlot.position.x,.1,activeSlot.position.z);
    }
  }
}catch{}
let storageAvailable=true,qaRunning=false,previousScreenMode='start';
function persistRegistry(){
  if(qaRunning)return;
  try{
    localStorage.setItem('campus-echo-saves-v1',JSON.stringify(saveRegistry));
    localStorage.setItem('campus-echo-v1',JSON.stringify(progress));
    localStorage.setItem('campus-echo-life-v1',JSON.stringify(life));
  }catch{
    if(storageAvailable)toast('浏览器未开放本地存储，本次进度仅在当前页面保留。');
    storageAvailable=false;
  }
}
function save(){
  if(qaRunning)return;
  if(saveRegistry.activeSaveId){
    updateSaveSlot(saveRegistry,saveRegistry.activeSaveId,{
      life,
      progress,
      position:{x:hero.g.position.x,z:hero.g.position.z},
    });
  }
  persistRegistry();
}
function updateStartScreenHint(){
  const count=saveRegistry.saves.length;
  const hasActiveSave=Boolean(saveRegistry.activeSaveId&&getSaveSlot(saveRegistry,saveRegistry.activeSaveId));
  if(hasActiveSave){
    $('start-button').innerHTML='继续当前存档 <span>→</span>';
    $('saved-hint').textContent=`当前存档：${life.playerName}（${life.genderLabel} · 学号 ${life.studentId}） · ${life.collegeName} · ${life.dormName} ${life.room}`;
  }else{
    $('start-button').innerHTML='创建新存档 · 办理入学 <span>→</span>';
    $('saved-hint').textContent=`下一位入学新生年级顺序：${String(saveRegistry.nextGradeOrder).padStart(3,'0')} · 点击创建角色并开启父母送学剧情`;
  }
}
setParentsStage('hidden');
updateStartScreenHint();

for(const selId of ['sleep-hour','wake-hour']){
  const sel=$(selId);
  if(sel){
    sel.innerHTML=Array.from({length:24},(_,h)=>`<option value="${h}">${String(h).padStart(2,'0')} 时</option>`).join('');
  }
}
if($('time-scale'))$('time-scale').value=String(life.timeScale);

function updateProfileHUD(){
  const info=formatGameClock(life.totalMinutes);
  const name=sanitizePlayerName(life.playerName);
  const gender=findGender(life.genderId)||findGender(life.genderLabel)||GENDERS[0];
  const college=findCollege(life.collegeId)||findCollege(life.collegeName)||COLLEGES[0];
  if($('player-portrait'))$('player-portrait').textContent=name.charAt(0)||'学';
  if($('player-name-display'))$('player-name-display').textContent=`${name}（${gender.shortLabel} · ${life.studentId}）`;
  if($('player-college-display'))$('player-college-display').textContent=`${college.name} · ${info.yearName}学生`;
  if($('college-badge'))$('college-badge').textContent=`${college.name} · ${life.studentId}`;
}
function updateDormVisuals(){
  for(const d of dormSpots){
    const isMine=d.id===life.dormId;
    d.marker.visible=isMine;
    d.ring.material.color.set(isMine?'#f6c453':'#9eb8ad');
    d.assignedLabel.visible=isMine;
    d.normalLabel.visible=!isMine;
  }
  const myDorm=findDormitory(life.dormId);
  if($('dorm-badge'))$('dorm-badge').textContent=`⌂ ${myDorm?myDorm.shortName:life.dormName} · ${life.room}`;
  if($('enrollment-dorm-preview'))$('enrollment-dorm-preview').textContent=`入学随机分配宿舍：${life.dormName} · ${life.room}`;
  if($('enrollment-student-id'))$('enrollment-student-id').textContent=`入学学号：${life.studentId}（${ENROLLMENT_YEAR}级 · 年级顺序 ${String(life.gradeOrder).padStart(3,'0')}）`;
  updateProfileHUD();
}
function updateTimeHUD(){
  const info=formatGameClock(life.totalMinutes);
  if($('clock-display'))$('clock-display').textContent=`${info.summary} · ${info.period}`;
  if($('player-college-display')){
    const college=findCollege(life.collegeId)||findCollege(life.collegeName)||COLLEGES[0];
    $('player-college-display').textContent=`${college.name} · ${info.yearName}学生`;
  }
}
updateDormVisuals();updateTimeHUD();

let mode='start',yaw=0,pitch=.35,camDistance=5.5,velocityY=0,grounded=true,stamina=100,exhausted=false,elapsed=0,stepPhase=0,toastTimer=0;
let targetYaw=yaw,targetPitch=pitch;
let landing=0,playerAction='Idle',actualSpeed=0;
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
function play(){
  mode='play';
  $('start-screen').classList.add('hidden');
  $('character-screen')?.classList.add('hidden');
  $('save-screen')?.classList.add('hidden');
  $('pause-screen').classList.add('hidden');
  $('dorm-screen')?.classList.add('hidden');
  $('completion').classList.add('hidden');
  $('hud').classList.remove('hidden');
  setParentsStage('hidden');
  keys.clear();canvas.focus({preventScroll:true});lock();
  updateQuest();updateTimeHUD();updateDormVisuals();
}
function pause(){if(mode!=='play')return;mode='pause';unlock();$('pause-screen').classList.remove('hidden');$('interact').classList.add('hidden');}
function selectCollegeUI(collegeId){
  const college=findCollege(collegeId)||COLLEGES[0];
  if($('player-college-select'))$('player-college-select').value=college.id;
  document.querySelectorAll('.college-card').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.college===college.id);
  });
}
function selectGenderUI(genderId){
  const gender=findGender(genderId)||GENDERS[0];
  if($('player-gender-select'))$('player-gender-select').value=gender.id;
  document.querySelectorAll('.gender-card').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.gender===gender.id);
  });
}
function openCharacterScreen(fromMode=mode){
  previousScreenMode=fromMode==='pause'||fromMode==='saves'?fromMode:'start';
  mode='create';unlock();
  $('start-screen').classList.add('hidden');
  $('save-screen')?.classList.add('hidden');
  $('pause-screen').classList.add('hidden');
  $('dorm-screen')?.classList.add('hidden');
  $('completion').classList.add('hidden');
  // Prepare a fresh candidate state with the next gradeOrder and a new random 11-digit student ID
  const nextOrder=saveRegistry.nextGradeOrder||1;
  life=freshLifeState(Math.random,{gradeOrder:nextOrder,year:ENROLLMENT_YEAR});
  progress=freshProgress();
  if($('player-name-input'))$('player-name-input').value=life.playerName||'林风';
  selectGenderUI(life.genderId);
  selectCollegeUI(life.collegeId);
  updateDormVisuals();
  $('character-screen')?.classList.remove('hidden');
  setTimeout(()=>$('player-name-input')?.focus(),30);
}
function loadSaveById(saveId){
  const slot=getSaveSlot(saveRegistry,saveId);
  if(!slot)return;
  saveRegistry.activeSaveId=slot.id;
  life=sanitizeLifeState(slot.life);
  progress=sanitizeProgress(slot.progress);
  if($('time-scale'))$('time-scale').value=String(life.timeScale);
  const myDorm=findDormitory(life.dormId)||DORMITORIES[0];
  const px=Number.isFinite(slot.position?.x)?slot.position.x:myDorm.x;
  const pz=Number.isFinite(slot.position?.z)?slot.position.z:myDorm.z;
  hero.g.position.set(px,.1,pz);
  velocityY=0;grounded=true;stamina=100;exhausted=false;landing=0;
  resetLook();
  persistRegistry();
  updateStartScreenHint();
  if(!life.prologueCompleted){
    startParentPrologue();
  }else{
    play();
    toast(`已读取存档：${life.playerName}（${life.genderLabel} · 学号 ${life.studentId} · ${life.collegeName}）`);
  }
}
function renderSaveList(){
  const listEl=$('save-list');
  if(!listEl)return;
  if(!saveRegistry.saves.length){
    listEl.innerHTML='<div class="save-empty">当前暂无存档。点击下方「+ 创建新存档」办理新生入学，生成你的专属学号与校园档案。</div>';
    return;
  }
  listEl.innerHTML=saveRegistry.saves.map(slot=>{
    const l=slot.life;
    const p=slot.progress;
    const clockInfo=formatGameClock(l.totalMinutes);
    const isCurrent=slot.id===saveRegistry.activeSaveId;
    return `<div class="save-card ${isCurrent?'active':''}" role="listitem" data-save-id="${slot.id}">
      <div class="save-card-info">
        <strong>${l.playerName}（${l.genderLabel}） · 学号 ${l.studentId} ${isCurrent?'[当前存档]':''}</strong>
        <small>${l.collegeName} · 分配宿舍：${l.dormName} ${l.room}</small>
        <small>时间进度：${clockInfo.summary}（第 ${clockInfo.totalDays}/${clockInfo.maxDays} 天） · 校园记忆 ${p.collected.length}/3</small>
      </div>
      <div class="save-card-actions">
        <button type="button" class="mini-button" data-save-action="load" data-save-id="${slot.id}">读取存档</button>
        <button type="button" class="danger-button" data-save-action="delete" data-save-id="${slot.id}">删除</button>
      </div>
    </div>`;
  }).join('');
  listEl.querySelectorAll('button[data-save-action]').forEach(btn=>{
    btn.onclick=()=>{
      const targetId=btn.dataset.saveId;
      const action=btn.dataset.saveAction;
      if(action==='load'){
        loadSaveById(targetId);
      }else if(action==='delete'){
        const targetSlot=getSaveSlot(saveRegistry,targetId);
        const deletedName=targetSlot?`${targetSlot.life.playerName}（${targetSlot.life.studentId}）`:'存档';
        if(deleteSaveSlot(saveRegistry,targetId)){
          const nextActive=getSaveSlot(saveRegistry);
          if(nextActive){
            life=sanitizeLifeState(nextActive.life);
            progress=sanitizeProgress(nextActive.progress);
          }else{
            life=freshLifeState(Math.random,{gradeOrder:saveRegistry.nextGradeOrder});
            progress=freshProgress();
          }
          persistRegistry();
          updateDormVisuals();
          updateTimeHUD();
          updateStartScreenHint();
          renderSaveList();
          toast(`已删除存档：${deletedName}`);
        }
      }
    };
  });
}
function openSaveScreen(fromMode=mode){
  previousScreenMode=fromMode==='pause'?'pause':'start';
  mode='saves';unlock();
  $('start-screen').classList.add('hidden');
  $('character-screen')?.classList.add('hidden');
  $('pause-screen').classList.add('hidden');
  $('dorm-screen')?.classList.add('hidden');
  renderSaveList();
  $('save-screen')?.classList.remove('hidden');
}
function speak(speaker,lines,callback=null){
  mode='dialogue';unlock();
  dialogueQueue=lines.map(item=>typeof item==='string'?{speaker,text:item}:{speaker:item.speaker||speaker,text:item.text});
  dialogueCallback=callback;
  $('dialogue').classList.remove('hidden');
  $('interact').classList.add('hidden');
  nextDialogue();
}
function speakSequence(entries,callback=null){
  const firstSpeaker=entries[0]?.speaker||'校园旁白';
  speak(firstSpeaker,entries,callback);
}
function nextDialogue(){
  if(dialogueQueue.length){
    const current=dialogueQueue.shift();
    if(current.speaker)$('speaker').textContent=current.speaker;
    $('dialogue-text').textContent=current.text;
    $('dialogue-next').innerHTML=(dialogueQueue.length?'继续':'完成对话')+' <span>→</span>';
    return;
  }
  $('dialogue').classList.add('hidden');
  const cb=dialogueCallback;dialogueCallback=null;
  mode='play';cb?.();
  if(mode==='play')lock();
  updateQuest();
}
function startParentPrologue(){
  $('character-screen')?.classList.add('hidden');
  $('save-screen')?.classList.add('hidden');
  $('start-screen').classList.add('hidden');
  $('pause-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  const script=buildPrologueScript(life);
  hero.g.position.set(START.x,.1,START.z);
  velocityY=0;grounded=true;landing=0;
  resetLook(0,.26);
  setParentsStage('gate',START);
  updateDormVisuals();updateTimeHUD();updateInteraction();drawMap();
  chime();
  toast(`大一新生报到日 · 父母陪你抵达开发区校区南门`);
  speakSequence(script.gateLines,()=>{
    // Transition to assigned dormitory entrance with parents
    const dormSpot=script.dorm;
    hero.g.position.set(dormSpot.x,.1,dormSpot.z);
    velocityY=0;grounded=true;landing=0;
    resetLook(0,.26);
    setParentsStage('dorm',dormSpot);
    updateInteraction();drawMap();
    chime();
    toast(`父母陪你来到了分配宿舍：${life.dormName} · ${life.room}`);
    speakSequence(script.dormLines,()=>{
      const startPos=completePrologue(life);
      if(startPos)hero.g.position.set(startPos.x,.1,startPos.z);
      setParentsStage('hidden');
      save();
      updateStartScreenHint();
      play();
      toast(`欢迎你，${life.collegeName}新生 ${life.playerName}（学号 ${life.studentId}）！已从「${life.dormName} · ${life.room}」开启四年大学生活`);
    });
  });
}
function updateSleepPreview(){
  if(!$('sleep-preview'))return;
  const sleepNow=$('sleep-mode').value==='now';
  $('sleep-time-row')?.classList.toggle('hidden',sleepNow);
  const plan=planSleepSchedule(life.totalMinutes,{
    sleepNow,
    sleepHour:Number($('sleep-hour').value),
    sleepMinute:Number($('sleep-minute').value),
    wakeHour:Number($('wake-hour').value),
    wakeMinute:Number($('wake-minute').value),
  });
  const waitText=plan.waitMinutes>0?`先在校园/寝室活动 ${Math.floor(plan.waitMinutes/60)}小时${plan.waitMinutes%60?` ${plan.waitMinutes%60}分钟`:''} 后入睡 · `:'立即熄灯入睡 · ';
  $('sleep-preview').textContent=`${waitText}预计睡眠 ${plan.sleepHoursText} → 将于 ${plan.wakeClock.summary}（${plan.wakeClock.period}）醒来，体力完全恢复。`;
}
function openDormScreen(){
  mode='dorm';unlock();
  const info=formatGameClock(life.totalMinutes);
  $('dorm-title').textContent=`${life.dormName} · ${life.room}（${life.playerName} · 学号 ${life.studentId}）`;
  $('dorm-status-text').textContent=`当前校园时间：${info.summary}（${info.season}季 · 四年总第 ${info.totalDays} / ${info.maxDays} 天）。你可以自由安排作息时间，或查看整栋宿舍楼室内交互预留。`;
  $('sleep-mode').value='now';
  $('sleep-hour').value=String(life.sleepHour);
  $('sleep-minute').value=String(life.sleepMinute>=30?30:0);
  $('wake-hour').value=String(life.wakeHour);
  $('wake-minute').value=String(life.wakeMinute>=30?30:0);
  updateSleepPreview();
  $('dorm-screen').classList.remove('hidden');
  $('interact').classList.add('hidden');
}
function teleportToAssignedDorm(){
  const myDorm=findDormitory(life.dormId);
  if(!myDorm)return;
  hero.g.position.set(myDorm.x,.1,myDorm.z);
  velocityY=0;grounded=true;landing=0;
  play();
  toast(`已抵达分配宿舍：${life.dormName} · ${life.room}（按 E 进入宿舍交互）`);
}
function interact(){if(!closest||mode!=='play')return;
  if(closest.type==='guide'){
    if(!progress.started)speak('小岚 · 校园向导',[`${life.playerName}同学（学号 ${life.studentId}）你好！欢迎来到${life.collegeName}。我正在整理一封写给未来的信，但还少了三段最重要的校园记忆。`,'去图书馆前寻找「求知」，去涌泉湖畔寻找「相遇」，去西北田径场寻找「热爱」。靠近发光的记忆，按 E 就能收集。','不必赶路。记得看看树影，也听听自己的脚步。找到三段记忆后，回到这里找我。'],()=>{progress.started=true;save();toast('任务已开启：寻找三段校园记忆');});
    else if(progress.completed)speak('小岚 · 校园向导',['谢谢你。这封信已经寄给未来，接下来的路，属于自由漫步的你。']);
    else if(progress.collected.length===3)speak('小岚 · 校园向导',['求知让我们走向远方，相遇让路途有了温度，热爱让每一天都值得奔赴。','你带回的三段记忆，已经组成了一封完整的信。愿未来的你，仍然记得此刻的风。'],()=>{if(finishQuest(progress)){save();mode='complete';unlock();$('completion').classList.remove('hidden');chime();}});
    else speak('小岚 · 校园向导',[`你已经找到了 ${progress.collected.length} 段记忆。剩下的地点已标在右上角地图上，沿着道路走就能抵达。`]);
  }else if(closest.type==='memory'){
    const m=closest.data;
    if(!progress.started){toast('这枚记忆似乎在等待一封信。先到书韵广场找小岚。');return;}
    if(collectMemory(progress,m.id)){save();chime();updateQuest();speak(m.name,[m.text],()=>toast(progress.collected.length===3?'记忆已集齐 · 返回书韵广场找小岚':`记忆已保存 · ${progress.collected.length} / 3`));}
  }else if(closest.type==='dorm'){
    if(closest.isAssigned){
      openDormScreen();
    }else{
      speak('宿舍门禁 · '+closest.data.name,[`这里是「${closest.data.name}」，门禁识别显示你是「${life.collegeName}」的 ${life.playerName}（学号 ${life.studentId}），入学分配宿舍为「${life.dormName} · ${life.room}」。`,'你可以沿着生活区步道前往自己的宿舍楼，或者按 H 键快速抵达分配宿舍楼下。']);
    }
  }else speak('校园导览',[`${life.playerName}同学（${life.collegeName} · 学号 ${life.studentId}），这里是开发区校区南门。你的入学分配宿舍为「${life.dormName} · ${life.room}」（位于学府大街东侧生活区，可按 H 快速抵达或按 M 查看地图）。`,'图书馆与信息楼在东南部，两座湖在中部，教学楼在北部，田径场在西北。']);
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
  const p=hero.g.position;
  const dormCandidates=dormSpots.map(d=>({
    type:'dorm',
    x:d.x,
    z:d.z,
    data:d,
    isAssigned:d.id===life.dormId,
    name:d.id===life.dormId?`我的宿舍 · ${d.name} (${life.room})`:d.name,
    action:d.id===life.dormId?'作息睡眠 / 进入宿舍楼 (半成品)':'查看宿舍门禁',
  }));
  const candidates=[
    {type:'guide',...GUIDE,name:'校园向导 · 小岚',action:progress.collected.length===3&&!progress.completed?'交付记忆':'交谈'},
    {type:'board',...board,action:'查看校园导览'},
    ...memories.filter(m=>!progress.collected.includes(m.id)).map(m=>({type:'memory',...m,data:m,action:'收集记忆'})),
    ...dormCandidates,
  ];
  closest=candidates.map(c=>({...c,d:Math.hypot(p.x-c.x,p.z-c.z)})).filter(c=>c.d<(c.type==='dorm'?3.8:3.3)).sort((a,b)=>a.d-b.d)[0]||null;
  $('interact').classList.toggle('hidden',!closest||mode!=='play');if(closest){$('interact-name').textContent=closest.name;$('interact-action').textContent=closest.action;}
  const target=nearestTarget();$('distance').textContent=progress.completed?`我的宿舍：${life.dormName} ${life.room}`:`${target.area||target.name} · ${Math.round(Math.hypot(p.x-target.x,p.z-target.z))} m`;
  $('area').textContent=campusArea(p.x,p.z);
}
const RANDOM_NAMES_MALE=['林风','陈默','周予安','顾言','许星河','陆景行','江屿'];
const RANDOM_NAMES_FEMALE=['苏晴','沈知夏','宋清禾','林语桐','夏晚星','温知意','叶清浅'];
document.querySelectorAll('.college-card').forEach(btn=>{
  btn.onclick=()=>selectCollegeUI(btn.dataset.college);
});
document.querySelectorAll('.gender-card').forEach(btn=>{
  btn.onclick=()=>selectGenderUI(btn.dataset.gender);
});
if($('player-college-select'))$('player-college-select').onchange=e=>selectCollegeUI(e.target.value);
if($('player-gender-select'))$('player-gender-select').onchange=e=>selectGenderUI(e.target.value);
if($('random-name-btn'))$('random-name-btn').onclick=()=>{
  const gId=$('player-gender-select')?.value||'male';
  const pool=gId==='female'?RANDOM_NAMES_FEMALE:RANDOM_NAMES_MALE;
  const pick=pool[Math.floor(Math.random()*pool.length)];
  if($('player-name-input'))$('player-name-input').value=pick;
};
if($('reroll-student-id-btn'))$('reroll-student-id-btn').onclick=()=>{
  life.studentId=generateStudentId({year:ENROLLMENT_YEAR,gradeOrder:life.gradeOrder});
  updateDormVisuals();
};
if($('reroll-dorm-btn'))$('reroll-dorm-btn').onclick=()=>{
  const assigned=assignDormitory();
  life.dormId=assigned.dormId;life.dormName=assigned.dormName;life.room=assigned.room;
  updateDormVisuals();
};
if($('cancel-enrollment'))$('cancel-enrollment').onclick=()=>{
  $('character-screen')?.classList.add('hidden');
  const activeSlot=getSaveSlot(saveRegistry);
  if(activeSlot){
    life=sanitizeLifeState(activeSlot.life);
    progress=sanitizeProgress(activeSlot.progress);
    updateDormVisuals();
  }
  if(previousScreenMode==='saves')openSaveScreen('start');
  else if(previousScreenMode==='pause'){mode='pause';$('pause-screen').classList.remove('hidden');}
  else{$('start-screen').classList.remove('hidden');mode='start';}
};
if($('confirm-enrollment'))$('confirm-enrollment').onclick=()=>{
  const rawName=$('player-name-input')?.value||'';
  const genderId=$('player-gender-select')?.value||'male';
  const collegeId=$('player-college-select')?.value||'se';
  enrollStudent(life,{
    playerName:rawName,
    genderId,
    collegeId,
    gradeOrder:life.gradeOrder,
    studentId:life.studentId,
  });
  progress=freshProgress();
  const myDorm=findDormitory(life.dormId)||DORMITORIES[0];
  createSaveSlot(saveRegistry,{
    life,
    progress,
    position:{x:myDorm.x,z:myDorm.z},
  });
  persistRegistry();
  updateStartScreenHint();
  startParentPrologue();
};
if($('open-saves-button'))$('open-saves-button').onclick=()=>openSaveScreen('start');
if($('pause-saves-button'))$('pause-saves-button').onclick=()=>openSaveScreen('pause');
if($('create-new-save-btn'))$('create-new-save-btn').onclick=()=>openCharacterScreen('saves');
if($('close-saves-btn'))$('close-saves-btn').onclick=()=>{
  $('save-screen')?.classList.add('hidden');
  if(previousScreenMode==='pause'&&saveRegistry.activeSaveId){
    mode='pause';$('pause-screen').classList.remove('hidden');
  }else{
    mode='start';$('start-screen').classList.remove('hidden');
  }
};
$('start-button').onclick=()=>{
  const hasActiveSave=Boolean(saveRegistry.activeSaveId&&getSaveSlot(saveRegistry,saveRegistry.activeSaveId));
  if(hasActiveSave){
    loadSaveById(saveRegistry.activeSaveId);
  }else{
    openCharacterScreen('start');
  }
};
$('pause').onclick=pause;$('resume').onclick=play;$('keep-exploring').onclick=play;$('dialogue-next').onclick=nextDialogue;
$('go-dorm').onclick=teleportToAssignedDorm;
$('sleep-mode').onchange=updateSleepPreview;
$('sleep-hour').onchange=updateSleepPreview;
$('sleep-minute').onchange=updateSleepPreview;
$('wake-hour').onchange=updateSleepPreview;
$('wake-minute').onchange=updateSleepPreview;
$('dorm-close').onclick=play;
$('dorm-sleep-confirm').onclick=()=>{
  const plan=executeSleep(life,{
    sleepNow:$('sleep-mode').value==='now',
    sleepHour:Number($('sleep-hour').value),
    sleepMinute:Number($('sleep-minute').value),
    wakeHour:Number($('wake-hour').value),
    wakeMinute:Number($('wake-minute').value),
  });
  stamina=100;exhausted=false;
  save();chime();play();
  toast(plan.wakeClock.graduated
    ?'四年大学时光圆满落幕！你可以继续在校园自由探索。'
    :`闹钟响起 · ${plan.wakeClock.summary}（睡眠 ${plan.sleepHoursText}，体力已充沛）`);
};
$('dorm-enter-building').onclick=()=>{
  $('dorm-screen').classList.add('hidden');
  speak(`${life.dormName} · 室内空间（半成品预留）`,[
    `你推开了「${life.dormName}」一楼大厅门禁，前方是宿管值班室与通往 ${life.room} 的多层楼梯走廊。`,
    '【开发阶段说明】当前版本已完成「入学随机分配宿舍 + 靠近对应宿舍交互 + 四年时间与自由睡眠作息」核心闭环；整栋宿舍楼内部的多层走廊、寝室书桌与室友室内移动交互将在后续阶段开放。'
  ]);
};
$('restart').onclick=()=>{
  openCharacterScreen('pause');
};
$('quality').onchange=e=>{const high=e.target.value==='high';campus.landscape.setQuality(high);renderer.shadowMap.enabled=high;renderer.setPixelRatio(high?Math.min(devicePixelRatio,1.6):1);scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});};
if($('time-scale'))$('time-scale').onchange=e=>{life.timeScale=Number(e.target.value)||60;save();toast(`时间流速已调整为 1 : ${life.timeScale}`);};
window.addEventListener('keydown',e=>{
  const activeTag=document.activeElement?.tagName;
  const isTyping=activeTag==='INPUT'||activeTag==='TEXTAREA';
  const code=resolveKeyCode(e);if(!code)return;
  if(isTyping){
    if(code==='Escape'){document.activeElement.blur();return;}
    if(code==='Enter'&&mode==='create'&&!e.repeat){e.preventDefault?.();$('confirm-enrollment')?.click();}
    return;
  }
  if(!e.metaKey&&!e.ctrlKey&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyE','KeyH','KeyM','KeyR','Escape'].includes(code))e.preventDefault?.();
  // Escape and pointerlockchange may arrive in either order. Never resume on Escape.
  if(code==='Escape'){if(mode==='play')pause();else if(mode==='dorm')play();else if(mode==='create')$('cancel-enrollment')?.click();else if(mode==='saves')$('close-saves-btn')?.click();return;}
  if(mode==='create'){if(!e.repeat&&code==='Enter')$('confirm-enrollment')?.click();return;}
  if(mode==='dialogue'){if(!e.repeat&&['KeyE','Enter','Space'].includes(code))nextDialogue();return;}
  if(mode==='dorm'){if(!e.repeat&&code==='Enter')$('dorm-sleep-confirm').click();return;}
  if(mode==='start'){if(!e.repeat&&['Enter','Space'].includes(code))$('start-button').click();return;}
  if(mode==='complete'){if(!e.repeat&&['Enter','Space'].includes(code))$('keep-exploring').click();return;}
  if(mode!=='play')return;keys.add(code);
  if(!e.repeat&&code==='KeyE')interact();
  if(!e.repeat&&code==='Space'&&grounded){velocityY=7.2;grounded=false;}
  if(!e.repeat&&code==='KeyM')document.querySelector('.map-panel').classList.toggle('expanded');
  if(!e.repeat&&code==='KeyH')teleportToAssignedDorm();
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
  const myDorm=findDormitory(life.dormId);
  drawCampusMap(ctx,size,size,{player:hero.g.position,yaw,memories,progress,dorm:myDorm,expanded});
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
    if(!qaRunning)advanceGameTime(life,dt);
    updateLook(dt);
    let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
    let right=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
    const moving=forward!==0||right!==0;
    const sprint=moving&&(keys.has('ShiftLeft')||keys.has('ShiftRight'));
    $('movement-status').textContent=sprint?'奔跑中':'自由探索中';
    actualSpeed=0;landing=Math.max(0,landing-dt);
    if(moving){const n=Math.hypot(forward,right);forward/=n;right/=n;const speed=sprint?RUN_SPEED:WALK_SPEED;const dx=(right*Math.cos(yaw)-forward*Math.sin(yaw))*speed*dt;const dz=(-forward*Math.cos(yaw)-right*Math.sin(yaw))*speed*dt;
      const p=moveWithCollision(hero.g.position,dx,dz,obstacles);
      const cp=constrainFootbridgeMovement(p,hero.g.position.y);
      actualSpeed=Math.hypot(cp.x-hero.g.position.x,cp.z-hero.g.position.z)/Math.max(dt,.0001);
      hero.g.position.x=cp.x;hero.g.position.z=cp.z;
      stepPhase+=dt*(sprint?14:9);hero.legs[0].rotation.x=Math.sin(stepPhase)*.65;hero.legs[1].rotation.x=-Math.sin(stepPhase)*.65;hero.arms[0].rotation.x=-Math.sin(stepPhase)*.5;hero.arms[1].rotation.x=Math.sin(stepPhase)*.5;hero.tail.rotation.x=-.25-(sprint?.3:0)+Math.sin(stepPhase)*.1;
    }else for(const limb of [...hero.legs,...hero.arms])limb.rotation.x*=Math.exp(-dt*12);
    const floorY=getFootbridgeElevation(hero.g.position.x,hero.g.position.z,hero.g.position.y);
    if(!grounded){
      velocityY-=19*dt;hero.g.position.y+=velocityY*dt;
      if(hero.g.position.y<=floorY){hero.g.position.y=floorY;velocityY=0;grounded=true;landing=.24;}
      hero.arms[0].rotation.x=-.5;hero.arms[1].rotation.x=-.5;
    }else{
      hero.g.position.y=floorY;
    }
    playerAction=movementAction({grounded,velocityY,speed:actualSpeed,sprint,landing});
    hero.updateModel?.(dt,playerAction,{speed:actualSpeed,backward:forward<0});
    updateInteraction();
  }
}
function tick(){
  requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.04);elapsed+=dt;frameCount++;
  if(mode==='play'&&lookPreviewTime>0){turnView(-190*dt,0);lookPreviewTime=Math.max(0,lookPreviewTime-dt);}
  stepPlayer(dt);
  if(['play','start','create','saves','dialogue','dorm','complete'].includes(mode)){
    const spk=$('speaker').textContent||'';
    const guideTalking=mode==='dialogue'&&spk.startsWith('小岚');
    const fatherTalking=mode==='dialogue'&&spk.startsWith('父亲');
    const motherTalking=mode==='dialogue'&&spk.startsWith('母亲');
    guide.updateModel?.(dt,guideTalking?'Talk':'Idle',{smile:true,talking:guideTalking});
    student.updateModel?.(dt);
    if(father.g.visible)father.updateModel?.(dt,fatherTalking?'Talk':'Idle',{smile:true,talking:fatherTalking});
    if(mother.g.visible)mother.updateModel?.(dt,motherTalking?'Talk':'Idle',{smile:true,talking:motherTalking});
    if(mode!=='play')hero.updateModel?.(dt,'Idle',{smile:mode==='dialogue'||mode==='complete'});
  }
  const overviewMode=mode==='start'||mode==='create'||(mode==='saves'&&previousScreenMode!=='pause');
  if(overviewMode){
    camera.position.set(285+Math.sin(elapsed*.055)*12,330,440);camera.lookAt(0,0,20);
  }else{
    updateCamera(dt);
  }
  for(const m of memories){m.mesh.rotation.y=elapsed*.8;m.mesh.position.y=1.7+Math.sin(elapsed*1.7+m.x)*.18;m.ring.scale.setScalar(1+Math.sin(elapsed*2)*.07);}
  for(const d of dormSpots){if(d.marker.visible){d.marker.rotation.y=elapsed*.9;d.marker.position.y=1.85+Math.sin(elapsed*2)*.14;d.ring.scale.setScalar(1+Math.sin(elapsed*2.2)*.08);}}
  guideMarker.position.y=2.8+Math.sin(elapsed*2)*.12;guideMarker.rotation.y=elapsed;
  const light=daylightProfile(life.totalMinutes);
  campus.landscape.update(elapsed,camera);atmosphere.update(elapsed,qaRunning?null:light.sunOffset);
  if(!qaRunning){
    sun.intensity=light.sunIntensity;
    hemiLight.intensity=light.hemiIntensity;
    renderer.toneMappingExposure=light.exposure;
    scene.fog.color.set(light.fogColor);
  }
  const shadowExtent=overviewMode?340:95;
  if(sun.shadow.camera.right!==shadowExtent){Object.assign(sun.shadow.camera,{left:-shadowExtent,right:shadowExtent,top:shadowExtent,bottom:-shadowExtent});sun.shadow.camera.updateProjectionMatrix();}
  const shadowX=overviewMode?0:hero.g.position.x,shadowZ=overviewMode?0:hero.g.position.z;
  const sunOff=qaRunning?{x:-150,y:350,z:180}:light.sunOffset;
  sun.position.set(shadowX+sunOff.x,sunOff.y,shadowZ+sunOff.z);sun.target.position.set(shadowX,0,shadowZ);
  if(toastTimer>0&&performance.now()>toastTimer){toastTimer=0;$('toast').classList.remove('visible');}
  if(elapsed-lastMapTime>.1){drawMap();updateTimeHUD();lastMapTime=elapsed;const degrees=((yaw*180/Math.PI)%360+360)%360;$('compass-heading').textContent=['N','NW','W','SW','S','SE','E','NE'][Math.round(degrees/45)%8];canvas.dataset.diagnostics=JSON.stringify({mode,x:+hero.g.position.x.toFixed(2),y:+hero.g.position.y.toFixed(2),z:+hero.g.position.z.toFixed(2),yaw:+yaw.toFixed(4),facing:+hero.g.rotation.y.toFixed(4),targetYaw:+targetYaw.toFixed(4),pitch:+pitch.toFixed(2),mouseLook:canvas.dataset.mouseLook||'unlocked',cameraDistance:+cameraDistance.toFixed(2),grounded,action:hero.animationState?.().action,animationPhase:hero.animationState?.().phase,frames:frameCount,environment:campus.landscape.stats,quality:campus.landscape.quality,buildings:campus.buildings.length,drawCalls:renderer.info.render.calls,progress,life,clock:formatGameClock(life.totalMinutes)});}
  renderer.render(scene,camera);
}
updateQuest();drawMap();tick();
// Read-only diagnostics for smoke checks and performance inspection.
Object.defineProperty(window,'campusDemo',{value:Object.freeze({getState:()=>({mode,position:{x:hero.g.position.x,y:hero.g.position.y,z:hero.g.position.z},grounded,progress:JSON.parse(JSON.stringify(progress)),life:JSON.parse(JSON.stringify(life)),clock:formatGameClock(life.totalMinutes),interactable:closest?.name||null,renderCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frames:frameCount,webgl:!!renderer.getContext()})})});

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
      progress=freshProgress();hero.g.position.set(START.x,.1,START.z);grounded=true;velocityY=0;landing=0;mode='play';$('start-screen').classList.add('hidden');$('hud').classList.remove('hidden');
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
      keys.add('KeyW');keys.add('ShiftLeft');stepPlayer(.1);keys.clear();check(hero.g.position.z<START.z-.8,'Shift 奔跑加速');
      hero.g.position.set(-270,.1,140);keys.add('KeyW');keys.add('ShiftLeft');
      let continuous=true;const phases=[];
      for(let i=0;i<1200;i++){stepPlayer(1/60);continuous&&=playerAction==='Run';if(i>1100)phases.push(hero.animationState().phase);}
      check(continuous,'持续奔跑 20 秒不再受体力限制');
      check(Math.max(...phases)-Math.min(...phases)>.5,'持续奔跑动画保持播放');
      keys.delete('ShiftLeft');stepPlayer(1/60);check(playerAction==='Walk','松开 Shift 恢复步行动画');
      keys.clear();stepPlayer(1/60);check(playerAction==='Idle','停下正常待机，无体力疲劳状态');
      check(!$('stamina-bar'),'界面已移除体力条');
      hero.g.position.set(START.x,.1,START.z);
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
