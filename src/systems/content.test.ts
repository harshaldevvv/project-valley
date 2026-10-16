import { describe, expect, it } from 'vitest';
import { CONTAINERS } from '../content/data/containers';
import { ITEMS, STARTING_KIT } from '../content/data/items';
import { LOOT, rarityMul } from '../content/data/loot';
import { itemText } from '../content/text/items';
import { createRng } from '../engine/rng';
import { autoPlace, autoPlaceInto, canPlace, containsItem, gridsOf, newItem, newItems } from './inventory';
import { Loadout } from './loadout';

describe('multi-grid storage', () => {
  it('alice pack has a main grid plus two side pockets, all reachable', () => {
    const pack = newItem('alice_pack');
    const grids = gridsOf(pack);
    expect(grids.map((g) => [g.w, g.h])).toEqual([[6, 6], [2, 4], [2, 4]]);
    // 36 + 8 + 8 cells of 1x1 items: all 52 fit, the 53rd doesn't.
    for (let i = 0; i < 52; i++) expect(autoPlaceInto(pack, newItem('glasses'))).toBe(0);
    expect(autoPlaceInto(pack, newItem('glasses'))).toBe(1);
    expect(pack.pockets![1]).toHaveLength(8);
  });

  it('vest pouches take magazines only; the admin pouch takes anything', () => {
    const vest = newItem('tactical_vest');
    const [p1, , , , admin] = gridsOf(vest);
    expect(canPlace(p1, newItem('mag_rifle_a'), 0, 0, false)).toBe(true);
    expect(canPlace(p1, newItem('bandage'), 0, 0, false)).toBe(false);
    expect(canPlace(admin, newItem('bandage'), 0, 0, false)).toBe(true);
  });

  it('worn pockets feed reloads and nested bags stay cycle-safe', () => {
    const lo = new Loadout(createRng(1));
    lo.equipment.armor = newItem('tactical_vest');
    lo.equipment.legs = newItem('cargo_pants');
    const mag = newItem('mag_rifle_a', 1, { rounds: 30 });
    lo.give(mag);
    expect(lo.equipment.armor!.pockets![0][0].item).toBe(mag); // a mag lands in a mag pouch
    lo.give(newItem('bandage', 2));
    expect(lo.count('bandage')).toBe(2);
    expect(lo.takeMagazine(newItem('rifle_a'))).toBe(mag);
    const wallet = newItem('wallet');
    const pack = newItem('alice_pack');
    expect(autoPlaceInto(pack, wallet)).toBe(0);
    expect(autoPlaceInto(wallet, newItem('cash', 300))).toBe(0);
    expect(containsItem(pack, wallet)).toBe(true);
    expect(autoPlaceInto(wallet, pack)).toBe(1); // pack contains wallet: cycle refused (and wallet takes valuables only)
    expect(autoPlaceInto(newItem('lunchbox'), newItem('ammo_9mm', 10))).toBe(10);
  });

  it('storage items are bigger inside than outside', () => {
    for (const d of Object.values(ITEMS)) {
      const cells = (d.grid ? d.grid.w * d.grid.h : 0) + (d.pockets ?? []).reduce((s, p) => s + p.w * p.h, 0);
      if (d.kind === 'backpack' || d.kind === 'container') expect(cells, d.id).toBeGreaterThan(d.w * d.h);
    }
  });
});

describe('content sanity', () => {
  it('every item has text and a swatch; every slot item has a slot-able kind', () => {
    for (const d of Object.values(ITEMS)) {
      expect(itemText[d.id], d.id).toBeTruthy();
      expect(d.iconSwatch, d.id).toMatch(/^#/);
      expect(d.stack, d.id).toBeGreaterThan(0);
      if (d.unpack) expect(ITEMS[d.unpack.item], d.id).toBeTruthy();
    }
  });

  it('loot tables reference real items/tables with positive weights and stay >= 60% themed', () => {
    for (const t of Object.values(LOOT)) {
      let themed = 0;
      let total = 0;
      for (const e of t.entries) {
        expect(e.weight, t.id).toBeGreaterThan(0);
        expect(!!e.item !== !!e.table, `${t.id}: item xor table`).toBe(true);
        if (e.item) expect(ITEMS[e.item], `${t.id} -> ${e.item}`).toBeTruthy();
        if (e.table) expect(LOOT[e.table], `${t.id} -> ${e.table}`).toBeTruthy();
        expect(e.count[0]).toBeLessThanOrEqual(e.count[1]);
        total += e.weight;
        if (e.item) themed += e.weight;
      }
      if (total && t.id !== 'common_junk') expect(themed / total, t.id).toBeGreaterThanOrEqual(0.6);
      for (const g of t.guaranteed ?? []) expect(ITEMS[g.item], `${t.id} -> ${g.item}`).toBeTruthy();
    }
    for (const c of Object.values(CONTAINERS)) expect(LOOT[c.lootTable], c.id).toBeTruthy();
    for (const k of STARTING_KIT.items) expect(ITEMS[k.item]).toBeTruthy();
  });

  it('rarity weighting follows the tier table (rare items scarcer at T1, more common at T5)', () => {
    expect(rarityMul(1, 'rare')).toBeCloseTo(5 / 70);
    expect(rarityMul(5, 'rare')).toBeGreaterThan(1);
    expect(rarityMul(3, 'legendary')).toBe(0);
    const lo = new Loadout(createRng(9));
    let rare = 0;
    for (let i = 0; i < 300; i++) rare += lo.rollLoot('civilian_wardrobe', 1).filter((it) => it.defId === 'large_hiking_pack').length;
    let rareT5 = 0;
    for (let i = 0; i < 300; i++) rareT5 += lo.rollLoot('civilian_wardrobe', 5).filter((it) => it.defId === 'large_hiking_pack').length;
    expect(rareT5).toBeGreaterThan(rare * 3);
  });

  it('every container rolls loot that fits its grid', () => {
    const lo = new Loadout(createRng(3));
    for (const [id, def] of Object.entries(CONTAINERS)) {
      for (let i = 0; i < 20; i++) {
        const g = { w: def.grid.w, h: def.grid.h, contents: [] };
        for (const it of lo.rollLoot(def.lootTable, def.tier)) autoPlace(g, it);
        expect(g.contents.length, id).toBeLessThanOrEqual(def.grid.w * def.grid.h);
      }
    }
    expect(newItems('cash', 12000)).toHaveLength(3);
  });
});
