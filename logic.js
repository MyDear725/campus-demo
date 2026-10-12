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
export const DEFAULT_PLAYER_NAME = '林风';
export const COLLEGES = [
  {
    id: 'dii',
    name: '国际信息与软件学院',
    shortName: '国软学院',
    description: '立足国际化软件工程视野，培养跨文化数字与信息创新人才。',
  },
  {
    id: 'se',
    name: '软件学院',
    shortName: '软件学院',
    description: '深耕软件架构、算法与智能系统工程，用代码构筑数字世界。',
  },
  {
    id: 'ic',
    name: '集成电路学院',
    shortName: '集电学院',
    description: '方寸芯片之间见天地，聚焦微纳电子与集成电路核心技术。',
  },
];
export const DEFAULT_COLLEGE_ID = 'se';
export const ENROLLMENT_YEAR = 2026;
export const GENDERS = [
  { id: 'male', label: '男生', shortLabel: '男' },
  { id: 'female', label: '女生', shortLabel: '女' },
];
export const DEFAULT_GENDER_ID = 'male';

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

export function findCollege(collegeOrId) {
  if (!collegeOrId || typeof collegeOrId !== 'string') return null;
  const trimmed = collegeOrId.trim();
  return COLLEGES.find(c => c.id === trimmed || c.name === trimmed || c.shortName === trimmed) || null;
}

export function findGender(genderOrId) {
  if (!genderOrId || typeof genderOrId !== 'string') return null;
  const trimmed = genderOrId.trim();
  return GENDERS.find(g => g.id === trimmed || g.label === trimmed || g.shortLabel === trimmed) || null;
}

export function sanitizePlayerName(name) {
  if (typeof name !== 'string') return DEFAULT_PLAYER_NAME;
  const cleaned = name.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 16);
  return cleaned || DEFAULT_PLAYER_NAME;
}

export function generateStudentId({ year = ENROLLMENT_YEAR, gradeOrder = 1, rng = Math.random } = {}) {
  const sample = () => { const v = rng(); return Number.isFinite(v) ? Math.max(0, Math.min(0.999999, v)) : 0; };
  const yearNum = Number.isFinite(Number(year)) ? Math.max(1000, Math.min(9999, Math.floor(Number(year)))) : ENROLLMENT_YEAR;
  const yearPrefix = String(yearNum).padStart(4, '0');
  const randomMiddle = String(Math.floor(sample() * 10000)).padStart(4, '0');
  const orderNum = Number.isFinite(Number(gradeOrder)) ? Math.max(1, Math.min(999, Math.floor(Number(gradeOrder)))) : 1;
  const orderSuffix = String(orderNum).padStart(3, '0');
  return `${yearPrefix}${randomMiddle}${orderSuffix}`;
}

export function parseStudentId(studentId) {
  if (typeof studentId !== 'string' || !/^\d{11}$/.test(studentId)) return null;
  const year = Number(studentId.slice(0, 4));
  const randomCode = studentId.slice(4, 8);
  const gradeOrder = Number(studentId.slice(8, 11));
  if (gradeOrder < 1 || gradeOrder > 999) return null;
  return {
    year,
    randomCode,
    gradeOrder,
    orderSuffix: studentId.slice(8, 11),
  };
}

export function assignDormitory(rng = Math.random) {
  const sample = () => { const v = rng(); return Number.isFinite(v) ? Math.max(0, Math.min(0.999999, v)) : 0; };
  const dorm = DORMITORIES[Math.floor(sample() * DORMITORIES.length)];
  const floor = 1 + Math.floor(sample() * 6);
  const num = 1 + Math.floor(sample() * 12);
  const room = `${floor}${String(num).padStart(2, '0')}寝室`;
  return { dormId: dorm.id, dormName: dorm.name, room };
}

