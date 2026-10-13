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

function projectToSegment(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return { t: 0, dist: Math.hypot(x - a[0], z - a[1]) };
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lenSq));
  const px = a[0] + t * dx, pz = a[1] + t * dz;
  const dist = Math.hypot(x - px, z - pz);
  return { t, dist, px, pz };
}

// Check if a point is on the elevated footbridge walkway, stairs, or span
export function isPointOnFootbridge(x, z) {
  const seg1 = projectToSegment(x, z, FOOTBRIDGE_META.westStart, FOOTBRIDGE_META.westSpan);
  const seg2 = projectToSegment(x, z, FOOTBRIDGE_META.westSpan, FOOTBRIDGE_META.eastSpan);
  const seg3 = projectToSegment(x, z, FOOTBRIDGE_META.eastSpan, FOOTBRIDGE_META.eastEnd);
  const minDist = Math.min(seg1.dist, seg2.dist, seg3.dist);
  return minDist <= FOOTBRIDGE_META.width * 0.58;
}

// Elevation function for player walking:
// - Returns y in [0.1, 4.5] when on the bridge deck or stairs
// - Section 1 (West Stairs): rises from 0.1 to 4.5
// - Section 2 (Main Covered Span): firmly 4.5m across Xuefu Ave (or 0.1 if player is on the street underneath)
// - Section 3 (East Stairs): descends from 4.5 to 0.1 into Sixth Canteen Plaza
export function getFootbridgeElevation(x, z, currentY = 0.1) {
  const seg1 = projectToSegment(x, z, FOOTBRIDGE_META.westStart, FOOTBRIDGE_META.westSpan);
  const seg2 = projectToSegment(x, z, FOOTBRIDGE_META.westSpan, FOOTBRIDGE_META.eastSpan);
  const seg3 = projectToSegment(x, z, FOOTBRIDGE_META.eastSpan, FOOTBRIDGE_META.eastEnd);
  const halfW = FOOTBRIDGE_META.width * 0.58;

  let bestSeg = 1;
  let minDist = seg1.dist;
  if (seg2.dist < minDist) { minDist = seg2.dist; bestSeg = 2; }
  if (seg3.dist < minDist) { minDist = seg3.dist; bestSeg = 3; }

  if (minDist > halfW) return 0.1;

  if (bestSeg === 2) {
    // If player is on Xuefu Ave roadway underneath (currentY <= 2.0), keep them on the road!
    if (currentY <= 2.0) return 0.1;
    return FOOTBRIDGE_META.deckHeight;
  }
  if (bestSeg === 1) {
    if (seg1.t <= 0) return 0.1;
    if (seg1.t >= 1) return FOOTBRIDGE_META.deckHeight;
    return 0.1 + (FOOTBRIDGE_META.deckHeight - 0.1) * seg1.t;
  }
  if (seg3.t >= 1) return 0.1;
  if (seg3.t <= 0) return FOOTBRIDGE_META.deckHeight;
  return FOOTBRIDGE_META.deckHeight - (FOOTBRIDGE_META.deckHeight - 0.1) * seg3.t;
}

