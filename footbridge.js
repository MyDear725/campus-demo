import * as THREE from 'three';

export const FOOTBRIDGE_META = {
  id: 'footbridge-xuefu',
  name: '学府大街跨街天桥',
  description: '连接教学区核心与第六学生食堂、生活区的标志性白色双拱透光圆筒人行天桥',
  westStart: [116, 7.8],
  westSpan: [132, 12.6],
  eastSpan: [156, 17.6],
  eastEnd: [171, 18.2],
  deckHeight: 4.5,
  archHeight: 14.8,
  width: 3.8,
};

// Check if a point is on the elevated footbridge walkway or ramp
export function isPointOnFootbridge(x, z) {
  const [x0, z0] = FOOTBRIDGE_META.westStart;
  const [x1, z1] = FOOTBRIDGE_META.eastEnd;
  const dx = x1 - x0, dz = z1 - z0;
  const lenSq = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / lenSq));
  const projX = x0 + t * dx, projZ = z0 + t * dz;
  const dist = Math.hypot(x - projX, z - projZ);
  return dist <= FOOTBRIDGE_META.width * 0.58;
}

// Elevation function for player walking:
// - Returns y in [0.1, 4.5] when on the bridge/ramps
// - If player is on the ground underneath the bridge on Xuefu Ave, returns 0.1
export function getFootbridgeElevation(x, z, currentY = 0.1) {
  const [x0, z0] = FOOTBRIDGE_META.westStart;
  const [x1, z1] = FOOTBRIDGE_META.eastEnd;
  const dx = x1 - x0, dz = z1 - z0;
  const lenSq = dx * dx + dz * dz;
  const t = ((x - x0) * dx + (z - z0) * dz) / lenSq;
  if (t < -0.05 || t > 1.05) return 0.1;

  const projX = x0 + t * dx, projZ = z0 + t * dz;
  const dist = Math.hypot(x - projX, z - projZ);
  const halfW = FOOTBRIDGE_META.width * 0.58;
  if (dist > halfW) return 0.1;

  const totalLen = Math.hypot(dx, dz);
  const s = t * totalLen; // distance along bridge axis in meters

  // West ramp: s in [0, 16] -> y rises smoothly from 0.1 to 4.5
  // Bridge span: s in [16, 40] -> y is 4.5
  // East ramp: s in [40, 55] -> y descends smoothly from 4.5 to 0.1
  const westRampLen = 16.0;
  const eastRampStart = 40.0;
  const eastRampEnd = 55.0;

  let bridgeDeckY = 0.1;
  if (s <= 0) {
    bridgeDeckY = 0.1;
  } else if (s < westRampLen) {
    const rampT = s / westRampLen;
    bridgeDeckY = 0.1 + 4.4 * (0.5 - 0.5 * Math.cos(Math.PI * rampT));
  } else if (s <= eastRampStart) {
    bridgeDeckY = FOOTBRIDGE_META.deckHeight;
  } else if (s < eastRampEnd) {
    const rampT = (s - eastRampStart) / (eastRampEnd - eastRampStart);
    bridgeDeckY = 0.1 + 4.4 * (0.5 + 0.5 * Math.cos(Math.PI * rampT));
  } else {
    bridgeDeckY = 0.1;
  }

  // If the player is on the road below (currentY < 1.8) and right over the roadway (s between 18 and 38), keep them on the ground
  if (currentY < 1.8 && s >= 18.0 && s <= 38.0) {
    return 0.1;
  }

  return bridgeDeckY;
}

