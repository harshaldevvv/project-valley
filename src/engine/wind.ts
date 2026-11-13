import { uniform } from 'three/tsl';

/** Shared wind gust 0..1 (slow irregular swells). Drives the tree sway shader (aiTrees.ts) and the wind loop volume
 *  (atmosphere.ts), so a gust is seen and heard together. `updateWind(seconds)` runs once per frame. */
export const windGust = uniform(0.4);
export const wind = { gust: 0.4 };
export function updateWind(t: number) {
  const g = 0.5 + 0.5 * Math.sin(t * 0.31) * Math.sin(t * 0.113 + 1.3);
  wind.gust = Math.min(1, Math.max(0, g * 1.25 - 0.05));
  windGust.value = wind.gust;
}
