import * as THREE from 'three';
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { createCharacterAnimator } from './character-motion.js';
const scene=new THREE.Scene();scene.background=new THREE.Color('#263d40');scene.fog=new THREE.Fog('#263d40',7,16);
const camera=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.01,30);camera.position.set(2.2,1.65,4.0);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.91,0);controls.enableDamping=true;controls.minDistance=.5;controls.maxDistance=7;controls.maxPolarAngle=Math.PI*.52;
scene.add(new THREE.HemisphereLight('#e9f0ff','#647a70',2));
for(const [i,[pos,color,intensity]] of [[[2,4,4],'#fff1d3',3],[[-3,2,1],'#d4e6ff',1.8],[[0,3,-3],'#ffdda0',3]].entries()){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);light.castShadow=i===0;light.shadow.mapSize.set(2048,2048);light.shadow.normalBias=.018;light.shadow.bias=-.0002;Object.assign(light.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:.1,far:12});scene.add(light);}
const floor=new THREE.Mesh(new THREE.CircleGeometry(20,64),new THREE.MeshStandardMaterial({color:'#263d40',roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;scene.add(floor);
let animator,current='Idle',expression='Auto';
new GLTFLoader().load('./assets/characters/campus-traveler.glb',gltf=>{scene.add(gltf.scene);gltf.scene.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});animator=createCharacterAnimator(gltf.scene,gltf.animations);document.getElementById('status').textContent='模型已载入 · 拖动旋转 / 滚轮缩放';document.body.dataset.model='ready';},undefined,error=>{document.getElementById('error').textContent='模型加载失败：'+error.message;console.error(error);});
function view(pos,target){camera.position.set(...pos);controls.target.set(...target);controls.update();}
document.getElementById('front').onclick=()=>view([0,1.0,3.7],[0,.92,0]);
document.getElementById('back').onclick=()=>view([0,1.0,-3.7],[0,.92,0]);
document.getElementById('detail').onclick=()=>view([.28,1.65,.95],[0,1.60,0]);
document.getElementById('motion').onchange=e=>{current=e.target.value;};
document.getElementById('expression').onchange=e=>{expression=e.target.value;};
const clock=new THREE.Clock();renderer.setAnimationLoop(()=>{animator?.update(Math.min(clock.getDelta(),.05),current,{expression});controls.update();renderer.render(scene,camera);});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
