import { MAP_BOUNDS, CAMPUS_START, DORMITORIES, nearPolygon } from './campus-layout.js';
export { DORMITORIES };
export const WORLD_LIMIT = MAP_BOUNDS.maxX;
export const START = CAMPUS_START;
export const MEMORY_IDS = ['knowledge', 'encounter', 'passion'];
export const MINUTES_PER_DAY = 1440;
export const DAYS_PER_YEAR = 360;
export const TOTAL_UNIVERSITY_YEARS = 4;
export const TOTAL_UNIVERSITY_DAYS = DAYS_PER_YEAR * TOTAL_UNIVERSITY_YEARS;
export const TOTAL_UNIVERSITY_MINUTES = TOTAL_UNIVERSITY_DAYS * MINUTES_PER_DAY;
export const INITIAL_GAME_MINUTES = 8 * 60;
export const DEFAULT_TIME_SCALE = 60;
export const VALID_TIME_SCALES = [1, 30, 60, 180, 360];

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

export function findDormitory(dormId) {
  return DORMITORIES.find(d => d.id === dormId) || null;
}

export function assignDormitory(rng = Math.random) {
  const sample = () => { const v = rng(); return Number.isFinite(v) ? Math.max(0, Math.min(0.999999, v)) : 0; };
  const dorm = DORMITORIES[Math.floor(sample() * DORMITORIES.length)];
  const floor = 1 + Math.floor(sample() * 6);
  const num = 1 + Math.floor(sample() * 12);
  const room = `${floor}${String(num).padStart(2, '0')}寝室`;
  return { dormId: dorm.id, dormName: dorm.name, room };
}

export function freshLifeState(rng = Math.random) {
  const assigned = assignDormitory(rng);
  return {
    totalMinutes: INITIAL_GAME_MINUTES,
    timeScale: DEFAULT_TIME_SCALE,
    dormId: assigned.dormId,
    dormName: assigned.dormName,
    room: assigned.room,
    sleepHour: 23,
    sleepMinute: 0,
    wakeHour: 7,
    wakeMinute: 30,
    sleepCount: 0,
  };
}

export function sanitizeLifeState(value, rng = Math.random) {
  const fallback = freshLifeState(rng);
  if (!value || typeof value !== 'object') return fallback;
  const dorm = findDormitory(value.dormId) || findDormitory(fallback.dormId);
  const room = typeof value.room === 'string' && /^\d{3}寝室$/.test(value.room) ? value.room : fallback.room;
  const totalMinutes = Number.isFinite(value.totalMinutes)
    ? Math.max(0, Math.min(TOTAL_UNIVERSITY_MINUTES, value.totalMinutes))
    : INITIAL_GAME_MINUTES;
  const timeScale = VALID_TIME_SCALES.includes(Number(value.timeScale)) ? Number(value.timeScale) : DEFAULT_TIME_SCALE;
  const clampInt = (v, min, max, def) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Math.floor(Number(v)))) : def;
  return {
    totalMinutes,
    timeScale,
    dormId: dorm.id,
    dormName: dorm.name,
    room,
    sleepHour: clampInt(value.sleepHour, 0, 23, 23),
    sleepMinute: clampInt(value.sleepMinute, 0, 59, 0),
    wakeHour: clampInt(value.wakeHour, 0, 23, 7),
    wakeMinute: clampInt(value.wakeMinute, 0, 59, 30),
    sleepCount: clampInt(value.sleepCount, 0, 10000, 0),
  };
}

export function advanceGameTime(lifeState, realDeltaSeconds) {
  if (!lifeState || !Number.isFinite(realDeltaSeconds) || realDeltaSeconds <= 0) return lifeState?.totalMinutes ?? INITIAL_GAME_MINUTES;
  const scale = VALID_TIME_SCALES.includes(Number(lifeState.timeScale)) ? Number(lifeState.timeScale) : DEFAULT_TIME_SCALE;
  const addedMinutes = realDeltaSeconds * (scale / 60);
  lifeState.totalMinutes = Math.min(TOTAL_UNIVERSITY_MINUTES, lifeState.totalMinutes + addedMinutes);
  return lifeState.totalMinutes;
}

export function formatGameClock(totalMinutes = INITIAL_GAME_MINUTES) {
  const clamped = Math.max(0, Math.min(TOTAL_UNIVERSITY_MINUTES, Number.isFinite(totalMinutes) ? totalMinutes : INITIAL_GAME_MINUTES));
  const rawDays = Math.floor(clamped / MINUTES_PER_DAY);
  const effectiveDay = Math.min(TOTAL_UNIVERSITY_DAYS - 1, rawDays);
  const yearIndex = Math.floor(effectiveDay / DAYS_PER_YEAR);
  const yearName = ['大一', '大二', '大三', '大四'][yearIndex];
  const dayOfYear = effectiveDay % DAYS_PER_YEAR;
  const monthOffset = Math.floor(dayOfYear / 30);
  const month = ((8 + monthOffset) % 12) + 1;
  const dayOfMonth = (dayOfYear % 30) + 1;
  const season = ['秋', '冬', '春', '夏'][Math.floor(monthOffset / 3)];
  const weekday = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][effectiveDay % 7];
  const minuteOfDay = Math.floor(clamped % MINUTES_PER_DAY);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const timeText = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const period = hour < 5 ? '深夜' : hour < 8 ? '清晨' : hour < 11 ? '上午' : hour < 14 ? '正午' : hour < 17 ? '下午' : hour < 19 ? '傍晚' : '夜晚';
  const graduated = clamped >= TOTAL_UNIVERSITY_MINUTES;
  return {
    yearIndex,
    yearName,
    month,
    dayOfMonth,
    season,
    weekday,
    hour,
    minute,
    timeText,
    period,
    totalDays: effectiveDay + 1,
    maxDays: TOTAL_UNIVERSITY_DAYS,
    graduated,
    summary: `${yearName} · ${month}月${dayOfMonth}日 ${weekday} ${timeText}`,
    shortSummary: `${yearName} · ${season} · ${timeText} (${period})`,
  };
}

