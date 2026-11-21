import { describe, expect, it } from 'vitest';
import { INVENTORY } from '../content/data/items';
import { POIS } from '../content/data/pois';
import { createRng } from '../engine/rng';
import { mount } from './attachments';
import { migrateWorldTools, WORLDTOOLS_VERSION, type WorldToolsSave } from './installCraft';
import { newItem, newItems } from './inventory';
import { Loadout, SAVE_VERSION as LOADOUT_VERSION, type LoadoutSave } from './loadout';
import { QUEST_SAVE_VERSION, Quests, type QuestEnv, type QuestSave } from './quests';
import { SaveManager, sha256 } from './save';
import { memoryKV } from './storage';
import { Survival, SURVIVAL_SAVE_VERSION, type SurvivalHost, type SurvivalSave } from './survival';

/**
 * Save compatibility: a whole game's state (the real systems where they are plain data, small stand-ins with the same
 * save shape and load rules for the world slices that need a renderer: clock, cars, weather) saved mid-quest, loaded
 * into a fresh session and compared; then saves written by older builds (fixtures in the formats of earlier commits)
 * must load or migrate without throwing.
 */

// ---------- a game session ----------
interface Car {
  id: string;
  p: [number, number, number];
  q: [number, number, number, number];
  hp: number;
}
const CAR_START: Car[] = [
  { id: 'sedan', p: [26, 0.4, 48], q: [0, 0, 0, 1], hp: 100 },
  { id: 'pickup', p: [-40, 0.4, 130], q: [0, 0, 0, 1], hp: 100 },
];
/** engine/weather.ts scheduledRain: weather is a pure function of the saved day and hour (overrides are debug only). */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};
const scheduledRain = (day: number, hours: number) => {
  if (hash(day * 3.1 + 0.5) > 0.36) return 0;
  const start = 6 + hash(day * 7.7) * 11;
  const len = 2 + hash(day * 5.3) * 3;
  return hours >= start && hours < start + len ? 1 : 0;
};

function session() {
  const kv = memoryKV();
  const toasts: string[] = [];
  const mgr = new SaveManager(kv, { toast: (t) => toasts.push(t), saved: () => {}, loaded: () => {}, info: () => ({ gameDay: clock.day, playtimeS: 1 }) });
  const lo = new Loadout(createRng(7));
  lo.giveStartingKit();
  const where = { x: 0, z: 0 };
  const clock = { day: 1, hours: 8 };
  const env: QuestEnv = {
    pos: () => where,
    count: (i) => lo.countAll(i),
    fuel: () => 0,
    hours: () => (clock.day - 1) * 24 + clock.hours,
    place: (id) => POIS.find((p) => p.id === id),
    give: (i, n) => newItems(i, n).forEach((it) => lo.give(it)),
  };
  const quests = new Quests(env);
  const host: SurvivalHost = { maxHp: () => 100, hurt: () => {}, hp: () => 100, heal: () => {}, isNight: () => false, days: () => clock.day, statusChanged: () => {} };
  const survival = new Survival(createRng(3), host);
  const cars: Car[] = structuredClone(CAR_START);
  let tools = migrateWorldTools({ camps: [], radio: 0 }, 1);

  // the same section names, versions and load rules the game registers
  mgr.section('world.time', {
    version: 2,
    save: () => ({ day: clock.day, hours: clock.hours }),
    load: (d, version) => {
      const v = d as { day?: number; hours: number };
      clock.day = version >= 2 && v.day ? v.day : 1;
      clock.hours = ((v.hours % 24) + 24) % 24;
    },
  });
  mgr.section('inventory', { version: LOADOUT_VERSION, save: () => lo.serialize(), load: (d) => lo.load(d as LoadoutSave) });
  mgr.section('survival', { version: SURVIVAL_SAVE_VERSION, save: () => survival.serialize(), load: (d, v) => survival.load(d as SurvivalSave, v) });
  mgr.section('quests', { version: QUEST_SAVE_VERSION, save: () => quests.serialize(), load: (d, v) => quests.load(d as QuestSave, v), fresh: () => quests.load({ state: {}, tracked: null, notes: [], seen: [] }) });
  mgr.section('worldtools', { version: WORLDTOOLS_VERSION, save: (): WorldToolsSave => structuredClone(tools), load: (d, v) => (tools = migrateWorldTools(d as WorldToolsSave, v)), fresh: () => (tools = migrateWorldTools({ camps: [], radio: 0 }, 1)) });
  mgr.section('vehicles', {
    version: 1,
    save: () => structuredClone(cars),
    load: (d) => {
      for (const s of d as Car[]) {
        const car = cars.find((c) => c.id === s.id);
        if (car) Object.assign(car, { p: [s.p[0], s.p[1] + 0.05, s.p[2]], q: s.q, hp: s.hp });
      }
    },
  });
  return { kv, mgr, lo, quests, survival, cars, clock, where, toasts, get tools() { return tools; }, set tools(t) { tools = t; } };
}
type Session = ReturnType<typeof session>;

