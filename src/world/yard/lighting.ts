import { Color, Fog, HemisphereLight } from 'three';
import type { Game } from '../../core/game';

/**
 * Startup defaults: slightly overcast late-summer afternoon, sun low in the south-west.
 * The engine's time-of-day system may drive these afterwards (game.sunDir, sun/hemi colours, fog).
 */
export const yardLight = {
  sky: '#aab8bb',
  fogNear: 90,
  fogFar: 430,
  hemiSky: '#d3dde0',
  hemiGround: '#5f5a43',
  hemiIntensity: 2.6, // physically based: ~1 leaves shaded faces near-black
  sun: '#ffe6c2',
  sunIntensity: 2.2,
  sunDir: [-0.5, 0.62, 0.42] as [number, number, number],
};

export function setupLighting(game: Game) {
  const L = yardLight;
  const sky = new Color(L.sky);
  game.scene.background = sky;
  game.scene.fog = new Fog(sky, L.fogNear, L.fogFar);
  const hemi = game.scene.children.find((o) => (o as HemisphereLight).isHemisphereLight) as HemisphereLight | undefined;
  hemi?.color.set(L.hemiSky);
  hemi?.groundColor.set(L.hemiGround);
  if (hemi) hemi.intensity = L.hemiIntensity;
  game.sun.color.set(L.sun);
  game.sun.intensity = L.sunIntensity;
  game.sunDir.set(...L.sunDir).normalize();
}