export function freshLifeState(rng = Math.random, options = {}) {
  const assigned = assignDormitory(rng);
  const college = findCollege(DEFAULT_COLLEGE_ID) || COLLEGES[0];
  const gender = findGender(DEFAULT_GENDER_ID) || GENDERS[0];
  const gradeOrder = Number.isFinite(Number(options.gradeOrder)) ? Math.max(1, Math.min(999, Math.floor(Number(options.gradeOrder)))) : 1;
  const year = Number.isFinite(Number(options.year)) ? Math.floor(Number(options.year)) : ENROLLMENT_YEAR;
  const studentId = generateStudentId({ year, gradeOrder, rng });
  return {
    playerName: DEFAULT_PLAYER_NAME,
    genderId: gender.id,
    genderLabel: gender.label,
    studentId,
    gradeOrder,
    collegeId: college.id,
    collegeName: college.name,
    enrolled: false,
    prologueCompleted: false,
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
  const college = findCollege(value.collegeId) || findCollege(value.collegeName) || findCollege(DEFAULT_COLLEGE_ID) || COLLEGES[0];
  const gender = findGender(value.genderId) || findGender(value.genderLabel) || findGender(DEFAULT_GENDER_ID) || GENDERS[0];
  const playerName = sanitizePlayerName(value.playerName);
  const clampInt = (v, min, max, def) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Math.floor(Number(v)))) : def;
  const parsedId = parseStudentId(value.studentId);
  const gradeOrder = parsedId ? parsedId.gradeOrder : clampInt(value.gradeOrder, 1, 999, 1);
  const studentId = parsedId ? value.studentId : generateStudentId({ year: ENROLLMENT_YEAR, gradeOrder, rng });
  const enrolled = value.enrolled === true;
  const prologueCompleted = enrolled && value.prologueCompleted === true;
  const totalMinutes = Number.isFinite(value.totalMinutes)
    ? Math.max(0, Math.min(TOTAL_UNIVERSITY_MINUTES, value.totalMinutes))
    : INITIAL_GAME_MINUTES;
  const timeScale = VALID_TIME_SCALES.includes(Number(value.timeScale)) ? Number(value.timeScale) : DEFAULT_TIME_SCALE;
  return {
    playerName,
    genderId: gender.id,
    genderLabel: gender.label,
    studentId,
    gradeOrder,
    collegeId: college.id,
    collegeName: college.name,
    enrolled,
    prologueCompleted,
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

export function enrollStudent(lifeState, { playerName, genderId, genderLabel, collegeId, collegeName, gradeOrder, studentId, reassignDorm = false } = {}, rng = Math.random) {
  if (!lifeState || typeof lifeState !== 'object') return freshLifeState(rng);
  if (reassignDorm) {
    const assigned = assignDormitory(rng);
    lifeState.dormId = assigned.dormId;
    lifeState.dormName = assigned.dormName;
    lifeState.room = assigned.room;
  }
  const college = findCollege(collegeId) || findCollege(collegeName) || findCollege(lifeState.collegeId) || COLLEGES[0];
  const gender = findGender(genderId) || findGender(genderLabel) || findGender(lifeState.genderId) || GENDERS[0];
  const resolvedOrder = Number.isFinite(Number(gradeOrder))
    ? Math.max(1, Math.min(999, Math.floor(Number(gradeOrder))))
    : (Number.isFinite(Number(lifeState.gradeOrder)) ? Math.max(1, Math.min(999, Math.floor(Number(lifeState.gradeOrder)))) : 1);
  const parsed = parseStudentId(studentId);
  lifeState.playerName = sanitizePlayerName(playerName ?? lifeState.playerName);
  lifeState.genderId = gender.id;
  lifeState.genderLabel = gender.label;
  lifeState.gradeOrder = parsed ? parsed.gradeOrder : resolvedOrder;
  lifeState.studentId = parsed
    ? studentId
    : (parseStudentId(lifeState.studentId)?.gradeOrder === lifeState.gradeOrder
      ? lifeState.studentId
      : generateStudentId({ year: ENROLLMENT_YEAR, gradeOrder: lifeState.gradeOrder, rng }));
  lifeState.collegeId = college.id;
  lifeState.collegeName = college.name;
  lifeState.enrolled = true;
  lifeState.prologueCompleted = false;
  return lifeState;
}

export function buildPrologueScript(lifeState) {
  const name = sanitizePlayerName(lifeState?.playerName);
  const gender = findGender(lifeState?.genderId) || findGender(lifeState?.genderLabel) || GENDERS[0];
  const college = findCollege(lifeState?.collegeId) || findCollege(lifeState?.collegeName) || COLLEGES[0];
  const dorm = findDormitory(lifeState?.dormId) || DORMITORIES[0];
  const room = lifeState?.room || '301寝室';
  const studentId = lifeState?.studentId || '20260001001';
  const childCall = gender.id === 'female' ? '闺女' : '儿子';
  return {
    gateLines: [
      {
        speaker: '父亲',
        text: `${name}，慢点走，大件行李箱爸帮你拉着。你看，这就是大连理工大学开发区校区了——恭喜爸的好${childCall}正式成为「${college.name}」的大一新生！`,
      },
      {
        speaker: '母亲',
        text: `坐了一路车累坏了吧？妈刚看了迎新报到单，你的学号是「${studentId}」，随机分配的宿舍在东侧生活区「${dorm.name} · ${room}」。走，爸妈先送你去宿舍楼下安顿好！`,
      },
    ],
    dormLines: [
      {
        speaker: '母亲',
        text: `到了，这就是「${dorm.name}」！床铺和日用品妈都帮你收拾妥当了。在「${college.name}」读书虽然充实，但一定要按时作息、照顾好自己。`,
      },
      {
        speaker: '父亲',
        text: `大学四年一共 1440 天，从今天起，什么时间休息、怎样探索这座校园，都由你自己掌舵了。去吧，${name}，从「${dorm.name} · ${room}」开启你的大学生活，爸妈这就返程了！`,
      },
    ],
    spawnPosition: { x: dorm.x, z: dorm.z },
    dorm,
    college,
    gender,
  };
}

export function completePrologue(lifeState) {
  if (!lifeState || typeof lifeState !== 'object') return null;
  const dorm = findDormitory(lifeState.dormId) || DORMITORIES[0];
  lifeState.enrolled = true;
  lifeState.prologueCompleted = true;
  return {
    x: dorm.x,
    z: dorm.z,
    dormId: dorm.id,
    dormName: dorm.name,
    room: lifeState.room,
  };
}

export function freshSaveRegistry() {
  return {
    activeSaveId: null,
    nextGradeOrder: 1,
    saves: [],
  };
}

export function sanitizeSaveRegistry(raw, rng = Math.random) {
  if (!raw || typeof raw !== 'object') return freshSaveRegistry();
  const rawSaves = Array.isArray(raw.saves) ? raw.saves : [];
  const seenIds = new Set();
  let maxOrder = 0;
  const saves = [];
  for (let i = 0; i < rawSaves.length; i++) {
    const item = rawSaves[i];
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `save-${i + 1}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const life = sanitizeLifeState(item.life, rng);
    const progress = sanitizeProgress(item.progress);
    const dorm = findDormitory(life.dormId) || DORMITORIES[0];
    const px = Number.isFinite(item.position?.x) ? item.position.x : dorm.x;
    const pz = Number.isFinite(item.position?.z) ? item.position.z : dorm.z;
    maxOrder = Math.max(maxOrder, life.gradeOrder || 1);
    saves.push({
      id,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '2026-09-01',
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '2026-09-01',
      life,
      progress,
      position: { x: px, z: pz },
    });
  }
  const nextGradeOrder = Math.max(
    maxOrder + 1,
    Number.isFinite(Number(raw.nextGradeOrder)) ? Math.max(1, Math.min(999, Math.floor(Number(raw.nextGradeOrder)))) : 1
  );
  const activeSaveId = saves.some(s => s.id === raw.activeSaveId)
    ? raw.activeSaveId
    : (saves[0]?.id || null);
  return {
    activeSaveId,
    nextGradeOrder: Math.min(999, nextGradeOrder),
    saves,
  };
}

export function getSaveSlot(registry, saveId = registry?.activeSaveId) {
  if (!registry || !Array.isArray(registry.saves) || !saveId) return null;
  return registry.saves.find(s => s.id === saveId) || null;
}

export function createSaveSlot(registry, { id, life, progress, position } = {}, rng = Math.random) {
  if (!registry || typeof registry !== 'object') return null;
  if (!Array.isArray(registry.saves)) registry.saves = [];
  const gradeOrder = Math.max(1, Math.min(999, Number(life?.gradeOrder) || Number(registry.nextGradeOrder) || (registry.saves.length + 1)));
  const sanitizedLife = sanitizeLifeState({ ...life, gradeOrder }, rng);
  if (parseStudentId(sanitizedLife.studentId)?.gradeOrder !== gradeOrder) {
    sanitizedLife.gradeOrder = gradeOrder;
    sanitizedLife.studentId = generateStudentId({ year: ENROLLMENT_YEAR, gradeOrder, rng });
  }
  const sanitizedProg = sanitizeProgress(progress);
  const dorm = findDormitory(sanitizedLife.dormId) || DORMITORIES[0];
  const pos = {
    x: Number.isFinite(position?.x) ? position.x : dorm.x,
    z: Number.isFinite(position?.z) ? position.z : dorm.z,
  };
  let slotId = typeof id === 'string' && id.trim() ? id.trim() : `save-${Date.now()}-${registry.saves.length + 1}`;
  while (registry.saves.some(s => s.id === slotId)) {
    slotId = `${slotId}-${Math.floor(rng() * 1000)}`;
  }
  const nowStr = new Date().toISOString();
  const slot = {
    id: slotId,
    createdAt: nowStr,
    updatedAt: nowStr,
    life: sanitizedLife,
    progress: sanitizedProg,
    position: pos,
  };
  registry.saves.unshift(slot);
  registry.activeSaveId = slot.id;
  registry.nextGradeOrder = Math.min(999, Math.max(Number(registry.nextGradeOrder) || 1, gradeOrder + 1));
  return slot;
}

export function updateSaveSlot(registry, saveId, { life, progress, position } = {}, rng = Math.random) {
  const slot = getSaveSlot(registry, saveId);
  if (!slot) return null;
  if (life) slot.life = sanitizeLifeState(life, rng);
  if (progress) slot.progress = sanitizeProgress(progress);
  if (position && Number.isFinite(position.x) && Number.isFinite(position.z)) {
    slot.position = { x: position.x, z: position.z };
  }
  slot.updatedAt = new Date().toISOString();
  return slot;
}

export function deleteSaveSlot(registry, saveId) {
  if (!registry || !Array.isArray(registry.saves) || !saveId) return false;
  const idx = registry.saves.findIndex(s => s.id === saveId);
  if (idx < 0) return false;
  registry.saves.splice(idx, 1);
  if (registry.activeSaveId === saveId) {
    registry.activeSaveId = registry.saves[0]?.id || null;
  }
  return true;
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
