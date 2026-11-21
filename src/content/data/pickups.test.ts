import { describe, expect, it } from 'vitest';
import { ITEMS, PICKUP_MODELS } from './items';
import manifestJson from '../../../public/assets/models/manifest.json';
import { Box3, Vector3 } from 'three';
import { PICKUP_SHAPES } from '../../ui/inventory/pickupShapes';

/**
 * E4: every item shows a real model when dropped. The world view (ui/inventory/pickups.ts) uses an own Polyfork file
 * (PICKUP_MODELS.files) when there is one, else the item's `model`, a per-item generic or the kind generic: each must be a
 * built asset in the manifest, or the player sees a grey placeholder box.
 */
const manifest = manifestJson as Record<string, unknown>;
const onDisk = new Set(Object.keys(import.meta.glob('../../../public/assets/models/item/*.glb')).map((k) => k.split('/').pop()!.replace(/\.glb$/, '')));
const files = PICKUP_MODELS.files as Record<string, { file: string }>;
const shapes = PICKUP_MODELS.shapes;
const resolve = (d: (typeof ITEMS)[string]) => d.model ?? PICKUP_MODELS.byItem[d.id] ?? (PICKUP_MODELS.byKind as Record<string, string>)[d.kind] ?? PICKUP_MODELS.fallback;

describe('pickup models (E4)', () => {
  it('every item resolves to a built model or an own model file', () => {
    const missing = Object.values(ITEMS).filter((d) => !files[d.id] && !shapes[d.id] && !(resolve(d) in manifest)).map((d) => `${d.id} -> ${resolve(d)}`);
    expect(missing).toEqual([]);
  });

  it('own model files exist on disk', () => {
    const gone = Object.entries(files).filter(([, f]) => !onDisk.has(f.file));
    expect(gone.map(([id, f]) => `${id}: ${f.file}`)).toEqual([]);
  });

  it('generic stand-ins stay a minority (most items have their own or a fitting shared model)', () => {
    const all = Object.values(ITEMS);
    const generic = all.filter((d) => !files[d.id] && !shapes[d.id] && !d.model && !PICKUP_MODELS.byItem[d.id]);
    // logged so the coverage is visible in the test output
    console.log(`pickup models: ${all.length} items, ${generic.length} on a kind generic: ${generic.map((d) => d.id).join(', ')}`);
    expect(generic.length / all.length).toBeLessThan(0.5);
    expect(generic.length).toBeLessThan(25); // round 2: well under 50
  });

  it('code-built shapes exist for real items and build at a sensible size', () => {
    const bad: string[] = [];
    for (const [id, key] of Object.entries(shapes)) {
      if (!ITEMS[id]) bad.push(`${id}: no such item`);
      const b = PICKUP_SHAPES[key];
      if (!b) {
        bad.push(`${id}: no shape ${key}`);
        continue;
      }
      const s = new Box3().setFromObject(b(ITEMS[id]?.iconSwatch ?? '#888888')).getSize(new Vector3());
      const long = Math.max(s.x, s.y, s.z);
      if (!(long > 0.03 && long < 1.6)) bad.push(`${id}: longest side ${long.toFixed(3)} m`);
    }
    expect(bad).toEqual([]);
  });
});
