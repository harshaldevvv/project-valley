import { expect, test } from 'vitest';
import { hoursPerSecond } from './clock';

test('a 40-minute day is 28 min of daylight and 12 min of night', () => {
  const realSecondsFor = (from: number, to: number, len: number) => {
    let h = from;
    let s = 0;
    while (h < to) {
      h += hoursPerSecond(h, len) / 60; // 1/60 s steps
      s += 1 / 60;
    }
    return s;
  };
  expect(realSecondsFor(5.5, 19.5, 40) / 60).toBeCloseTo(28, 1);
  expect((realSecondsFor(19.5, 24, 40) + realSecondsFor(0, 5.5, 40)) / 60).toBeCloseTo(12, 1);
  expect(realSecondsFor(0, 24, 120) / 60).toBeCloseTo(120, 0);
});
