import * as THREE from 'three';

export function createCharacterAnimator(model, clips, seed = 0) {
  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(clips.map(clip => [clip.name, mixer.clipAction(clip)]));
  const names = ['Idle', 'Walk', 'Run', 'Jump', 'Fall', 'Land', 'Tired', 'Talk'];
  if (!names.every(name => actions[name])) throw new Error('Character animation clips are incomplete');
  for (const [name, action] of Object.entries(actions)) {
    action.play().setEffectiveWeight(name === 'Idle' ? 1 : 0);
    if (['Jump', 'Land'].includes(name)) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
  }
  const faces = [];
  model.traverse(o => { if (o.morphTargetDictionary) faces.push(o); });
  let current = 'Idle', time = seed, phase = 0, blinkAt = 1.8 + seed % 2, blinkTime = -1;
  const values = { Blink: 0, Smile: 0, Tired: 0, Talk: 0 };
  return {
    update(dt, next = 'Idle', context = {}) {
      dt = Math.min(dt, .1); time += dt;
      if (!actions[next]) next = 'Idle';
      if (next !== current) {
        // Locomotion stays alive; only single-use gestures restart on entry.
        if (['Jump', 'Land'].includes(next)) actions[next].reset().play();
        current = next;
      }
      const blend = 1 - Math.exp(-dt / (next === 'Land' ? .045 : .10));
      for (const [name, action] of Object.entries(actions)) {
        action.setEffectiveWeight(THREE.MathUtils.lerp(action.getEffectiveWeight(), name === next ? 1 : 0, blend));
      }
      // Match left/right foot phase through the walk/run blend, including repeated Shift taps.
      const rate = context.speed === undefined ? 1 : THREE.MathUtils.clamp(context.speed / (next === 'Run' ? 10 : 5.4), .35, 1.3);
      const strideDirection=context.backward?-1:1;
      phase = ((phase + strideDirection * dt * (next === 'Run' ? 30 / 22 : 30 / 32) * rate) % 1 + 1) % 1;
      for (const name of ['Walk', 'Run']) {
        actions[name].time = phase * actions[name].getClip().duration;
        actions[name].setEffectiveTimeScale(0);
      }
      mixer.update(dt);
      if (time >= blinkAt) { blinkTime = 0; blinkAt = time + 3.1 + .9 * Math.sin(time * 1.37); }
      if (blinkTime >= 0) { blinkTime += dt; if (blinkTime > .19) blinkTime = -1; }
      const target = {
        Blink: blinkTime < 0 ? 0 : Math.sin(Math.PI * blinkTime / .19),
        Smile: context.smile ? .75 : next === 'Talk' ? .45 : .08,
        Tired: context.exhausted || next === 'Tired' ? .85 : 0,
        Talk: context.talking || next === 'Talk' ? (.25 + .75 * Math.abs(Math.sin(time * 10.3))) : next === 'Tired' ? .25 : 0,
      };
      if (context.expression && context.expression !== 'Auto') {
        for (const name of Object.keys(target)) target[name] = name === context.expression ? 1 : 0;
      }
      for (const name of Object.keys(values)) {
        values[name] = name === 'Blink' ? target[name] : THREE.MathUtils.lerp(values[name], target[name], 1 - Math.exp(-dt * 12));
        for (const face of faces) {
          const index = face.morphTargetDictionary[name];
          // Blink and fatigue both lower eyelids; avoid adding them past full closure.
          if (index !== undefined) face.morphTargetInfluences[index] = values[name] * (name === 'Tired' ? 1 - values.Blink : 1);
        }
      }
    },
    getState: () => ({ action: current, phase, weights: Object.fromEntries(Object.entries(actions).map(([k,a]) => [k,a.getEffectiveWeight()])), expressions: { ...values } }),
  };
}
