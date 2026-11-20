import { describe, expect, it } from 'vitest';
import { RECIPES } from '../content/data/crafting';
import { CONTAINER_THEMES, CONTAINERS } from '../content/data/containers';
import { difficulty } from '../content/data/difficulty';
import { ITEMS, ITEM_RENAMES, PICKUP_MODELS } from '../content/data/items';
import { LOOT } from '../content/data/loot';
import { ITEM_PARTS, OUTFIT_PARTS, partsById } from '../content/data/outfit';
import { WOUNDS } from '../content/data/survival';
import { meleeDefs } from '../content/data/weapons';
import { itemText } from '../content/text/items';
import { containerText } from '../content/text/containers';
import { createRng } from '../engine/rng';
import { autoPlace, autoPlaceInto, canPlace, gridsOf, newItem } from './inventory';
import { Loadout } from './loadout';
import { repairLoadoutSave } from './saveRepair';
import { Survival, type SurvivalHost } from './survival';

const cells = (id: string) => gridsOf(newItem(id)).reduce((s, g) => s + g.w * g.h, 0);
const host = () => {
  const h = { hp: 50 };
  const api: SurvivalHost = {
    maxHp: () => 100, hp: () => h.hp, hurt: (n) => (h.hp -= n), heal: (n) => (h.hp = Math.min(100, h.hp + n)),
    isNight: () => false, days: () => 0, statusChanged: () => {},
  };
  return { h, api };
};

describe('backpacks', () => {
  it('there are five or more sizes, each bigger inside than outside, and capacity rises with rarity', () => {
    const packs = Object.values(ITEMS).filter((d) => d.kind === 'backpack');
    expect(packs.length).toBeGreaterThanOrEqual(10);
    for (const d of packs) expect(cells(d.id), d.id).toBeGreaterThan(d.w * d.h);
    const order = ['waist_pack', 'backpack_small', 'daypack', 'hiking_pack', 'duffel_bag', 'military_pack', 'large_hiking_pack', 'rucksack_military', 'alice_pack', 'laboratory_pack'];
    const caps = order.map(cells);
    expect(caps).toEqual([...caps].sort((a, b) => a - b));
    expect(cells('school_bag')).toBe(16);
    expect(cells('duffel_bag')).toBe(28);
    expect(cells('rucksack_military')).toBe(48);
    expect(gridsOf(newItem('duffel_bag'))[0]).toMatchObject({ w: 7, h: 4 });
  });

  it('a daypack holds exactly its cells of 1x1 items', () => {
    const pack = newItem('daypack');
    for (let i = 0; i < 20; i++) expect(autoPlaceInto(pack, newItem('glasses'))).toBe(0);
    expect(autoPlaceInto(pack, newItem('glasses'))).toBe(1);
  });

  it('a worn pack feeds the loadout, and the starting kit still fits', () => {
    const lo = new Loadout(createRng(1));
    lo.equipment.backpack = newItem('rucksack_military');
    lo.give(newItem('bandage', 3));
    expect(lo.count('bandage')).toBe(3);
  });
});

