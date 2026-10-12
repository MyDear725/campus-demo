export const WALK_SPEED = 5.4;
export const RUN_SPEED = 10;
export const SPRINT_RECOVERY = 25;

// Hysteresis keeps an empty meter from alternating walk/run every frame.
export function updateEnergy(value, exhausted, wantsSprint, dt) {
  if (value <= 0) exhausted = true;
  if (exhausted && value >= SPRINT_RECOVERY) exhausted = false;
  const sprint = wantsSprint && !exhausted;
  value = Math.max(0, Math.min(100, value + (sprint ? -21 : 14) * dt));
  if (value === 0) exhausted = true;
  return { value, exhausted, sprint: sprint && !exhausted };
}

export function movementAction({ grounded, velocityY, speed, sprint, exhausted, landing }) {
  if (!grounded) return velocityY > 0 ? 'Jump' : 'Fall';
  if (landing > 0) return 'Land';
  if (speed > .1) return sprint ? 'Run' : 'Walk';
  return exhausted ? 'Tired' : 'Idle';
}

const KEY_FALLBACKS = {
  w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD',
  e: 'KeyE', h: 'KeyH', m: 'KeyM', r: 'KeyR',
  ' ': 'Space', spacebar: 'Space',
  enter: 'Enter', escape: 'Escape', esc: 'Escape',
  shift: 'ShiftLeft',
  arrowup: 'ArrowUp', arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
};

const KEYCODE_FALLBACKS = {
  87: 'KeyW', 65: 'KeyA', 83: 'KeyS', 68: 'KeyD',
  69: 'KeyE', 72: 'KeyH', 77: 'KeyM', 82: 'KeyR',
  32: 'Space', 13: 'Enter', 27: 'Escape', 16: 'ShiftLeft',
  38: 'ArrowUp', 40: 'ArrowDown', 37: 'ArrowLeft', 39: 'ArrowRight',
};

export function resolveKeyCode(event = {}) {
  if (typeof event.code === 'string' && event.code && event.code !== 'Unidentified') {
    return event.code;
  }
  if (typeof event.key === 'string' && event.key) {
    const mapped = KEY_FALLBACKS[event.key.toLowerCase()];
    if (mapped) return mapped;
  }
  const kc = typeof event.keyCode === 'number' ? event.keyCode : event.which;
  if (typeof kc === 'number' && KEYCODE_FALLBACKS[kc]) {
    return KEYCODE_FALLBACKS[kc];
  }
  return '';
}
