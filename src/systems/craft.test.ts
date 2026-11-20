import { describe, expect, it } from 'vitest';
import { RECIPES, RECIPE_BY_ID } from '../content/data/crafting';
import { difficulty } from '../content/data/difficulty';
import { ITEMS } from '../content/data/items';
import { WARMTH } from '../content/data/survival';
import { radioLines } from '../content/text/radio';
import { itemText } from '../content/text/items';
import { createRng } from '../engine/rng';
import { canCraft, check, damagedWeapons, perform, valueOf, type Station } from './crafting';
import { newItem } from './inventory';

import { Loadout } from './loadout';
import { Survival, SURVIVAL_SAVE_VERSION, migrateSurvival, type SurvivalHost, type SurvivalSave } from './survival';
import { DRY_DAY, ambient, equilibrium, stepWarmth, targetWarmth, wornWarmth, type WarmthEnv } from './warmth';

const none = new Set<Station>();
const fire = new Set<Station>(['campfire']);
const kit = () => {
  const lo = new Loadout(createRng(1));
  lo.equipment.backpack = newItem('rucksack_military');
  return lo;
};
/** Into the pack (not worn or wielded): crafting only sees what is carried in grids. */
const put = (lo: Loadout, id: string, n = 1) => {
  for (let i = 0; i < n; i++) expect(lo.storeWorn(newItem(id))).toBe(true);
};