// Constrains player movement inside the glass tube corridor and stairs.
// Prevents player from penetrating the green glass walls or falling off the elevated structure.
export function constrainFootbridgeMovement(targetPos, currentY = 0.1) {
  const seg1 = projectToSegment(targetPos.x, targetPos.z, FOOTBRIDGE_META.westStart, FOOTBRIDGE_META.westSpan);
  const seg2 = projectToSegment(targetPos.x, targetPos.z, FOOTBRIDGE_META.westSpan, FOOTBRIDGE_META.eastSpan);
  const seg3 = projectToSegment(targetPos.x, targetPos.z, FOOTBRIDGE_META.eastSpan, FOOTBRIDGE_META.eastEnd);

  let bestSeg = seg1;
  let segId = 1;
  if (seg2.dist < bestSeg.dist) { bestSeg = seg2; segId = 2; }
  if (seg3.dist < bestSeg.dist) { bestSeg = seg3; segId = 3; }

  // If on ground (currentY <= 0.4):
  if (currentY <= 0.4) {
    // Xuefu Ave road level underneath main span: completely free movement
    if (segId === 2) return targetPos;

    // Outer entrance / exit ground thresholds: completely free movement
    if (segId === 1 && bestSeg.t <= 0.05) return targetPos;
    if (segId === 3 && bestSeg.t >= 0.95) return targetPos;

    // Outside bridge corridor on ground: completely free movement
    if (bestSeg.dist > FOOTBRIDGE_META.width * 0.6) return targetPos;

    // Ground player approaching elevated stairs side wall from outside: keep outside
    if (segId === 1 && bestSeg.t > 0.15 && bestSeg.dist < 1.95) {
      const nx = (targetPos.x - bestSeg.px) / (bestSeg.dist || 0.001);
      const nz = (targetPos.z - bestSeg.pz) / (bestSeg.dist || 0.001);
      return { x: bestSeg.px + nx * 1.95, z: bestSeg.pz + nz * 1.95 };
    }
    if (segId === 3 && bestSeg.t < 0.85 && bestSeg.dist < 1.95) {
      const nx = (targetPos.x - bestSeg.px) / (bestSeg.dist || 0.001);
      const nz = (targetPos.z - bestSeg.pz) / (bestSeg.dist || 0.001);
      return { x: bestSeg.px + nx * 1.95, z: bestSeg.pz + nz * 1.95 };
    }

    return targetPos;
  }

  // Player is elevated on the footbridge or stairs (currentY > 0.4):
  // If player is far away from the bridge (e.g. on other high structures), don't constrain:
  if (bestSeg.dist > 6.0) return targetPos;

  // Otherwise, player is walking inside the covered skywalk corridor!
  // Clamping boundary inside the glass skywalk corridor (walkable half-width 1.62m)
  const walkableHalfW = 1.62;
  if (bestSeg.dist > walkableHalfW) {
    const clampedPos = { ...targetPos };
    if (bestSeg.dist > 0.0001) {
      const nx = (targetPos.x - bestSeg.px) / bestSeg.dist;
      const nz = (targetPos.z - bestSeg.pz) / bestSeg.dist;
      clampedPos.x = bestSeg.px + nx * walkableHalfW;
      clampedPos.z = bestSeg.pz + nz * walkableHalfW;
    }
    return clampedPos;
  }

  return targetPos;
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

  // Direction along bridge main span and normal vector in horizontal plane
  const vSpan = pEastTop.clone().sub(pWestTop);
  const spanLen = vSpan.length();
  const dirSpan = vSpan.clone().normalize();
  const yawSpan = Math.atan2(vSpan.z, vSpan.x);
  const normalSpan = new THREE.Vector3(-Math.sin(yawSpan), 0, Math.cos(yawSpan)).normalize();
  const pMidSpan = pWestTop.clone().lerp(pEastTop, 0.5);

  // --- 2. Dual White Parabolic Arches on Left & Right Flanks (两侧分开主拱，精确对称居中) ---
  // The dual white arch ribs flank the bridge symmetrically around pMidSpan along dirSpan:
  // Left arch is at +archOffset * normalSpan, Right arch is at -archOffset * normalSpan.
  // The green glass canopy is exactly at 0 * normalSpan, perfectly dead center between the dual arches!
  const archSegments = 40;
  const archRadius = 0.32;
  const secondaryRadius = 0.18;
  const archOffset = 2.45; // 2.45m on each side (bridge width is 3.8m, half-width 1.9m)
  const archHalfSpan = 22.0; // Arch foundation span along dirSpan from pMidSpan

  const archCenterWest = pMidSpan.clone().addScaledVector(dirSpan, -archHalfSpan);
  archCenterWest.y = 0.1;
  const archCenterEast = pMidSpan.clone().addScaledVector(dirSpan, archHalfSpan);
  archCenterEast.y = 0.1;

  const leftArchPoints = [];
  const rightArchPoints = [];

  for (const side of [-1, 1]) {
    const sideNorm = normalSpan.clone().multiplyScalar(side * archOffset);
    const footingWest = archCenterWest.clone().add(sideNorm);
    const footingEast = archCenterEast.clone().add(sideNorm);

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

    // Footing abutment blocks on the ground outside the walkway
    for (const foot of [footingWest, footingEast]) {
      addBox(foot.x, 0.45, foot.z, 1.4, 0.9, 1.4, whiteSteel);
      addBox(foot.x, 1.0, foot.z, 1.0, 0.3, 1.0, whiteSteel);
    }
  }

  // Overhead transverse portal tie braces connecting the left and right arches above the glass tube
  for (const tIdx of [12, 16, 20, 24, 28]) {
    const pL = leftArchPoints[tIdx];
    const pR = rightArchPoints[tIdx];
    if (pL && pR && pL.y > FOOTBRIDGE_META.deckHeight + 3.2) {
      addBeam(pL, pR, 0.12, whiteSteel);
      if (tIdx + 4 <= 28) {
        const nextL = leftArchPoints[tIdx + 4];
        const nextR = rightArchPoints[tIdx + 4];
        if (nextL && nextR) {
          addBeam(pL, nextR, 0.06, whiteSteel);
          addBeam(pR, nextL, 0.06, whiteSteel);
        }
      }
    }
  }

  // --- 3. Cylindrical Teal Glass Skywalk Canopies (跨街主跨与东西两侧楼梯全覆盖透光圆筒连廊) ---
  const tubeOuterRadius = 2.15;

  function buildSkywalkCanopy(pStartFloor, pEndFloor, options = {}) {
    const {
      isMainSpan = false,
      hasWestPortal = false,
      hasEastPortal = false,
      ringSpacing = 2.0,
    } = options;

    const pCenterA = new THREE.Vector3(pStartFloor.x, pStartFloor.y + 1.65, pStartFloor.z);
    const pCenterB = new THREE.Vector3(pEndFloor.x, pEndFloor.y + 1.65, pEndFloor.z);
    const v = pCenterB.clone().sub(pCenterA);
    const tubeLen = v.length();
    if (tubeLen < 0.001) return;
    const dir = v.clone().normalize();
    const mid = pCenterA.clone().lerp(pCenterB, 0.5);

    // 1. Teal Glass Cylinder Canopy
    const glassCylinder = new THREE.CylinderGeometry(
      tubeOuterRadius,
      tubeOuterRadius,
      tubeLen,
      32,
      1,
      true
    );
    const glassMesh = new THREE.Mesh(glassCylinder, tealGlass);
    glassMesh.position.copy(mid);
    glassMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    bridgeGroup.add(glassMesh);

    // 2. Circular structural white steel ring ribs spaced along tube
    const ringCount = Math.max(1, Math.round(tubeLen / ringSpacing));

    // Coordinate frame for rings and stringers
    let upRef = new THREE.Vector3(0, 1, 0);
    let rightVec = new THREE.Vector3().crossVectors(dir, upRef).normalize();
    if (rightVec.lengthSq() < 0.001) rightVec = new THREE.Vector3(1, 0, 0);
    let upVec = new THREE.Vector3().crossVectors(rightVec, dir).normalize();

    for (let i = 0; i <= ringCount; i++) {
      const t = i / ringCount;
      const ringPos = pCenterA.clone().lerp(pCenterB, t);

      // Torus ring around the cylinder
      const ringGeo = new THREE.TorusGeometry(tubeOuterRadius + 0.05, 0.075, 8, 32);
      const ringMesh = new THREE.Mesh(ringGeo, whiteSteel);
      ringMesh.position.copy(ringPos);
      ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      bridgeGroup.add(ringMesh);

      // For main span: suspension cables hanging from left and right arches down to ring hoops
      if (isMainSpan) {
        const dFromMid = -spanLen * 0.5 + t * spanLen;
        const tArch = (dFromMid + archHalfSpan) / (2 * archHalfSpan);
        const archIdx = Math.min(archSegments, Math.max(0, Math.round(tArch * archSegments)));
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
    }

    // 3. 4 Longitudinal white steel stringer rails along the glass tube
    for (const angle of [0, Math.PI, Math.PI * 0.5, -Math.PI * 0.5]) {
      const offset = rightVec.clone().multiplyScalar(Math.cos(angle))
        .addScaledVector(upVec, Math.sin(angle))
        .multiplyScalar(tubeOuterRadius + 0.04);
      const p1 = pCenterA.clone().add(offset);
      const p2 = pCenterB.clone().add(offset);
      addBeam(p1, p2, 0.08, whiteSteel);
    }

    // 4. Ground Entrance Portal Frames
    if (hasWestPortal) {
      const portalRing = new THREE.TorusGeometry(tubeOuterRadius + 0.12, 0.11, 10, 36);
      const pm = new THREE.Mesh(portalRing, whiteSteel);
      pm.position.copy(pCenterA);
      pm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      bridgeGroup.add(pm);

      const pLeftCol = pCenterA.clone().addScaledVector(rightVec, tubeOuterRadius + 0.05);
      const pRightCol = pCenterA.clone().addScaledVector(rightVec, -(tubeOuterRadius + 0.05));
      addBox(pLeftCol.x, pLeftCol.y * 0.5, pLeftCol.z, 0.35, pLeftCol.y, 0.35, whiteSteel);
      addBox(pRightCol.x, pRightCol.y * 0.5, pRightCol.z, 0.35, pRightCol.y, 0.35, whiteSteel);

      const pVisor = pCenterA.clone().addScaledVector(dir, -0.5);
      addBox(pVisor.x, pCenterA.y + tubeOuterRadius * 0.65, pVisor.z, 0.8, 0.25, tubeOuterRadius * 2.1, whiteSteel);
    }

    if (hasEastPortal) {
      const portalRing = new THREE.TorusGeometry(tubeOuterRadius + 0.12, 0.11, 10, 36);
      const pm = new THREE.Mesh(portalRing, whiteSteel);
      pm.position.copy(pCenterB);
      pm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      bridgeGroup.add(pm);

      const pLeftCol = pCenterB.clone().addScaledVector(rightVec, tubeOuterRadius + 0.05);
      const pRightCol = pCenterB.clone().addScaledVector(rightVec, -(tubeOuterRadius + 0.05));
      addBox(pLeftCol.x, pLeftCol.y * 0.5, pLeftCol.z, 0.35, pLeftCol.y, 0.35, whiteSteel);
      addBox(pRightCol.x, pRightCol.y * 0.5, pRightCol.z, 0.35, pRightCol.y, 0.35, whiteSteel);

      const pVisor = pCenterB.clone().addScaledVector(dir, 0.5);
      addBox(pVisor.x, pCenterB.y + tubeOuterRadius * 0.65, pVisor.z, 0.8, 0.25, tubeOuterRadius * 2.1, whiteSteel);
    }
  }

  // Build Skywalk Canopies for:
  // - West Approach Stairs (sloping up from campus ground to main span)
  buildSkywalkCanopy(pWestStart, pWestTop, { hasWestPortal: true });
  // - Main Span across Xuefu Avenue (horizontal covered span dead center between arches)
  buildSkywalkCanopy(pWestTop, pEastTop, { isMainSpan: true });
  // - East Approach Stairs (sloping down from main span to Sixth Canteen Plaza)
  buildSkywalkCanopy(pEastTop, pEastEnd, { hasEastPortal: true });

  // Structural transition knuckle collars at West and East junctions
  for (const knucklePt of [pWestTop, pEastTop]) {
    const pCenter = new THREE.Vector3(knucklePt.x, knucklePt.y + 1.65, knucklePt.z);
    const knuckleRing = new THREE.TorusGeometry(tubeOuterRadius + 0.10, 0.12, 10, 36);
    const km = new THREE.Mesh(knuckleRing, whiteSteel);
    km.position.copy(pCenter);
    km.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirSpan);
    bridgeGroup.add(km);

    addBox(pCenter.x, knucklePt.y * 0.5, pCenter.z, 0.35, knucklePt.y, 0.35, whiteSteel);
  }

  // --- 4. Main Walking Deck & Bridge Soffit across the Avenue ---
  const tubeMid = pMidSpan;
  const tubeSpanLen = spanLen;
  const ringCount = Math.max(1, Math.round(spanLen / 2.0));

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

  // Helper to build architectural outdoor pedestrian stairs (台阶踏步与休息平台)
  function buildStaircaseFlight(pStart, pEnd, options = {}) {
    const {
      stepCount = 20,
      midLandingRatio = 0.5,
      midLandingLen = 2.2,
      railOffset = FOOTBRIDGE_META.width * 0.5 - 0.14,
    } = options;

    const totalDx = pEnd.x - pStart.x;
    const totalDz = pEnd.z - pStart.z;
    const horizLen = Math.hypot(totalDx, totalDz);
    const vertH = pEnd.y - pStart.y;
    const yaw = Math.atan2(totalDz, totalDx);
    const pitch = Math.atan2(vertH, horizLen);

    const nx = -Math.sin(yaw);
    const nz = Math.cos(yaw);

    // Mid landing platform (休息缓冲平台)
    const midT = midLandingRatio;
    const pMid = pStart.clone().lerp(pEnd, midT);
    const midPlatformY = pMid.y;

    addBox(
      pMid.x,
      midPlatformY - 0.12,
      pMid.z,
      midLandingLen,
      0.24,
      FOOTBRIDGE_META.width,
      deckPaving,
      0,
      -yaw,
      0
    );

    // Support pier under mid landing
    if (midPlatformY > 0.8) {
      addBox(pMid.x, midPlatformY * 0.5 - 0.12, pMid.z, 0.8, midPlatformY, 2.6, whiteSteel);
    }

    // Two flights of stone steps
    const flight1Count = Math.floor(stepCount / 2);
    const flight2Count = stepCount - flight1Count;

    const midHalfLenT = (midLandingLen * 0.5) / horizLen;
    const flight1EndT = Math.max(0.05, midT - midHalfLenT);
    const flight2StartT = Math.min(0.95, midT + midHalfLenT);

    // Flight 1 (Lower flight steps)
    const stepDepth1 = (flight1EndT * horizLen) / flight1Count;
    for (let i = 0; i < flight1Count; i++) {
      const t = (i + 0.5) / flight1Count * flight1EndT;
      const pt = pStart.clone().lerp(pEnd, t);
      const stepY = pStart.y + (pMid.y - pStart.y) * ((i + 1) / flight1Count);
      addBox(
        pt.x,
        stepY - 0.11,
        pt.z,
        stepDepth1 * 1.08,
        0.22,
        FOOTBRIDGE_META.width,
        deckPaving,
        0,
        -yaw,
        0
      );
      const baseH = Math.max(0.1, stepY - pStart.y);
      if (baseH > 0.25) {
        addBox(
          pt.x,
          pStart.y + (baseH - 0.22) * 0.5,
          pt.z,
          stepDepth1 * 0.95,
          baseH - 0.22,
          FOOTBRIDGE_META.width - 0.08,
          deckUnderside,
          0,
          -yaw,
          0
        );
      }
    }

    // Flight 2 (Upper flight steps)
    const stepDepth2 = ((1.0 - flight2StartT) * horizLen) / flight2Count;
    for (let i = 0; i < flight2Count; i++) {
      const t = flight2StartT + (i + 0.5) / flight2Count * (1.0 - flight2StartT);
      const pt = pStart.clone().lerp(pEnd, t);
      const stepY = pMid.y + (pEnd.y - pMid.y) * ((i + 1) / flight2Count);
      addBox(
        pt.x,
        stepY - 0.11,
        pt.z,
        stepDepth2 * 1.08,
        0.22,
        FOOTBRIDGE_META.width,
        deckPaving,
        0,
        -yaw,
        0
      );
      const baseH = Math.max(0.1, stepY - pStart.y);
      if (baseH > 0.6) {
        addBox(
          pt.x,
          pStart.y + (baseH - 0.22) * 0.5,
          pt.z,
          stepDepth2 * 0.95,
          baseH - 0.22,
          FOOTBRIDGE_META.width - 0.08,
          deckUnderside,
          0,
          -yaw,
          0
        );
      }
    }

    // Side stringers and railings along stairs
    for (const side of [-1, 1]) {
      const offX = nx * railOffset * side;
      const offZ = nz * railOffset * side;

      // Lower stringer
      const mid1 = pStart.clone().lerp(pMid, 0.5);
      const len1 = horizLen * flight1EndT;
      addBox(
        mid1.x + offX,
        mid1.y + 0.1,
        mid1.z + offZ,
        len1,
        0.32,
        0.12,
        whiteSteel,
        0,
        -yaw,
        pitch
      );

      // Upper stringer
      const mid2 = pMid.clone().lerp(pEnd, 0.5);
      const len2 = horizLen * (1.0 - flight2StartT);
      addBox(
        mid2.x + offX,
        mid2.y + 0.1,
        mid2.z + offZ,
        len2,
        0.32,
        0.12,
        whiteSteel,
        0,
        -yaw,
        pitch
      );

      // Flight 1 Handrails
      addBox(
        mid1.x + offX,
        mid1.y + 1.05,
        mid1.z + offZ,
        len1,
        0.08,
        0.08,
        railingMetal,
        0,
        -yaw,
        pitch
      );
      addBox(
        mid1.x + offX,
        mid1.y + 0.55,
        mid1.z + offZ,
        len1,
        0.04,
        0.04,
        railingMetal,
        0,
        -yaw,
        pitch
      );

      // Mid platform Handrails
      addBox(
        pMid.x + offX,
        midPlatformY + 1.05,
        pMid.z + offZ,
        midLandingLen,
        0.08,
        0.08,
        railingMetal,
        0,
        -yaw,
        0
      );
      addBox(
        pMid.x + offX,
        midPlatformY + 0.55,
        pMid.z + offZ,
        midLandingLen,
        0.04,
        0.04,
        railingMetal,
        0,
        -yaw,
        0
      );

      // Flight 2 Handrails
      addBox(
        mid2.x + offX,
        mid2.y + 1.05,
        mid2.z + offZ,
        len2,
        0.08,
        0.08,
        railingMetal,
        0,
        -yaw,
        pitch
      );
      addBox(
        mid2.x + offX,
        mid2.y + 0.55,
        mid2.z + offZ,
        len2,
        0.04,
        0.04,
        railingMetal,
        0,
        -yaw,
        pitch
      );

      // Baluster vertical posts
      for (const t of [0.05, 0.25, flight1EndT, midT, flight2StartT, 0.75, 0.95]) {
        const pt = pStart.clone().lerp(pEnd, t);
        const stairY = t <= midT
          ? pStart.y + (pMid.y - pStart.y) * (t / midT)
          : pMid.y + (pEnd.y - pMid.y) * ((t - midT) / (1 - midT));
        addBox(
          pt.x + offX,
          stairY + 0.55,
          pt.z + offZ,
          0.06,
          1.1,
          0.06,
          railingMetal,
          0,
          -yaw,
          0
        );
      }
    }

    // Top threshold landing
    addBox(
      pEnd.x,
      pEnd.y - 0.12,
      pEnd.z,
      1.4,
      0.24,
      FOOTBRIDGE_META.width,
      deckPaving,
      0,
      -yaw,
      0
    );

    // Bottom entrance base step
    addBox(
      pStart.x,
      pStart.y + 0.05,
      pStart.z,
      1.4,
      0.12,
      FOOTBRIDGE_META.width + 0.4,
      stonePlaza,
      0,
      -yaw,
      0
    );
  }

  // --- 5. West Approach Stairs (主校区侧双段石阶与休息平台 —— 绝非斜坡) ---
  buildStaircaseFlight(pWestStart, pWestTop, {
    stepCount: 20,
    midLandingRatio: 0.5,
    midLandingLen: 2.2,
  });

  // --- 6. East Approach Stairs (第六食堂侧双段石阶与休息平台 —— 连通东苑广场) ---
  buildStaircaseFlight(pEastEnd, pEastTop, {
    stepCount: 20,
    midLandingRatio: 0.5,
    midLandingLen: 2.2,
  });

  // Sixth Canteen western plaza paving extension connecting ramp landing directly to canteen doors
  addBox(177, 0.08, 18.2, 13, 0.08, 16, stonePlaza, 0, 0, 0, false);

  // Landmark monument / campus pylon on the roadside (matching the white/gold stone pillar in the photo)
  // Located at roadside near east bridgehead: x = 158.5, z = 11.5 (well clear of the pedestrian ramp)
  addBox(158.5, 1.8, 11.5, 0.9, 3.6, 0.9, whiteSteel);
  addBox(158.5, 3.7, 11.5, 1.1, 0.25, 1.1, whiteSteel);
  addBox(158.5, 2.2, 11.02, 0.55, 1.6, 0.08, goldAccent);


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