/** Everything a load must bring back, as plain JSON. */
function state(s: Session) {
  const inv = s.lo.serialize();
  const strip = (x: unknown) => JSON.parse(JSON.stringify(x));
  return strip({
    equipment: inv.equipment,
    pickups: inv.pickups,
    hotbar: inv.hotbar,
    containers: inv.containers.length,
    quests: s.quests.serialize(),
    survival: s.survival.serialize(),
    cars: s.cars.map((c) => ({ id: c.id, x: c.p[0], z: c.p[2], q: c.q, hp: c.hp })),
    fuel: s.tools.carFuel,
    time: { day: s.clock.day, hours: s.clock.hours },
    rain: scheduledRain(s.clock.day, s.clock.hours),
  });
}

/** Play to the middle of the Maple Street quest with a full pack, worn gear and a modded gun. */
function midGame(s: Session) {
  const q = s.quests;
  for (const id of ['wake', 'listen', 'make_do', 'route9']) for (let i = 0; i < 10 && q.state[id].status === 'active'; i++) q.skip(id);
  const maple = POIS.find((p) => p.id === 'maple')!;
  Object.assign(s.where, { x: maple.x, z: maple.z });
  q.tick();
  q.report({ type: 'note', id: 'note_maple_sick' });
  expect(q.current('maple')).toMatchObject({ type: 'collect', item: 'antibiotics' });

  const rifle = newItem('rifle_a');
  mount(rifle, 'scope_4x');
  mount(rifle, 'suppressor');
  s.lo.equipment.primary = rifle;
  s.lo.give(newItem('kevlar_vest'));
  s.lo.give(newItem('hiking_boots'));
  for (const id of ['canned_soup', 'cloth_rag', 'battery', 'scrap_metal', 'water_bottle', 'matches', 'jerrycan']) for (const it of newItems(id, 6)) s.lo.give(it);
  expect(s.lo.pickups.length).toBeGreaterThan(0); // the pack is full: some of it lies on the ground

  s.survival.load({ ...s.survival.serialize(), hunger: 41.5, thirst: 63, warmth: 72.25 });
  s.cars[0].p = [61.5, 0.42, 92.25];
  s.cars[0].q = [0, 0.3826834, 0, 0.9238795];
  s.cars[1].hp = 37;
  s.tools = { ...s.tools, carFuel: [7.5, 31], radio: 3, charge: 512 };
  s.clock.day = 3;
  s.clock.hours = 14.75;
}

describe('save round trip (mid-quest, full pack, gear, gun parts, car, time, weather)', () => {
  it('a fresh session loads exactly what was saved', async () => {
    const a = session();
    midGame(a);
    const before = state(a);
    await a.mgr.save('manual-1');

    const b = session(); // a new page: starting kit, no quests done
    b.kv.raw.gens = a.kv.raw.gens;
    b.kv.raw.meta = a.kv.raw.meta;
    expect(await b.mgr.load('manual-1')).toBe(true);
    const after = state(b);
    for (const k of Object.keys(before) as (keyof typeof before)[]) {
      if (k === 'cars') continue;
      expect(after[k], String(k)).toEqual(before[k]);
    }
    // cars come back where they were (the game lifts them 5 cm so they settle onto the ground)
    after.cars.forEach((c: { x: number; z: number; q: number[]; hp: number }, i: number) => {
      expect(c.x).toBeCloseTo(before.cars[i].x, 5);
      expect(c.z).toBeCloseTo(before.cars[i].z, 5);
      expect(c.q).toEqual(before.cars[i].q);
      expect(c.hp).toBe(before.cars[i].hp);
    });
    expect(b.lo.equipment.primary?.attach).toEqual({ optic: 'scope_4x', muzzle: 'suppressor' });
    expect(b.quests.current('maple')).toMatchObject({ type: 'collect' });
    expect(b.toasts).toEqual([]);

    // and the quest carries on from there after the load
    const junk = b.lo.playerGrids().flatMap((g) => g.grid.contents)[0];
    b.lo.detach(junk.item); // the pack is full: drop something first (any item frees a cell for the 1x1 pills)
    b.lo.give(newItem('antibiotics'));
    b.quests.tick();
    expect(b.quests.current('maple')).toMatchObject({ type: 'give', npc: 'eli' });
  });
});

