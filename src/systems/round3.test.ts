import { describe, expect, it } from 'vitest';
import { RECIPE_BY_ID } from '../content/data/crafting';
import { BUILDINGS } from '../content/data/outskirts';
import { INVENTORY, ITEMS, STARTING_KIT } from '../content/data/items';
import { PUMPS, VEHICLE_FUEL, LIGHT, JERRYCAN_LOOT } from '../content/data/tools';
import { vehicles } from '../content/data/vehicles';
import { WARMTH } from '../content/data/survival';
import { createRng } from '../engine/rng';
import { canCraft, equippedUse, perform, type Station } from './crafting';
import * as fuel from './fuel';
import { newItem } from './inventory';
import { migrateWorldTools } from './installCraft';
import { Loadout, SAVE_VERSION, type LoadoutSave } from './loadout';
import { DRY_DAY, ambient, insideAny, targetWarmth } from './warmth';

const none = new Set<Station>();
const pack = () => {
  const lo = new Loadout(createRng(3));
  lo.equipment.backpack = newItem('rucksack_military');
  return lo;
};
const put = (lo: Loadout, id: string, n = 1) => {
  for (let i = 0; i < n; i++) expect(lo.storeWorn(newItem(id))).toBe(true);
};

describe('vehicle fuel', () => {
  it('a full tank lasts about 25 minutes flat out, a can about 7, and cars start part full', () => {
    const tank = vehicles.pickup_a.fuelLiters;
    const perS = fuel.burn(VEHICLE_FUEL.idleLPerS, VEHICLE_FUEL.driveLPerS, 1, 1);
    expect(tank / perS / 60).toBeGreaterThan(18);
    expect(tank / perS / 60).toBeLessThan(35);
    expect(ITEMS.jerrycan.fuelCapacity! / perS / 60).toBeGreaterThan(5);
    expect(VEHICLE_FUEL.startFraction).toBeGreaterThan(0.3);
    expect(VEHICLE_FUEL.startFraction).toBeLessThan(0.8);
  });

  it('idling burns much less than driving, and the throttle is clamped', () => {
    expect(fuel.burn(VEHICLE_FUEL.idleLPerS, VEHICLE_FUEL.driveLPerS, 0, 60)).toBeCloseTo(VEHICLE_FUEL.idleLPerS * 60);
    expect(fuel.burn(0.01, 0.05, 5, 1)).toBeCloseTo(0.06);
    expect(fuel.burn(0.01, 0.05, -1, 1)).toBeCloseTo(0.01);
  });

  it('cans fill emptiest first at a pump and pour fullest first into a car; litres are conserved', () => {
    const lo = pack();
    const a = newItem('jerrycan', 1, { fuel: 5 });
    const b = newItem('jerrycan', 1, { fuel: 15 });
    expect(lo.storeWorn(a) && lo.storeWorn(b)).toBe(true);
    expect(fuel.carried(lo)).toBe(20);
    expect(fuel.space(lo)).toBe(20);
    expect(fuel.fill(lo, 8)).toBe(8);
    expect(a.fuel).toBe(13); // emptiest got it
    expect(fuel.draw(lo, 10)).toBe(10);
    expect(b.fuel).toBe(5); // the fullest can (15) poured first
    expect(a.fuel).toBe(13);
    expect(fuel.carried(lo)).toBe(18); // 5 + 15 + 8 filled - 10 poured
  });

  it('never gives out more than there is, or takes in more than fits', () => {
    const lo = pack();
    const c = newItem('jerrycan', 1, { fuel: 18 });
    lo.storeWorn(c);
    expect(fuel.draw(lo, 50)).toBe(18);
    expect(c.fuel).toBe(0);
    expect(fuel.fill(lo, 500)).toBe(20);
    expect(c.fuel).toBe(20);
    expect(fuel.fill(lo, 5)).toBe(0);
  });

  it('pumps are finite: two spots on the Route 9 island, a hundred litres each', () => {
    expect(PUMPS.spots).toHaveLength(2);
    expect(PUMPS.reserveLiters).toBeLessThan(200);
    const total = PUMPS.spots.length * PUMPS.reserveLiters;
    expect(total / vehicles.pickup_a.fuelLiters).toBeLessThan(4); // a few tanks, not a faucet
  });

  it('loot jerrycans come with some fuel, never more than the can holds', () => {
    const lo = new Loadout(createRng(21));
    const found = [];
    for (let i = 0; i < 400; i++) found.push(...lo.rollLoot('gas_station_shelf', 1).filter((x) => x.defId === 'jerrycan'));
    expect(found.length).toBeGreaterThan(3);
    for (const j of found) {
      expect(j.fuel).toBeGreaterThanOrEqual(0);
      expect(j.fuel!).toBeLessThanOrEqual(ITEMS.jerrycan.fuelCapacity! * JERRYCAN_LOOT.max + 0.5);
    }
  });
});

