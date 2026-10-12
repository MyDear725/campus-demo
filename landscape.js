import * as THREE from 'three';
import { Water } from './node_modules/three/examples/jsm/objects/Water.js';
import { mergeGeometries } from './node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { createNatureMaterials, waterNormals, seededRandom } from './nature-materials.js';
import { createForest } from './foliage.js';
import { CAMPUS_FEATURES, ROADS, QUEST_ROUTES, featureCenter, nearPolygon, segmentDistance } from './campus-layout.js';

export function stripGeometry(points,width,y=.1,offset=0){
  const vertices=[],uv=[],indices=[];let distance=0;
  for(let i=0;i<points.length;i++){
    const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const prev=new THREE.Vector2(p[0]-a[0],p[1]-a[1]).normalize(),next=new THREE.Vector2(b[0]-p[0],b[1]-p[1]).normalize();
    if(i===0)prev.copy(next);if(i===points.length-1)next.copy(prev);
    const normal=new THREE.Vector2(-prev.y-next.y,prev.x+next.x).normalize();
    const miter=Math.min(2,1/Math.max(.5,normal.dot(new THREE.Vector2(-next.y,next.x))));
    if(i)distance+=Math.hypot(p[0]-a[0],p[1]-a[1]);
    for(const side of [-1,1]){const d=(offset+side*width/2)*miter;vertices.push(p[0]+normal.x*d,y,p[1]+normal.y*d);uv.push(side*width/6,distance/6);}
    if(i){const j=(i-1)*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function polygonGeometry(points){const s=new THREE.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();return new THREE.ShapeGeometry(s);}
function worldUv(geo,scale=5){const p=geo.attributes.position,uv=[];for(let i=0;i<p.count;i++)uv.push(p.getX(i)/scale,p.getZ(i)/scale);geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geo;}

export function hillHeight(x,z,points){
  const c=featureCenter({points}),dx=x-c.x,dz=z-c.z,len=Math.hypot(dx,dz);if(len<.001)return 25;
  const ux=dx/len,uz=dz/len;let radius=Infinity;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],sx=b[0]-a[0],sz=b[1]-a[1],ax=a[0]-c.x,az=a[1]-c.z,den=ux*sz-uz*sx;
    if(Math.abs(den)<1e-8)continue;
    const t=(ax*sz-az*sx)/den,u=(ax*uz-az*ux)/den;if(t>0&&u>=0&&u<=1)radius=Math.min(radius,t);
  }
  const r=Math.min(1,len/radius);return 25*Math.pow(Math.max(0,Math.cos(r*Math.PI/2)),1.8)+Math.sin(x*.15)*Math.sin(z*.11)*1.2*Math.sin(r*Math.PI);
}

export function buildLandscape(scene,world,obstacles,occluders){
  const materials=createNatureMaterials(),random=seededRandom(381),groups=new Map();
  function collect(geo,material,cast=false){
    if(geo.index){const non=geo.toNonIndexed();geo.dispose();geo=non;}
    const key=material.uuid+cast;if(!groups.has(key))groups.set(key,{material,cast,geometries:[]});groups.get(key).geometries.push(geo);return geo;
  }
  function strip(points,width,material,y=.1,offset=0){return collect(stripGeometry(points,width,y,offset),material);}
  const cube=new THREE.BoxGeometry(1,1,1);
  function box(x,y,z,w,h,d,material,angle=0,cast=true){const geo=cube.clone();geo.scale(w,h,d);geo.rotateY(angle);geo.translate(x,y,z);collect(geo,material,cast);}
  const ground=new THREE.PlaneGeometry(2400,2200,1,1);ground.rotateX(-Math.PI/2);ground.translate(0,-.09,0);worldUv(ground,5);collect(ground,materials.grass);
  // Continuous mitered paths replace overlapping pale rectangles and round joints.
  for(const road of ROADS){
    const vehicle=road.width>=6,surface=vehicle?materials.asphalt:materials.paving;
    strip(road.points,road.width+1.8,materials.paving,.035);
    strip(road.points,road.width,surface,.075);
    for(const side of [-1,1])strip(road.points,.22,materials.stone,.17,side*(road.width/2+.16));
    if(vehicle){
      for(const side of [-1,1])strip(road.points,.085,materials.paint,.085,side*(road.width/2-.35));
      for(let i=1;i<road.points.length;i++){
        const a=road.points[i-1],b=road.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
        for(let d=2;d<length-3;d+=7){const t=d/length,u=(d+2.7)/length;strip([[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]],.12,materials.paint,.086);}
      }
    }
  }
  for(const z of [174,199])for(let x=-.2;x<6;x+=.95)box(x,.085,z,.46,.012,3,materials.paint,0,false);

  const waterGeos=[],banks=[];
  for(const f of CAMPUS_FEATURES){
    const c=featureCenter(f);
    if(f.kind==='water'){
      waterGeos.push(polygonGeometry(f.points));
      const path=[...f.points,f.points[0]],promenade=f.points.map(([x,z])=>[c.x+(x-c.x)*1.16,c.z+(z-c.z)*1.16]);promenade.push(promenade[0]);
      strip(path,1.4,materials.stone,.08);strip(promenade,2.7,materials.paving,.10);
      banks.push({feature:f,center:c,promenade});
      // Lake-side benches, separated from the pedestrian centre line.
      for(let i=1;i<promenade.length-1;i+=6){
        const p=promenade[i],q=promenade[i+1],angle=-Math.atan2(q[1]-p[1],q[0]-p[0]);
        const nx=(p[0]-c.x),nz=(p[1]-c.z),n=Math.hypot(nx,nz),x=p[0]+nx/n*2,z=p[1]+nz/n*2;
        for(let j=-1;j<=1;j++)box(x+Math.sin(angle)*j*.17,.52,z+Math.cos(angle)*j*.17,2.1,.09,.13,materials.wood,angle);
        for(const side of [-1,1])box(x+Math.cos(angle)*side*.8,.28,z-Math.sin(angle)*side*.8,.12,.5,.5,materials.steel,angle);
        const back= new THREE.Vector2(Math.sin(angle),Math.cos(angle));
        for(let j=0;j<2;j++)box(x+back.x*.34,.85+j*.16,z+back.y*.34,2.1,.12,.08,materials.wood,angle);
      }
    }
    if(f.kind==='hill'){
      const pts=[];f.points.forEach((a,i)=>{const b=f.points[(i+1)%f.points.length];for(let j=0;j<4;j++)pts.push([a[0]+(b[0]-a[0])*j/4,a[1]+(b[1]-a[1])*j/4]);});
      const positions=[c.x,25,c.z],idx=[],count=pts.length,rings=18;
      for(let r=1;r<=rings;r++)for(const p of pts){const x=c.x+(p[0]-c.x)*r/rings,z=c.z+(p[1]-c.z)*r/rings;positions.push(x,hillHeight(x,z,f.points),z);}
      for(let j=0;j<count;j++)idx.push(0,1+j,1+(j+1)%count);
      for(let r=1;r<rings;r++)for(let j=0;j<count;j++){const a=1+(r-1)*count+j,b=1+(r-1)*count+(j+1)%count,d=a+count,e=b+count;idx.push(a,d,b,b,d,e);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(idx);geo.computeVertexNormals();
      if(geo.attributes.normal.getY(0)<0){for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];geo.setIndex(idx);geo.computeVertexNormals();}worldUv(geo);
      const m=new THREE.Mesh(geo,materials.grass);m.material=materials.grass.clone();m.material.side=THREE.DoubleSide;m.castShadow=m.receiveShadow=true;world.add(m);occluders.push(m);
    }
  }
  const mergedWater=mergeGeometries(waterGeos);waterGeos.forEach(g=>g.dispose());
  const water=new Water(mergedWater,{textureWidth:512,textureHeight:512,waterNormals:waterNormals(),sunDirection:new THREE.Vector3(-150,350,180).normalize(),sunColor:'#fff3d9',waterColor:'#244e47',distortionScale:.45,fog:true});
  water.material.fragmentShader=water.material.fragmentShader.replace('float rf0 = 0.3;', 'float rf0 = 0.04;').replace('100.0, 2.0, 0.5', '180.0, 0.65, 0.5');
  water.name='campus-lakes';water.rotation.x=-Math.PI/2;water.position.y=.025;water.material.uniforms.size.value=7;world.add(water);
  // Two lakes share one reflection pass. Low quality uses animated environment
  // reflection instead, so it never retains a stale view-dependent mirror image.
  const simpleWater=new THREE.MeshStandardMaterial({color:'#345e58',roughness:.2,metalness:.55,normalMap:water.material.uniforms.normalSampler.value,normalScale:new THREE.Vector2(.22,.22)});
  simpleWater.normalMap=simpleWater.normalMap.clone();simpleWater.normalMap.repeat.set(1.8,1.8);
  const waterShader=water.material,reflect=water.onBeforeRender;let high=true;
  water.onBeforeRender=function(renderer,scene,camera){if(high)reflect.call(this,renderer,scene,camera);};

  // Forest placement respects buildings, lakes, road verges and playable routes.
  const trees=[],routes=Object.values(QUEST_ROUTES),hill=CAMPUS_FEATURES.find(f=>f.kind==='hill');
  // Reserve both direct travel and the diagonal-then-straight path produced by
  // keyboard steering, so decorative planting cannot trap a player en route.
  const walkPaths=routes.flatMap(route=>[route,route.flatMap((p,i)=>{
    if(!i)return [p];const a=route[i-1],dx=p[0]-a[0],dz=p[1]-a[1],d=Math.min(Math.abs(dx),Math.abs(dz));
    return [[a[0]+Math.sign(dx)*d,a[1]+Math.sign(dz)*d],p];
  })]);
  function tree(x,z,type,scale=1,y=0){
    if(trees.some(t=>Math.hypot(t.x-x,t.z-z)<(y?3.1:4.6)))return;
    if(!y&&(CAMPUS_FEATURES.some(f=>nearPolygon(x,z,f.points,2.7))||ROADS.some(r=>r.points.some((p,j)=>j&&segmentDistance(x,z,r.points[j-1],p)<r.width/2+1.65))||walkPaths.some(route=>route.some((p,j)=>j&&segmentDistance(x,z,route[j-1],p)<1.4))))return;
    trees.push({x,y,z,type,scale,rotation:random()*Math.PI*2});
    if(!y)obstacles.push({minX:x-.22,maxX:x+.22,minZ:z-.22,maxZ:z+.22,name:'tree trunk'});
  }
  for(const r of ROADS.filter(r=>r.width>=5))for(let i=1;i<r.points.length;i++){
    const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    for(let d=4;d<length;d+=11)for(const side of [-1,1])tree(a[0]+dx*d/length-dz/length*(r.width/2+3.4)*side,a[1]+dz*d/length+dx/length*(r.width/2+3.4)*side,r.name==='南门入口'?1:random()<.2?2:0,.75+random()*.28);
  }
  for(let i=0;i<1100&&trees.length<430;i++){
    const x=-245+random()*540,z=-159+random()*366;if(x<-65&&z>105)continue;
    tree(x,z,random()<.16?1:random()<.35?3:0,.7+random()*.48);
  }
  const hc=featureCenter(hill);
  for(let i=0;i<420;i++){
    const a=hill.points[i%hill.points.length],t=.15+random()*.75,x=hc.x+(a[0]-hc.x)*t,z=hc.z+(a[1]-hc.z)*t;
    tree(x,z,random()<.6?3:0,.85+random()*.3,hillHeight(x,z,hill.points));
  }
  const forest=createForest(world,trees,materials);

  // Small bank rocks and upright reed clusters add scale to the shoreline.
  const rockBase=new THREE.IcosahedronGeometry(1,1),rockMatrices=[],reeds=[];
  for(const bank of banks)for(let i=0;i<bank.feature.points.length;i++){
    const p=bank.feature.points[i],c=bank.center;
    if(i%3===0)for(let n=0;n<3;n++){
      const x=p[0]+(p[0]-c.x)*.013+(random()-.5)*2,z=p[1]+(p[1]-c.z)*.013+(random()-.5)*2;
      const dummy=new THREE.Object3D();dummy.position.set(x,.16,z);dummy.scale.set(.3+random()*.55,.16+random()*.26,.25+random()*.45);dummy.rotation.y=random()*6;dummy.updateMatrix();rockMatrices.push(dummy.matrix.clone());
    }
    if(i%4===0)for(let n=0;n<9;n++)reeds.push({x:p[0]+(p[0]-c.x)*.027+(random()-.5)*3,z:p[1]+(p[1]-c.z)*.027+(random()-.5)*3,h:.45+random()*.55});
  }
  const rocks=new THREE.InstancedMesh(rockBase,materials.rock,rockMatrices.length);rockMatrices.forEach((m,i)=>rocks.setMatrixAt(i,m));rocks.castShadow=rocks.receiveShadow=true;rocks.computeBoundingSphere();world.add(rocks);
  const blades=[];for(const r of reeds)for(let j=0;j<5;j++){
    const a=j*2.4,dx=Math.cos(a)*.09,dz=Math.sin(a)*.09,h=r.h*(.7+random()*.5);
    blades.push(r.x-dx,.08,r.z-dz,r.x+dx,.08,r.z+dz,r.x+Math.cos(a)*.2,h,r.z+Math.sin(a)*.2);
  }
  const reedGeo=new THREE.BufferGeometry();reedGeo.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));reedGeo.computeVertexNormals();const reedMat=new THREE.MeshStandardMaterial({color:'#7b8053',roughness:1,side:THREE.DoubleSide});world.add(new THREE.Mesh(reedGeo,reedMat));

  // A soft, irregular distant ridge replaces the empty horizon; illustrative
  // terrain only, outside the mapped/playable campus boundary.
  for(let layer=0;layer<2;layer++){
    const geo=new THREE.PlaneGeometry(1900,470,120,20);geo.rotateX(-Math.PI/2);geo.translate(-120,0,-780-layer*370);
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i),edge=Math.max(0,1-Math.abs(z+780+layer*370)/235);
      const ridge=46+Math.sin(x*.008+layer)*22+Math.sin(x*.017)*14+Math.sin(x*.047)*6;
      pos.setY(i,Math.pow(edge,.65)*ridge*(1+layer*.25)-.2);
    }
    geo.computeVertexNormals();worldUv(geo,14);
    const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:layer?'#87968e':'#657b66',map:materials.grass.map,roughness:1}));m.receiveShadow=true;world.add(m);
  }
  for(const group of groups.values()){
    const geo=mergeGeometries(group.geometries);group.geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geo,group.material);mesh.castShadow=group.cast;mesh.receiveShadow=true;world.add(mesh);
  }
  return {water,forest,materials,get quality(){return high?'high':'low';},stats:{trees:trees.length,lakes:banks.length,roadSurfaces:ROADS.length},
    update(time){forest.update(time);waterShader.uniforms.time.value=time*.35;simpleWater.normalMap.offset.set(time*.003,time*.0015);},
    setQuality(value){high=value;forest.setQuality(value);water.material=value?waterShader:simpleWater;},
  };
}
