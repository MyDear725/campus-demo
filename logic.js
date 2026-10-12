import { MAP_BOUNDS, CAMPUS_START, nearPolygon } from './campus-layout.js';
export const WORLD_LIMIT = MAP_BOUNDS.maxX;
export const START = CAMPUS_START;
export const MEMORY_IDS = ['knowledge', 'encounter', 'passion'];
export function collides(x, z, obstacles, radius = 0.43) {
  if (x<MAP_BOUNDS.minX+radius||x>MAP_BOUNDS.maxX-radius||z<MAP_BOUNDS.minZ+radius||z>MAP_BOUNDS.maxZ-radius) return true;
  return obstacles.some(o => {
    if(o.points)return nearPolygon(x,z,o.points,radius);
    const cx = Math.max(o.minX, Math.min(x, o.maxX));
    const cz = Math.max(o.minZ, Math.min(z, o.maxZ));
    return (x - cx) ** 2 + (z - cz) ** 2 < radius ** 2;
  });
}
export function moveWithCollision(position, dx, dz, obstacles) {
  let { x, z } = position;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  for (let i = 0; i < steps; i++) {
    if (!collides(x + dx / steps, z, obstacles)) x += dx / steps;
    if (!collides(x, z + dz / steps, obstacles)) z += dz / steps;
  }
  return { x, z };
}
export function freshProgress() { return { started: false, collected: [], completed: false }; }
export function sanitizeProgress(value) {
  if (!value || typeof value !== 'object') return freshProgress();
  const collected = [...new Set(Array.isArray(value.collected) ? value.collected.filter(x => MEMORY_IDS.includes(x)) : [])];
  const started = value.started === true;
  return { started, collected: started ? collected : [], completed: started && collected.length === 3 && value.completed === true };
}
export function collectMemory(progress, id) {
  if (!progress.started || !MEMORY_IDS.includes(id) || progress.collected.includes(id)) return false;
  progress.collected.push(id); return true;
}
export function finishQuest(progress) {
  if (!progress.started || !MEMORY_IDS.every(id => progress.collected.includes(id))) return false;
  progress.completed = true; return true;
}
