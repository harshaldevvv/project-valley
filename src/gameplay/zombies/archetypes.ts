import { ARCHETYPES, ARCH_SPAWN, DAY_NIGHT, HORDE_NIGHT, type Archetype } from '../../content/data/zombie_arch';

/**
 * Archetype and pacing rules, pure (no three.js): which special zombie a spawn is, how day and night change the numbers, and
 * the horde-night schedule. zombies.ts and hordeNight.ts call these; the tests cover them.
 */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

/** Day-to-night blend of a {day, night} pair. */
export const blend = (p: { day: number; night: number }, night01: number) => lerp(p.day, p.night, night01);

/** Weight of each archetype for a spawn in a tier-`tier` zone at `night01` (0 day .. 1 night). */
export function archWeights(tier: number, night01: number): Record<Archetype, number> {
  const t = Math.min(3, Math.max(1, Math.round(tier)));
  const out = {} as Record<Archetype, number>;
  for (const a of ARCHETYPES) {
    const s = ARCH_SPAWN[a];
    out[a] = s.base * (s.tier[t] ?? 0) * blend(s, night01);
  }
  return out;
}

/** Chance that a spawn is one of the specials (the rest are ordinary shamblers). */
export function specialChance(tier: number, night01: number) {
  const w = archWeights(tier, night01);
  const sum = ARCHETYPES.reduce((s, a) => s + w[a], 0);
  return sum / (1 + sum);
}

/** Pick a special for a roll `r` in [0,1), or null for an ordinary zombie. Weights as above. */
export function pickArchetype(r: number, tier: number, night01: number): Archetype | null {
  const w = archWeights(tier, night01);
  const sum = ARCHETYPES.reduce((s, a) => s + w[a], 0);
  let x = r * (1 + sum);
  for (const a of ARCHETYPES) {
    x -= w[a];
    if (x < 0) return a;
  }
  return null;
}

/** How many zombies a streaming zone wants right now: fewer by day, more at night. */
export const zoneCount = (base: number, night01: number) => Math.max(1, Math.round(base * blend(DAY_NIGHT.count, night01)));

/** Hit points at spawn: tougher by day. */
export const spawnHp = (hp: number, night01: number) => Math.round(hp * blend(DAY_NIGHT.hp, night01));

export const chaseMul = (night01: number) => blend(DAY_NIGHT.chase, night01);
export const hearingMul = (night01: number) => blend(DAY_NIGHT.hearing, night01);
export const suspicionMul = (night01: number) => blend(DAY_NIGHT.suspicion, night01);
export const windupMul = (night01: number) => blend(DAY_NIGHT.windup, night01);

// ---------------------------------------------------------------- horde night
export interface HordeState {
  phase: 'idle' | 'warned' | 'on';
  /** The in-game day the current (or last) horde night started on. */
  day: number;
  /** Days that already had their horde (so a reload or a skipped clock never repeats one). */
  done: number[];
}
export const newHordeState = (): HordeState => ({ phase: 'idle', day: 0, done: [] });
export type HordeEvent = 'warn' | 'start' | 'end' | null;

/** Is this day a horde day? */
export const isHordeDay = (day: number, every = HORDE_NIGHT.everyDays) => day >= every && day % every === 0;

/** Advance the schedule for the clock at (day, hours). Returns the event that just happened, if any. */
export function hordeStep(s: HordeState, day: number, hours: number): HordeEvent {
  if (s.phase === 'warned' && day !== s.day) s.phase = 'idle'; // the clock moved past the night without a start (debug skip)
  if (s.phase === 'on') {
    const ended = day > s.day + 1 || (day === s.day + 1 && hours >= HORDE_NIGHT.endHour);
    if (!ended) return null;
    s.done.push(s.day);
    s.phase = 'idle';
    return 'end';
  }
  if (!isHordeDay(day) || s.done.includes(day)) return null;
  if (hours >= HORDE_NIGHT.startHour) {
    s.phase = 'on';
    s.day = day;
    return 'start';
  }
  if (s.phase === 'idle' && hours >= HORDE_NIGHT.warnHour) {
    s.phase = 'warned';
    s.day = day;
    return 'warn';
  }
  return null;
}

/** How many zombies a horde brings for a roll `r` in [0,1). */
export const hordeSize = (r: number) => HORDE_NIGHT.count[0] + Math.floor(r * (HORDE_NIGHT.count[1] - HORDE_NIGHT.count[0] + 1));
