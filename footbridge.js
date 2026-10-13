import * as THREE from 'three';

export const FOOTBRIDGE_META = {
  id: 'footbridge-xuefu',
  name: '学府大街跨街天桥',
  description: '连接教学区核心与第六学生食堂、生活区的标志性白色拱形透光圆筒人行天桥',
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

  // If the player is already elevated or entering through the ramp endpoints, they are on the bridge
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

  // Direction unit vector along bridge
  const dirSpan = pEastTop.clone().sub(pWestTop).normalize();
  const angleSpan = Math.atan2(dirSpan.x, dirSpan.z);
  const yawSpan = Math.atan2(pEastTop.z - pWestTop.z, pEastTop.x - pWestTop.x);

  // --- 2. Soaring White Parabolic Arch Structure (白色大跨度主拱) ---
  const archWestFooting = new THREE.Vector3(123, 0.2, 9.8);
  const archEastFooting = new THREE.Vector3(164.5, 0.2, 18.6);
  const archSpan = archWestFooting.distanceTo(archEastFooting);
  const archSegments = 36;
  const archRadius = 0.38;
  const secondaryRadius = 0.22;

  const archPoints = [];
  const archSecondaryPoints = [];

  for (let i = 0; i <= archSegments; i++) {
    const t = i / archSegments;
    const p = archWestFooting.clone().lerp(archEastFooting, t);
    // Parabolic arc equation: peak at t = 0.5
    const archY = 0.2 + FOOTBRIDGE_META.archHeight * (4 * t * (1 - t));
    p.y = archY;
    archPoints.push(p);

    // Inner secondary parallel arch chord
    const innerP = p.clone();
    innerP.y = Math.max(0.5, archY - 0.75);
    archSecondaryPoints.push(innerP);
  }

  // Main tubular arch beams & truss cross lacing
  for (let i = 0; i < archSegments; i++) {
    const pA = archPoints[i];
    const pB = archPoints[i + 1];
    addBeam(pA, pB, archRadius, whiteSteel);

    const pInnerA = archSecondaryPoints[i];
    const pInnerB = archSecondaryPoints[i + 1];
    addBeam(pInnerA, pInnerB, secondaryRadius, whiteSteel);

    // Cross truss webbing
    addBeam(pA, pInnerB, 0.09, whiteSteel);
    addBeam(pInnerA, pB, 0.09, whiteSteel);
    addBeam(pA, pInnerA, 0.12, whiteSteel);
  }

  // Footing abutment blocks at arch bases
  for (const foot of [archWestFooting, archEastFooting]) {
    addBox(foot.x, 0.8, foot.z, 2.2, 1.6, 2.2, whiteSteel);
    addBox(foot.x, 1.7, foot.z, 1.6, 0.6, 1.6, whiteSteel);
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
  // Cylinder default is along Y; rotate to lie along the bridge axis (yawSpan)
  glassCylinder.rotateZ(Math.PI / 2);
  glassCylinder.rotateY(-yawSpan);

  const glassMesh = addMesh(glassCylinder, tealGlass, tubeMid.x, tubeMid.y, tubeMid.z, 0, 0, 0, false);

  // Circular structural white steel ring ribs spaced every 2.0 meters along the tube
  const ringCount = Math.floor(tubeSpanLen / 2.0);
  const ringStep = tubeSpanLen / ringCount;

  for (let i = 0; i <= ringCount; i++) {
    const t = i / ringCount;
    const ringPos = pWestTop.clone().lerp(pEastTop, t);
    ringPos.y = tubeCenterY;

    // Torus ring around the cylinder
    const ringGeo = new THREE.TorusGeometry(tubeOuterRadius + 0.05, 0.075, 8, 32);
    ringGeo.rotateY(Math.PI / 2 - yawSpan);
    addMesh(ringGeo, whiteSteel, ringPos.x, ringPos.y, ringPos.z);

    // Vertical suspension cable from arch down to this ring rib
    // Find closest arch point
    const archIdx = Math.min(archSegments, Math.max(0, Math.round(t * (archSegments - 8) + 4)));
    const archPt = archPoints[archIdx];
    if (archPt && archPt.y > ringPos.y + tubeOuterRadius) {
      const topOfRing = ringPos.clone();
      topOfRing.y += tubeOuterRadius;
      addBeam(topOfRing, archPt, 0.045, cableMetal);
    }
  }

  // 4 Longitudinal white steel stringer rails along the glass tube
  for (const [angleOffset, rOff] of [
    [0, 1], // top ridge
    [Math.PI, 1], // bottom keel
    [Math.PI * 0.5, 1], // left waist
    [-Math.PI * 0.5, 1], // right waist
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
  // Deck floor: 3.8m wide, 0.25m thick
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

  // --- 5. West Approach Ramp (主校区侧缓坡引桥) ---
  const westRampLen = pWestStart.distanceTo(pWestTop);
  const westRampMid = pWestStart.clone().lerp(pWestTop, 0.5);
  const westRampYaw = Math.atan2(pWestTop.z - pWestStart.z, pWestTop.x - pWestStart.x);
  const westRampPitch = Math.atan2(pWestTop.y - pWestStart.y, Math.hypot(pWestTop.x - pWestStart.x, pWestTop.z - pWestStart.z));

  // Sloping deck
  const westRampMesh = addBox(
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

  // Support piers under west ramp
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

  // Support piers under east ramp
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
  // Sixth Canteen center is around x=188, z=10. Plaza covers x in [170, 185], z in [6, 26]
  addBox(177, 0.08, 18.2, 13, 0.08, 16, stonePlaza, 0, 0, 0, false);

  // Landmark monument / campus pylon on the roadside (matching the white/gold stone pillar in the photo)
  // Located at roadside near east bridgehead: x = 158.5, z = 12.5
  addBox(158.5, 1.8, 11.5, 0.9, 3.6, 0.9, whiteSteel);
  addBox(158.5, 3.7, 11.5, 1.1, 0.25, 1.1, whiteSteel);
  addBox(158.5, 2.2, 11.02, 0.55, 1.6, 0.08, goldAccent); // inscription plaque

  // Central median reservation greenery under the bridge along Xuefu Ave
  // Xuefu Ave runs through x=143, z=16. Median strip at x=143.5, z in [-5, 35]
  addBox(143.5, 0.2, 16, 1.4, 0.25, 28, new THREE.MeshStandardMaterial({ color: '#557a55', roughness: 0.9 }));
  // Median curbs
  addBox(142.75, 0.25, 16, 0.14, 0.35, 28, whiteSteel);
  addBox(144.25, 0.25, 16, 0.14, 0.35, 28, whiteSteel);

  // Add decorative trees/shrubs along the bridge approach plazas
  // (Left and right of west ramp landing)
  for (const [tx, tz] of [
    [114, 13],
    [115, 2],
    [169, 9],
    [172, 28],
  ]) {
    addBox(tx, 0.25, tz, 2.2, 0.3, 2.2, whiteSteel);
    addBox(tx, 0.45, tz, 1.9, 0.2, 1.9, new THREE.MeshStandardMaterial({ color: '#4a6f44', roughness: 0.9 }));
  }

  // --- 7. Colliders ---
  // Keep pedestrian path through the bridge completely open for all walking routes

  world.add(bridgeGroup);
  return { bridgeGroup, meta: FOOTBRIDGE_META };
}
