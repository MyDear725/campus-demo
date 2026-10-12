import { CAMPUS_FEATURES } from './campus-data.js';
export { CAMPUS_FEATURES };
export const MAP_BOUNDS={minX:-290,maxX:310,minZ:-180,maxZ:235};
export const CAMPUS_START={x:3,z:194};
export const GUIDE={x:20,z:109};
export const BOARD={x:-8,z:191};
export const MEMORY_SPOTS=[
  {id:'knowledge',area:'图书馆 · 书韵广场',x:38,z:104},
  {id:'encounter',area:'涌泉湖畔',x:-33,z:64},
  {id:'passion',area:'西北田径场',x:-132,z:-51},
];
export const DORMITORIES=[
  {id:'dorm-1',buildingId:77931,name:'学生宿舍1舍',shortName:'1舍',x:272,z:-110,area:'学生生活区 · 北苑'},
  {id:'dorm-2',buildingId:77933,name:'学生宿舍2舍',shortName:'2舍',x:242,z:-110,area:'学生生活区 · 北苑'},
  {id:'dorm-3',buildingId:77935,name:'学生宿舍3舍',shortName:'3舍',x:233,z:-99,area:'学生生活区 · 中苑'},
  {id:'dorm-4',buildingId:77937,name:'学生宿舍4舍',shortName:'4舍',x:218,z:-63,area:'学生生活区 · 南苑'},
  {id:'dorm-5',buildingId:77938,name:'学生宿舍5舍',shortName:'5舍',x:248,z:-63,area:'学生生活区 · 南苑'},
  {id:'dorm-6',buildingId:77941,name:'第六学生宿舍',shortName:'6舍',x:185,z:33,area:'学生生活区 · 西苑'},
];
// Clear pedestrian routes also used for collision regression checks.
export const QUEST_ROUTES={
  toGuide:[[3,194],[0,174],[-23,161],[-22,128],[-9,113],[20,109]],
  toLibrary:[[20,109],[38,104]],
  toLake:[[38,104],[20,93],[8,73],[-6,62],[-33,64]],
  toTrack:[[-33,64],[-72,70],[-82,49],[-99,0],[-102,-25],[-104,-49],[-132,-51]],
  returnGuide:[[-132,-51],[-104,-49],[-102,-25],[-99,0],[-82,49],[-72,70],[-33,64],[-6,62],[8,73],[20,93],[20,109]],
  toLiving:[[20,109],[20,93],[42,43],[76,20],[108,5],[131,12],[153,18],[173,18]],
};
// Road centerlines traced from the supplied north-up satellite reference.
// They supplement official feature polygons; these are not surveyed road vectors.
export const ROADS=[
  {name:'松工路',width:9,points:[[-102,-156],[0,-152],[116,-149],[209,-146],[293,-141]]},
  {name:'学府大街',width:12,external:true,points:[[64,229],[94,161],[118,91],[143,16],[168,-66],[191,-147],[207,-181]]},
  {name:'南侧道路',width:9,external:true,points:[[-287,227],[-174,221],[-69,219],[4,216],[64,215],[151,200],[278,164]]},
  {name:'南门入口',width:9,points:[[3,211],[3,181],[0,170],[-23,161]]},
  {name:'信息楼环路',width:7,points:[[-23,161],[-21,169],[38,165],[79,155],[96,117],[108,65],[116,20],[131,-39],[149,-143]]},
  {name:'中央步行轴',width:5,points:[[-23,161],[-22,128],[-9,113],[14,99],[22,73],[34,41],[42,10],[55,-23],[64,-40]]},
  {name:'西侧环路',width:7,points:[[3,211],[-46,208],[-53,176],[-54,119],[-60,79],[-78,48],[-85,8],[-91,-24],[-100,-57],[-99,-150]]},
  {name:'教学区环路',width:6,points:[[64,-40],[45,-46],[21,-62],[9,-84],[4,-112],[8,-145],[113,-145],[115,-103],[116,-58],[100,-36],[64,-40]]},
  {name:'教学区内庭',width:3,points:[[44,-111],[56,-102],[63,-89],[69,-74],[70,-56],[65,-42]]},
  {name:'体育馆南路',width:6,points:[[-225,1],[-190,0],[-154,-1],[-119,-1],[-85,0],[-50,-3],[-1,-3],[35,-12],[62,-27],[99,-26],[125,-17]]},
  {name:'运动场东路',width:5,points:[[-99,-150],[-96,-95],[-97,-52],[-114,-49],[-164,-49],[-188,-49],[-215,-44]]},
  {name:'综合楼东路',width:5,points:[[-118,-1],[-116,14],[-109,26],[-94,28],[-81,24]]},
  {name:'综合楼南路',width:5,points:[[-223,64],[-176,66],[-140,70],[-105,70],[-72,70],[-39,66],[0,67],[22,73]]},
  {name:'西侧步道',width:4,points:[[-225,1],[-232,29],[-232,64],[-234,106],[-215,123],[-170,112],[-138,102],[-101,90],[-60,79]]},
  {name:'湖东园路',width:3,points:[[22,73],[49,61],[75,45],[108,65],[87,27],[68,4],[35,-12]]},
  {name:'湖畔连接',width:3,points:[[-33,64],[-6,62],[22,73]]},
  {name:'生活区连接通道',width:5,points:[[108,5],[131,12],[153,18],[173,18],[176,28],[211,36],[222,61]]},
  {name:'生活区步行轴',width:5,points:[[211,36],[224,11],[248,-11],[267,-46],[280,-85],[290,-106],[294,-144]]},
  {name:'宿舍南路',width:4,points:[[183,-64],[202,-60],[225,-57],[267,-46]]},
  {name:'宿舍庭院',width:4,points:[[199,-110],[231,-98],[261,-99],[280,-85]]},
  {name:'宿舍北路',width:4,points:[[198,-141],[231,-141],[270,-143],[294,-144]]},
];
export function pointInPolygon(x,z,points){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [xi,zi]=points[i],[xj,zj]=points[j];
    if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;
  }
  return inside;
}
export function segmentDistance(x,z,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1];const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}
export function nearPolygon(x,z,points,radius){
  return pointInPolygon(x,z,points)||points.some((p,i)=>segmentDistance(x,z,p,points[(i+1)%points.length])<radius);
}
export function featureCenter(f){return {x:f.points.reduce((s,p)=>s+p[0],0)/f.points.length,z:f.points.reduce((s,p)=>s+p[1],0)/f.points.length};}
export function campusObstacles(){return CAMPUS_FEATURES.filter(f=>['building','water','hill'].includes(f.kind)).map(f=>({name:f.name,points:f.points}));}
export function campusArea(x,z){
  if(x>150)return '学府大街东 · 学生生活区';
  if(z>165)return '南门入口';
  let best=null,d=Infinity;
  for(const f of CAMPUS_FEATURES.filter(f=>!['reserve','gate'].includes(f.kind))){const c=featureCenter(f),dist=Math.hypot(x-c.x,z-c.z);if(dist<d){d=dist;best=f;}}
  return best?.name+'周边';
}
