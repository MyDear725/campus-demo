// Horizontal angles stay continuous: never clamp or reset them at a full turn.
export function rotateLook(yaw, pitch, dx, dy) {
  return {
    yaw: yaw - (Number.isFinite(dx) ? dx : 0) * .0027,
    pitch: Math.max(-.65, Math.min(1.35, pitch + (Number.isFinite(dy) ? dy : 0) * .0024)),
  };
}

export function orbitOffset(yaw, pitch, distance) {
  return {x: Math.sin(yaw) * distance * Math.cos(pitch),
    y: Math.sin(pitch) * distance, z: Math.cos(yaw) * distance * Math.cos(pitch)};
}

export function smoothLook(yaw, pitch, targetYaw, targetPitch, dt) {
  // Smooth one shared heading for both body and camera, never two independent
  // rotations. Unwrapped yaw preserves the direction of fast, multi-turn input.
  const blend = -Math.expm1(-24 * Math.max(0, dt));
  return {yaw: yaw + (targetYaw - yaw) * blend,
    pitch: pitch + (targetPitch - pitch) * blend};
}

export function followDistance(current, limit, dt) {
  // Retract immediately to avoid walls; ease out after leaving an obstruction.
  return limit < current ? limit : current + (limit - current) * (1 - Math.exp(-dt * 10));
}

export function createMouseLook(canvas, {doc = document, win = window, isPlaying, onMove, onReleased, onState}) {
  let pending = false, held = false, generation = 0, timer;
  const locked = () => doc.pointerLockElement === canvas;
  const clearPending = () => {pending = false; clearTimeout(timer);};
  const state = value => onState(value);
  const fail = () => {clearPending(); if (isPlaying() && !locked()) state('denied');};
  function lock() {
    if (!isPlaying() || pending) return;
    if (locked()) {state('locked'); return;}
    if (!canvas.requestPointerLock) {fail(); return;}
    pending = true; const ticket = ++generation; state('pending');
    timer = setTimeout(() => {if (ticket === generation) fail();}, 3000);
    try {
      // Invoke synchronously inside the click/key gesture. Support both legacy
      // void-returning and Promise-returning implementations; change is authority.
      const request = canvas.requestPointerLock();
      request?.catch(() => {if (ticket === generation) fail();});
    } catch {fail();}
  }
  function unlock() {
    ++generation; clearPending(); held = false; state('unlocked');
    if (locked()) doc.exitPointerLock();
  }
  doc.addEventListener('pointerlockchange', () => {
    if (locked()) {
      clearPending();
      if (!isPlaying()) {unlock(); return;}
      held = true; state('locked');
    } else {
      const released = held; held = false;
      if (released) {clearPending(); state('unlocked'); if (isPlaying()) onReleased();}
    }
  });
  doc.addEventListener('pointerlockerror', fail);
  win.addEventListener('mousemove', event => {
    // Absolute cursor coordinates stop at window edges and must never be used
    // as a silent substitute for relative input in a 360-degree camera.
    if (isPlaying() && locked()) onMove(event.movementX, event.movementY);
  });
  canvas.addEventListener('click', lock);
  return {lock, unlock, locked};
}
