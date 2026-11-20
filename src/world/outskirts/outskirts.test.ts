import { describe, expect, it } from 'vitest';
import { BUILDINGS, OUT, PLACED } from '../../content/data/outskirts';
import { POIS, poiSpots } from '../../content/data/pois';
import { PF_FILES } from './modelFiles';

describe('outskirts data', () => {
  it('uses only models that exist', () => {
    const keys = new Set<string>([...PLACED.map((p) => p.k), ...BUILDINGS.flatMap((b) => [...b.furniture.map((f) => f.k), ...b.containers.map((c) => c.model)]), ...poiSpots.map((s) => s.model ?? '')]);
    keys.delete(''); keys.delete('counter'); keys.delete('register');
    expect([...keys].filter((k) => !PF_FILES[k])).toEqual([]);
  });
  it('keeps everything on the plateau and out of the yard', () => {
    for (const p of PLACED) {
      expect(p.x, p.k).toBeGreaterThan(OUT.x0); expect(p.x, p.k).toBeLessThan(OUT.x1);
      expect(p.z, p.k).toBeGreaterThan(OUT.z0); expect(p.z, p.k).toBeLessThan(OUT.z1);
    }
  });
  it('gives every poi containers and a zombie zone, with unique spot ids', () => {
    for (const p of POIS) expect(poiSpots.filter((s) => s.poi === p.id).length, p.id).toBeGreaterThan(2);
    for (const p of POIS) expect(p.zombies.length, p.id).toBeGreaterThan(0);
    expect(new Set(poiSpots.map((s) => s.id)).size).toBe(poiSpots.length);
  });
});
