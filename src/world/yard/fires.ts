import { PointLight } from 'three';
import type { Game } from '../../core/game';

/** Warm flickering light at the camp fire (always in the scene, intensity follows the night). */
export function buildFireLights(game: Game, fires: [number, number, number][]) {
  const lights = fires.map(([x, y, z]) => {
    const l = new PointLight('#ff9a4a', 0, 16, 1.8);
    l.position.set(x, y, z);
    l.castShadow = false;
    game.scene.add(l);
    return l;
  });
  let t = 0;
  game.addSystem({
    name: 'fires',
    render(_a, dt) {
      t += dt;
      const night = Math.min(1, game.time.night * 1.2 + 0.1);
      lights.forEach((l, i) => {
        const f = 0.8 + 0.2 * Math.sin(t * 9.1 + i) * Math.sin(t * 5.3 + i * 2) + 0.1 * Math.sin(t * 23);
        l.intensity = 38 * night * f;
        l.position.y = 0.7 + 0.08 * Math.sin(t * 7);
      });
    },
  });
}