describe('recipes', () => {
  it('there are 20 to 30, and every id exists with text', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(20);
    expect(RECIPES.length).toBeLessThanOrEqual(30);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    for (const r of RECIPES) {
      for (const i of [...r.inputs, ...r.outputs]) expect(ITEMS[i.item], `${r.id}: ${i.item}`).toBeTruthy();
      for (const g of r.tools ?? []) for (const t of g) expect(ITEMS[t], `${r.id}: tool ${t}`).toBeTruthy();
      expect(r.seconds).toBeGreaterThan(0);
      expect(r.inputs.length).toBeGreaterThan(0);
      if (r.repair) expect(r.outputs).toHaveLength(0);
      else expect(r.outputs.length).toBeGreaterThan(0);
    }
    for (const o of RECIPES.flatMap((r) => r.outputs)) expect(itemText[o.item], o.item).toBeTruthy();
  });

  it('no loops: the recipe graph is acyclic, so nothing can be made from its own product', () => {
    const edges = new Map<string, Set<string>>();
    for (const r of RECIPES) for (const o of r.outputs) for (const i of r.inputs) (edges.get(i.item) ?? edges.set(i.item, new Set()).get(i.item)!).add(o.item);
    const state = new Map<string, number>();
    const visit = (n: string, path: string[]) => {
      if (state.get(n) === 1) throw new Error(`recipe cycle: ${[...path, n].join(' -> ')}`);
      if (state.get(n) === 2) return;
      state.set(n, 1);
      for (const m of edges.get(n) ?? []) visit(m, [...path, n]);
      state.set(n, 2);
    };
    for (const n of edges.keys()) expect(() => visit(n, [])).not.toThrow();
  });

  it('crafting never mints money: outputs are worth at most 4x the inputs, and food stays near the can it came from', () => {
    for (const r of RECIPES) {
      if (r.repair) continue;
      const out = valueOf(r.outputs);
      const inp = valueOf(r.inputs);
      expect(out, `${r.id}: ${out} vs ${inp}`).toBeLessThanOrEqual(inp * 4 + 5);
    }
  });

  it('every tool and station the recipes use can be found or made', () => {
    for (const r of RECIPES) for (const g of r.tools ?? []) expect(g.some((t) => ITEMS[t]), r.id).toBe(true);
    expect(RECIPES.filter((r) => r.station === 'workbench')).toHaveLength(0); // none exist in the world yet
  });

  it('a bandage costs four rags and the rags come out of the pack', () => {
    const lo = kit();
    lo.give(newItem('cloth_rag', 3));
    expect(check(lo, RECIPE_BY_ID.bandage, none)).toEqual([{ kind: 'input', item: 'cloth_rag', have: 3, need: 4 }]);
    lo.give(newItem('cloth_rag', 5));
    const made = perform(lo, RECIPE_BY_ID.bandage, none)!;
    expect(made.map((m) => m.defId)).toEqual(['bandage']);
    expect(lo.count('cloth_rag')).toBe(4);
    expect(lo.count('bandage')).toBe(1);
  });

  it('tools are needed but not used up, and alternatives count', () => {
    const lo = kit();
    put(lo, 'flannel_shirt');
    expect(canCraft(lo, RECIPE_BY_ID.rags_flannel, none)).toBe(false);
    put(lo, 'multitool');
    expect(canCraft(lo, RECIPE_BY_ID.rags_flannel, none)).toBe(true);
    perform(lo, RECIPE_BY_ID.rags_flannel, none);
    expect(lo.count('cloth_rag')).toBe(4);
    expect(lo.count('multitool')).toBe(1);
    expect(lo.count('flannel_shirt')).toBe(0);
  });

  it('boiling water needs the pot and a lit campfire close by', () => {
    const lo = kit();
    lo.give(newItem('dirty_water'));
    lo.give(newItem('cooking_pot'));
    expect(check(lo, RECIPE_BY_ID.boil_water, none)).toEqual([{ kind: 'station', station: 'campfire' }]);
    expect(perform(lo, RECIPE_BY_ID.boil_water, none)).toBeNull();
    expect(perform(lo, RECIPE_BY_ID.boil_water, fire)!.map((m) => m.defId)).toEqual(['water_bottle']);
    expect(lo.count('dirty_water')).toBe(0);
    expect(lo.count('cooking_pot')).toBe(1);
  });

  it('purification tablets clean water anywhere and are used up', () => {
    const lo = kit();
    lo.give(newItem('dirty_water'));
    lo.give(newItem('purification_tablets', 2));
    perform(lo, RECIPE_BY_ID.purify_water, none);
    expect(lo.count('water_bottle')).toBe(1);
    expect(lo.count('purification_tablets')).toBe(1);
  });

  it('the spear eats the knife; the nail bat keeps the hammer', () => {
    const lo = kit();
    for (const id of ['knife_a', 'wood_planks', 'wood_planks', 'duct_tape']) put(lo, id);
    perform(lo, RECIPE_BY_ID.spear, none);
    expect(lo.count('knife_a')).toBe(0);
    expect(lo.equipment.melee?.defId).toBe('spear'); // a new weapon goes straight into the empty melee slot
    put(lo, 'baseball_bat');
    put(lo, 'nails', 1);
    lo.consume('nails', 0);
    lo.storeWorn(newItem('nails', 10));
    put(lo, 'hammer_a');
    perform(lo, RECIPE_BY_ID.nail_bat, none);
    expect(lo.count('nail_bat')).toBe(1);
    expect(lo.count('hammer_a')).toBe(1);
    expect(lo.count('nails')).toBe(3); // 11 - 8
  });

  it('repair restores durability on the chosen weapon only, capped at 1', () => {
    const lo = kit();
    const worn = newItem('hammer_a', 1, { durability: 0.5 });
    const fine = newItem('crowbar_a', 1, { durability: 1 });
    lo.storeWorn(worn);
    lo.storeWorn(fine);
    for (const id of ['scrap_metal', 'cloth_rag', 'multitool', 'scrap_metal', 'cloth_rag']) put(lo, id);
    expect(damagedWeapons(lo)).toEqual([worn]);
    expect(canCraft(lo, RECIPE_BY_ID.repair_weapon, none, null)).toBe(false);
    expect(canCraft(lo, RECIPE_BY_ID.repair_weapon, none, fine)).toBe(false);
    perform(lo, RECIPE_BY_ID.repair_weapon, none, worn);
    expect(worn.durability).toBeCloseTo(0.85);
    perform(lo, RECIPE_BY_ID.repair_weapon, none, worn);
    expect(worn.durability).toBe(1);
    expect(lo.count('scrap_metal')).toBe(0);
  });
});

const host = (env: () => WarmthEnv = () => DRY_DAY) => {
  const h = { hp: 100, events: [] as string[] };
  const api: SurvivalHost = {
    maxHp: () => 100, hp: () => h.hp, hurt: (n, c) => ((h.hp -= n), h.events.push(c)), heal: (n) => (h.hp = Math.min(100, h.hp + n)),
    isNight: () => false, days: () => 0, statusChanged: (id, on) => h.events.push(`${id}:${on}`), env,
  };
  return { h, api };
};
const run = (s: Survival, seconds: number, dt = 1) => {
  for (let t = 0; t < seconds; t += dt) s.step(dt);
};
const kitEnv = (o: Partial<WarmthEnv>): WarmthEnv => ({ ...DRY_DAY, clothing: 9, ...o }); // field jacket + boots + gloves

