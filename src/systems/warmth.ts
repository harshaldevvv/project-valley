import { WARMTH } from '../content/data/survival';
import { ITEMS } from '../content/data/items';
import type { ItemInstance, SlotName } from '../content/data/types';

/** Everything that decides how warm you can be right now. Plain numbers so it tests without a world. */
export interface WarmthEnv {
  /** 0 day .. 1 night (engine clock, smooth through dusk and dawn). */
  night: number;
  /** 0 dry .. 1 full rain (engine/weather.ts). */
  rain: number;
  /** Warmth of worn clothing, comfort degrees. */
  clothing: number;
  /** Share of the rain chill the clothes cancel, 0..1. */
  rainproof: number;
  /** Standing next to a lit campfire. */
  fire: boolean;
  /** Indoors or under a roof: out of the rain and the wind. */
  sheltered?: boolean;
}

export const DRY_DAY: WarmthEnv = { night: 0, rain: 0, clothing: 0, rainproof: 0, fire: false };

/** Outdoor temperature on the comfort scale. */
export function ambient(env: Pick<WarmthEnv, 'night' | 'rain' | 'rainproof' | 'sheltered'>) {
  const base = WARMTH.dayTemp + (WARMTH.nightTemp - WARMTH.dayTemp) * Math.min(1, Math.max(0, env.night));
  if (env.sheltered) return base + WARMTH.shelterBonus;
  return base - env.rain * WARMTH.rainPenalty * (1 - Math.min(1, Math.max(0, env.rainproof)));
}

export function equilibrium(env: WarmthEnv) {
  return ambient(env) + env.clothing + (env.fire ? WARMTH.fireBonus : 0);
}

/** The warmth (0..100) you drift toward. */
export function targetWarmth(env: WarmthEnv) {
  return Math.min(100, Math.max(0, 100 - Math.max(0, WARMTH.comfort - equilibrium(env)) * WARMTH.coldPerDegree));
}

/** One step of `dt` seconds. */
export function stepWarmth(w: number, env: WarmthEnv, dt: number) {
  const target = targetWarmth(env);
  if (target < w) return Math.max(target, w - (WARMTH.coolPerMin / 60) * dt);
  const rate = env.fire ? WARMTH.fireWarmPerMin : WARMTH.warmPerMin;
  return Math.min(target, w + (rate / 60) * dt);
}

const WORN: SlotName[] = ['head', 'face', 'eyes', 'ears', 'torso', 'armor', 'legs', 'gloves', 'feet', 'backpack'];
/** Total warmth and rain protection of what the player wears. */
export function wornWarmth(equipment: Partial<Record<SlotName, ItemInstance | undefined>>) {
  let clothing = 0;
  let rain = 0;
  for (const slot of WORN) {
    const d = equipment[slot] && ITEMS[equipment[slot]!.defId];
    if (!d) continue;
    clothing += d.warmth ?? 0;
    rain += d.rainproof ?? 0;
  }
  return { clothing, rainproof: Math.min(1, rain) };
}

/** A building footprint as in data/outskirts.ts: centre, size (w along local x, d along local z) and yaw. */
export interface Footprint {
  x: number;
  z: number;
  w: number;
  d: number;
  yaw: number;
}
/** Is the point inside any footprint (turned by its yaw)? Used for "indoors counts as out of the rain". */
export function insideAny(x: number, z: number, list: readonly Footprint[], margin = 0) {
  for (const b of list) {
    const dx = x - b.x;
    const dz = z - b.z;
    // outskirts buildingWorld(): x = bx + u cos(yaw) + v sin(yaw), z = bz - u sin(yaw) + v cos(yaw)
    const u = dx * Math.cos(b.yaw) - dz * Math.sin(b.yaw);
    const v = dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw);
    if (Math.abs(u) <= b.w / 2 + margin && Math.abs(v) <= b.d / 2 + margin) return true;
  }
  return false;
}
