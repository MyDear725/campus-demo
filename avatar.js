import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from './node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { createCharacterAnimator } from './character-motion.js';

const source = new GLTFLoader().loadAsync('./assets/characters/campus-traveler.glb');
export async function upgradeAvatar(character, variant = 'traveler') {
  const gltf = await source;
  const model = clone(gltf.scene);
  model.rotation.y = Math.PI;
  model.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    // NPCs share the new mesh and skeleton while keeping distinguishable clothes.
    if (variant !== 'traveler') {
      object.material = object.material.clone();
      if (object.material.name === 'Jacket_midnight_teal') object.material.color.set(variant === 'guide' ? '#9c805e' : '#8e5143');
    }
  });
  const animator = createCharacterAnimator(model, gltf.animations, variant === 'guide' ? 1.1 : variant === 'student' ? 2.3 : 0);
  character.g.clear();
  character.g.add(model);
  character.updateModel = animator.update;
  character.animationState = animator.getState;
  character.modelReady = true;
  return { clips: gltf.animations.map(clip => clip.name) };
}
