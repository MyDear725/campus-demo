import * as THREE from 'three';
import { pointInPolygon, segmentDistance } from './campus-layout.js';
import { TEACHING_ENTRIES } from './teaching-layout.js';

// Footprints are official map data; facade proportions are modeled from the
// campus photographs listed in art/map-reference/exteriors/sources.json.
// Unseen elevations and dorm details are original architectural interpretation.
export const BUILDING_DESIGNS = {
  77914:{type:'information',height:12,floors:4,wall:'stone',accent:'slate',spacing:3.4,roof:'pergola'},
  77917:{type:'library',height:17,floors:5,wall:'stone',accent:'silver',spacing:2.4,roof:'oval'},
  77921:{type:'administration',height:12,floors:4,wall:'slate',accent:'stone',spacing:3.1,roof:'plant'},
  77923:{type:'sports',height:10,floors:2,wall:'brick',accent:'silver',spacing:2.6,roof:'wave'},
  77925:{type:'teaching-a',height:13,floors:4,wall:'stone',accent:'slate',spacing:3,roof:'tower'},
  77927:{type:'teaching-c',height:12,floors:4,wall:'slate',accent:'stone',spacing:2.9,roof:'fins'},
  77928:{type:'teaching-b',height:8.7,floors:3,wall:'concrete',accent:'stone',spacing:4,roof:'lecture'},
  77931:{type:'residence',height:14,floors:5,wall:'warm',accent:'brick',spacing:2.75,roof:'plant',variant:0},
  77933:{type:'residence',height:14,floors:5,wall:'stone',accent:'brick',spacing:2.8,roof:'plant',variant:1},
  77935:{type:'residence',height:14,floors:5,wall:'concrete',accent:'slate',spacing:2.85,roof:'plant',variant:2},
  77937:{type:'residence',height:14,floors:5,wall:'sage',accent:'stone',spacing:2.7,roof:'plant',variant:3},
  77938:{type:'residence',height:14,floors:5,wall:'warm',accent:'concrete',spacing:3,roof:'plant',variant:4},
  77941:{type:'residence',height:14,floors:5,wall:'stone',accent:'slate',spacing:3.1,roof:'plant',variant:5},
  77943:{type:'dining',height:10,floors:3,wall:'warm',accent:'terracotta',spacing:3.6,roof:'vents'},
  96575:{type:'laboratory',height:7,floors:2,wall:'concrete',accent:'slate',spacing:3.4,roof:'vents'},
  2304982:{type:'community',height:14,floors:5,wall:'stone',accent:'terracotta',spacing:3.3,roof:'plant'},
};

const COLORS={stone:'#c8c8bc',concrete:'#989e9b',slate:'#697779',warm:'#d6ccba',sage:'#b7c0b7',brick:'#a56e59',terracotta:'#af7963',silver:'#c9d0ce',roof:'#7e8988',dark:'#253a40',metal:'#778b90',sill:'#d4d2c5'};
function masonryTexture(brick=false){
  const size=256,data=new Uint8Array(size*size*4);let seed=81;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    seed=(seed*1664525+1013904223)>>>0;
    const row=Math.floor(y/(brick?16:64)),xx=(x+(brick&&row%2?32:0))% (brick?64:128);
    const mortar=y%(brick?16:64)<(brick?2:1)||xx<(brick?2:1);
    const shade=mortar?(brick?140:180):224+(seed%22);
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=shade;data[i+3]=255;
  }
  const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=THREE.SRGBColorSpace;t.repeat.set(.32,.32);t.needsUpdate=true;return t;
}

function shape(points){const s=new THREE.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();return s;}
function clipped(points,z,below){
  const out=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],ai=below?a[1]<=z:a[1]>=z,bi=below?b[1]<=z:b[1]>=z;
    if(ai)out.push(a);
    if(ai!==bi){const t=(z-a[1])/(b[1]-a[1]);out.push([a[0]+(b[0]-a[0])*t,z]);}
  }
  return out;
}