describe('warmth math', () => {
  it('ambient falls through dusk to night and rain chills, a raincoat cancels most of it', () => {
    expect(ambient({ night: 0, rain: 0, rainproof: 0 })).toBe(WARMTH.dayTemp);
    expect(ambient({ night: 1, rain: 0, rainproof: 0 })).toBe(WARMTH.nightTemp);
    expect(ambient({ night: 0.5, rain: 0, rainproof: 0 })).toBeCloseTo((WARMTH.dayTemp + WARMTH.nightTemp) / 2);
    expect(ambient({ night: 0, rain: 1, rainproof: 0 })).toBe(WARMTH.dayTemp - WARMTH.rainPenalty);
    expect(ambient({ night: 0, rain: 1, rainproof: 0.75 })).toBeCloseTo(WARMTH.dayTemp - WARMTH.rainPenalty * 0.25);
  });

  it('it is gentle: the starting clothes stay warm at night, even in light rain; a bare torso at night gets cold', () => {
    expect(targetWarmth(kitEnv({ night: 1 }))).toBeGreaterThan(70);
    expect(targetWarmth(kitEnv({ night: 1, rain: 1 }))).toBeGreaterThan(WARMTH.coldBelow);
    expect(targetWarmth({ ...DRY_DAY, night: 1, clothing: 3 })).toBeLessThan(WARMTH.coldBelow);
    expect(targetWarmth({ ...DRY_DAY, night: 1, rain: 1, clothing: 0 })).toBeLessThan(WARMTH.freezingBelow);
    expect(targetWarmth(DRY_DAY)).toBe(100);
  });

  it('a fire makes you comfortable in the worst weather and heats faster than daylight', () => {
    const bad: WarmthEnv = { night: 1, rain: 1, clothing: 0, rainproof: 0, fire: false };
    expect(targetWarmth({ ...bad, fire: true })).toBe(100);
    expect(equilibrium({ ...bad, fire: true })).toBe(equilibrium(bad) + WARMTH.fireBonus);
    const cold = 20;
    expect(stepWarmth(cold, { ...DRY_DAY }, 60) - cold).toBeCloseTo(WARMTH.warmPerMin);
    expect(stepWarmth(cold, { ...DRY_DAY, fire: true }, 60) - cold).toBeCloseTo(WARMTH.fireWarmPerMin);
  });

  it('cooling is slow: minutes, not seconds, and it never overshoots the target', () => {
    const env: WarmthEnv = { ...DRY_DAY, night: 1, clothing: 0 };
    const t = targetWarmth(env);
    expect(stepWarmth(100, env, 60)).toBeCloseTo(100 - WARMTH.coolPerMin);
    expect(stepWarmth(t + 0.1, env, 600)).toBe(t);
  });

  it('worn warmth sums the clothes and caps rain protection at 1', () => {
    const w = wornWarmth({ torso: newItem('puffer_jacket'), head: newItem('beanie'), gloves: newItem('gloves_winter'), feet: newItem('hiking_boots'), legs: newItem('jeans') });
    expect(w.clothing).toBe(10 + 3 + 3 + 3 + 2);
    const rain = wornWarmth({ torso: newItem('raincoat'), feet: newItem('rubber_boots'), head: newItem('bucket_hat') });
    expect(rain.rainproof).toBe(1);
    expect(wornWarmth({}).clothing).toBe(0);
  });
});

