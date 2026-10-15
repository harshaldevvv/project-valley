import type { WeaponDef } from '../../content/data/types';

/** Pure gun math (principles §3). No three.js, no state: unit-tested in math.test.ts. */

export const easeOutCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** Damage multiplier: 1 until R1, linear to minMul at 2.5·R1, then flat. */
export function falloffMul(dist: number, r1: number, minMul: number) {
  if (dist <= r1) return 1;
  const t = Math.min(1, (dist - r1) / (1.5 * r1));
  return 1 + (minMul - 1) * t;
}

/**
 * Recoil kick for the n-th shot of a burst (0-based), degrees [pitch, yaw].
 * Shots 0–4 climb straight up, then a mild left/right wander; ±15 % noise from `rand` (0..1).
 */
export function recoilKick(def: WeaponDef, shot: number, rand: () => number): [number, number] {
  const [pMin, pMax] = def.recoilPitch;
  const noise = () => 1 + (rand() * 2 - 1) * 0.15;
  const ramp = Math.min(1, shot / 4); // first shots kick a bit less, then full
  const pitch = (pMin + (pMax - pMin) * ramp) * noise();
  const yaw = shot < 5 ? 0 : def.recoilYaw * Math.sin(shot * 0.9) * noise();
  return [pitch, yaw];
}

/** Exponential recovery of a recoil offset at fixed dt (frame-rate independent because dt is fixed). */
export const recover = (offset: number, ratePerSec: number, dt: number) => offset * Math.exp(-ratePerSec * dt);

export interface SpreadInput {
  ads: number; // 0..1 (eased)
  bloom: number;
  speed01: number; // horizontal speed / jog speed, 0..~1.7
  sprinting: boolean;
  airborne: boolean;
  exhausted: boolean;
}
/** Current cone half-angle in degrees. ADS standing still is near-perfect. */
export function spreadDeg(def: WeaponDef, s: SpreadInput, add: { sprint: number; air: number; move: number }) {
  const base = def.hipSpread + (def.adsSpread - def.hipSpread) * s.ads;
  let extra = s.bloom + add.move * Math.min(1, s.speed01) * (1 - 0.6 * s.ads);
  if (s.sprinting) extra += add.sprint;
  if (s.airborne) extra += add.air;
  if (s.exhausted) extra += 0.5;
  return base + extra;
}

export const addBloom = (bloom: number, def: WeaponDef) => Math.min(def.bloomMax, bloom + def.bloomPerShot);
export const decayBloom = (bloom: number, perSec: number, dt: number) => Math.max(0, bloom - perSec * dt);

/** Seconds between shots for an RPM cap. */
export const shotInterval = (rpm: number) => 60 / rpm;