export function planSleepSchedule(totalMinutes, { sleepNow = true, sleepHour = 23, sleepMinute = 0, wakeHour = 7, wakeMinute = 30 } = {}) {
  const currentMin = Math.floor(Math.max(0, totalMinutes)) % MINUTES_PER_DAY;
  const sH = Math.max(0, Math.min(23, Math.floor(Number(sleepHour) || 0)));
  const sM = Math.max(0, Math.min(59, Math.floor(Number(sleepMinute) || 0)));
  const wH = Math.max(0, Math.min(23, Math.floor(Number(wakeHour) || 0)));
  const wM = Math.max(0, Math.min(59, Math.floor(Number(wakeMinute) || 0)));

  const targetSleepMin = sH * 60 + sM;
  const waitMinutes = sleepNow ? 0 : (targetSleepMin - currentMin + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const sleepStartMin = sleepNow ? currentMin : targetSleepMin;
  const targetWakeMin = wH * 60 + wM;

  let sleepMinutes = (targetWakeMin - sleepStartMin + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (sleepMinutes < 30) sleepMinutes += MINUTES_PER_DAY;

  const totalAdvanceMinutes = waitMinutes + sleepMinutes;
  const nextTotalMinutes = Math.min(TOTAL_UNIVERSITY_MINUTES, Math.floor(Math.max(0, totalMinutes)) + totalAdvanceMinutes);
  return {
    waitMinutes,
    sleepMinutes,
    totalAdvanceMinutes,
    sleepHoursText: `${Math.floor(sleepMinutes / 60)}小时${sleepMinutes % 60 ? ` ${sleepMinutes % 60}分钟` : ''}`,
    wakeClock: formatGameClock(nextTotalMinutes),
  };
}

export function executeSleep(lifeState, options = {}) {
  const plan = planSleepSchedule(lifeState.totalMinutes, {
    sleepNow: options.sleepNow !== false,
    sleepHour: options.sleepHour ?? lifeState.sleepHour,
    sleepMinute: options.sleepMinute ?? lifeState.sleepMinute,
    wakeHour: options.wakeHour ?? lifeState.wakeHour,
    wakeMinute: options.wakeMinute ?? lifeState.wakeMinute,
  });
  if (Number.isFinite(Number(options.sleepHour))) lifeState.sleepHour = Math.max(0, Math.min(23, Math.floor(Number(options.sleepHour))));
  if (Number.isFinite(Number(options.sleepMinute))) lifeState.sleepMinute = Math.max(0, Math.min(59, Math.floor(Number(options.sleepMinute))));
  if (Number.isFinite(Number(options.wakeHour))) lifeState.wakeHour = Math.max(0, Math.min(23, Math.floor(Number(options.wakeHour))));
  if (Number.isFinite(Number(options.wakeMinute))) lifeState.wakeMinute = Math.max(0, Math.min(59, Math.floor(Number(options.wakeMinute))));
  lifeState.totalMinutes = Math.min(TOTAL_UNIVERSITY_MINUTES, Math.floor(lifeState.totalMinutes) + plan.totalAdvanceMinutes);
  lifeState.sleepCount = (lifeState.sleepCount || 0) + 1;
  return plan;
}

export function daylightProfile(totalMinutes = INITIAL_GAME_MINUTES) {
  const minuteOfDay = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = minuteOfDay / 60;
  // Angle where 6:00 is sunrise (0), 12:00 is noon (pi/2), 18:00 is sunset (pi), 0:00 is midnight (-pi/2)
  const phase = ((hour - 6) / 24) * Math.PI * 2;
  const elevation = Math.sin(phase);
  const azimuth = Math.cos(phase);
  const daylight = Math.max(0, Math.min(1, (elevation + 0.12) / 0.65));
  const sunY = Math.max(12, 40 + Math.max(-0.15, elevation) * 320);
  const sunX = -azimuth * 220;
  const sunZ = 160 + Math.sin(phase * 0.5) * 40;
  return {
    hour,
    daylight,
    isNight: daylight < 0.22,
    sunOffset: { x: sunX, y: sunY, z: sunZ },
    sunIntensity: +(0.25 + daylight * 2.55).toFixed(3),
    hemiIntensity: +(0.36 + daylight * 0.84).toFixed(3),
    exposure: +(0.68 + daylight * 0.37).toFixed(3),
    fogColor: daylight > 0.5 ? '#c3d3d9' : daylight > 0.2 ? '#8f9fb5' : '#1b2b38',
  };
}
