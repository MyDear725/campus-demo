import { ROADS, CAMPUS_FEATURES, QUEST_ROUTES, segmentDistance, nearPolygon } from './campus-layout.js';

// Road-side campus boundary interpretation, not cadastral/surveyed property data.
export function offsetPath(points,offset){
  return points.map((p,i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const u=[p[0]-a[0],p[1]-a[1]],v=[b[0]-p[0],b[1]-p[1]];
    if(!i){u[0]=v[0];u[1]=v[1];}if(i===points.length-1){v[0]=u[0];v[1]=u[1];}
    const ul=Math.hypot(...u)||1,vl=Math.hypot(...v)||1,nx=-u[1]/ul-v[1]/vl,nz=u[0]/ul+v[0]/vl,n=Math.hypot(nx,nz)||1;
    const x=nx/n,z=nz/n,miter=offset/Math.max(.5,x*(-v[1]/vl)+z*v[0]/vl);
    return [p[0]+x*miter,p[1]+z*miter];
  });
}
const eastWest=offsetPath([[73,208],[94,161],[118,91],[143,16],[168,-66],[191,-147]],-9.6);
const eastLiving=offsetPath([[122,79],[143,16],[168,-66],[191,-147]],9.6);
const north=ROADS.find(r=>r.name==='松工路');
export const BOUNDARY_PATHS=[
  {name:'南门西侧围栏',points:[[-58,211],[-22,209],[-7,207]]},
  {name:'南门东侧围栏',points:[[15,207],[38,205],eastWest[0]]},
  {name:'主校区临学府大街',points:eastWest},
  {name:'生活区临学府大街',points:eastLiving},
  {name:'北侧临松工路',points:offsetPath(north.points,7.2)},
];

// Openings are cut for actual paths, gate polygons, and the keyboard-steered
// crossing route. The same panels drive rendering, minimap and collision.
const routes=Object.values(QUEST_ROUTES).flatMap(path=>[path,path.flatMap((p,i)=>{
  if(!i)return [p];const a=path[i-1],d=Math.min(Math.abs(p[0]-a[0]),Math.abs(p[1]-a[1]));
  return [[a[0]+Math.sign(p[0]-a[0])*d,a[1]+Math.sign(p[1]-a[1])*d],p];
})]);
export function isBoundaryOpening(x,z){
  if(ROADS.filter(r=>!r.external).some(r=>r.points.some((p,i)=>i&&segmentDistance(x,z,r.points[i-1],p)<r.width/2+1.1)))return true;
  if(routes.some(path=>path.some((p,i)=>i&&segmentDistance(x,z,path[i-1],p)<1.6)))return true;
  return CAMPUS_FEATURES.some(f=>['gate','building','water','hill'].includes(f.kind)&&nearPolygon(x,z,f.points,.65));
}
export function nearBoundary(x,z,radius){return BOUNDARY_PATHS.some(path=>path.points.some((p,i)=>i&&segmentDistance(x,z,path.points[i-1],p)<radius));}
export const FENCE_PANELS=[];
for(const path of BOUNDARY_PATHS)for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.ceil(length/2.7);
  for(let j=0;j<count;j++){
    const p=[a[0]+(b[0]-a[0])*j/count,a[1]+(b[1]-a[1])*j/count],q=[a[0]+(b[0]-a[0])*(j+1)/count,a[1]+(b[1]-a[1])*(j+1)/count];
    if([0,.25,.5,.75,1].some(t=>isBoundaryOpening(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t)))continue;
    FENCE_PANELS.push({name:path.name,a:p,b:q});
  }
}

// Crossings at the main gate and between the west and east campus grounds.
export const ROAD_CROSSINGS=[
  {road:'南侧道路',x:3,z:216,width:9,heading:Math.atan2(64-4,215-216),length:5},
  {road:'学府大街',x:143.9,z:13.2,width:12,heading:Math.atan2(143-118,16-91),length:6},
];
