import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { movementAction, resolveKeyCode } from '../motion.js';

test('airborne and landing poses take priority, while blocked movement rests', () => {
  const state={grounded:false,speed:10,sprint:true,exhausted:false,landing:0};
  assert.equal(movementAction({...state,velocityY:2}),'Jump');
  assert.equal(movementAction({...state,velocityY:-2}),'Fall');
  assert.equal(movementAction({...state,grounded:true,landing:.1}),'Land');
  assert.equal(movementAction({...state,grounded:true,speed:0}),'Idle');
});
test('resolveKeyCode normalizes standard codes, key strings, and IME/keyCode fallbacks', () => {
  assert.equal(resolveKeyCode({ code: 'KeyW' }), 'KeyW');
  assert.equal(resolveKeyCode({ code: 'Unidentified', key: 'w' }), 'KeyW');
  assert.equal(resolveKeyCode({ code: '', key: 'E' }), 'KeyE');
  assert.equal(resolveKeyCode({ code: '', key: 'h' }), 'KeyH');
  assert.equal(resolveKeyCode({ key: ' ' }), 'Space');
  assert.equal(resolveKeyCode({ key: 'Escape' }), 'Escape');
  assert.equal(resolveKeyCode({ key: 'Enter' }), 'Enter');
  assert.equal(resolveKeyCode({ code: 'Unidentified', keyCode: 65 }), 'KeyA');
  assert.equal(resolveKeyCode({ code: 'Unidentified', keyCode: 72 }), 'KeyH');
  assert.equal(resolveKeyCode({ which: 68 }), 'KeyD');
  assert.equal(resolveKeyCode({ keyCode: 32 }), 'Space');
  assert.equal(resolveKeyCode({ keyCode: 16 }), 'ShiftLeft');
  assert.equal(resolveKeyCode({}), '');
});
test('macOS native app launcher bridges all movement and interaction keys without swallowing them in mouse monitor', () => {
  const src = fs.readFileSync(new URL('../启动校园Demo.app/Contents/Resources/CampusApp.m', import.meta.url), 'utf8');
  for (const expectedCode of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyH', 'KeyM', 'KeyR', 'Space', 'Enter', 'Escape', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    assert.ok(src.includes(`@"${expectedCode}"`), `missing hardware mapping for ${expectedCode}`);
  }
  assert.ok(src.includes('window.__onNativeKey'), 'missing native key bridge function');
  assert.ok(src.includes('NSEventTypeKeyDown') && src.includes('NSEventTypeKeyUp') && src.includes('NSEventTypeFlagsChanged'), 'missing keyDown/keyUp/flagsChanged handling');
  assert.ok(src.includes('event.type == NSEventTypeMouseMoved'), 'mouse deltaX/deltaY must only be accessed on mouse events');
  assert.ok(src.includes('isTextInputActive'), 'missing text input passthrough for typing player name');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const text of ['id="character-screen"', 'id="save-screen"', 'id="player-name-input"', 'id="player-gender-select"', 'id="enrollment-student-id"', '国际信息与软件学院', '软件学院', '集成电路学院', '男生', '女生']) {
    assert.ok(html.includes(text), `index.html missing ${text}`);
  }
});
