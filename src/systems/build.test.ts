import { describe, expect, it } from 'vitest';
import { BUILD } from '../content/data/build';
import { yard } from '../content/data/yard';
import { yardHouse } from '../world/yard/house';
import { blockerOf, canRemove, checkSlot, refundOf, slotOf, snapToHit, type Piece } from './build';

const area = { x0: 0, z0: 0, x1: 24, z1: 24 };
let uid = 1;
const put = (pieces: Piece[], defId: string, hit: { x: number; y: number; z: number }, turns = 0) => {
  const s = snapToHit(defId, hit, turns, pieces, area);
  if (s.valid) pieces.push({ uid: uid++, defId, x: s.x, y: s.y, z: s.z, rot: s.rot, paid: true });
  return s;
};

describe('build rules', () => {
  it('foundations snap to grid cells and cannot overlap or leave the pad', () => {
    const p: Piece[] = [];
    expect(put(p, 'wood_foundation', { x: 4.2, y: 0, z: 1 })).toMatchObject({ valid: true, x: 4.5, z: 1.5, y: 0 });
    expect(put(p, 'wood_foundation', { x: 5.9, y: 0, z: 2.9 })).toMatchObject({ valid: false, reason: 'occupied' });
    expect(put(p, 'wood_foundation', { x: 30, y: 0, z: 1 })).toMatchObject({ valid: false, reason: 'area' });
  });

  it('walls snap to the nearest foundation edge; R flips sides; need support', () => {
    const p: Piece[] = [];
    put(p, 'wood_foundation', { x: 1.5, y: 0, z: 1.5 });
    const w = put(p, 'wood_wall', { x: 1.5, y: 0.5, z: 0.4 }); // near north edge
    expect(w).toMatchObject({ valid: true, x: 1.5, z: 0, rot: 0, y: BUILD.foundationTop });
    const e = put(p, 'wood_window', { x: 1.5, y: 0.5, z: 0.4 }, 1); // R once: east side
    expect(e).toMatchObject({ valid: true, x: 3, z: 1.5 });
    expect(put(p, 'wood_wall', { x: 10.5, y: 0, z: 10.5 })).toMatchObject({ valid: false, reason: 'support' });
  });

  it('floors need walls below; doors need a doorway; removal keeps support', () => {
    const p: Piece[] = [];
    put(p, 'wood_foundation', { x: 1.5, y: 0, z: 1.5 });
    expect(put(p, 'wood_floor', { x: 1.5, y: 3.5, z: 1.5 }).valid).toBe(false);
    const dw = put(p, 'wood_doorway', { x: 1.5, y: 0.5, z: 2.8 });
    expect(dw.valid).toBe(true);
    expect(put(p, 'wood_door', { x: 1.6, y: 1, z: 2.9 })).toMatchObject({ valid: true, x: dw.x, z: dw.z });
    expect(put(p, 'wood_floor', { x: 1.5, y: 3.5, z: 1.5 })).toMatchObject({ valid: true, y: BUILD.foundationTop + BUILD.storey });
    const doorway = p.find((q) => q.defId === 'wood_doorway')!;
    const door = p.find((q) => q.defId === 'wood_door')!;
    expect(canRemove(doorway, p)).toBe(false); // door + floor rest on it
    expect(blockerOf(doorway, p)?.defId).toBe('wood_door');
    expect(canRemove(door, p)).toBe(true);
    expect(refundOf(door)).toEqual([{ item: 'wood_planks', count: 1 }, { item: 'nails', count: 2 }]);
  });

  it('gables sit on walls and R flips their tall end', () => {
    const p: Piece[] = [];
    put(p, 'wood_foundation', { x: 1.5, y: 0, z: 1.5 });
    expect(put(p, 'wood_gable', { x: 1.5, y: 0.5, z: 0.4 }).valid).toBe(false); // no wall below at level 1
    put(p, 'wood_wall', { x: 1.5, y: 0.5, z: 0.4 });
    const top = { x: 1.5, y: 3.5, z: 0.4 };
    expect(snapToHit('wood_gable', top, 0, p, area)).toMatchObject({ valid: true, z: 0, rot: 0, y: BUILD.foundationTop + BUILD.storey });
    expect(snapToHit('wood_gable', top, 2, p, area)).toMatchObject({ valid: true, z: 0, rot: Math.PI });
  });

  it('slotOf normalizes arbitrary positions (programmatic place)', () => {
    expect(slotOf('wood_wall', 1.4, 0.55, 3.1, Math.PI / 2 + 0.01)).toMatchObject({ x: 0, z: 4.5, rot: Math.PI / 2, key: 'E:v:0:1:0' });
    expect(slotOf('wood_wall', 1.5, 0.5, 3, Math.PI).key).toBe('E:h:0:1:0');
  });

  it("the world's prebuilt house lands on valid, supported slots", () => {
    const b = yard.stations.build;
    const pad = { x0: b.x - b.w / 2, z0: b.z - b.d / 2, x1: b.x + b.w / 2, z1: b.z + b.d / 2 };
    const p: Piece[] = [];
    for (const [defId, x, y, z, rot] of yardHouse) {
      const s = checkSlot(defId, slotOf(defId, x, y, z, rot), p, pad);
      expect(s, defId).toMatchObject({ valid: true, x, y, z });
      p.push({ uid: uid++, defId, x, y, z, rot: s.rot, paid: true });
    }
  });
});
