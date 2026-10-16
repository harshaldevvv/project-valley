import { describe, expect, it } from 'vitest';
import { LOCKPICK } from '../content/data/containers';
import { createRng } from '../engine/rng';
import { allowedTurn, newLock, stepLock } from './lockpick';

const run = (s: ReturnType<typeof newLock>, seconds: number) => {
  let r: string | null = null;
  for (let t = 0; t < seconds && !r; t += 1 / 60) r = stepLock(s, 1 / 60, true);
  return r;
};

describe('lockpick', () => {
  it('opens at the sweet spot', () => {
    const s = newLock(2, createRng(4));
    s.pick = s.sweet + s.half * 0.5;
    expect(allowedTurn(s)).toBe(1);
    expect(run(s, 2)).toBe('open');
  });

  it('a wrong angle turns partly, then snaps after the stress time', () => {
    const s = newLock(1, createRng(4));
    s.pick = s.sweet + s.half + LOCKPICK.falloffDeg / 2; // half way down the falloff
    expect(allowedTurn(s)).toBeCloseTo(0.5);
    const t0 = 0.5 / LOCKPICK.turnSpeed; // time to reach the stop
    let r: string | null = null;
    let t = 0;
    for (; t < 5 && !r; t += 1 / 60) r = stepLock(s, 1 / 60, true);
    expect(r).toBe('broke');
    expect(t).toBeGreaterThan(t0 + LOCKPICK.stressSeconds - 0.05);
    expect(s.turn).toBe(0);
  });

  it('releasing springs back and relieves stress', () => {
    const s = newLock(3, createRng(1));
    s.pick = s.sweet + 90 > 180 ? s.sweet - 90 : s.sweet + 90;
    run(s, 0.6);
    stepLock(s, 1, false);
    expect(s.turn).toBe(0);
    expect(s.stress).toBe(0);
  });
});
