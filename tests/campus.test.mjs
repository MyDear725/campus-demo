import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_FEATURES, GUIDE, CAMPUS_START, MEMORY_SPOTS, DORMITORIES, QUEST_ROUTES, campusObstacles, campusArea, featureCenter, pointInPolygon } from '../campus-layout.js';
import { FOOTBRIDGE_META, getFootbridgeElevation, isPointOnFootbridge } from '../footbridge.js';
import { MAP_META } from '../campus-data.js';
import { collides, moveWithCollision } from '../logic.js';
const obstacles=campusObstacles();
test('development-campus landmarks retain the actual north/south/east/west relationships',()=>{
  assert.equal(MAP_META.campusId,77298);assert.equal(CAMPUS_FEATURES.length,27);
  const center=name=>featureCenter(CAMPUS_FEATURES.find(f=>f.name===name));
  const lib=center('图书馆'),track=center('开发区校区运动场'),teach=center('教学楼A区'),lake=center('涌泉湖'),living=center('第六学生宿舍');
  assert.ok(track.x<lake.x && track.z<lake.z);
  assert.ok(lib.x>lake.x && lib.z>lake.z && teach.z<lib.z);
  assert.ok(living.x>lib.x);
  assert.deepEqual(CAMPUS_FEATURES.filter(f=>f.kind==='water').map(f=>f.name).sort(),['思源湖','涌泉湖']);
});
test('both lakes stop swept player movement at their actual shorelines',()=>{
  for(const f of CAMPUS_FEATURES.filter(f=>f.kind==='water')){
    const c=featureCenter(f);assert.ok(pointInPolygon(c.x,c.z,f.points));assert.ok(collides(c.x,c.z,obstacles));
    const start={x:Math.min(...f.points.map(p=>p[0]))-5,z:c.z};
    const result=moveWithCollision(start,c.x-start.x,0,[{points:f.points}]);
    assert.ok(!pointInPolygon(result.x,result.z,f.points));
    assert.ok(Math.hypot(result.x-c.x,result.z-c.z)>3);
  }
});
test('spawn, guide, collectibles, and all 6 dormitory entrances are outside solid geometry',()=>{
  for(const p of [CAMPUS_START,GUIDE,...MEMORY_SPOTS,...DORMITORIES])assert.equal(collides(p.x,p.z,obstacles),false,JSON.stringify(p));
  assert.equal(DORMITORIES.length,6);
  for(const dorm of DORMITORIES){
    const building=CAMPUS_FEATURES.find(f=>f.name===dorm.name);
    assert.ok(building,`missing campus building for ${dorm.name}`);
  }
});
test('all quest and living-area routes are walkable with the real polygon colliders',()=>{
  for(const [name,route] of Object.entries(QUEST_ROUTES)){
    let p={x:route[0][0],z:route[0][1]};
    for(const [x,z] of route.slice(1)){
      const start={...p},steps=Math.ceil(Math.hypot(x-p.x,z-p.z)/.1);
      for(let i=0;i<steps;i++)p=moveWithCollision(p,(x-start.x)/steps,(z-start.z)/steps,obstacles);
      assert.ok(Math.hypot(p.x-x,p.z-z)<.15,`${name}: blocked before ${x}, ${z}, reached ${p.x}, ${p.z}`);
    }
  }
});
test('xuefu avenue footbridge connects campus core to sixth canteen plaza with accurate arch and elevation profile',()=>{
  assert.equal(FOOTBRIDGE_META.id, 'footbridge-xuefu');
  assert.equal(FOOTBRIDGE_META.deckHeight, 4.5);
  assert.ok(FOOTBRIDGE_META.archHeight >= 14);

  // Outside bridge
  assert.equal(getFootbridgeElevation(0, 0), 0.1);
  assert.equal(getFootbridgeElevation(143, 90), 0.1);

  // On the west approach ramp: y climbs smoothly above 0.1
  const westMidY = getFootbridgeElevation(124, 10.2);
  assert.ok(westMidY > 0.5 && westMidY < 4.0, `west ramp elevation ${westMidY}`);

  // On the main bridge deck over Xuefu Ave: deck height is 4.5m
  const spanCenterY = getFootbridgeElevation(144, 15.1, 4.5);
  assert.equal(spanCenterY, 4.5);
  assert.ok(isPointOnFootbridge(144, 15.1));

  // Walking on the road under the bridge: stays on road level
  const roadY = getFootbridgeElevation(144, 15.1, 0.1);
  assert.equal(roadY, 0.1);

  // On the east approach ramp towards Sixth Canteen: y descends to plaza
  const eastMidY = getFootbridgeElevation(163, 17.9, 3.0);
  assert.ok(eastMidY > 0.5 && eastMidY < 4.0, `east ramp elevation ${eastMidY}`);

  // East end touches down right in front of Sixth Canteen
  const eastEnd = getFootbridgeElevation(171, 18.2);
  assert.equal(eastEnd, 0.1);

  // Walking continuously along bridge centerline from west stairs to east stairs never traps player underneath
  let walkY = 0.1;
  const pathSteps = [
    [116, 7.8], [120, 9.0], [124, 10.2], [128, 11.4], [132, 12.6],
    [138, 13.85], [144, 15.1], [150, 16.35], [156, 17.6],
    [160, 17.75], [164, 17.9], [168, 18.05], [171, 18.2]
  ];
  for (const [x, z] of pathSteps) {
    walkY = getFootbridgeElevation(x, z, walkY);
    assert.ok(walkY >= 0.1 && walkY <= 4.5, `elevation out of bounds at ${x}, ${z}: ${walkY}`);
    if (x >= 132 && x <= 156) {
      assert.equal(walkY, 4.5, `on bridge deck at ${x}, ${z} must be 4.5m, got ${walkY}`);
    }
  }
  assert.equal(walkY, 0.1);

  // Campus area recognises the bridge
  assert.equal(campusArea(144, 15), '学府大街 · 跨街天桥');
});

