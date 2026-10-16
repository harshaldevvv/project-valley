import { Color, Fog, HemisphereLight } from 'three/webgpu';
import type { Game } from '../core/game';

/**
 * Time of day (0–24 h): drives game.sunDir (east→south→west arc; the moon takes over at night),
 * sun colour/intensity, the hemisphere light, scene.background and fog colour, by blending palettes.
 *   const tod = createTimeOfDay(game); tod.set(18.8);  tod.hours  // current
 * Nothing changes until the first set(): the world's start-up lighting is kept and becomes the key for its hour.
 * Night is dark-blue moonlight, not black, so it stays playable without a flashlight.
 */
interface Key {
  h: number;
  sky: string; // horizon: background + fog
  zenith: string; // sky dome top
  night: number; // 0 day .. 1 night (stars, moon disc, lamps)
  sun: string;
  sunI: number;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
}
const NIGHT = { sky: '#151d2d', zenith: '#03060d', night: 1, sun: '#9fb4dc', sunI: 0.6, hemiSky: '#506691', hemiGround: '#20222a', hemiI: 2.0 };
const KEYS: Key[] = [
  { h: 0, ...NIGHT },
  { h: 4.5, ...NIGHT },
  { h: 5.5, sky: '#5e5a6c', zenith: '#1e2a48', night: 0.5, sun: '#ff9a6a', sunI: 0.1, hemiSky: '#76809a', hemiGround: '#2a2a2c', hemiI: 1.9 },
  { h: 6, sky: '#d3a585', zenith: '#58719a', night: 0, sun: '#ffb27a', sunI: 1.4, hemiSky: '#cdbcb0', hemiGround: '#4f4538', hemiI: 2.1 },
  { h: 8, sky: '#b4c3c6', zenith: '#6a90b8', night: 0, sun: '#ffe2bd', sunI: 2.1, hemiSky: '#d6e2e6', hemiGround: '#5b5240', hemiI: 2.4 },
  { h: 12, sky: '#aab8bb', zenith: '#5f8cbc', night: 0, sun: '#fff1d8', sunI: 2.4, hemiSky: '#dfe8ea', hemiGround: '#5b5240', hemiI: 2.6 },
  { h: 16.5, sky: '#b1bbb8', zenith: '#6a8db4', night: 0, sun: '#ffe6c4', sunI: 2.2, hemiSky: '#dbe2e0', hemiGround: '#5b5240', hemiI: 2.5 },
  { h: 18.8, sky: '#cf916e', zenith: '#4d6390', night: 0.1, sun: '#ff9a5c', sunI: 1.5, hemiSky: '#c9ab9a', hemiGround: '#4f4036', hemiI: 2.1 },
  { h: 19.5, sky: '#6e5866', zenith: '#1c2442', night: 0.5, sun: '#ff8a50', sunI: 0.1, hemiSky: '#7a7a94', hemiGround: '#2c2828', hemiI: 1.9 },
  { h: 20.3, sky: '#2c3350', zenith: '#0a1020', night: 0.85, sun: '#8a90c0', sunI: 0.5, hemiSky: '#55618a', hemiGround: '#232128', hemiI: 1.9 },
  { h: 24, ...NIGHT },
];
export const SUNRISE = 5.5;
export const SUNSET = 19.5;
export const TIME_PRESETS: Record<string, number> = { Dawn: 6.2, Morning: 9, Noon: 12, Dusk: 18.8, Night: 23 };

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
    return d.y > 0 ? SUNRISE + ((SUNSET - SUNRISE) * Math.atan2(d.y, d.x)) / Math.PI : 12;
  };
  const capture = () => {
    if (keys) return keys;
    hours = hourFromSun();
    const hemi = hemiLight();
    const bg = game.scene.background instanceof Color ? game.scene.background : new Color('#9fb0b4');
    const now: Key = {
      h: hours,
      sky: `#${bg.getHexString()}`,
      zenith: '#5f8cbc',
      night: 0,
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
    /** Sky dome colours (horizon = scene.background/fog). Read by sky.ts / lamps.ts. */
    zenith: new Color('#5f8cbc'),
    night: 0,
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
      mix(state.zenith, a.zenith, b.zenith, t);
      state.night = a.night + (b.night - a.night) * t;
      mix(game.sun.color, a.sun, b.sun, t);
      game.sun.intensity = a.sunI + (b.sunI - a.sunI) * t;
      const hemi = hemiLight();
      if (hemi) {
        mix(hemi.color, a.hemiSky, b.hemiSky, t);
        mix(hemi.groundColor, a.hemiGround, b.hemiGround, t);
        hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * t;
      }
      // Late-summer day: the sun rises 5:30 in the east (+X), peaks south (+Z) at 12:15, sets 19:30 in the west;
      // the moon crosses the rest of the night. The light stays >= 12° up so shadows stay sane at the horizon.
      const day = h >= SUNRISE && h <= SUNSET;
      const ang = day ? ((h - SUNRISE) / (SUNSET - SUNRISE)) * Math.PI : ((((h - SUNSET) % 24) + 24) % 24 / (24 - SUNSET + SUNRISE)) * Math.PI;
      const elev = Math.max(Math.sin(ang), 0.21) * (day ? 1 : 0.8);
      game.sunDir.set(Math.cos(ang), elev, 0.45).normalize();
    },
  };
  return state;
}
export type TimeOfDay = ReturnType<typeof createTimeOfDay>;
