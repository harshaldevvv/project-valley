import { DirectionalLight, PointLight } from 'three';
import type { Game } from '../../core/game';

/** Warm flickering light at the camp fire (always in the scene, intensity follows the night). */
export function buildFireLights(game: Game, fires: [number, number, number][], lamps: [number, number, number][] = []) {
  // warm interior lamps (one point light each, brighter at night)
  const lampLights = lamps.map(([x, y, z]) => {
    const l = new PointLight('#ffc77a', 0, 9, 1.6);
    l.position.set(x, y, z);
    l.castShadow = false;
    game.scene.add(l);
    return l;
  });
  const lights = fires.map(([x, y, z]) => {
    const l = new PointLight('#ff9a4a', 0, 16, 1.8);
    l.position.set(x, y, z);
    l.castShadow = false;
    game.scene.add(l);
    return l;
  });
  // Night rim light: a cool, shadowless directional from the side opposite the moon and low, so figures and props get a
  // bright edge against the dark ground (contre-jour). One light, always present; zero by day.
  const rim = new DirectionalLight('#7f9fe8', 0);
  rim.castShadow = false;
  game.scene.add(rim, rim.target);
  let t = 0;
  game.addSystem({
    name: 'fires',
    render(_a, dt) {
      t += dt;
      const night = Math.min(1, game.time.night * 1.2 + 0.1);
      const sd = game.sunDir;
      rim.position.set(-sd.x * 40, 14, -sd.z * 40).add(game.camera.position);
      rim.target.position.copy(game.camera.position);
      rim.intensity = 1.1 * Math.max(0, (game.time.night - 0.35) / 0.65);
      lampLights.forEach((l, i) => { l.intensity = (6 + 20 * game.time.night) * (0.95 + 0.05 * Math.sin(t * 7 + i * 2)); });
      lights.forEach((l, i) => {
        const f = 0.8 + 0.2 * Math.sin(t * 9.1 + i) * Math.sin(t * 5.3 + i * 2) + 0.1 * Math.sin(t * 23);
        l.intensity = 38 * night * f;
        l.position.y = 0.7 + 0.08 * Math.sin(t * 7);
      });
    },
  });
}
