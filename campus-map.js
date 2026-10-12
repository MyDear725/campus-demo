import { CAMPUS_FEATURES, ROADS, MAP_BOUNDS, GUIDE, featureCenter } from './campus-layout.js';
export function drawCampusMap(ctx,width,height,{player,yaw=0,memories=[],progress,expanded=false}={}){
  const pad=expanded?35:10,s=Math.min((width-pad*2)/(MAP_BOUNDS.maxX-MAP_BOUNDS.minX),(height-pad*2)/(MAP_BOUNDS.maxZ-MAP_BOUNDS.minZ));
  const ox=(width-(MAP_BOUNDS.maxX-MAP_BOUNDS.minX)*s)/2,oy=(height-(MAP_BOUNDS.maxZ-MAP_BOUNDS.minZ)*s)/2;
  const X=x=>ox+(x-MAP_BOUNDS.minX)*s,Y=z=>oy+(z-MAP_BOUNDS.minZ)*s;
  ctx.fillStyle='#304e43';ctx.fillRect(0,0,width,height);
  function path(points,close=false){ctx.beginPath();points.forEach(([x,z],i)=>i?ctx.lineTo(X(x),Y(z)):ctx.moveTo(X(x),Y(z)));if(close)ctx.closePath();}
  for(const r of ROADS){path(r.points);ctx.strokeStyle=r.external?'#96a49b':'#c2c3a7';ctx.lineWidth=Math.max(1,r.width*s);ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}
  const palette={building:'#d7c7a8',water:'#6faeb0',hill:'#56744e',plaza:'#ddd1a9',track:'#b77b65',court:'#799d92',reserve:'#3d5b44',gate:'#ead49c'};
  for(const f of CAMPUS_FEATURES){path(f.points,true);ctx.fillStyle=palette[f.kind];ctx.fill();}
  const labels=expanded?CAMPUS_FEATURES.filter(f=>!['reserve','gate'].includes(f.kind)):CAMPUS_FEATURES.filter(f=>['图书馆','教学楼A区','综合楼','体育馆','涌泉湖','开发区校区运动场','第六学生宿舍'].includes(f.name));
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${expanded?13:9}px "Microsoft YaHei"`;ctx.lineWidth=3;ctx.strokeStyle='#29483a';ctx.fillStyle='#f7eed5';
  const labelOffsets={77931:[279,-137],77933:[234,-137],77935:[203,-104],77937:[207,-63],77938:[255,-63]};
  for(const f of labels){const c=featureCenter(f);if(labelOffsets[f.id]){[c.x,c.z]=labelOffsets[f.id];}let name=f.name.replace('大连理工大学','').replace('开发区校区','').replace('学生宿舍','宿舍').replace('第七宿舍/大学生活动中心','活动中心');ctx.strokeText(name,X(c.x),Y(c.z));ctx.fillText(name,X(c.x),Y(c.z));}
  if(expanded){ctx.fillStyle='#d9d5be';ctx.font='12px "Microsoft YaHei"';ctx.fillText('学府大街',X(151),Y(87));ctx.fillText('松工路',X(55),Y(-163));ctx.fillText('南门',X(3),Y(222));ctx.fillStyle='#afbdab';ctx.fillText('校外区域',X(-165),Y(159));ctx.fillText('北 N ↑',width-49,24);ctx.textAlign='left';ctx.fillText('官方地物轮廓 · 道路参考卫星图',18,height-14);}
  for(const m of memories){if(!progress?.started||progress.collected.includes(m.id))continue;const x=X(m.x),y=Y(m.z);ctx.fillStyle=m.color;ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();ctx.fill();}
  if(!progress?.completed){ctx.fillStyle='#f4d985';ctx.beginPath();ctx.arc(X(GUIDE.x),Y(GUIDE.z),expanded?5:3,0,Math.PI*2);ctx.fill();}
  if(player){ctx.save();ctx.translate(X(player.x),Y(player.z));ctx.rotate(-yaw);ctx.fillStyle='#fffdf1';ctx.strokeStyle='#264735';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,5);ctx.lineTo(0,2);ctx.lineTo(-5,5);ctx.closePath();ctx.stroke();ctx.fill();ctx.restore();}
}