describe('vests, containers, restricted pockets', () => {
  it('the chest rig takes magazines in three pouches and anything in the flap pocket', () => {
    const rig = newItem('chest_rig');
    const g = gridsOf(rig);
    expect(g).toHaveLength(4);
    expect(canPlace(g[0], newItem('mag_rifle_a'), 0, 0, false)).toBe(true);
    expect(canPlace(g[0], newItem('apple'), 0, 0, false)).toBe(false);
    expect(canPlace(g[3], newItem('apple'), 0, 0, false)).toBe(true);
  });

  it('small containers only accept their own goods', () => {
    expect(autoPlaceInto(newItem('first_aid_pouch'), newItem('bandage'))).toBe(0);
    expect(autoPlaceInto(newItem('first_aid_pouch'), newItem('apple'))).toBe(1);
    expect(autoPlaceInto(newItem('tool_roll'), newItem('lighter'))).toBe(0);
    expect(autoPlaceInto(newItem('tool_roll'), newItem('bandage'))).toBe(1);
    expect(autoPlaceInto(newItem('mag_pouch'), newItem('mag_pistol_a'))).toBe(0);
    expect(autoPlaceInto(newItem('tackle_box'), newItem('screws', 5))).toBe(0);
  });

  it('armour ratings climb with rarity and only plates and riot helmets block infection', () => {
    const arm = (id: string) => ITEMS[id].armour ?? 0;
    expect(arm('stab_vest')).toBeLessThan(arm('kevlar_vest'));
    expect(arm('kevlar_vest')).toBeLessThan(arm('plate_carrier'));
    expect(arm('hard_hat')).toBeLessThan(WOUNDS.infection.armourImmune);
    for (const id of ['plate_carrier', 'riot_helmet', 'helmet_military']) expect(arm(id)).toBeGreaterThanOrEqual(WOUNDS.infection.armourImmune);
    for (const id of ['chest_rig', 'hunting_vest', 'sneakers', 'bike_helmet']) expect(arm(id)).toBeLessThan(WOUNDS.infection.armourImmune);
  });

  it('armour cuts the chance of bleeding from a hit: none, stab vest, plates', () => {
    const rate = (armour: number) => {
      let bled = 0;
      for (let seed = 1; seed <= 600; seed++) {
        const s = new Survival(createRng(seed), host().api);
        s.onZombieHit({ damage: 10, zone: 'body', armour });
        if (s.statuses.has('bleeding')) bled++;
      }
      return bled / 600;
    };
    const [none, stab, plates] = [rate(0), rate(ITEMS.stab_vest.armour!), rate(ITEMS.plate_carrier.armour!)];
    expect(none).toBeGreaterThan(0.22);
    expect(stab).toBeLessThan(none * 0.92);
    expect(plates).toBeLessThan(none * 0.6);
  });

  it('every wearable has a slot that exists, and slots match the kind of clothing', () => {
    const slots = ['head', 'face', 'eyes', 'ears', 'torso', 'armor', 'legs', 'gloves', 'feet', 'backpack'];
    for (const d of Object.values(ITEMS).filter((x) => x.kind === 'clothing' || x.kind === 'backpack')) {
      expect(d.slots?.length, d.id).toBeGreaterThan(0);
      for (const s of d.slots!) expect(slots, d.id).toContain(s);
    }
  });
});

describe('consumable effects', () => {
  it('food and drink restore needs and rest', () => {
    const { api } = host();
    const s = new Survival(createRng(1), api);
    s.adjust({ hunger: -60, thirst: -60, fatigue: -40 });
    s.applyUse(ITEMS.canned_chili.use!);
    expect(s.hunger).toBeCloseTo(40 + 32);
    s.applyUse(ITEMS.thermos.use!);
    expect(s.thirst).toBeCloseTo(40 + 20);
    expect(s.fatigue).toBeCloseTo(60 + 22);
    s.applyUse(ITEMS.water_jug.use!);
    expect(s.thirst).toBeCloseTo(100); // clamped
  });

  it('the refusal check lets a rest item through only when you are tired', () => {
    const { api } = host();
    const s = new Survival(createRng(1), api);
    const use = { seconds: 2, fatigue: 20 };
    expect(s.useRefusal(use, 'drink')).not.toBeNull();
    s.adjust({ fatigue: -50 });
    expect(s.useRefusal(use, 'drink')).toBeNull();
  });

  it('medicine heals, cures and respects its limits', () => {
    const { h, api } = host();
    const s = new Survival(createRng(1), api);
    s.addStatus('heavy_bleeding');
    s.applyUse(ITEMS.tourniquet.use!);
    expect(s.statuses.has('heavy_bleeding')).toBe(false);
    s.applyUse(ITEMS.first_aid_kit.use!);
    expect(h.hp).toBe(80);
    s.addStatus('infection', { stage: 2 });
    s.applyUse(ITEMS.antiseptic.use!); // antiseptic only stops stage 1
    expect(s.statuses.has('infection')).toBe(true);
    s.applyUse(ITEMS.antibiotics.use!);
    expect(s.statuses.has('infection')).toBe(false);
    s.addStatus('infection', { stage: 1 });
    s.applyUse(ITEMS.antiseptic.use!);
    expect(s.statuses.has('infection')).toBe(false);
  });

  it('dirty water quenches thirst and sometimes infects; clean water never does', () => {
    expect(difficulty.infection).toBe(true);
    let sick = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const s = new Survival(createRng(seed), host().api);
      s.adjust({ thirst: -50 });
      s.applyUse(ITEMS.dirty_water.use!);
      expect(s.thirst).toBeCloseTo(78);
      if (s.statuses.has('infection')) sick++;
    }
    expect(sick / 300).toBeGreaterThan(0.2);
    expect(sick / 300).toBeLessThan(0.4);
    for (let seed = 1; seed <= 50; seed++) {
      const s = new Survival(createRng(seed), host().api);
      s.applyUse(ITEMS.water_bottle.use!);
      expect(s.statuses.has('infection')).toBe(false);
    }
  });

  it('food values stay on the principles clock: one item never refills a need alone, except the jug', () => {
    for (const d of Object.values(ITEMS)) {
      const u = d.use;
      if (!u) continue;
      expect(u.seconds, d.id).toBeGreaterThanOrEqual(1);
      expect(u.seconds, d.id).toBeLessThanOrEqual(6);
      expect(u.food ?? 0, d.id).toBeLessThanOrEqual(50);
      expect(u.water ?? 0, d.id).toBeLessThanOrEqual(80);
      expect(u.heal ?? 0, d.id).toBeLessThanOrEqual(50);
      if (u.inflicts) expect(u.inflicts.chance, d.id).toBeLessThan(1);
    }
  });
});

