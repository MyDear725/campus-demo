export const WALK_SPEED = 5.4;
export const RUN_SPEED = 10;
export function movementAction({ grounded, velocityY, speed, sprint, landing }) {
  if (!grounded) return velocityY > 0 ? 'Jump' : 'Fall';
  if (landing > 0) return 'Land';
  if (speed > .1) return sprint ? 'Run' : 'Walk';
  return 'Idle';
}
