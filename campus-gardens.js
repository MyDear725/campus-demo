import * as THREE from 'three';
import { mergeGeometries } from './node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { seededRandom } from './nature-materials.js';
import { nearBoundary } from './campus-boundary.js';
import { TEACHING_COURT, TEACHING_ENTRIES } from './teaching-layout.js';
import { CAMPUS_FEATURES, ROADS, QUEST_ROUTES, GUIDE, BOARD, CAMPUS_START, MEMORY_SPOTS, nearPolygon, segmentDistance } from './campus-layout.js';

// Original, illustrative planting design. Geometry is shared in spatial batches;
// no model downloads or per-flower Object3D updates are needed.
function merged(parts){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());return g;}
function geometry(positions,colors){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  if(colors)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
function leaf(positions,colors,origin,angle,length,width,rise,color){
  const [x,y,z]=origin,dx=Math.cos(angle),dz=Math.sin(angle),px=-dz*width,pz=dx*width;
  const a=[x,y,z],b=[x+dx*length*.48+px,y+rise*.65,z+dz*length*.48+pz];
  const c=[x+dx*length,y+rise,z+dz*length],d=[x+dx*length*.48-px,y+rise*.65,z+dz*length*.48-pz];
  positions.push(...a,...b,...c,...a,...c,...d);
  for(let i=0;i<6;i++)colors.push(color.r,color.g,color.b);
}
function grassGeometry(){
  const positions=[],colors=[],random=seededRandom(27);
  for(let i=0;i<13;i++){
    const angle=random()*Math.PI*2,r=random()*.25,h=.2+random()*.45,x=Math.cos(angle)*r,z=Math.sin(angle)*r,w=.014+random()*.021;
    const dx=Math.cos(angle),dz=Math.sin(angle),bend=.1+random()*.2;
    positions.push(x-dz*w,0,z+dx*w,x+dz*w,0,z-dx*w,x+dx*bend*.4-dz*w*.5,h*.58,z+dz*bend*.4+dx*w*.5,
      x+dz*w,0,z-dx*w,x+dx*bend*.4+dz*w*.5,h*.58,z+dz*bend*.4-dx*w*.5,x+dx*bend*.4-dz*w*.5,h*.58,z+dz*bend*.4+dx*w*.5,
      x+dx*bend*.4-dz*w*.5,h*.58,z+dz*bend*.4+dx*w*.5,x+dx*bend*.4+dz*w*.5,h*.58,z+dz*bend*.4-dx*w*.5,x+dx*bend,h,z+dz*bend);
    const base=new THREE.Color('#566b30').multiplyScalar(.8+random()*.3),tip=new THREE.Color('#a0aa60');
    for(let v=0;v<9;v++){const c=v===8?tip:base;colors.push(c.r,c.g,c.b);}
  }
  return geometry(positions,colors);
}
function shrubGeometry(){
  const positions=[],colors=[],random=seededRandom(88);
  for(let i=0;i<155;i++){
    const a=random()*Math.PI*2,r=Math.sqrt(random())*.65,h=.2+Math.sqrt(Math.max(0,1-r*r/.5))*.55*random();
    const color=new THREE.Color(i%7===0?'#8a9850':'#3e6138').multiplyScalar(.8+random()*.5);
    leaf(positions,colors,[Math.cos(a)*r,h,Math.sin(a)*r],random()*Math.PI*2,.15+random()*.16,.035+random()*.02,.02+random()*.12,color);
  }
  return geometry(positions,colors);
}
function flowerGeometry(spike=false){
  const stems=[],petals=[],centres=[],leafPositions=[],leafColors=[],random=seededRandom(spike?12:17);
  const green=new THREE.Color('#466439');
  for(let i=0;i<(spike?5:3);i++){
    const a=i*2.4,x=Math.cos(a)*.15,z=Math.sin(a)*.15,h=(spike?.58:.34)+random()*.22;
    const stem=new THREE.CylinderGeometry(.007,.011,h,4,1,true);stem.translate(x,h/2,z);stems.push(stem);
    for(let j=0;j<6;j++)leaf(leafPositions,leafColors,[x,h*(.12+j*.11),z],a+j*2.1,.19,.036,.07,green);
    for(let j=0;j<4;j++)leaf(leafPositions,leafColors,[x,.035,z],a+j*1.57,.23,.044,.12,green);
    if(spike){
      for(let k=0;k<7;k++){
        const bud=new THREE.IcosahedronGeometry(.034*(1-k*.07),0);bud.scale(1,1.25,1);bud.translate(x+Math.cos(k*2.4)*.016,h+k*.028,z+Math.sin(k*2.4)*.016);petals.push(bud);
      }
    }else{
      for(let j=0;j<9;j++){
        const theta=j*Math.PI*2/9;
        const g=geometry([0,0,.018,-.035,.012,.085,0,.008,.155,0,0,.018,0,.008,.155,.035,.012,.085]);
        g.rotateY(theta);g.rotateX(.12);g.translate(x,h,z);petals.push(g);
      }
      const disk=new THREE.SphereGeometry(.034,6,3);disk.scale(1,.45,1);disk.translate(x,h+.01,z);centres.push(disk);
    }
  }
  // Stem and leaf geometry share attributes, and are tinted with the stem material.
  const leaves=geometry(leafPositions);stems.push(leaves);
  for(const g of stems){g.deleteAttribute('uv');if(g.index){const n=g.toNonIndexed();g.copy(n);n.dispose();}}
  return {green:merged(stems),petals:merged(petals),centres:centres.length?merged(centres):null};
}

export function createPlantingMask(banks){
  const paths=Object.values(QUEST_ROUTES).flatMap(route=>[route,route.flatMap((p,i)=>{
    if(!i)return [p];const a=route[i-1],d=Math.min(Math.abs(p[0]-a[0]),Math.abs(p[1]-a[1]));
    return [[a[0]+Math.sign(p[0]-a[0])*d,a[1]+Math.sign(p[1]-a[1])*d],p];
  })]);
  const spots=[CAMPUS_START,GUIDE,BOARD,...MEMORY_SPOTS];
  return (x,z,padding=.3)=>{
    if(x<-245||x>297||z<-155||z>209||(x<-65&&z>105))return false;
    if(nearBoundary(x,z,padding+.45))return false;
    if(nearPolygon(x,z,TEACHING_COURT.points,padding+.4))return false;
    if(Object.values(TEACHING_ENTRIES).some(e=>Math.hypot(x-e.anchor[0],z-e.anchor[1])<5.3+padding))return false;
    if(CAMPUS_FEATURES.some(f=>nearPolygon(x,z,f.points,padding+.4)))return false;
    if(ROADS.some(r=>r.points.some((p,i)=>i&&segmentDistance(x,z,r.points[i-1],p)<r.width/2+1+padding)))return false;
    if(banks.some(b=>b.promenade.some((p,i)=>i&&segmentDistance(x,z,b.promenade[i-1],p)<1.65+padding)))return false;
    if(paths.some(path=>path.some((p,i)=>i&&segmentDistance(x,z,path[i-1],p)<1.05+padding)))return false;
    return !spots.some(p=>Math.hypot(p.x-x,p.z-z)<2.5+padding);
  };
}

export function buildGardens(world,{trees,banks,materials}){
  const random=seededRandom(131026),clear=createPlantingMask(banks),batches=new Map(),chunks=new Map();
  const time={value:0},fadeStart={value:65},fadeEnd={value:95};
  const colour={grass:['#f4f0c6','#c8d59c','#bccd90'],flowers:['#f1e7cb','#d7a4b7','#a5a1cd','#e3bf60']};
  const planted=[],beds=[],stats={flowerBeds:0,flowerClumps:0,shrubs:0,grassTufts:0,fallenLeaves:0};
  function livingMaterial(color,vertexColors=false){
    const m=new THREE.MeshStandardMaterial({color,vertexColors,side:THREE.DoubleSide,roughness:.94});
    m.onBeforeCompile=shader=>{
      shader.uniforms.uGardenTime=time;shader.uniforms.uGardenFadeStart=fadeStart;shader.uniforms.uGardenFadeEnd=fadeEnd;
      shader.vertexShader='uniform float uGardenTime;uniform float uGardenFadeStart;uniform float uGardenFadeEnd;varying float vGardenFade;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 plantWorld=(modelMatrix*instanceMatrix*vec4(position,1.0)).xyz;
        float phase=plantWorld.x*.7+plantWorld.z*.4;
        float flex=pow(max(position.y,0.0),1.6);
        transformed.x+=sin(uGardenTime*1.35+phase)*.055*flex;
        transformed.z+=cos(uGardenTime*.95+phase)*.038*flex;
        float viewRange=length(plantWorld.xz-cameraPosition.xz)-max(cameraPosition.y-12.0,0.0)*2.0;
        vGardenFade=1.0-smoothstep(uGardenFadeStart,uGardenFadeEnd,viewRange);`);
      shader.fragmentShader='varying float vGardenFade;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        if(vGardenFade<fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453))discard;`);
    };
    return m;
  }
  const grassMat=livingMaterial('#ffffff',true),shrubMat=livingMaterial('#ffffff',true),stemMat=livingMaterial('#52663a'),petalMat=livingMaterial('#ffffff'),centreMat=livingMaterial('#cda542');
  const grass=grassGeometry(),shrub=shrubGeometry(),daisy=flowerGeometry(),salvia=flowerGeometry(true);
  const soil=new THREE.CylinderGeometry(1,1,.035,40);const edge=new THREE.TorusGeometry(1,.014,4,48);edge.rotateX(-Math.PI/2);
  const leafGeo=new THREE.BufferGeometry();leafGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.05,.005,.09,0,.01,.21,0,0,0,0,.01,.21,-.05,.005,.09],3));leafGeo.computeVertexNormals();
  const dryLeaf=new THREE.MeshStandardMaterial({color:'#af8748',side:THREE.DoubleSide,roughness:1});
  const dummy=new THREE.Object3D(),white=new THREE.Color('#ffffff');
  function add(geo,mat,x,z,scale=1,rotation=0,tint=white,y=-.065,kind='detail'){
    const cx=Math.floor(x/48),cz=Math.floor(z/48),cell=`${cx}:${cz}`,key=`${cell}:${geo.uuid}:${mat.uuid}`;
    if(!batches.has(key))batches.set(key,{geo,mat,cell,cx,cz,items:[],kind});
    dummy.position.set(x,y,z);dummy.rotation.set(0,rotation,0);
    if(typeof scale==='number')dummy.scale.setScalar(scale);else dummy.scale.set(...scale);
    dummy.updateMatrix();batches.get(key).items.push({matrix:dummy.matrix.clone(),color:new THREE.Color(tint)});
  }
  function plant(type,x,z,scale=1,palette=0){
    const rotation=random()*Math.PI*2;
    if(type==='grass'){add(grass,grassMat,x,z,scale,rotation,colour.grass[Math.floor(random()*3)]);stats.grassTufts++;}
    else if(type==='shrub'){add(shrub,shrubMat,x,z,scale,rotation,new THREE.Color('#ffffff').multiplyScalar(.85+random()*.25));stats.shrubs++;}
    else{
      const f=type==='salvia'?salvia:daisy;
      add(f.green,stemMat,x,z,scale,rotation);add(f.petals,petalMat,x,z,scale,rotation,type==='salvia'?'#796493':colour.flowers[palette%4]);
      if(f.centres)add(f.centres,centreMat,x,z,scale,rotation);stats.flowerClumps++;
    }
    planted.push({type,x,z});
  }
  function flowerBed(x,z,rx,rz,angle,palette){
    const co=Math.cos(angle),si=Math.sin(angle),point=(u,v)=>[x+co*u+si*v,z-si*u+co*v];
    if(beds.some(b=>Math.hypot(x-b.x,z-b.z)<Math.max(rx,rz)+Math.max(b.rx,b.rz)+1))return;
    // Validate the full footprint, not just its centre; no beds over junctions.
    if(!clear(x,z,.4))return;
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2,p=point(Math.cos(a)*rx,Math.sin(a)*rz);if(!clear(...p,.3))return;}
    if(trees.some(t=>!t.y&&((co*(t.x-x)-si*(t.z-z))/rx)**2+((si*(t.x-x)+co*(t.z-z))/rz)**2<1.25))return;
    beds.push({x,z,rx,rz,angle});stats.flowerBeds++;
    add(soil,materials.soil,x,z,[rx,1,rz],angle,white,-.06,'bed');add(edge,materials.stone,x,z,[rx,1,rz],angle,white,-.02,'bed');
    for(let u=-rx+.2;u<rx;u+=.46)for(let v=-rz+.2;v<rz;v+=.5){
      const uu=u+(random()-.5)*.15,vv=v+(random()-.5)*.15;if((uu/rx)**2+(vv/rz)**2>.83)continue;
      const p=point(uu,vv);plant(Math.abs(uu)<rx*.36?'salvia':'flower',...p,.8+random()*.35,palette);
      if(random()<.45)plant('grass',...p,.48+random()*.2);
    }
    for(const v of [-rz*.67,rz*.67]){const p=point(0,v);plant('shrub',...p,.7);}
  }
  // Entry flower ribbons, then smaller beds by campus walks and the lakes.
  flowerBed(-6.9,191,1.4,3.6,0,0);flowerBed(12.9,191,1.4,3.6,0,1);
  flowerBed(-7.7,179,1.4,3.4,.22,3);flowerBed(12.7,179,1.4,3.4,.22,0);
  for(const road of ROADS.filter(r=>!r.external))for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    for(let d=12;d<length-5;d+=31)for(const side of [-1,1]){
      const offset=road.width/2+3.5,x=a[0]+dx*d/length-dz/length*offset*side,z=a[1]+dz*d/length+dx/length*offset*side;
      flowerBed(x,z,1.1,2.8,Math.atan2(dx,dz),Math.floor(random()*4));
    }
  }
  for(const bank of banks)for(let i=0;i<bank.promenade.length-1;i+=4){
    const p=bank.promenade[i],dx=p[0]-bank.center.x,dz=p[1]-bank.center.z,n=Math.hypot(dx,dz);
    flowerBed(p[0]+dx/n*4,p[1]+dz/n*4,1.25,3.2,Math.atan2(dz,-dx),i%4);
  }
  const inBed=(x,z,padding=0)=>beds.some(b=>{const dx=x-b.x,dz=z-b.z,co=Math.cos(b.angle),si=Math.sin(b.angle);return ((co*dx-si*dz)/(b.rx+padding))**2+((si*dx+co*dz)/(b.rz+padding))**2<1;});
  // Soft, uneven ground cover along road verges; denser natural patches away
  // from the mown edge. Random seed keeps placement stable across reloads.
  function patch(x,z,r,count,flowers=false){
    for(let i=0;i<count;i++){
      const a=random()*Math.PI*2,d=Math.sqrt(random())*r,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d;
      if(!clear(px,pz,.35)||inBed(px,pz,.3)||trees.some(t=>!t.y&&Math.hypot(px-t.x,pz-t.z)<.65))continue;
      plant(flowers&&i%5===0?'flower':'grass',px,pz,flowers?.7+random()*.5:.45+random()*.7,0);
    }
  }
  for(const road of ROADS.filter(r=>!r.external))for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    for(let d=3;d<length;d+=5)for(const side of [-1,1]){
      const offset=road.width/2+3+random()*2,x=a[0]+dx*d/length-dz/length*offset*side,z=a[1]+dz*d/length+dx/length*offset*side;
      patch(x,z,1.25,14,random()<.13);
      if(clear(x,z,1.05)&&!inBed(x,z,1)&&random()<.2)plant('shrub',x,z,.85+random()*.5);
    }
  }
  for(const bank of banks)for(let i=0;i<bank.promenade.length-1;i++){
    const p=bank.promenade[i],dx=p[0]-bank.center.x,dz=p[1]-bank.center.z,n=Math.hypot(dx,dz);
    patch(p[0]+dx/n*3.6,p[1]+dz/n*3.6,2.4,32,i%3===0);
  }
  // Mulch and a light scattering of autumn leaves anchor each trunk to the soil.
  for(const t of trees.filter(t=>!t.y)){
    if(!clear(t.x,t.z,.7))continue;
    add(soil,materials.soil,t.x,t.z,[.62,1,.62],0,white,-.066,'bed');
    for(let i=0;i<11;i++){
      const a=random()*Math.PI*2,r=.4+random()*1.7,x=t.x+Math.cos(a)*r,z=t.z+Math.sin(a)*r;
      if(!clear(x,z,.12)||inBed(x,z,.15))continue;
      add(leafGeo,dryLeaf,x,z,.7+random()*.7,random()*6,new THREE.Color().setHSL(.09+random()*.06,.3,.65),-.045);stats.fallenLeaves++;
    }
    if(random()<.28)patch(t.x,t.z,2,10);
  }
  const allMeshes=[];
  for(const b of batches.values()){
    if(!chunks.has(b.cell)){const group=new THREE.Group();group.name=`planting-${b.cell}`;world.add(group);chunks.set(b.cell,{group,x:(b.cx+.5)*48,z:(b.cz+.5)*48});}
    const mesh=new THREE.InstancedMesh(b.geo,b.mat,b.items.length);mesh.name=b.kind==='bed'?'garden-ground':'garden-plants';
    b.items.forEach((item,i)=>{mesh.setMatrixAt(i,item.matrix);mesh.setColorAt(i,item.color);});mesh.computeBoundingSphere();mesh.receiveShadow=true;
    // Small plants receive existing shadows; avoiding an extra shadow pass for
    // thousands of stems also keeps their animated silhouettes consistent.
    mesh.castShadow=false;mesh.userData.fullCount=b.items.length;mesh.userData.kind=b.kind;
    chunks.get(b.cell).group.add(mesh);allMeshes.push(mesh);
  }
  let high=true;
  return {stats,beds,planted,chunks:[...chunks.values()],
    update(elapsed,camera){time.value=elapsed;if(camera)for(const c of chunks.values())c.group.visible=Math.hypot(camera.position.x-c.x,camera.position.z-c.z)<(high?135:105)+Math.max(0,camera.position.y-12)*2;},
    setQuality(value){high=value;fadeStart.value=value?65:42;fadeEnd.value=value?95:65;for(const mesh of allMeshes)mesh.count=mesh.userData.kind==='bed'?mesh.userData.fullCount:Math.max(1,Math.ceil(mesh.userData.fullCount*(value?1:.55)));},
  };
}
