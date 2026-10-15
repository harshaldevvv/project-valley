import { expect, test } from 'vitest';
import { FixedLoop, SIM_DT } from './loop';

test('fixed loop steps at 60 Hz independent of frame rate, clamps stalls', () => {
  const run = (frameMs: number, frames: number) => {
    let steps = 0;
    let lastAlpha = 0;
    const loop = new FixedLoop({ step: () => steps++, render: (a) => (lastAlpha = a) });
    for (let i = 0; i <= frames; i++) loop.frame(i * frameMs);
    return { steps, lastAlpha };
  };
  // 1 simulated second at 30, 60 and 144 fps -> ~60 steps each
  for (const fps of [30, 60, 144]) {
    const { steps, lastAlpha } = run(1000 / fps, fps);
    expect(Math.abs(steps - 60)).toBeLessThanOrEqual(1);
    expect(lastAlpha).toBeGreaterThanOrEqual(0);
    expect(lastAlpha).toBeLessThan(1);
  }
  // a 2 s stall runs at most 4 steps, never a catch-up spiral
  let steps = 0;
  const loop = new FixedLoop({ step: () => steps++, render: () => {} });
  loop.frame(0);
  loop.frame(2000);
  expect(steps).toBe(4);
  expect(SIM_DT).toBeCloseTo(1 / 60);
});