export function buildFootbridge(world, obstacles = [], occluders = []) {
  const bridgeGroup = new THREE.Group();
  bridgeGroup.name = 'CampusFootbridge';

  // Materials designed to match the real photograph
  const whiteSteel = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.28,
    metalness: 0.35,
  });

  const tealGlass = new THREE.MeshStandardMaterial({
    color: '#349b8e',
    roughness: 0.16,
    metalness: 0.2,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
  });

  const deckPaving = new THREE.MeshStandardMaterial({
    color: '#d6cfbe',
    roughness: 0.82,
    metalness: 0.05,
  });

  const deckUnderside = new THREE.MeshStandardMaterial({
    color: '#e4e8eb',
    roughness: 0.45,
    metalness: 0.2,
  });

  const railingMetal = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.3,
    metalness: 0.5,
  });

  const cableMetal = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.35,
    metalness: 0.6,
  });

  const stonePlaza = new THREE.MeshStandardMaterial({
    color: '#c2bca8',
    roughness: 0.85,
  });

  const goldAccent = new THREE.MeshStandardMaterial({
    color: '#d4af37',
    roughness: 0.35,
    metalness: 0.7,
  });

  // Reusable geometries
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 16);

  function addMesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = cast;
    m.receiveShadow = true;
    bridgeGroup.add(m);
    return m;
  }

  function addBox(x, y, z, w, h, d, mat, rx = 0, ry = 0, rz = 0, cast = true) {
    const m = addMesh(boxGeo, mat, x, y, z, rx, ry, rz, cast);
    m.scale.set(w, h, d);
    return m;
  }

  function addBeam(p1, p2, radius, mat, cast = true) {
    const dist = p1.distanceTo(p2);
    if (dist < 0.001) return null;
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const m = addMesh(cylGeo, mat, mid.x, mid.y, mid.z, 0, 0, 0, cast);
    m.scale.set(radius, dist, radius);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
    return m;
  }

  // --- 1. Bridge Axis Coordinates ---
  const pWestStart = new THREE.Vector3(116, 0.1, 7.8);
  const pWestTop = new THREE.Vector3(132, FOOTBRIDGE_META.deckHeight, 12.6);
  const pEastTop = new THREE.Vector3(156, FOOTBRIDGE_META.deckHeight, 17.6);
  const pEastEnd = new THREE.Vector3(171, 0.1, 18.2);

  // Direction along bridge and normal vector in horizontal plane
  const yawSpan = Math.atan2(pEastTop.z - pWestTop.z, pEastTop.x - pWestTop.x);
  const normalSpan = new THREE.Vector3(-Math.sin(yawSpan), 0, Math.cos(yawSpan)).normalize();

  // --- 2. Dual White Parabolic Arches on Left & Right Flanks (两侧分开主拱，绝不插在桥面正中间) ---
  // The two white arch ribs flank the left and right sides of the bridge,
  // leaving the entire walkway and ramp 100% open and unobstructed!
  const archSegments = 36;
  const archRadius = 0.32;
  const secondaryRadius = 0.18;
  const archOffset = 2.45; // 2.45m on each side (bridge width is 3.8m, half-width 1.9m)

  const leftArchPoints = [];
  const rightArchPoints = [];

  for (const side of [-1, 1]) {
    const sideNorm = normalSpan.clone().multiplyScalar(side * archOffset);
    const footingWest = new THREE.Vector3(117, 0.1, 8.0).add(sideNorm);
    const footingEast = new THREE.Vector3(169, 0.1, 18.0).add(sideNorm);

    const mainPts = [];
    const innerPts = [];

    for (let i = 0; i <= archSegments; i++) {
      const t = i / archSegments;
      const p = footingWest.clone().lerp(footingEast, t);
      // Parabolic arc formula: peak at t = 0.5
      const archY = 0.1 + FOOTBRIDGE_META.archHeight * (4 * t * (1 - t));
      p.y = archY;
      mainPts.push(p);

      const innerP = p.clone();
      innerP.y = Math.max(0.4, archY - 0.7);
      innerPts.push(innerP);
    }

    if (side === 1) leftArchPoints.push(...mainPts);
    else rightArchPoints.push(...mainPts);

    // Beams and truss webbing for this flank arch
    for (let i = 0; i < archSegments; i++) {
      addBeam(mainPts[i], mainPts[i + 1], archRadius, whiteSteel);
      addBeam(innerPts[i], innerPts[i + 1], secondaryRadius, whiteSteel);
      addBeam(mainPts[i], innerPts[i + 1], 0.08, whiteSteel);
      addBeam(innerPts[i], mainPts[i + 1], 0.08, whiteSteel);
      addBeam(mainPts[i], innerPts[i], 0.10, whiteSteel);
    }

    // Footing abutment blocks on the ground outside the ramp
    for (const foot of [footingWest, footingEast]) {
      addBox(foot.x, 0.45, foot.z, 1.4, 0.9, 1.4, whiteSteel);
      addBox(foot.x, 1.0, foot.z, 1.0, 0.3, 1.0, whiteSteel);
    }
  }

  // Overhead transverse portal tie braces connecting the left and right arches above the glass tube
  for (const tIdx of [10, 14, 18, 22, 26]) {
    const pL = leftArchPoints[tIdx];
    const pR = rightArchPoints[tIdx];
    if (pL && pR && pL.y > FOOTBRIDGE_META.deckHeight + 3.2) {
      addBeam(pL, pR, 0.12, whiteSteel);
      if (tIdx + 4 <= 26) {
        const nextL = leftArchPoints[tIdx + 4];
        const nextR = rightArchPoints[tIdx + 4];
        if (nextL && nextR) {
          addBeam(pL, nextR, 0.06, whiteSteel);
          addBeam(pR, nextL, 0.06, whiteSteel);
        }
      }
    }
  }

  // --- 3. Cylindrical Teal Glass Skywalk Corridor (透光玻璃圆筒连廊) ---
  const tubeSpanLen = pWestTop.distanceTo(pEastTop);
  const tubeCenterY = FOOTBRIDGE_META.deckHeight + 1.65; // corridor center
  const tubeOuterRadius = 2.15;
  const tubeMid = pWestTop.clone().lerp(pEastTop, 0.5);
  tubeMid.y = tubeCenterY;

  // Longitudinal cylindrical glass canopy
  const glassCylinder = new THREE.CylinderGeometry(
    tubeOuterRadius,
    tubeOuterRadius,
    tubeSpanLen,
    32,
    1,
    true, // open-ended tube
    0,
    Math.PI * 2
  );
  glassCylinder.rotateZ(Math.PI / 2);
  glassCylinder.rotateY(-yawSpan);

  addMesh(glassCylinder, tealGlass, tubeMid.x, tubeMid.y, tubeMid.z, 0, 0, 0, false);

  // Circular structural white steel ring ribs spaced every 2.0 meters along the tube
  const ringCount = Math.floor(tubeSpanLen / 2.0);

  for (let i = 0; i <= ringCount; i++) {
    const t = i / ringCount;
    const ringPos = pWestTop.clone().lerp(pEastTop, t);
    ringPos.y = tubeCenterY;

    // Torus ring around the cylinder
    const ringGeo = new THREE.TorusGeometry(tubeOuterRadius + 0.05, 0.075, 8, 32);
    ringGeo.rotateY(Math.PI / 2 - yawSpan);
    addMesh(ringGeo, whiteSteel, ringPos.x, ringPos.y, ringPos.z);

    // Suspension cables from left and right arches down to left and right sides of each ring hoop
    const archIdx = Math.min(archSegments, Math.max(0, Math.round(t * (archSegments - 8) + 4)));
    const leftArchPt = leftArchPoints[archIdx];
    const rightArchPt = rightArchPoints[archIdx];

    if (leftArchPt && leftArchPt.y > ringPos.y) {
      const leftRingSide = ringPos.clone().addScaledVector(normalSpan, tubeOuterRadius + 0.02);
      addBeam(leftRingSide, leftArchPt, 0.038, cableMetal);
    }
    if (rightArchPt && rightArchPt.y > ringPos.y) {
      const rightRingSide = ringPos.clone().addScaledVector(normalSpan, -(tubeOuterRadius + 0.02));
      addBeam(rightRingSide, rightArchPt, 0.038, cableMetal);
    }
  }

  // 4 Longitudinal white steel stringer rails along the glass tube
  for (const [angleOffset] of [
    [0], // top ridge
    [Math.PI], // bottom keel
    [Math.PI * 0.5], // left waist
    [-Math.PI * 0.5], // right waist
  ]) {
    const p1 = pWestTop.clone();
    p1.y = tubeCenterY + Math.cos(angleOffset) * (tubeOuterRadius + 0.04);
    p1.x -= Math.sin(yawSpan) * Math.sin(angleOffset) * (tubeOuterRadius + 0.04);
    p1.z += Math.cos(yawSpan) * Math.sin(angleOffset) * (tubeOuterRadius + 0.04);

    const p2 = pEastTop.clone();
    p2.y = tubeCenterY + Math.cos(angleOffset) * (tubeOuterRadius + 0.04);
    p2.x -= Math.sin(yawSpan) * Math.sin(angleOffset) * (tubeOuterRadius + 0.04);
    p2.z += Math.cos(yawSpan) * Math.sin(angleOffset) * (tubeOuterRadius + 0.04);

    addBeam(p1, p2, 0.08, whiteSteel);
  }

  // --- 4. Main Walking Deck & Bridge Soffit across the Avenue ---
  // Deck floor: 3.8m wide, 0.24m thick
  const deckBox = addBox(
    tubeMid.x,
    FOOTBRIDGE_META.deckHeight - 0.12,
    tubeMid.z,
    tubeSpanLen,
    0.24,
    FOOTBRIDGE_META.width,
    deckPaving,
    0,
    -yawSpan,
    0
  );
  deckBox.userData.isBridgeDeck = true;

  // Deck soffit / underside fascia beam
  addBox(
    tubeMid.x,
    FOOTBRIDGE_META.deckHeight - 0.28,
    tubeMid.z,
    tubeSpanLen + 0.2,
    0.16,
    FOOTBRIDGE_META.width + 0.2,
    deckUnderside,
    0,
    -yawSpan,
    0
  );

  // Interior safety railings along main span
  for (const side of [-1, 1]) {
    const railOffset = (FOOTBRIDGE_META.width * 0.5 - 0.16) * side;
    const nx = -Math.sin(yawSpan) * railOffset;
    const nz = Math.cos(yawSpan) * railOffset;

    // Top handrail
    addBox(
      tubeMid.x + nx,
      FOOTBRIDGE_META.deckHeight + 1.05,
      tubeMid.z + nz,
      tubeSpanLen,
      0.08,
      0.08,
      railingMetal,
      0,
      -yawSpan,
      0
    );

    // Mid rail
    addBox(
      tubeMid.x + nx,
      FOOTBRIDGE_META.deckHeight + 0.55,
      tubeMid.z + nz,
      tubeSpanLen,
      0.04,
      0.04,
      railingMetal,
      0,
      -yawSpan,
      0
    );

    // Baluster posts every 1.8 meters
    for (let i = 0; i <= ringCount; i++) {
      const t = i / ringCount;
      const pt = pWestTop.clone().lerp(pEastTop, t);
      addBox(
        pt.x + nx,
        FOOTBRIDGE_META.deckHeight + 0.55,
        pt.z + nz,
        0.06,
        1.1,
        0.06,
        railingMetal,
        0,
        -yawSpan,
        0
      );
    }
  }

  // --- 5. West Approach Ramp (主校区侧缓坡引桥 —— 内部100%无立柱完全通畅) ---
  const westRampLen = pWestStart.distanceTo(pWestTop);
  const westRampMid = pWestStart.clone().lerp(pWestTop, 0.5);
  const westRampYaw = Math.atan2(pWestTop.z - pWestStart.z, pWestTop.x - pWestStart.x);
  const westRampPitch = Math.atan2(pWestTop.y - pWestStart.y, Math.hypot(pWestTop.x - pWestStart.x, pWestTop.z - pWestStart.z));

  // Sloping deck
  addBox(
    westRampMid.x,
    westRampMid.y - 0.1,
    westRampMid.z,
    westRampLen,
    0.22,
    FOOTBRIDGE_META.width,
    deckPaving,
    0,
    -westRampYaw,
    westRampPitch
  );

  // Support piers under west ramp (placed underneath the ramp deck)
  for (const t of [0.35, 0.72]) {
    const pt = pWestStart.clone().lerp(pWestTop, t);
    const h = pt.y - 0.1;
    if (h > 0.6) {
      addBox(pt.x, h * 0.5, pt.z, 0.7, h, 2.6, whiteSteel);
    }
  }

  // Railings along west ramp
  for (const side of [-1, 1]) {
    const railOffset = (FOOTBRIDGE_META.width * 0.5 - 0.14) * side;
    const nx = -Math.sin(westRampYaw) * railOffset;
    const nz = Math.cos(westRampYaw) * railOffset;

    addBox(
      westRampMid.x + nx,
      westRampMid.y + 1.05,
      westRampMid.z + nz,
      westRampLen,
      0.08,
      0.08,
      railingMetal,
      0,
      -westRampYaw,
      westRampPitch
    );
    addBox(
      westRampMid.x + nx,
      westRampMid.y + 0.55,
      westRampMid.z + nz,
      westRampLen,
      0.04,
      0.04,
      railingMetal,
      0,
      -westRampYaw,
      westRampPitch
    );
  }

  // --- 6. East Approach Ramp & Sixth Canteen Landing Plaza (第六食堂侧引桥与广场) ---
  const eastRampLen = pEastTop.distanceTo(pEastEnd);
  const eastRampMid = pEastTop.clone().lerp(pEastEnd, 0.5);
  const eastRampYaw = Math.atan2(pEastEnd.z - pEastTop.z, pEastEnd.x - pEastTop.x);
  const eastRampPitch = -Math.atan2(pEastTop.y - pEastEnd.y, Math.hypot(pEastEnd.x - pEastTop.x, pEastEnd.z - pEastTop.z));

  // Sloping deck down to the plaza
  addBox(
    eastRampMid.x,
    eastRampMid.y - 0.1,
    eastRampMid.z,
    eastRampLen,
    0.22,
    FOOTBRIDGE_META.width,
    deckPaving,
    0,
    -eastRampYaw,
    eastRampPitch
  );

  // Support piers under east ramp (placed underneath the ramp deck)
  for (const t of [0.32, 0.68]) {
    const pt = pEastTop.clone().lerp(pEastEnd, t);
    const h = pt.y - 0.1;
    if (h > 0.6) {
      addBox(pt.x, h * 0.5, pt.z, 0.7, h, 2.6, whiteSteel);
    }
  }

  // Railings along east ramp
  for (const side of [-1, 1]) {
    const railOffset = (FOOTBRIDGE_META.width * 0.5 - 0.14) * side;
    const nx = -Math.sin(eastRampYaw) * railOffset;
    const nz = Math.cos(eastRampYaw) * railOffset;

    addBox(
      eastRampMid.x + nx,
      eastRampMid.y + 1.05,
      eastRampMid.z + nz,
      eastRampLen,
      0.08,
      0.08,
      railingMetal,
      0,
      -eastRampYaw,
      eastRampPitch
    );
    addBox(
      eastRampMid.x + nx,
      eastRampMid.y + 0.55,
      eastRampMid.z + nz,
      eastRampLen,
      0.04,
      0.04,
      railingMetal,
      0,
      -eastRampYaw,
      eastRampPitch
    );
  }

  // Sixth Canteen western plaza paving extension connecting ramp landing directly to canteen doors
  addBox(177, 0.08, 18.2, 13, 0.08, 16, stonePlaza, 0, 0, 0, false);

  // Landmark monument / campus pylon on the roadside (matching the white/gold stone pillar in the photo)
  // Located at roadside near east bridgehead: x = 158.5, z = 11.5 (well clear of the pedestrian ramp)
  addBox(158.5, 1.8, 11.5, 0.9, 3.6, 0.9, whiteSteel);
  addBox(158.5, 3.7, 11.5, 1.1, 0.25, 1.1, whiteSteel);
  addBox(158.5, 2.2, 11.02, 0.55, 1.6, 0.08, goldAccent);

  // Central median reservation greenery under the bridge along Xuefu Ave
  addBox(143.5, 0.2, 16, 1.4, 0.25, 28, new THREE.MeshStandardMaterial({ color: '#557a55', roughness: 0.9 }));
  // Median curbs
  addBox(142.75, 0.25, 16, 0.14, 0.35, 28, whiteSteel);
  addBox(144.25, 0.25, 16, 0.14, 0.35, 28, whiteSteel);

  // Add decorative trees/shrubs planters along the bridge approach plazas
  for (const [tx, tz] of [
    [113, 14],
    [114, 1.5],
    [169, 8],
    [172, 28.5],
  ]) {
    addBox(tx, 0.25, tz, 2.2, 0.3, 2.2, whiteSteel);
    addBox(tx, 0.45, tz, 1.9, 0.2, 1.9, new THREE.MeshStandardMaterial({ color: '#4a6f44', roughness: 0.9 }));
  }

  // Walkway is completely open for all routes
  world.add(bridgeGroup);
  return { bridgeGroup, meta: FOOTBRIDGE_META };
}
