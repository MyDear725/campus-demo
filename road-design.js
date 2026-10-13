import * as THREE from 'three';
import { ROADS, ROAD_STYLES, segmentDistance } from './campus-layout.js';
import { FENCE_PANELS, ROAD_CROSSINGS, offsetPath } from './campus-boundary.js';
import { surfaceTexture } from './nature-materials.js';

export function buildRoadDesign({strip,box,materials,obstacles}){
  const external=materials.asphalt.clone();external.color.set('#aeb8c0');external.roughness=.97;
  const main=new THREE.MeshStandardMaterial({map:surfaceTexture('campusRoad'),roughness:.93,bumpScale:.02});main.bumpMap=main.map;
  const secondary=materials.paving.clone();secondary.color.set('#dfbd98');
  const trim=materials.stone.clone();trim.color.set('#aa9278');
  const yellow=new THREE.MeshStandardMaterial({color:'#d9b04f',roughness:.9});
  const metal=new THREE.MeshStandardMaterial({color:'#354d4e',roughness:.58,metalness:.55});
  const cap=materials.stone.clone();cap.color.set('#b9b4a2');
  const styles={external,main,secondary};
  const campusCrossings=[{x:1.1,z:174,width:9,length:3,heading:Math.atan2(-3,-11)},{x:3,z:199,width:9,length:3,heading:0}];
  const atOtherRoad=(road,x,z)=>ROADS.some(other=>other!==road&&other.points.some((p,i)=>i&&segmentDistance(x,z,other.points[i-1],p)<other.width/2+.5));
  const atCrossing=(x,z)=>[...ROAD_CROSSINGS,...campusCrossings].some(c=>{
    const dx=x-c.x,dz=z-c.z;return Math.abs(dx*Math.sin(c.heading)+dz*Math.cos(c.heading))<c.length/2+.8&&Math.abs(dx*Math.cos(c.heading)-dz*Math.sin(c.heading))<c.width/2+1;
  });
  function pieces(road,offset,callback){
    const pts=offsetPath(road.points,offset);let travelled=0;
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(length/1.1);
      for(let j=0;j<n;j++){
        const p=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],q=[a[0]+(b[0]-a[0])*(j+1)/n,a[1]+(b[1]-a[1])*(j+1)/n];
        callback(p,q,(p[0]+q[0])/2,(p[1]+q[1])/2,travelled+(j+.5)*length/n);
      }
      travelled+=length;
    }
  }
  // Layer order makes a paved path meet the carriageway cleanly at a junction.
  for(const kind of ['secondary','main','external'])for(const road of ROADS.filter(r=>r.kind===kind)){
    const y={secondary:.066,main:.084,external:.105}[kind],sidewalk=ROAD_STYLES[kind].sidewalk;
    strip(road.points,road.width+sidewalk*2,materials.paving,.025);
    strip(road.points,road.width,styles[kind],y);
    for(const side of [-1,1]){
      pieces(road,side*(road.width/2+.12),(a,b,x,z)=>{
        if(atOtherRoad(road,x,z)||atCrossing(x,z))return;
        strip([a,b],kind==='secondary'?.19:.23,kind==='secondary'?trim:cap,y+.07);
      });
      if(kind!=='secondary')pieces(road,side*(road.width/2-.34),(a,b,x,z)=>{
        if(!atOtherRoad(road,x,z)&&!atCrossing(x,z))strip([a,b],.075,materials.paint,y+.008);
      });
    }
    if(kind==='external')for(const offset of [-.16,.16])pieces(road,offset,(a,b,x,z)=>{
      if(!atOtherRoad(road,x,z)&&!atCrossing(x,z))strip([a,b],.105,yellow,y+.009);
    });
    if(kind==='main')pieces(road,0,(a,b,x,z,d)=>{
      if(d%9<2.3&&!atOtherRoad(road,x,z)&&!atCrossing(x,z))strip([a,b],.09,materials.paint,y+.009);
    });
    if(kind==='secondary'){
      // Narrow transverse stone bands and warm brick edging identify footpaths.
      pieces(road,0,(a,b,x,z,d)=>{
        if(d%12>1.1||atOtherRoad(road,x,z))return;
        const dx=b[0]-a[0],dz=b[1]-a[1],n=Math.hypot(dx,dz);
        strip([[x-dz/n*(road.width/2-.2),z+dx/n*(road.width/2-.2)],[x+dz/n*(road.width/2-.2),z-dx/n*(road.width/2-.2)]],.13,materials.stone,y+.008);
      });
    }
  }
  function crossing(x,z,width,length,heading,y){
    const ux=Math.sin(heading),uz=Math.cos(heading),nx=uz,nz=-ux;
    for(let d=-width/2+.45;d<width/2-.2;d+=.85){const px=x+nx*d,pz=z+nz*d;strip([[px-ux*length/2,pz-uz*length/2],[px+ux*length/2,pz+uz*length/2]],.42,materials.paint,y);}
  }
  for(const c of ROAD_CROSSINGS)crossing(c.x,c.z,c.width,c.length,c.heading,.117);
  for(const c of campusCrossings)crossing(c.x,c.z,c.width,c.length,c.heading,.096);

  // Stone plinth, capped pillars, horizontal rails and closely spaced pickets.
  // Collision uses the exact panel segment, never an oversized rotated AABB.
  let fenceLength=0;
  for(const panel of FENCE_PANELS){
    const {a,b}=panel,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx),x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
    fenceLength+=length;
    box(x,.19,z,length,.38,.3,materials.stone,angle);box(x,.41,z,length,.07,.38,cap,angle);
    for(const p of [a,b]){box(p[0],.99,p[1],.25,1.98,.25,cap);box(p[0],2.01,p[1],.34,.1,.34,cap);}
    for(const y of [.62,1.75])box(x,y,z,length,.075,.08,metal,angle);
    const count=Math.ceil(length/.23);
    for(let i=1;i<count;i++)box(a[0]+dx*i/count,1.17,a[1]+dz*i/count,.038,1.37,.038,metal);
    obstacles.push({kind:"fence",name:panel.name,segment:[a,b],thickness:.38,minX:Math.min(a[0],b[0])-.19,maxX:Math.max(a[0],b[0])+.19,minZ:Math.min(a[1],b[1])-.19,maxZ:Math.max(a[1],b[1])+.19});
  }
  return {roadClasses:Object.fromEntries(Object.keys(ROAD_STYLES).map(k=>[k,ROADS.filter(r=>r.kind===k).length])),fencePanels:FENCE_PANELS.length,fenceLength:Math.round(fenceLength)};
}
