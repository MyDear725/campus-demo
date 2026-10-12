import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collides, moveWithCollision, freshProgress, sanitizeProgress, collectMemory, finishQuest, MEMORY_IDS,
  MINUTES_PER_DAY, DAYS_PER_YEAR, TOTAL_UNIVERSITY_MINUTES, INITIAL_GAME_MINUTES,
  COLLEGES, DEFAULT_PLAYER_NAME, findCollege, sanitizePlayerName,
  findDormitory, assignDormitory, freshLifeState, sanitizeLifeState,
  enrollStudent, buildPrologueScript, completePrologue,
  advanceGameTime, formatGameClock, planSleepSchedule, executeSleep, daylightProfile
} from '../logic.js';
import { DORMITORIES } from '../campus-layout.js';
const wall=[{minX:2,maxX:3,minZ:-10,maxZ:10}];
test('fast movement cannot tunnel through buildings',()=>{const p=moveWithCollision({x:0,z:0},20,0,wall);assert.ok(p.x<1.58);assert.ok(p.x>1.3);});
test('diagonal movement slides along walls',()=>{const p=moveWithCollision({x:1.5,z:0},2,4,wall);assert.ok(p.x<1.58);assert.ok(p.z>3.9);});
test('campus boundary keeps player inside',()=>{const p=moveWithCollision({x:309,z:0},10,0,[]);assert.ok(p.x<=309.57);assert.equal(collides(311,0,[]),true);});
test('quest requires acceptance, unique memories, then delivery',()=>{const p=freshProgress();assert.equal(collectMemory(p,'knowledge'),false);assert.equal(finishQuest(p),false);p.started=true;assert.equal(collectMemory(p,'knowledge'),true);assert.equal(collectMemory(p,'knowledge'),false);assert.equal(collectMemory(p,'invalid'),false);assert.equal(finishQuest(p),false);MEMORY_IDS.forEach(id=>collectMemory(p,id));assert.equal(finishQuest(p),true);assert.equal(p.completed,true);assert.equal(p.collected.length,3);});
test('corrupt and inconsistent saves cannot skip quest',()=>{assert.deepEqual(sanitizeProgress(null),freshProgress());assert.deepEqual(sanitizeProgress({started:false,collected:MEMORY_IDS,completed:true}),freshProgress());assert.deepEqual(sanitizeProgress({started:true,collected:['knowledge','knowledge','wrong'],completed:true}),{started:true,collected:['knowledge'],completed:false});});
test('enrollment randomly assigns one of the 6 campus dormitories and sanitizes saved life state',()=>{
  assert.equal(DORMITORIES.length,6);
  for(let i=0;i<DORMITORIES.length;i++){
    const assigned=assignDormitory(()=>i/DORMITORIES.length);
    assert.equal(assigned.dormId,DORMITORIES[i].id);
    assert.equal(findDormitory(assigned.dormId).name,DORMITORIES[i].name);
    assert.match(assigned.room,/^\d{3}寝室$/);
  }
  const life=freshLifeState(()=>0.99);
  assert.equal(life.dormId,'dorm-6');
  assert.equal(life.totalMinutes,INITIAL_GAME_MINUTES);
  const sanitized=sanitizeLifeState({dormId:'invalid-dorm',totalMinutes:-50,timeScale:999,sleepHour:25,wakeHour:-3},()=>0);
  assert.equal(sanitized.dormId,'dorm-1');
  assert.equal(sanitized.totalMinutes,0);
  assert.equal(sanitized.timeScale,60);
  assert.equal(sanitized.sleepHour,23);
  assert.equal(sanitized.wakeHour,0);
});
test('character creation supports student name and the three colleges, and parent prologue spawns at assigned dormitory',()=>{
  assert.deepEqual(COLLEGES.map(c=>c.name),['国际信息与软件学院','软件学院','集成电路学院']);
  assert.equal(sanitizePlayerName('   '),DEFAULT_PLAYER_NAME);
  assert.equal(sanitizePlayerName('  苏晴\n '), '苏晴');
  for(const expectedName of ['国际信息与软件学院','软件学院','集成电路学院']){
    const college=findCollege(expectedName);
    assert.ok(college);
    assert.equal(college.name,expectedName);
  }
  const life=freshLifeState(()=>0.4); // dorm-3
  assert.equal(life.enrolled,false);
  assert.equal(life.prologueCompleted,false);
  enrollStudent(life,{playerName:'沈知夏',collegeName:'集成电路学院'});
  assert.equal(life.playerName,'沈知夏');
  assert.equal(life.collegeId,'ic');
  assert.equal(life.collegeName,'集成电路学院');
  assert.equal(life.enrolled,true);
  assert.equal(life.prologueCompleted,false);
  const script=buildPrologueScript(life);
  assert.equal(script.gateLines.length,2);
  assert.equal(script.dormLines.length,2);
  assert.ok(script.gateLines[0].text.includes('沈知夏')&&script.gateLines[0].text.includes('集成电路学院'));
  assert.ok(script.gateLines[1].text.includes(life.dormName)&&script.gateLines[1].text.includes(life.room));
  assert.ok(script.dormLines[0].text.includes(life.dormName)&&script.dormLines[1].text.includes('沈知夏'));
  const startSpot=completePrologue(life);
  assert.equal(life.prologueCompleted,true);
  const assignedDorm=findDormitory(life.dormId);
  assert.equal(startSpot.x,assignedDorm.x);
  assert.equal(startSpot.z,assignedDorm.z);
});
test('4-year university time converts real seconds by ratio and formats year, season, day, and clock',()=>{
  const life=freshLifeState(()=>0);
  life.timeScale=180; // 1s real = 3m game (180x)
  const startClock=formatGameClock(life.totalMinutes);
  assert.equal(startClock.yearName,'大一');
  assert.equal(startClock.season,'秋');
  assert.equal(startClock.totalDays,1);
  assert.equal(startClock.timeText,'08:00');
  advanceGameTime(life,20); // 20s * (180/60) = +60 game minutes -> 09:00
  assert.equal(formatGameClock(life.totalMinutes).timeText,'09:00');
  // Jump to Year 4 final day and verify graduation cap
  life.totalMinutes=TOTAL_UNIVERSITY_MINUTES-30;
  advanceGameTime(life,40); // +120 game minutes -> capped at TOTAL_UNIVERSITY_MINUTES
  assert.equal(life.totalMinutes,TOTAL_UNIVERSITY_MINUTES);
  const gradClock=formatGameClock(life.totalMinutes);
  assert.equal(gradClock.graduated,true);
  assert.equal(gradClock.yearName,'大四');
  assert.equal(gradClock.totalDays,DAYS_PER_YEAR*4);
});
test('free sleep/wake schedule calculates immediate and cross-midnight rest durations accurately',()=>{
  const life=freshLifeState(()=>0); // Day 1, 08:00 (480)
  // Immediate sleep from 23:30 to 07:30 next morning = 8 hours (480 minutes)
  life.totalMinutes=23*60+30;
  const planImmediate=planSleepSchedule(life.totalMinutes,{sleepNow:true,wakeHour:7,wakeMinute:30});
  assert.equal(planImmediate.waitMinutes,0);
  assert.equal(planImmediate.sleepMinutes,480);
  const res1=executeSleep(life,{sleepNow:true,sleepHour:23,sleepMinute:30,wakeHour:7,wakeMinute:30});
  assert.equal(res1.sleepMinutes,480);
  assert.equal(life.sleepCount,1);
  assert.equal(formatGameClock(life.totalMinutes).timeText,'07:30');
  assert.equal(formatGameClock(life.totalMinutes).totalDays,2);
  // Scheduled sleep: at 21:00, schedule sleep at 23:00 and wake at 06:30 -> wait 120m + sleep 450m
  life.totalMinutes=MINUTES_PER_DAY+21*60;
  const res2=executeSleep(life,{sleepNow:false,sleepHour:23,sleepMinute:0,wakeHour:6,wakeMinute:30});
  assert.equal(res2.waitMinutes,120);
  assert.equal(res2.sleepMinutes,450);
  assert.equal(formatGameClock(life.totalMinutes).timeText,'06:30');
  assert.equal(formatGameClock(life.totalMinutes).totalDays,3);
  // Daylight profile contrasts noon vs midnight
  assert.ok(daylightProfile(12*60).daylight > 0.9);
  assert.ok(daylightProfile(1*60).daylight < 0.25);
});