describe('shelter', () => {
  it('indoors there is no rain and a little more warmth', () => {
    const rain = { night: 1, rain: 1, rainproof: 0 };
    expect(ambient({ ...rain, sheltered: true })).toBe(WARMTH.nightTemp + WARMTH.shelterBonus);
    expect(ambient({ ...rain, sheltered: false })).toBe(WARMTH.nightTemp - WARMTH.rainPenalty);
    expect(targetWarmth({ ...DRY_DAY, night: 1, rain: 1, clothing: 0, sheltered: true })).toBeGreaterThan(targetWarmth({ ...DRY_DAY, night: 1, rain: 1, clothing: 0 }));
  });

  it('building footprints (turned by yaw) hold their centre and nothing 40 m away', () => {
    expect(BUILDINGS.length).toBeGreaterThan(3);
    for (const b of BUILDINGS) {
      expect(insideAny(b.x, b.z, [b]), b.id).toBe(true);
      expect(insideAny(b.x + 40, b.z, [b]), b.id).toBe(false);
      // a point just inside a corner, rotated into world space like outskirts buildingWorld()
      const u = b.w / 2 - 0.3, v = b.d / 2 - 0.3;
      const wx = b.x + u * Math.cos(b.yaw) + v * Math.sin(b.yaw);
      const wz = b.z - u * Math.sin(b.yaw) + v * Math.cos(b.yaw);
      expect(insideAny(wx, wz, [b]), `${b.id} corner`).toBe(true);
    }
  });
});

describe('crafting with worn and wielded items', () => {
  it('a wielded knife counts as a tool, and counts toward an input only after the pack is short', () => {
    const lo = pack();
    for (const id of ['wood_planks', 'duct_tape']) put(lo, id, id === 'wood_planks' ? 2 : 1);
    lo.equipment.melee = newItem('knife_a');
    expect(canCraft(lo, RECIPE_BY_ID.spear, none)).toBe(true);
    expect(equippedUse(lo, RECIPE_BY_ID.spear).map((i) => i.defId)).toEqual(['knife_a']); // the panel asks first
    const made = perform(lo, RECIPE_BY_ID.spear, none)!;
    expect(made.map((m) => m.defId)).toEqual(['spear']);
    expect(lo.equipment.melee?.defId).toBe('spear'); // knife gone, spear took the empty slot
  });

  it('carried items are used before worn ones, and nothing asks to confirm', () => {
    const lo = pack();
    put(lo, 'flannel_shirt');
    lo.equipment.torso = newItem('flannel_shirt');
    put(lo, 'multitool');
    expect(equippedUse(lo, RECIPE_BY_ID.rags_flannel)).toEqual([]);
    perform(lo, RECIPE_BY_ID.rags_flannel, none);
    expect(lo.equipment.torso?.defId).toBe('flannel_shirt');
    expect(lo.count('cloth_rag')).toBe(4);
  });

  it('a worn jacket is used up only when it is the last one, and a bag with things inside is never eaten', () => {
    const lo = pack();
    put(lo, 'multitool');
    lo.equipment.torso = newItem('flannel_shirt');
    expect(canCraft(lo, RECIPE_BY_ID.rags_flannel, none)).toBe(true);
    perform(lo, RECIPE_BY_ID.rags_flannel, none);
    expect(lo.equipment.torso).toBeUndefined();
    const full = pack();
    put(full, 'multitool');
    full.equipment.torso = newItem('hoodie');
    full.equipment.torso.pockets![0].push({ item: newItem('apple'), x: 0, y: 0, rotated: false });
    expect(canCraft(full, RECIPE_BY_ID.rags_hoodie, none)).toBe(false);
  });
});

describe('flashlight needs an item', () => {
  it('a new game carries a flashlight bound to the hotbar and two batteries', () => {
    expect(STARTING_KIT.items.find((i) => i.item === 'flashlight_a')).toBeTruthy();
    expect(STARTING_KIT.items.find((i) => i.item === 'battery')?.count).toBe(2);
    expect(INVENTORY.hotbar).toContain('flashlight_a');
    for (const id of LIGHT.items) expect(ITEMS[id].use?.action, id).toBe('light');
    expect(ITEMS.headlamp.slots).toEqual(['eyes']);
    expect(LIGHT.batterySeconds).toBeGreaterThanOrEqual(600);
  });

  it('a v1 save without any light is given a flashlight and batteries; one that has a light is untouched', () => {
    expect(SAVE_VERSION).toBe(2);
    const old = new Loadout(createRng(1));
    old.equipment.backpack = newItem('backpack_small');
    old.hotbar = ['bandage', null, null, null, null];
    const save = old.serialize();
    save.v = 1;
    const fresh = new Loadout(createRng(1));
    fresh.load(save as LoadoutSave);
    expect(fresh.count('flashlight_a')).toBe(1);
    expect(fresh.count('battery')).toBe(2);
    expect(fresh.hotbar).toContain('flashlight_a');

    const keeps = new Loadout(createRng(1));
    keeps.equipment.backpack = newItem('backpack_small');
    keeps.storeWorn(newItem('camping_lantern'));
    const s2 = keeps.serialize();
    s2.v = 1;
    const again = new Loadout(createRng(1));
    again.load(s2 as LoadoutSave);
    expect(again.count('flashlight_a')).toBe(0);
    expect(again.count('camping_lantern')).toBe(1);
  });
});

describe('worldtools save', () => {
  it('a v1 slice loads with pumps full, light fully charged and no car fuel override', () => {
    const m = migrateWorldTools({ camps: [{ id: 'c', x: 1, y: 0, z: 2, lit: true, fuel: 100 }], radio: 3 }, 1);
    expect(m.pumps).toEqual(PUMPS.spots.map(() => PUMPS.reserveLiters));
    expect(m.charge).toBe(LIGHT.startSeconds);
    expect(m.carFuel).toEqual([]);
    expect(m.camps).toHaveLength(1);
    expect(m.radio).toBe(3);
  });

  it('a v2 slice keeps what it stored', () => {
    const m = migrateWorldTools({ camps: [], radio: 0, pumps: [10, 0], charge: 42, carFuel: [33.5] }, 2);
    expect(m).toMatchObject({ pumps: [10, 0], charge: 42, carFuel: [33.5] });
  });
});
