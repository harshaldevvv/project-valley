import { describe, expect, it } from 'vitest';
import { INVENTORY } from '../content/data/items';
import { createRng } from '../engine/rng';
import { autoPlace, canPlace, findFree, gridOf, newItem, place, sortGrid, splitStack, type Grid } from './inventory';
import { Loadout } from './loadout';

const grid = (w: number, h: number): Grid => ({ w, h, contents: [] });

describe('grid inventory', () => {
  it('rejects overlap and out of bounds', () => {
    const g = grid(4, 4);
    expect(place(g, newItem('pistol_a'), 0, 0, false)).not.toBeNull(); // 2x1 at (0,0)
    expect(canPlace(g, newItem('bandage'), 1, 0, false)).toBe(false);
    expect(canPlace(g, newItem('bandage'), 2, 0, false)).toBe(true);
    expect(canPlace(g, newItem('pistol_a'), 3, 1, false)).toBe(false); // sticks out right
  });

  it('rotation swaps the footprint', () => {
    const g = grid(2, 5);
    const rifle = newItem('rifle_a'); // 5x2
    expect(canPlace(g, rifle, 0, 0, false)).toBe(false);
    expect(canPlace(g, rifle, 0, 0, true)).toBe(true);
    expect(findFree(g, rifle)).toEqual({ x: 0, y: 0, rotated: true });
  });

  it('stacks up to the limit and spills the rest into a new cell', () => {
    const g = grid(2, 1);
    autoPlace(g, newItem('bandage', 3)); // stack 4
    const more = newItem('bandage', 3);
    expect(autoPlace(g, more)).toBe(0);
    expect(g.contents.map((gi) => gi.item.count)).toEqual([4, 2]);
    expect(autoPlace(g, newItem('bandage', 4))).toBe(2); // 2 top up, 2 don't fit
  });

  it('splits stacks', () => {
    const a = newItem('ammo_9mm', 40);
    const b = splitStack(a, 15)!;
    expect([a.count, b.count]).toEqual([25, 15]);
    expect(splitStack(a, 25)).toBeNull();
  });

  it('nested containers: bag in bag yes, bag in itself no', () => {
    const outer = newItem('backpack_small');
    const inner = newItem('jacket_field');
    const og = gridOf(outer)!;
    expect(autoPlace(og, inner)).toBe(0);
    expect(autoPlace(gridOf(inner)!, outer)).toBe(1); // outer contains inner: cycle
    expect(canPlace(og, outer, 0, 0, false)).toBe(false);
    INVENTORY.bagception = false;
    expect(canPlace(og, newItem('backpack_small'), 0, 2, false)).toBe(false);
    INVENTORY.bagception = true;
  });

  it('auto-place fills first fit row-major', () => {
    const g = grid(3, 2);
    place(g, newItem('bandage'), 0, 0, false);
    const w = newItem('water_bottle'); // 1x2
    autoPlace(g, w);
    expect(g.contents[1]).toMatchObject({ x: 1, y: 0, rotated: false });
  });
});

describe('auto-sort', () => {
  it('merges stacks and packs big items first, in place', () => {
    const g = grid(5, 3);
    const contents = g.contents;
    place(g, newItem('bandage', 1), 0, 0, false);
    place(g, newItem('pistol_a'), 3, 2, false);
    place(g, newItem('bandage', 2), 4, 0, false);
    expect(sortGrid(g)).toBe(true);
    expect(g.contents).toBe(contents);
    expect(g.contents.map((gi) => [gi.item.defId, gi.x, gi.y, gi.item.count])).toEqual([['pistol_a', 0, 0, 1], ['bandage', 2, 0, 3]]);
  });
});

describe('loadout', () => {
  const kit = () => {
    const l = new Loadout(createRng(7));
    l.giveStartingKit();
    return l;
  };

  it('starting kit fits and counts', () => {
    const l = kit();
    expect(l.equipped('melee')?.defId).toBe('knife_a');
    expect(l.count('wood_planks')).toBe(10);
    expect(l.count('nails')).toBe(20);
    expect(l.consume('nails', 25)).toBe(20);
    expect(l.count('nails')).toBe(0);
  });

  it('takeMagazine returns the fullest compatible mag; ammo loads and unloads', () => {
    const l = kit();
    const pistol = newItem('pistol_a');
    l.give(pistol);
    expect(l.equipped('sidearm')).toBe(pistol);
    const m1 = newItem('mag_pistol_a', 1, { rounds: 4 });
    const m2 = newItem('mag_pistol_a', 1, { rounds: 11 });
    l.give(m1);
    l.give(m2);
    l.give(newItem('mag_rifle_a', 1, { rounds: 30 }));
    expect(l.takeMagazine(pistol)).toBe(m2);
    const ammo = newItem('ammo_9mm', 20);
    l.give(ammo);
    expect(l.loadMagazine(m1, ammo)).toBe(11);
    expect(m1.rounds).toBe(15);
    expect(l.insertMagazine(pistol, m1)).toBe(true);
    expect(pistol.mag).toBe(m1);
    expect(l.unloadMagazine(m1)).toBe(15);
    expect(l.count('ammo_9mm')).toBe(24);
  });

  it('give drops to the ground when full and never loses items', () => {
    const l = new Loadout(createRng(1));
    l.give(newItem('wood_planks', 5));
    expect(l.pickups).toHaveLength(1);
    l.detach(l.pickups[0].item);
    expect(l.pickups).toHaveLength(0);
  });

  it('weapon rack refills on every open; crates roll once', () => {
    const l = new Loadout(createRng(3));
    l.registerContainer('rack', 'weapon_rack');
    const c = l.openContainer('rack');
    const n = c.grid.contents.length;
    expect(n).toBeGreaterThanOrEqual(8);
    expect(c.grid.contents.find((gi) => gi.item.defId === 'rifle_a')?.item.mag?.rounds).toBe(30);
    c.grid.contents.length = 0;
    expect(l.openContainer('rack').grid.contents.length).toBe(n);
    l.registerContainer('c1', 'crate_wood');
    const first = l.openContainer('c1').grid.contents.length;
    expect(first).toBeGreaterThan(0);
    l.openContainer('c1').grid.contents.pop();
    expect(l.openContainer('c1').grid.contents.length).toBe(first - 1);
  });

  it('locked containers stay locked through save/load until picked; bodies roll loot', () => {
    const l = kit();
    expect(l.count('lockpick')).toBe(3);
    expect(l.registerContainer('lc', 'cabinet_locked').locked).toBe(true);
    const m = new Loadout(createRng(2));
    m.load(JSON.parse(JSON.stringify(l.serialize())));
    expect(m.containers.get('lc')!.locked).toBe(true);
    m.registerContainer('zb', 'body_zombie_soldier');
    expect(() => m.openContainer('zb')).not.toThrow();
    m.removeContainer('zb');
    expect(m.containers.has('zb')).toBe(false);
  });

  it('serialize/load round-trips', () => {
    const l = kit();
    l.registerContainer('c1', 'cabinet_metal');
    l.openContainer('c1');
    const save = JSON.parse(JSON.stringify(l.serialize()));
    const m = new Loadout(createRng(9));
    m.load(save);
    expect(m.serialize()).toEqual(save);
    expect(m.count('bandage')).toBe(3);
  });
});
