import { Color, Fog, HemisphereLight } from 'three/webgpu';
import type { Game } from '../core/game';

/**
 * Time of day (0–24 h): drives game.sunDir (east→south→west arc; the moon takes over at night),
 * sun colour/intensity, the hemisphere light, scene.background and fog colour, by blending palettes.
 *   const tod = createTimeOfDay(game); tod.set(18.5);  tod.hours  // current
 * Nothing changes until the first set(): the world's start-up lighting is kept and becomes the key for its hour.
 * Night is dark-blue moonlight, not black, so it stays playable without a flashlight.
 */
interface Key {
  h: number;
  sky: string; // background + fog
  sun: string;
  sunI: number;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
}
const KEYS: Key[] = [
  { h: 0, sky: '#0d131d', sun: '#8fa6d0', sunI: 0.35, hemiSky: '#46597d', hemiGround: '#1d1e24', hemiI: 1.6 },
  { h: 4.5, sky: '#111826', sun: '#8fa6d0', sunI: 0.3, hemiSky: '#46597d', hemiGround: '#1d1e24', hemiI: 1.6 },
  { h: 6, sky: '#b9a08e', sun: '#ffb27a', sunI: 1.4, hemiSky: '#cdbcb0', hemiGround: '#4f4538', hemiI: 2.1 },
  { h: 8, sky: '#a9bcc2', sun: '#ffe2bd', sunI: 2.1, hemiSky: '#d6e2e6', hemiGround: '#5b5240', hemiI: 2.4 },
  { h: 12, sky: '#9fb0b4', sun: '#fff1d8', sunI: 2.4, hemiSky: '#dfe8ea', hemiGround: '#5b5240', hemiI: 2.6 },
  { h: 16.5, sky: '#a7b2b0', sun: '#ffe6c4', sunI: 2.2, hemiSky: '#dbe2e0', hemiGround: '#5b5240', hemiI: 2.5 },
  { h: 18.5, sky: '#b88a70', sun: '#ff9a5c', sunI: 1.5, hemiSky: '#c9ab9a', hemiGround: '#4f4036', hemiI: 2.1 },
  { h: 20, sky: '#2a2f45', sun: '#8a90c0', sunI: 0.4, hemiSky: '#4f5a7e', hemiGround: '#232128', hemiI: 1.6 },
  { h: 24, sky: '#0d131d', sun: '#8fa6d0', sunI: 0.35, hemiSky: '#46597d', hemiGround: '#1d1e24', hemiI: 1.6 },
];
export const TIME_PRESETS: Record<string, number> = { Dawn: 6, Morning: 9, Noon: 12, Dusk: 18.5, Night: 23 };

export function createTimeOfDay(game: Game) {
  const ca = new Color();
  const cb = new Color();
  const mix = (out: Color, a: string, b: string, t: number) => out.copy(ca.set(a)).lerp(cb.set(b), t);
  const hemiLight = () => game.scene.children.find((o) => (o as HemisphereLight).isHemisphereLight) as HemisphereLight | undefined;
  let keys: Key[] | null = null;
  let hours = 12;

  /** First use: the world's start-up lighting becomes the key at the hour its sun direction implies, so
   *  the slider starts from what is on screen instead of snapping to the table. */
  const hourFromSun = () => {
    const d = game.sunDir;
    return d.y > 0 ? 6 + (12 * Math.atan2(d.y, d.x)) / Math.PI : 12;
  };
  const capture = () => {
    if (keys) return keys;
    hours = hourFromSun();
    const hemi = hemiLight();
    const bg = game.scene.background instanceof Color ? game.scene.background : new Color('#9fb0b4');
    const now: Key = {
      h: hours,
      sky: `#${bg.getHexString()}`,
      sun: `#${game.sun.color.getHexString()}`,
      sunI: game.sun.intensity,
      hemiSky: `#${hemi?.color.getHexString() ?? 'dfe8ea'}`,
      hemiGround: `#${hemi?.groundColor.getHexString() ?? '5b5240'}`,
      hemiI: hemi?.intensity ?? 2.6,
    };
    keys = KEYS.filter((k) => Math.abs(k.h - hours) > 1.2).concat(now).sort((a, b) => a.h - b.h);
    return keys;
  };

  const state = {
    get hours() {
      return keys ? hours : hourFromSun(); // reading never captures (the debug slider reads at install time)
    },
    set(h: number) {
      const K = capture();
      h = ((h % 24) + 24) % 24;
      hours = h;
      let i = 0;
      while (K[i + 1].h < h) i++;
      const a = K[i];
      const b = K[i + 1];
      const t = (h - a.h) / (b.h - a.h);
      if (!(game.scene.background instanceof Color)) game.scene.background = new Color();
      const bg = game.scene.background as Color;
      mix(bg, a.sky, b.sky, t);
      if (game.scene.fog instanceof Fog) game.scene.fog.color.copy(bg);
      mix(game.sun.color, a.sun, b.sun, t);
      game.sun.intensity = a.sunI + (b.sunI - a.sunI) * t;
      const hemi = hemiLight();
      if (hemi) {
        mix(hemi.color, a.hemiSky, b.hemiSky, t);
        mix(hemi.groundColor, a.hemiGround, b.hemiGround, t);
        hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * t;
      }
      // Sun rises at 6 in the east (+X), peaks south (+Z) at noon, sets at 18 in the west. The moon is the
      // opposite point; keep the light at least 12° up so shadows stay sane at the horizon.
      const day = h >= 6 && h <= 18;
      const ang = ((day ? h - 6 : (h + 6) % 24) / 12) * Math.PI;
      const elev = Math.max(Math.sin(ang), 0.21) * (day ? 1 : 0.8);
      game.sunDir.set(Math.cos(ang), elev, 0.45).normalize();
    },
  };
  return state;
}
export type TimeOfDay = ReturnType<typeof createTimeOfDay>;
