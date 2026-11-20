import { describe, expect, it } from 'vitest';
import { ARCHETYPES, ARCH_AI, ARCH_SPAWN, DAY_NIGHT, HORDE_NIGHT } from '../../content/data/zombie_arch';
import { senses, zombieDefs } from '../../content/data/zombies';
import { POIS } from '../../content/data/pois';
import { createRng } from '../../engine/rng';
import { archWeights, blend, chaseMul, hearingMul, hordeSize, hordeStep, isHordeDay, newHordeState, pickArchetype, specialChance, spawnHp, suspicionMul, windupMul, zoneCount } from './archetypes';
import { sightRate } from './senses';

describe('archetype definitions', () => {
  it('every archetype has a def with the AI parameters it needs, and a model path in the pfz set', () => {
    for (const a of ARCHETYPES) {
      const d = zombieDefs[a];
      expect(d, a).toBeTruthy();
      expect(d.archetype).toBe(a);
      expect(d.model).toBe(`zmb_pfz_${a}_a`);
      expect(d.hp).toBeGreaterThan(0);
      expect(ARCH_SPAWN[a]).toBeTruthy();
    }
    expect(zombieDefs.screamer.scream).toMatchObject({ radius: ARCH_AI.screamer.radius, windupS: ARCH_AI.screamer.windupS, cooldownS: ARCH_AI.screamer.cooldownS });
    expect(zombieDefs.brute.knockdownS).toBe(ARCH_AI.brute.knockdownS);
    expect(zombieDefs.crawler.startsCrawling).toBe(true);
  });

  it('the archetypes differ the way their names say', () => {
    const base = zombieDefs.shambler;
    const { runner, crawler, brute, screamer } = zombieDefs;
    expect(runner.chase).toBeGreaterThan(base.chase * 2.5); // fast
    expect(runner.hp).toBeLessThan(base.hp * 0.6); // fragile
    expect(runner.attackWindup).toBeLessThan(base.attackWindup);
    expect(crawler.crawl).toBeGreaterThan(base.crawl);
    expect(crawler.scale!).toBeLessThan(0.7); // low capsule and head
    expect(crawler.headY! * crawler.scale!).toBeLessThan(0.8);
    expect(brute.scale!).toBeGreaterThan(1.3); // big
    expect(brute.hp).toBeGreaterThan(base.hp * 4); // tough
    expect(brute.chase).toBeLessThan(base.chase); // slow
    expect(brute.attackDamage).toBeGreaterThan(base.attackDamage * 2);
    expect(brute.staggerFrac).toBeGreaterThan(base.staggerFrac * 1.5); // shrugs off staggers
    expect(screamer.hp).toBeLessThan(base.hp);
    expect(screamer.scream!.radius).toBeGreaterThan(senses.rangeDay);
  });

  it('a brute swing cannot one-shot a healthy player and a runner cannot burst one down', () => {
    expect(zombieDefs.brute.attackDamage).toBeLessThan(40);
    expect(zombieDefs.runner.attackDamage).toBeLessThan(zombieDefs.shambler.attackDamage);
  });
});

describe('spawn weights', () => {
  it('tier 1 is mostly ordinary zombies by day; tier 3 at night is a real mix', () => {
    expect(specialChance(1, 0)).toBeLessThan(0.13);
    expect(specialChance(3, 1)).toBeGreaterThan(0.2);
    expect(specialChance(3, 1)).toBeGreaterThan(specialChance(1, 0) * 3);
  });

  it('runners are mostly a night thing; brutes and screamers do not appear in tier 1; crawlers are steady', () => {
    const day = archWeights(2, 0);
    const night = archWeights(2, 1);
    expect(night.runner).toBeGreaterThan(day.runner * 3);
    expect(archWeights(1, 0.5).brute).toBe(0);
    expect(archWeights(1, 1).screamer).toBe(0);
    expect(archWeights(3, 0.5).brute).toBeGreaterThan(archWeights(2, 0.5).brute);
    expect(Math.abs(night.crawler - day.crawler) / day.crawler).toBeLessThan(0.3);
  });

  it('weights are never negative and the blend runs smoothly from day to night', () => {
    for (let tier = 1; tier <= 3; tier++) for (let n = 0; n <= 1; n += 0.25) for (const a of ARCHETYPES) expect(archWeights(tier, n)[a]).toBeGreaterThanOrEqual(0);
    expect(blend({ day: 2, night: 6 }, 0.5)).toBe(4);
    expect(blend({ day: 2, night: 6 }, 2)).toBe(6); // clamped
  });

  it('pickArchetype follows the weights: rolls cover every archetype in tier 3 and only plain zombies below the first slice', () => {
    const rng = createRng(11);
    const counts: Record<string, number> = { none: 0 };
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const a = pickArchetype(rng.next(), 3, 1) ?? 'none';
      counts[a] = (counts[a] ?? 0) + 1;
    }
    for (const a of ARCHETYPES) expect(counts[a], a).toBeGreaterThan(N * 0.01);
    expect(counts.none / N).toBeCloseTo(1 - specialChance(3, 1), 1);
    // frequencies follow the weights
    const w = archWeights(3, 1);
    expect(counts.runner / counts.screamer).toBeGreaterThan((w.runner / w.screamer) * 0.7);
    expect(counts.runner / counts.screamer).toBeLessThan((w.runner / w.screamer) * 1.4);
    // tier 1 by day never makes brutes or screamers
    const r2 = createRng(3);
    for (let i = 0; i < 5000; i++) expect(['brute', 'screamer']).not.toContain(pickArchetype(r2.next(), 1, 0));
    expect(pickArchetype(0.9999, 3, 1)).toBeNull();
  });
});

