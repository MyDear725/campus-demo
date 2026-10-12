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
