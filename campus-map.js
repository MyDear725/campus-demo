import { CAMPUS_FEATURES, ROADS, ROAD_STYLES, MAP_BOUNDS, GUIDE, featureCenter } from './campus-layout.js';
import { FENCE_PANELS } from './campus-boundary.js';
import { TEACHING_COURT } from './teaching-layout.js';

export function drawCampusMap(ctx,width,height,{player,yaw=0,memories=[],progress,dorm=null,expanded=false}={}){
  const pad=expanded?35:10,s=Math.min((width-pad*2)/(MAP_BOUNDS.maxX-MAP_BOUNDS.minX),(height-pad*2)/(MAP_BOUNDS.maxZ-MAP_BOUNDS.minZ));
  const ox=(width-(MAP_BOUNDS.maxX-MAP_BOUNDS.minX)*s)/2,oy=(height-(MAP_BOUNDS.maxZ-MAP_BOUNDS.minZ)*s)/2;
  const X=x=>ox+(x-MAP_BOUNDS.minX)*s,Y=z=>oy+(z-MAP_BOUNDS.minZ)*s;
  ctx.fillStyle='#304e43';ctx.fillRect(0,0,width,height);
  function path(points,close=false){ctx.beginPath();points.forEach(([x,z],i)=>i?ctx.lineTo(X(x),Y(z)):ctx.moveTo(X(x),Y(z)));if(close)ctx.closePath();}
  for(const kind of ['secondary','main','external'])for(const r of ROADS.filter(r=>r.kind===kind)){path(r.points);ctx.strokeStyle=ROAD_STYLES[kind].mapColor;ctx.lineWidth=Math.max(1,r.width*s);ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}
  ctx.beginPath();for(const {a,b} of FENCE_PANELS){ctx.moveTo(X(a[0]),Y(a[1]));ctx.lineTo(X(b[0]),Y(b[1]));}ctx.strokeStyle='#e3d8b9';ctx.lineWidth=expanded?1.4:.7;ctx.stroke();
  const palette={building:'#d7c7a8',water:'#6faeb0',hill:'#56744e',plaza:'#ddd1a9',track:'#b77b65',court:'#799d92',reserve:'#3d5b44',gate:'#ead49c'};
  path(TEACHING_COURT.points,true);ctx.fillStyle=palette.plaza;ctx.fill();
  const fountain=TEACHING_COURT.fountain;ctx.beginPath();ctx.arc(X(fountain.x),Y(fountain.z),fountain.radius*s,0,Math.PI*2);ctx.fillStyle=palette.water;ctx.fill();
  for(const f of CAMPUS_FEATURES){path(f.points,true);ctx.fillStyle=palette[f.kind];ctx.fill();}

  // Draw iconic white arch & teal glass footbridge across Xuefu Avenue
  const bx0=X(120),by0=Y(9),bx1=X(166),by1=Y(18);
  ctx.save();
  ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(3.2,4.5*s);ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(bx0,by0);ctx.lineTo(bx1,by1);ctx.stroke();
  ctx.strokeStyle='#349b8e';ctx.lineWidth=Math.max(1.8,2.6*s);
  ctx.beginPath();ctx.moveTo(bx0,by0);ctx.lineTo(bx1,by1);ctx.stroke();
  ctx.restore();

  const labels=expanded?CAMPUS_FEATURES.filter(f=>!['reserve','gate'].includes(f.kind)):CAMPUS_FEATURES.filter(f=>['图书馆','教学楼A区','综合楼','体育馆','涌泉湖','开发区校区运动场','第六学生宿舍'].includes(f.name));
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${expanded?13:9}px "Microsoft YaHei"`;ctx.lineWidth=3;ctx.strokeStyle='#29483a';ctx.fillStyle='#f7eed5';
  const labelOffsets={77931:[279,-137],77933:[234,-137],77935:[203,-104],77937:[207,-63],77938:[255,-63]};
  for(const f of labels){const c=featureCenter(f);if(labelOffsets[f.id]){[c.x,c.z]=labelOffsets[f.id];}let name=f.name.replace('大连理工大学','').replace('开发区校区','').replace('学生宿舍','宿舍').replace('第七宿舍/大学生活动中心','活动中心');ctx.strokeText(name,X(c.x),Y(c.z));ctx.fillText(name,X(c.x),Y(c.z));}
  if(expanded){
    ctx.fillStyle='#d9d5be';ctx.font='12px "Microsoft YaHei"';
    ctx.fillText('学府大街',X(151),Y(87));ctx.fillText('松工路',X(55),Y(-163));ctx.fillText('南门',X(3),Y(222));
    ctx.fillStyle='#afbdab';ctx.fillText('校外区域',X(-165),Y(159));
    ctx.fillText('北 N ↑',width-49,24);
    ctx.textAlign='left';ctx.fillText('官方地物轮廓 · 道路参考卫星图',18,height-14);
    ctx.textAlign='center';ctx.fillStyle='#9ce8dc';ctx.fillText('学府天桥',X(143),Y(5));
    const x=18;let y=height-190;
    for(const style of Object.values(ROAD_STYLES)){
      ctx.fillStyle=style.mapColor;ctx.fillRect(x,y-3,23,5);
      ctx.fillStyle='#f4ead2';ctx.fillText(style.label,x+30,y);y+=24;
    }
    ctx.strokeStyle='#e3d8b9';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+23,y);ctx.stroke();ctx.fillText('临街围栏',x+30,y);
  }
  for(const m of memories){if(!progress?.started||progress.collected.includes(m.id))continue;const x=X(m.x),y=Y(m.z);ctx.fillStyle=m.color;ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();ctx.fill();}
  if(!progress?.completed){ctx.fillStyle='#f4d985';ctx.beginPath();ctx.arc(X(GUIDE.x),Y(GUIDE.z),expanded?5:3,0,Math.PI*2);ctx.fill();}
  if(dorm&&Number.isFinite(dorm.x)&&Number.isFinite(dorm.z)){const dx=X(dorm.x),dy=Y(dorm.z),r=expanded?6:4;ctx.fillStyle='#ff9f5a';ctx.strokeStyle='#fff6d9';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(dx,dy,r,0,Math.PI*2);ctx.fill();ctx.stroke();if(expanded){ctx.textAlign='center';ctx.font='bold 11px "Microsoft YaHei"';ctx.fillStyle='#ffe29a';ctx.fillText('★ 我的宿舍',dx,dy-12);}}
  if(player){ctx.save();ctx.translate(X(player.x),Y(player.z));ctx.rotate(-yaw);ctx.fillStyle='#fffdf1';ctx.strokeStyle='#264735';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,5);ctx.lineTo(0,2);ctx.lineTo(-5,5);ctx.closePath();ctx.stroke();ctx.fill();ctx.restore();}
}