describe('day and night', () => {
  it('daylight: fewer and tougher; night: more, faster, further, quicker to swing', () => {
    expect(zoneCount(10, 0)).toBeLessThan(zoneCount(10, 1));
    expect(zoneCount(1, 0)).toBe(1); // never zero
    expect(spawnHp(100, 0)).toBeGreaterThan(spawnHp(100, 1));
    expect(chaseMul(1)).toBeGreaterThan(chaseMul(0));
    expect(hearingMul(1)).toBeGreaterThan(hearingMul(0));
    expect(suspicionMul(1)).toBeGreaterThan(suspicionMul(0));
    expect(windupMul(1)).toBeLessThan(windupMul(0));
    expect(chaseMul(0)).toBe(DAY_NIGHT.chase.day);
    expect(chaseMul(1)).toBe(DAY_NIGHT.chase.night);
  });

  it('they sense further at night (the existing senses data) and the day-to-night blend is smooth', () => {
    expect(senses.rangeNight).toBeGreaterThan(senses.rangeDay);
    const at = 28; // m: beyond the day range, inside the night range
    expect(sightRate(at, 0, 1, 1, false)).toBe(0);
    expect(sightRate(at, 0, 1, 1, true)).toBeGreaterThan(0);
    expect(sightRate(at, 0, 1, 1, 1)).toBeGreaterThan(0);
    let last = 0;
    for (let n = 0; n <= 1; n += 0.1) {
      const r = sightRate(20, 0, 1, 1, n);
      expect(r).toBeGreaterThanOrEqual(last - 1e-9); // never worse as it gets darker
      last = r;
    }
  });

  it('the cap a horde needs fits the crowd budget of 32 per model and is above the normal cap', () => {
    expect(HORDE_NIGHT.maxAlive).toBeGreaterThan(30);
    expect(HORDE_NIGHT.count[1]).toBeLessThanOrEqual(HORDE_NIGHT.maxAlive - 10);
  });
});

describe('horde night schedule', () => {
  it('every 3rd day from day 3, never before; warning at 21:00, start at 22:00, end at dawn the next morning', () => {
    expect(isHordeDay(1)).toBe(false);
    expect(isHordeDay(2)).toBe(false);
    expect(isHordeDay(3)).toBe(true);
    expect(isHordeDay(6)).toBe(true);
    expect(isHordeDay(7)).toBe(false);
    const s = newHordeState();
    expect(hordeStep(s, 3, 12)).toBeNull();
    expect(hordeStep(s, 3, 20.9)).toBeNull();
    expect(hordeStep(s, 3, 21.0)).toBe('warn');
    expect(hordeStep(s, 3, 21.5)).toBeNull(); // only once
    expect(hordeStep(s, 3, 22.0)).toBe('start');
    expect(s.phase).toBe('on');
    expect(hordeStep(s, 3, 23.9)).toBeNull();
    expect(hordeStep(s, 4, 3)).toBeNull(); // past midnight, still night
    expect(hordeStep(s, 4, HORDE_NIGHT.endHour)).toBe('end');
    expect(s.phase).toBe('idle');
    expect(s.done).toEqual([3]);
    expect(hordeStep(s, 4, 22)).toBeNull(); // day 4 is not a horde day
    expect(hordeStep(s, 3, 22)).toBeNull(); // and day 3 does not repeat
  });

  it('a clock jump past the warning still starts the horde, and past the whole night ends it', () => {
    const a = newHordeState();
    expect(hordeStep(a, 6, 23)).toBe('start'); // jumped straight to 23:00
    expect(hordeStep(a, 8, 12)).toBe('end'); // and two days later
    const b = newHordeState();
    expect(hordeStep(b, 3, 21.2)).toBe('warn');
    expect(hordeStep(b, 4, 2)).toBeNull(); // slept through: not a horde day any more, the warning is dropped
    expect(b.phase).toBe('idle');
  });

  it('horde size is 15 to 25 for every roll', () => {
    for (let r = 0; r <= 1; r += 0.01) {
      const n = hordeSize(Math.min(0.999999, r));
      expect(n).toBeGreaterThanOrEqual(15);
      expect(n).toBeLessThanOrEqual(25);
    }
    expect(hordeSize(0)).toBe(15);
    expect(hordeSize(0.999999)).toBe(25);
  });

  it('the reward items exist-shaped and modest, and the horde ring is out of the normal sense range at day', () => {
    expect(HORDE_NIGHT.reward.length).toBeGreaterThan(1);
    expect(HORDE_NIGHT.ring[0]).toBeGreaterThan(senses.rangeDay);
    for (const poi of POIS) expect(poi.tier).toBeLessThanOrEqual(3); // the archetype tier table has 3 tiers
  });
});