export function buildArchitecture(world,features,{cube,occluders}){
  const tile=masonryTexture(),brick=masonryTexture(true),materials=new Map(),buildings=[];
  const glassColors=['#496772','#68858b','#405a67','#789599'];
  function mat(key){
    if(!materials.has(key)){
      const isGlass=key.startsWith('glass'),isBrick=['brick','terracotta'].includes(key),isMetal=['metal','silver'].includes(key);
      const color=isGlass?glassColors[Number(key.slice(-1))||0]:COLORS[key]||key;
      const m=new THREE.MeshStandardMaterial({color,roughness:isGlass?.23:isMetal?.36:.84,metalness:isGlass?.48:isMetal?.6:.04});
      if(!isGlass&&!['dark','metal','silver','roof'].includes(key)){m.map=isBrick?brick:tile;m.bumpMap=m.map;m.bumpScale=isBrick?.035:.014;}
      if(isGlass)m.envMapIntensity=.85;
      materials.set(key,m);
    }
    return materials.get(key);
  }
  function add(geo,key,x=0,y=0,z=0,cast=true){const m=new THREE.Mesh(geo,mat(key));m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;world.add(m);return m;}
  function box(x,y,z,w,h,d,key,angle=0,cast=true){const m=add(cube,key,x,y,z,cast);m.scale.set(w,h,d);m.rotation.y=angle;return m;}
  function cap(points,y,key){const m=add(new THREE.ShapeGeometry(shape(points)),key,0,y);m.rotation.x=-Math.PI/2;return m;}
  function volume(points,height,key){const m=add(new THREE.ExtrudeGeometry(shape(points),{depth:height,bevelEnabled:false}),key);m.rotation.x=-Math.PI/2;occluders.push(m);return m;}
  function beam(a,b,width,key){const mid=new THREE.Vector3().addVectors(a,b).multiplyScalar(.5),m=box(mid.x,mid.y,mid.z,width,a.distanceTo(b),width,key);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return m;}

  for(const f of features.filter(f=>f.kind==='building')){
    const p=BUILDING_DESIGNS[f.id];if(!p)throw new Error('Missing facade design: '+f.name);
    const xs=f.points.map(q=>q[0]),zs=f.points.map(q=>q[1]);
    const bounds={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
    const cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2;
    const h=p.height,storey=h/p.floors,library=p.type==='library',gym=p.type==='sports',dorm=p.type==='residence';
    const base=volume(library?clipped(f.points,107,false):f.points,library?10:h,p.wall);base.userData.buildingId=f.id;
    if(library){volume(clipped(f.points,107,true),h,p.wall);cap(clipped(f.points,107,true),h+.05,'roof');cap(clipped(f.points,107,false),10.05,'roof');}
    else cap(f.points,h+.04,'roof');
    let windowCount=0;
    const perimeter=f.points.map((a,i)=>[a,f.points[(i+1)%f.points.length]]);
    if(library){const body=clipped(f.points,107,true);for(let i=0;i<body.length;i++){const a=body[i],b=body[(i+1)%body.length];if(a[1]===107&&b[1]===107)perimeter.push([a,b]);}}
    const edges=perimeter.map(([a,b],i)=>{
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      const ux=dx/length,uz=dz/length;let nx=-uz,nz=ux;
      if(pointInPolygon((a[0]+b[0])/2+nx*.08,(a[1]+b[1])/2+nz*.08,f.points)){nx=-nx;nz=-nz;}
      return {a,b,dx,dz,length,ux,uz,nx,nz,angle:-Math.atan2(dz,dx),i};
    }).filter(e=>e.length>.3);
    // A substantial outward-facing south/west edge for the main entrance.
    const teachingEntry=TEACHING_ENTRIES[f.id];
    const entry=teachingEntry
      ?edges.filter(e=>e.length>6).sort((a,b)=>segmentDistance(...teachingEntry.anchor,a.a,a.b)-segmentDistance(...teachingEntry.anchor,b.a,b.b))[0]
      :edges.filter(e=>e.length>8).sort((a,b)=>(b.nz*.75-b.nx*.25)*15+b.length*.15-((a.nz*.75-a.nx*.25)*15+a.length*.15))[0];
    for(const e of edges){
      const {a,dx,dz,length,angle,nx,nz,i}=e;
      const midZ=(a[1]+e.b[1])/2,eh=library&&midZ>107?10:h;
      function part(t,y,w,hh,depth,key,out=0,cast=true){return box(a[0]+dx*t+nx*out,y,a[1]+dz*t+nz*out,w,hh,depth,key,angle,cast);}
      const floors=library&&midZ>107?3:p.floors,fh=eh/floors;
      const curtain=(library&&midZ<=107)||(gym&&length>12)||(p.type==='information'&&length<30&&length>12);
      part(.5,.48,length,.9,.2,dorm?p.accent:'concrete',.08);
      part(.5,eh+.28,length+.16,.5,.48,'sill',.05);
      // Weather-resistant copings, recessed shadow line and vertical panel joints.
      part(.5,eh-.15,length,.12,.25,'dark',.11,false);
      if(length>5)for(let d=.4;d<length;d+=dorm?8:6)part(d/length,eh/2,.12,eh,.12,p.accent,.13);
      const bays=Math.max(1,Math.floor(length/p.spacing)),bay=length/bays;
      if(length<1.8)continue;
      if(curtain){
        part(.5,eh/2+.2,length-.25,eh-1,.15,'glass0',.12,false);
        for(let k=0;k<=bays;k++)part(k/bays,eh/2,.095,eh-.5,.22,'silver',.24,false);
        for(let floor=1;floor<floors;floor++){
          part(.5,floor*fh,length,.24,.6,'silver',.29);
          part(.5,floor*fh+fh*.55,length,.065,.18,'metal',.25,false);
        }
        for(let k=0;k<bays;k++)for(let floor=0;floor<floors;floor++){
          part((k+.5)/bays,floor*fh+fh*.52,bay-.16,fh-.36,.025,'glass'+((k+floor+i)%4),.22,false);
          if((k+floor)%3===0)part((k+.5)/bays,floor*fh+fh*.75,bay-.23,.11,.035,'silver',.255,false);
          windowCount++;
        }
        if(library){
          part(.5,eh+.8,length+.55,.18,1.8,'silver',.42);
          for(let k=0;k<=bays;k+=2)part(k/bays,eh+.45,.14,.85,1.7,'silver',.4);
        }
        if(gym){
          // The reference hall has a brick lower storey beneath its tall glazing.
          part(.5,1.75,length,3.5,.16,'brick',.34);
          part(.5,3.6,length,.25,.6,'stone',.4);
          for(let k=0;k<bays;k++){
            const t=(k+.5)/bays;if(e===entry&&Math.abs(t-.5)*length<3.5)continue;
            const w=Math.min(1.7,bay*.7);
            part(t,1.85,w+.18,2.25,.15,'stone',.47);
            part(t,1.85,w,2.05,.08,'glass1',.59,false);
            part(t,1.85,.07,2.05,.07,'silver',.65,false);
            part(t,2.25,w,.07,.07,'silver',.65,false);
            part(t,.65,w+.35,.14,.4,'sill',.5);
          }
        }
      }else{
        for(let floor=0;floor<floors;floor++){
          const y=floor*fh+fh*.58;
          if(floor)part(.5,floor*fh,length,.17,.34,p.accent,.1);
          for(let k=0;k<bays;k++){
            const t=(k+.5)/bays,entrance=e===entry&&Math.abs(t-.5)*length<3.1&&floor===0;
            if(entrance)continue;
            const w=Math.min(bay*.64,dorm?1.65:2.5),wh=fh*(dorm?.57:.61);
            part(t,y,w+.22,wh+.22,.13,'dark',.13,false);
            part(t,y,w,wh,.13,'silver',.205,false);
            part(t,y,w-.12,wh-.12,.025,'glass'+((k*3+floor+i+(p.variant||0))%4),.282,false);
            part(t,y,.065,wh,.075,'silver',.325,false);
            part(t,y+wh*.22,w,.055,.075,'silver',.325,false);
            part(t,y-wh/2-.14,w+.36,.13,.48,'sill',.24);
            if(dorm&&floor>0&&(p.variant||0)%2===1&&k%3===1){
              const by=floor*fh+.25,bw=w+.5;
              part(t,by,bw,.16,1.05,'sill',.48);
              part(t,by+.85,bw,.06,.06,'metal',.99,false);
              part(t,by+.38,bw,.055,.055,'metal',.99,false);
              for(const side of [-1,0,1])part(t+side*bw*.46/length,by+.43,.055,.85,.055,'silver',.99,false);
            }
            if(dorm&&(k+floor)%4===0){
              // Shallow curtains behind the outer frame and small outdoor units.
              part(t-w*.17/length,y,w*.25,wh-.15,.03,'warm',.305,false);
              part(t,y-wh/2-.48,.65,.4,.4,'silver',.3,false);
              part(t,y-wh/2-.48,.48,.24,.025,'dark',.515,false);
            }
            windowCount++;
          }
        }
        if(p.type==='teaching-b'&&e!==entry)for(let k=0;k<bays;k++)part((k+.5)/bays,eh*.5,.25,eh,1.25,'stone',.5);
        if(dorm)for(const t of [.03,.97])part(t,eh/2,.1,eh,.1,'metal',.23,false);
      }
      // A recessed, glazed double-door lobby with handles and supported canopy.
      if(e===entry){
        const ew=Math.min(6.4,length*.6);
        const doorOffset=gym?.57:.16;
        part(.5,1.55,ew,3.1,.15,'dark',doorOffset,false);
        for(const side of [-1,1]){
          part(.5+side*ew*.23/length,1.5,ew*.44,2.85,.08,'glass1',doorOffset+.12,false);
          part(.5+side*.19/length,1.35,.045,.55,.14,'silver',doorOffset+.24,false);
          part(.5+side*ew*.49/length,1.7,.2,3.4,.38,p.accent,.25);
        }
        part(.5,1.55,.1,3.1,.2,'silver',doorOffset+.19);
        part(.5,3.4,ew+1.6,.24,2.5,p.accent,1);
        part(.5,3.57,ew+1.8,.09,2.6,'silver',1,false);
        // Shallow pavement threshold only: preserve the demo's level walking routes.
        part(.5,.12,ew+2,.18,2.8,'sill',1.1,false);
        if(teachingEntry){
          const accent=teachingEntry.accent;
          // Portal piers hug the facade; the central approach remains level.
          for(const side of [-1,1]){
            part(.5+side*(ew/2+.35)/length,2.1,.48,4.2,.6,accent,.45);
            part(.5+side*(ew/2+.38)/length,2.25,.085,1.4,.06,'#fff0c7',.78,false);
          }
          part(.5,4.25,ew+1.3,.38,.7,accent,.48);
          part(.5,3.56,ew+2,.12,3.8,accent,1.65);
          part(.5,3.44,ew+1.5,.05,3.4,'dark',1.65,false);
          if(teachingEntry.letter==='B')for(let d=-ew/2;d<=ew/2;d+=.38)part(.5+d/length,3.67,.12,.18,3.8,accent,1.65);
          if(teachingEntry.letter==='C')for(const side of [-1,1])part(.5+side*(ew/2+.25)/length,4,.12,.12,3.7,'silver',1.6);
          // Small physical A/B/C plaques on the entry, no floating rooftop labels.
          const plaqueT=.5+(ew/2+.9)/length;
          part(plaqueT,2.6,1.1,1.35,.12,'dark',.3,false);
          const letters={A:[[-.3,-.4,0,.4],[0,.4,.3,-.4],[-.18,-.04,.18,-.04]],B:[[-.28,-.4,-.28,.4],[-.28,.4,.2,.4],[.2,.4,.3,.23],[.3,.23,.2,0],[-.28,0,.2,0],[.2,0,.3,-.2],[.3,-.2,.2,-.4],[-.28,-.4,.2,-.4]],C:[[.27,.36,-.2,.4],[-.2,.4,-.3,.22],[-.3,.22,-.3,-.22],[-.3,-.22,-.2,-.4],[-.2,-.4,.27,-.36]]};
          for(const [ax,ay,bx,by] of letters[teachingEntry.letter]){
            const at=(x,y)=>new THREE.Vector3(a[0]+dx*plaqueT+nz*x+nx*.39,2.6+y,a[1]+dz*plaqueT-nx*x+nz*.39);
            beam(at(ax,ay),at(bx,by),.065,'#f3e8cd');
          }
        }
      }
    }
    // Rooftop details sit within the original footprint, never in courtyards.
    if(!['oval','wave'].includes(p.roof)){
      let placed=0;
      for(let x=bounds.minX+5;x<bounds.maxX-4;x+=9)for(let z=bounds.minZ+5;z<bounds.maxZ-4;z+=9){
        if(placed>=5||!pointInPolygon(x,z,f.points)||edges.some(e=>segmentDistance(x,z,e.a,e.b)<3))continue;
        box(x,h+.42,z,2.5,.7,1.7,'silver');box(x,h+.82,z,2,.1,1.4,'dark',0,false);
        for(let n=-.6;n<=.6;n+=.3)box(x+n,h+.9,z,.08,.08,1.3,'metal',0,false);
        if(p.roof==='vents')box(x+1,h+1.4,z,.45,1.8,.45,'metal');placed++;
      }
    }
    if(p.roof==='pergola'){
      // Information building: white, open rooftop frame visible from the south gate.
      const z=140;
      for(let x=-5;x<62;x+=5){
        if(!pointInPolygon(x,z,f.points))continue;
        for(const zz of [z-4,z+4])box(x,h+1,zz,.28,2,.28,'stone');
        box(x,h+2,z,.32,.26,9.6,'stone');
      }
      for(const zz of [z-4,z+4])box(28,h+2,zz,65,.26,.35,'stone');
    }
    if(p.roof==='tower'){
      const x=60,z=-119;box(x,h+1.6,z,3.3,3.2,4.1,'slate');box(x,h+1.6,z+2.1,2.6,3.1,.12,'glass1');
      for(let y=h;y<h+3;y+=1)box(x,y,z+2.2,2.8,.08,.12,'silver',0,false);
      box(x,h+3.4,z,4,.22,4.8,'stone');box(x,h+4.2,z,.1,1.4,.1,'silver');
    }
    if(p.roof==='lecture'||p.roof==='fins'){
      for(const e of edges.filter(e=>e.length>8)){
        const x=(e.a[0]+e.b[0])/2,z=(e.a[1]+e.b[1])/2;
        box(x,h+.5,z,e.length+.5,.22,1.8,'sill',e.angle);
      }
    }
    if(library){
      // Elliptical skylight and a light metal crown, based on the official aerial.
      const x=67,z=81;
      const dome=add(new THREE.SphereGeometry(1,40,16,0,Math.PI*2,0,Math.PI/2),'glass1',x,h+.15,z);dome.scale.set(7.2,2,12);
      const ring=add(new THREE.TorusGeometry(1,.035,6,64),'silver',x,h+.2,z);ring.rotation.x=Math.PI/2;ring.scale.set(8,13,1);
      for(let i=0;i<10;i++){const a=i*Math.PI/10;for(let j=0;j<16;j++){const t=j*Math.PI/16,u=(j+1)*Math.PI/16;beam(new THREE.Vector3(x+Math.cos(a)*7.23*Math.cos(t),h+.2+2.02*Math.sin(t),z+Math.sin(a)*12.03*Math.cos(t)),new THREE.Vector3(x+Math.cos(a)*7.23*Math.cos(u),h+.2+2.02*Math.sin(u),z+Math.sin(a)*12.03*Math.cos(u)),.07,'silver');}}
    }
    if(gym){
      // Swept, upturned metal roof from the sports-hall reference photograph.
      const x0=bounds.minX-1,x1=bounds.maxX-7,z0=bounds.minZ+1,z1=bounds.maxZ+1;
      const roofY=t=>h+.65+3.2*(Math.pow(t-.36,2)*2.3)+.55*Math.sin(t*Math.PI*2);
      const positions=[],uv=[];
      for(let j=0;j<48;j++){
        const t=j/48,u=(j+1)/48,a=x0+(x1-x0)*t,b=x0+(x1-x0)*u,ya=roofY(t),yb=roofY(u);
        positions.push(a,ya,z0,a,ya,z1,b,yb,z1,a,ya,z0,b,yb,z1,b,yb,z0);uv.push(t,0,t,1,u,1,t,0,u,1,u,0);
        for(const z of [z0,z1])beam(new THREE.Vector3(a,ya,z),new THREE.Vector3(b,yb,z),.38,'silver');
        if(j%3===0)box(a,ya+.09,(z0+z1)/2,.075,.12,z1-z0,'silver');
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
      const roof=add(geo,'silver');roof.material=mat('silver').clone();roof.material.side=THREE.DoubleSide;occluders.push(roof);
      for(let x=x0+2;x<x1;x+=4){const y=roofY((x-x0)/(x1-x0));box(x,(h+y)/2,z1-.25,.14,y-h,.14,'silver');}
    }
    buildings.push({id:f.id,name:f.name,type:p.type,height:h,bounds,windows:windowCount,roof:p.roof,entrance:entry?{nx:entry.nx,nz:entry.nz,x:(entry.a[0]+entry.b[0])/2,z:(entry.a[1]+entry.b[1])/2}:null});
  }
  return buildings;
}

// Original procedural environment: reflected sky and tree silhouettes, no remote
// textures or reference photos are shipped as material assets.
export function setCampusEnvironment(scene,renderer){
  const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');
  const sky=ctx.createLinearGradient(0,0,0,512);sky.addColorStop(0,'#769ebd');sky.addColorStop(.43,'#c2d8e1');sky.addColorStop(.5,'#dddccc');sky.addColorStop(.56,'#7b886b');sky.addColorStop(1,'#555e4d');ctx.fillStyle=sky;ctx.fillRect(0,0,1024,512);
  for(let i=0;i<30;i++){const x=(i*173)%1024,y=90+(i*31)%135;ctx.fillStyle='#f4f5ed55';ctx.beginPath();ctx.ellipse(x,y,40+i%4*14,7+i%3*4,0,0,Math.PI*2);ctx.fill();}
  for(let i=0;i<120;i++){const x=i*9;ctx.fillStyle=i%2?'#526b59':'#627b64';ctx.beginPath();ctx.moveTo(x-7,278);ctx.lineTo(x,246-(i*7%21));ctx.lineTo(x+8,278);ctx.fill();}
  const tex=new THREE.CanvasTexture(c);tex.mapping=THREE.EquirectangularReflectionMapping;tex.colorSpace=THREE.SRGBColorSpace;
  const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromEquirectangular(tex);scene.environment=env.texture;tex.dispose();pmrem.dispose();
  return env;
}
