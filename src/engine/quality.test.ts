import { describe, expect, it } from 'vitest';
import { lowerQuality, p95 } from './quality';
import { QUALITY, QUALITY_ORDER } from '../content/data/quality';

describe('quality presets', () => {
  it('steps down high -> medium -> low, then stops', () => {
    expect(lowerQuality('high')).toBe('medium');
    expect(lowerQuality('medium')).toBe('low');
    expect(lowerQuality('low')).toBeNull();
  });
  it('p95 picks the 95th percentile', () => {
    const ms = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(p95(ms)).toBe(96);
    expect(p95([])).toBe(0);
  });
  it('each lower preset costs no more than the one above', () => {
    for (let i = 1; i < QUALITY_ORDER.length; i++) {
      const a = QUALITY[QUALITY_ORDER[i - 1]], b = QUALITY[QUALITY_ORDER[i]];
      for (const k of ['renderScale', 'shadowMap', 'shadowExtent', 'grass', 'foliage', 'grassFar', 'farCull', 'npcDraw', 'lampLights', 'viewDist'] as const) expect(b[k]).toBeLessThanOrEqual(a[k]);
    }
  });
});