// ---------- saves written by older builds ----------
const grid = (items: [string, number, number, number][]) => items.map(([defId, count, x, y], i) => ({ item: { uid: 100 + i, defId, count }, x, y, rotated: false }));
/** M2 (c621105, 2026-10-16): loadout v1 (no flashlight rule), survival v1 (no warmth), world.time v1 (hours only); no quests or worldtools yet. */
const M2_SECTIONS = {
  'world.time': { v: 1, data: { hours: 19.5 } },
  inventory: {
    v: 1,
    data: {
      v: 1,
      nextUid: 400,
      equipment: {
        torso: { uid: 1, defId: 'jacket_field', count: 1, pockets: [grid([['bandage', 3, 0, 0]]), grid([['canned_beans', 2, 0, 0]])] },
        backpack: { uid: 2, defId: 'backpack_small', count: 1, contents: grid([['wood_planks', 10, 0, 0], ['nails', 20, 2, 0], ['lockpick', 3, 3, 0], ['no_such_item_any_more', 1, 0, 2]]) },
        melee: { uid: 3, defId: 'knife_a', count: 1 },
      },
      pickups: [{ item: { uid: 9, defId: 'water_bottle', count: 1 }, x: 1, y: 0, z: 2 }],
      containers: [{ id: 'yard_crate_1', defId: 'crate_wood', searched: true, contents: grid([['scrap_metal', 2, 0, 0]]) }],
      hotbar: [null, null, null, null, null],
    },
  },
  survival: { v: 1, data: { hunger: 55, thirst: 70, fatigue: 90, clock: 1234, statuses: [['bleeding', { t: 3 }], ['cold', { t: 1 }]] } },
  vehicles: { v: 1, data: [{ id: 'sedan', p: [30, 0.4, 50], q: [0, 0, 0, 1], hp: 80 }] },
  player: { v: 1, data: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hp: 90, stamina: 50, slot: 0, cam: 'tp', crouched: false } },
};
/** Round 3 (da7dce9, before Quests v1): worldtools v1 (camps + radio only), survival v2, loadout v2, still no quests. */
const ROUND3_SECTIONS = {
  'world.time': { v: 2, data: { day: 2, hours: 6.25 } },
  survival: { v: 2, data: { hunger: 80, thirst: 80, fatigue: 80, warmth: 60, clock: 50, statuses: [] } },
  worldtools: { v: 1, data: { camps: [{ id: 'camp_x', x: 3, y: 0, z: 4, lit: true, fuel: 90 }], radio: 2 } },
};

async function writeRaw(s: Session, slot: string, file: object) {
  const json = JSON.stringify(file);
  s.kv.raw.gens.set(`${slot}:1`, { json, hash: await sha256(json) });
  s.kv.raw.meta.set(slot, { slot, current: 1, gens: [1], next: 2, info: { slot, savedAt: 1, label: slot, gameDay: 1, playtimeS: 0 } });
}