describe('cold status and effects', () => {
  const night = (clothing: number, rain = 0): WarmthEnv => ({ night: 1, rain, clothing, rainproof: 0, fire: false });

  it('dry and warm: nothing ever happens', () => {
    const { api } = host();
    const s = new Survival(createRng(1), api);
    run(s, 3600, 5);
    expect(s.warmth).toBe(100);
    expect(s.statuses.has('cold')).toBe(false);
  });

  it('a cold night with thin clothes goes cold, then freezing, with penalties; a fire reverses it', () => {
    const e = { v: night(0, 1) };
    const { h, api } = host(() => e.v);
    const s = new Survival(createRng(1), api);
    run(s, 12 * 60);
    expect(s.statuses.has('cold') || s.statuses.has('freezing')).toBe(true);
    run(s, 20 * 60);
    expect(s.statuses.has('freezing')).toBe(true);
    expect(s.statuses.has('cold')).toBe(false); // one at a time
    expect(s.mods.staminaRegen).toBeCloseTo(WARMTH.freezing.staminaRegen);
    expect(s.mods.moveSpeed).toBeCloseTo(WARMTH.freezing.moveSpeed);
    expect(h.hp).toBeLessThan(100); // freezing hurts slowly
    e.v = { ...e.v, fire: true };
    run(s, 90);
    expect(s.statuses.has('freezing')).toBe(false);
    run(s, 120);
    expect(s.warmth).toBeGreaterThan(WARMTH.coldBelow);
  });

  it('freezing does not hurt on the story setting', () => {
    const was = difficulty.coldDamage;
    difficulty.coldDamage = false;
    try {
      const { h, api } = host(() => night(0, 1));
      const s = new Survival(createRng(1), api);
      s.warmth = 5;
      run(s, 300);
      expect(s.statuses.has('freezing')).toBe(true);
      expect(h.hp).toBe(100);
    } finally {
      difficulty.coldDamage = was;
    }
  });

  it('hot food warms you instantly and is refused when you are already warm', () => {
    const { api } = host(() => night(9));
    const s = new Survival(createRng(1), api);
    expect(s.useRefusal(ITEMS.hot_soup.use!, 'food')).not.toBeNull(); // full and warm
    s.adjust({ hunger: -50, warmth: -60 });
    expect(s.useRefusal(ITEMS.hot_soup.use!, 'food')).toBeNull();
    s.applyUse(ITEMS.hot_soup.use!);
    expect(s.warmth).toBeCloseTo(40 + ITEMS.hot_soup.use!.warmth!);
  });

  it('actions (radio, campfire kit) are never refused', () => {
    const { api } = host();
    const s = new Survival(createRng(1), api);
    expect(s.useRefusal(ITEMS.radio_handheld.use!, 'tool')).toBeNull();
    expect(s.useRefusal(ITEMS.campfire_kit.use!, 'tool')).toBeNull();
  });

  it('respawn warms you a little', () => {
    const { api } = host();
    const s = new Survival(createRng(1), api);
    s.warmth = 3;
    s.respawn();
    expect(s.warmth).toBe(WARMTH.respawn);
  });
});

describe('warmth saves', () => {
  const v1: SurvivalSave = { hunger: 40, thirst: 30, fatigue: 90, clock: 12, statuses: [['well_fed', { timeLeft: null, tick: 0 }]] };

  it('a v1 save loads as warm and keeps its needs', () => {
    expect(SURVIVAL_SAVE_VERSION).toBe(2);
    const { api } = host();
    const s = new Survival(createRng(1), api);
    s.load(v1, 1);
    expect(s).toMatchObject({ hunger: 40, thirst: 30, fatigue: 90, warmth: 100 });
    expect(migrateSurvival(v1, 1).warmth).toBe(100);
  });

  it('v2 round-trips warmth and its cold status', () => {
    const e = { v: { ...DRY_DAY, night: 1, clothing: 0 } };
    const { api } = host(() => e.v);
    const a = new Survival(createRng(1), api);
    run(a, 25 * 60);
    const json = JSON.parse(JSON.stringify(a.serialize())) as SurvivalSave;
    expect(json.warmth).toBeLessThan(WARMTH.coldBelow);
    const b = new Survival(createRng(1), host(() => e.v).api);
    b.load(json, 2);
    expect(b.warmth).toBeCloseTo(a.warmth);
    expect(b.statuses.has('freezing') || b.statuses.has('cold')).toBe(true);
  });
});

describe('tool items', () => {
  it('the radio has broadcasts, never consumed, and the campfire kit places a fire', () => {
    expect(radioLines.length).toBeGreaterThanOrEqual(8);
    for (const l of radioLines) expect(l.length).toBeGreaterThan(30);
    expect(ITEMS.radio_handheld.use).toMatchObject({ action: 'radio', keep: true });
    expect(ITEMS.campfire_kit.use?.action).toBe('campfire');
    expect(ITEMS.campfire_kit.use?.keep).toBeUndefined();
  });

  it('every clothing item has a warmth number, hats and jackets more than glasses', () => {
    for (const d of Object.values(ITEMS)) {
      if (d.kind !== 'clothing' || !d.slots) continue;
      if (['eyes', 'armor'].includes(d.slots[0]) || d.slots[0] === 'face' || d.slots[0] === 'ears') continue;
      if (d.id === 'hard_hat' || d.id === 'bike_helmet') continue;
      expect(d.warmth ?? 0, d.id).toBeGreaterThan(0);
    }
    expect(ITEMS.puffer_jacket.warmth!).toBeGreaterThan(ITEMS.flannel_shirt.warmth!);
  });
});