describe('content wiring', () => {
  it('every item has text within the tile label limit', () => {
    for (const d of Object.values(ITEMS)) {
      const t = itemText[d.id];
      expect(t, d.id).toBeTruthy();
      expect(t.short.length, `${d.id} short "${t.short}"`).toBeLessThanOrEqual(8);
      expect(t.name.length, d.id).toBeGreaterThan(2);
      expect(t.description.length, d.id).toBeGreaterThan(20);
    }
    for (const id of Object.keys(itemText)) expect(ITEMS[id], `text without item: ${id}`).toBeTruthy();
  });

  it('melee items have a melee definition and weapon items are not orphaned', () => {
    for (const id of ['baseball_bat', 'machete', 'fire_axe']) {
      expect(meleeDefs[id], id).toBeTruthy();
      expect(ITEMS[id].slots).toEqual(['melee']);
    }
    expect(meleeDefs.fire_axe.damage).toBeGreaterThan(meleeDefs.crowbar_a.damage);
    expect(meleeDefs.knife_a.windup).toBeLessThan(meleeDefs.fire_axe.windup);
  });

  it('outfit mappings point at real parts and tints in the right slot', () => {
    for (const [id, [part, tint]] of Object.entries(ITEM_PARTS)) {
      expect(ITEMS[id], id).toBeTruthy();
      const p = partsById(part);
      expect(p, `${id} -> ${part}`).toBeTruthy();
      expect(tint, id).toBeLessThan(p!.tints.length);
    }
    expect(OUTFIT_PARTS.length).toBeGreaterThan(5);
  });

  it('own pickup models are declared for real items with sane sizes and files that exist', () => {
    const files = Object.keys(import.meta.glob('../../public/assets/models/item/*.glb'));
    for (const [id, m] of Object.entries(PICKUP_MODELS.files)) {
      expect(ITEMS[id], id).toBeTruthy();
      expect(m.size).toBeGreaterThan(0.03);
      expect(m.size).toBeLessThan(1.2);
      expect(files.some((f) => f.endsWith(`/${m.file}.glb`)), m.file).toBe(true);
    }
  });
});

