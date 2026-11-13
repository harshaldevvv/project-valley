import { SpotLight, Vector3 } from 'three';
import type { Game } from '../core/game';

/**
 * Flashlight (L): a warm spotlight from the camera along the view direction. One SpotLight lives in the scene from the
 * start (adding lights recompiles shaders), intensity 0 while off. It ramps smoothly and flickers very slightly.
 * Stronger at night; by day it barely shows, so it is only useful in the dark.
 */
export function installFlashlight(game: Game) {
  const light = new SpotLight('#ffe9c4', 0, 46, Math.PI / 6.2, 0.55, 1.5);
  light.castShadow = false;
  game.scene.add(light, light.target);
  const state = { on: false, level: 0 };
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyL' && !e.repeat && !game.input.blocked) state.on = !state.on;
  });
  const fwd = new Vector3();
  let t = 0;
  game.addSystem({
    name: 'flashlight',
    render(_a, dt) {
      t += dt;
      const goal = state.on ? 1 : 0;
      state.level += (goal - state.level) * Math.min(1, dt * 14);
      if (state.level < 0.01) {
        light.intensity = 0;
        return;
      }
      const cam = game.camera;
      cam.getWorldDirection(fwd);
      light.position.copy(cam.position).addScaledVector(fwd, 2.8); // starts ahead of the camera so the third-person body behind the lens is not blown out
      light.position.y -= 0.12;
      light.target.position.copy(cam.position).addScaledVector(fwd, 14);
      const flicker = 1 + 0.03 * Math.sin(t * 37) * Math.sin(t * 11);
      const dark = 0.35 + 0.65 * game.time.night; // dim by day so it does not look like a second sun
      light.intensity = 420 * state.level * flicker * dark;
    },
  });
  return state;
}