describe('old saves load or migrate without throwing', () => {
  it('an M2 save (loadout v1, survival v1, clock v1, no quests): migrated, unknown items dropped, quests start fresh', async () => {
    const s = session();
    midGame(s); // the session has progress that must not leak into the old save
    await writeRaw(s, 'auto', { format: 2, slot: 'auto', savedAt: 1, meta: { gameDay: 1, playtimeS: 5, label: 'auto' }, sections: M2_SECTIONS });
    expect(await s.mgr.load('auto')).toBe(true);
    expect(s.toasts).toEqual([]);
    expect(s.clock).toEqual({ day: 1, hours: 19.5 });
    expect(s.survival.warmth).toBe(100); // v1 had no warmth
    expect(s.survival.serialize().statuses.map(([id]) => id)).toEqual(['bleeding']); // 'cold' meant nothing in v1
    expect(s.lo.countAll('flashlight_a')).toBe(1); // v1 -> v2 gives a light
    expect(s.lo.countAll('nails')).toBe(20);
    expect(JSON.stringify(s.lo.serialize())).not.toContain('no_such_item_any_more');
    expect(s.cars[0].hp).toBe(80);
    expect(s.quests.state.wake.status).toBe('active'); // pre-quest save: a new game's quests, not the session's
    expect(s.quests.state.route9.status).toBe('locked');
    expect(s.tools.camps).toEqual([]);
  });

  it('a Round 3 save (worldtools v1, no quests): pumps, light charge and car fuel get defaults', async () => {
    const s = session();
    await writeRaw(s, 'quick', { format: 2, slot: 'quick', savedAt: 1, meta: { gameDay: 2, playtimeS: 5, label: 'quick' }, sections: ROUND3_SECTIONS });
    expect(await s.mgr.load('quick')).toBe(true);
    expect(s.clock).toEqual({ day: 2, hours: 6.25 });
    expect(s.survival.warmth).toBe(60);
    expect(s.tools.camps).toHaveLength(1);
    expect(s.tools.radio).toBe(2);
    expect(s.tools.pumps.length).toBeGreaterThan(0);
    expect(s.tools.carFuel).toEqual([]);
  });

  it('a format-1 file migrates to the current format', async () => {
    const s = session();
    await writeRaw(s, 'manual-2', { format: 1, slot: 'manual-2', savedAt: 1, sections: { 'world.time': { v: 1, data: { hours: 3 } } } });
    expect(await s.mgr.load('manual-2')).toBe(true);
    expect(s.clock.hours).toBe(3);
  });

  it('quest saves from an older chain: removed quests ignored, out-of-range steps clamped, broken order demoted', async () => {
    const s = session();
    const quests: QuestSave = {
      state: {
        wake: { status: 'done', step: 99, n: 0 },
        listen: { status: 'done', step: 1, n: 0 },
        old_removed_quest: { status: 'active', step: 2, n: 0 },
        make_do: { status: 'active', step: 7, n: 0 }, // more steps than the quest has now
        farm: { status: 'done', step: 5, n: 0 }, // its requirements are not done: cannot stay done
      },
      tracked: 'old_removed_quest',
      notes: ['note_maple_sick', 42 as unknown as string],
      seen: [],
    };
    await writeRaw(s, 'manual-3', { format: 2, slot: 'manual-3', savedAt: 1, meta: { gameDay: 1, playtimeS: 0, label: '' }, sections: { quests: { v: 1, data: quests } } });
    expect(await s.mgr.load('manual-3')).toBe(true);
    expect(s.quests.state.make_do).toMatchObject({ status: 'active', step: 0 });
    expect(s.quests.state.farm.status).toBe('locked');
    expect(s.quests.tracked).toBe('make_do');
    expect(s.quests.notes).toEqual(['note_maple_sick']);
  });

  it('one broken section is skipped and reported; the rest of the save still loads', async () => {
    const s = session();
    await writeRaw(s, 'auto', {
      format: 2, slot: 'auto', savedAt: 1, meta: { gameDay: 1, playtimeS: 0, label: '' },
      sections: { 'world.time': { v: 2, data: { day: 4, hours: 10 } }, inventory: { v: 99, data: { v: 99 } }, survival: { v: 2, data: { hunger: 12, thirst: 50, fatigue: 50, clock: 0 } } },
    });
    const kit = JSON.stringify(s.lo.serialize().equipment);
    expect(await s.mgr.load('auto')).toBe(true);
    expect(s.clock.day).toBe(4);
    expect(s.survival.hunger).toBe(12); // statuses missing: read as none
    expect(JSON.stringify(s.lo.serialize().equipment)).toBe(kit); // the unreadable inventory left the pack as it was
    expect(s.toasts).toHaveLength(1);
  });

  it('a save from a newer build (unknown format) is refused, not half-loaded', async () => {
    const s = session();
    await writeRaw(s, 'auto', { format: 99, slot: 'auto', savedAt: 1, sections: { 'world.time': { v: 9, data: { day: 9, hours: 9 } } } });
    expect(await s.mgr.load('auto')).toBe(false);
    expect(s.clock).toEqual({ day: 1, hours: 8 });
  });

  it('the starting hotbar is a plain list (old saves without one get it)', () => {
    const s = session();
    const old = s.lo.serialize() as Partial<LoadoutSave>;
    delete old.hotbar;
    delete old.pickups;
    s.lo.load(old as LoadoutSave);
    expect(s.lo.hotbar).toEqual([...INVENTORY.hotbar]);
    expect(s.lo.pickups).toEqual([]);
  });
});