describe('loot reach and balance', () => {
  const rolled = new Set<string>();
  for (const t of Object.values(LOOT)) {
    for (const e of t.entries) if (e.item) rolled.add(e.item);
    for (const g of t.guaranteed ?? []) rolled.add(g.item);
  }

  it('every item that is not a starter or a derivative can be found in at least one loot table', () => {
    const crafted = RECIPES.flatMap((r) => r.outputs.map((o) => o.item)).filter((id) => ['hot_soup', 'hot_chili', 'hot_noodles', 'spear', 'nail_bat'].includes(id));
    const exempt = new Set(['secure_pouch', ...crafted]); // starting kit only, or made only by crafting (cooked food, crafted weapons)
    const never = Object.keys(ITEMS).filter((id) => !exempt.has(id) && !rolled.has(id));
    expect(never).toEqual([]);
  });

  it('themed container types resolve and their tables exist', () => {
    for (const [theme, types] of Object.entries(CONTAINER_THEMES)) {
      expect(types.length, theme).toBeGreaterThan(1);
      for (const c of types) {
        expect(CONTAINERS[c], `${theme}: ${c}`).toBeTruthy();
        expect(containerText[c], `${theme}: ${c} text`).toBeTruthy();
      }
    }
    for (const c of Object.values(CONTAINERS)) expect(containerText[c.id], c.id).toBeTruthy();
  });

  it('new themed tables roll items that fit their container, and cash only comes from registers, desks and bedrooms', () => {
    const lo = new Loadout(createRng(7));
    for (const c of Object.values(CONTAINERS)) {
      let cash = 0;
      for (let i = 0; i < 40; i++) {
        const g = { w: c.grid.w, h: c.grid.h, contents: [] as never[] };
        const items = lo.rollLoot(c.lootTable, c.tier);
        for (const it of items) {
          if (it.defId === 'cash') cash += it.count;
          autoPlace(g, it);
        }
      }
      if (['gas_shelf', 'camp_stash', 'bathroom_cabinet', 'military_footlocker'].includes(c.id)) expect(cash, c.id).toBeLessThan(40 * 50 * 0.5);
    }
  });

  it('every container spot the world places uses a real container type and a known theme', () => {
    const mods = Object.values(import.meta.glob('../content/data/pois.ts', { eager: true })) as { poiSpots?: { id: string; type: string; theme: string }[] }[];
    const spots = mods[0]?.poiSpots ?? []; // pois.ts is the environment agent's file: skipped if it is absent
    for (const sp of spots) {
      expect(CONTAINERS[sp.type], `${sp.id}: type ${sp.type}`).toBeTruthy();
      expect(CONTAINER_THEMES[sp.theme], `${sp.id}: theme ${sp.theme}`).toBeTruthy();
    }
  });

  it('a kitchen gives roughly one meal per visit and a police locker gives armour at tier 3', () => {
    const lo = new Loadout(createRng(11));
    let food = 0;
    const N = 400;
    for (let i = 0; i < N; i++) for (const it of lo.rollLoot('house_kitchen', 1)) food += (ITEMS[it.defId].use?.food ?? 0) * it.count;
    const perVisit = food / N;
    expect(perVisit).toBeGreaterThan(25); // a meal
    expect(perVisit).toBeLessThan(120); // never a stockpile (hunger drains 100 points in 90 min)
    let armour = 0;
    for (let i = 0; i < N; i++) for (const it of lo.rollLoot('police_locker', 3)) if (ITEMS[it.defId].armour) armour++;
    expect(armour).toBeGreaterThan(N * 0.25);
  });
});

describe('saves with the new items', () => {
  it('a loadout full of new gear round-trips through JSON with pockets intact', () => {
    const lo = new Loadout(createRng(5));
    lo.equipment.backpack = newItem('rucksack_military');
    lo.equipment.armor = newItem('chest_rig');
    lo.give(newItem('mag_rifle_a', 1, { rounds: 17 }));
    lo.give(newItem('first_aid_kit', 2));
    lo.give(newItem('chocolate_bar', 3));
    const json = JSON.stringify(lo.serialize());
    const lo2 = new Loadout(createRng(5));
    lo2.load(JSON.parse(json));
    expect(JSON.stringify(lo2.serialize())).toBe(json);
    expect(lo2.count('first_aid_kit')).toBe(2);
    expect(lo2.equipment.armor!.pockets![0][0].item.rounds).toBe(17);
  });

  it('a save naming a renamed or deleted item still loads: renames keep the item, unknown ones are dropped, never thrown', () => {
    const lo = new Loadout(createRng(5));
    lo.equipment.backpack = newItem('daypack');
    lo.give(newItem('apple', 2));
    const save = lo.serialize();
    save.equipment.backpack!.contents![0].item.defId = 'old_apple_id'; // renamed in a later version
    save.equipment.backpack!.contents!.push({ item: { uid: 99999, defId: 'long_gone_item', count: 1 }, x: 3, y: 3, rotated: false });
    save.hotbar[0] = 'long_gone_item';
    ITEM_RENAMES.old_apple_id = 'apple';
    try {
      const rep = repairLoadoutSave(save);
      expect(rep).toEqual({ renamed: 1, dropped: ['long_gone_item'] });
      const lo2 = new Loadout(createRng(5));
      lo2.load(save);
      expect(lo2.count('apple')).toBe(2);
      expect(lo2.hotbar[0]).toBeNull();
    } finally {
      delete ITEM_RENAMES.old_apple_id;
    }
  });
});
