import { describe, expect, it } from 'vitest';
import { RECIPE_BY_ID } from '../content/data/crafting';
import { ITEMS } from '../content/data/items';
import { POIS } from '../content/data/pois';
import { QUESTS, QUEST_BY_ID, QUEST_KEYS, QUEST_PLACED } from '../content/data/quests';
import { CONTAINERS, CONTAINER_THEMES } from '../content/data/containers';
import { NPCS } from '../content/data/npc';
import { noteText, questText } from '../content/text/quests';
import { poiText } from '../content/text/pois';
import { bearing } from '../ui/quests/questUi';
import { QUEST_SAVE_VERSION, Quests, type QuestEnv, type QuestEvent } from './quests';

interface World {
  x: number;
  z: number;
  items: Record<string, number>;
  fuel: number;
  hours: number;
  given: [string, number][];
}
const world = (): World => ({ x: 0, z: 0, items: {}, fuel: 0, hours: 6, given: [] });
const mk = (w: World) => {
  const env: QuestEnv = {
    pos: () => ({ x: w.x, z: w.z }),
    count: (i) => w.items[i] ?? 0,
    fuel: () => w.fuel,
    hours: () => w.hours,
    place: (id) => POIS.find((p) => p.id === id),
    give: (i, n) => (w.given.push([i, n]), (w.items[i] = (w.items[i] ?? 0) + n)),
  };
  const q = new Quests(env);
  const events: QuestEvent[] = [];
  q.on((e) => events.push(e));
  return { q, events };
};
const goto = (w: World, poi: string) => {
  const p = POIS.find((x) => x.id === poi)!;
  w.x = p.x;
  w.z = p.z;
};

describe('quest data', () => {
  it('there are 8 to 16 quests with unique ids and a dependency graph that has no cycle and one starting quest', () => {
    expect(QUESTS.length).toBeGreaterThanOrEqual(8);
    expect(QUESTS.length).toBeLessThanOrEqual(16);
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    expect(QUESTS.filter((q) => q.requires.length === 0).map((q) => q.id)).toEqual(['wake']);
    const state = new Map<string, number>();
    const visit = (id: string) => {
      if (state.get(id) === 1) throw new Error(`cycle at ${id}`);
      if (state.get(id) === 2) return;
      state.set(id, 1);
      for (const r of QUEST_BY_ID[id].requires) {
        expect(QUEST_BY_ID[r], `${id} requires ${r}`).toBeTruthy();
        visit(r);
      }
      state.set(id, 2);
    };
    for (const q of QUESTS) visit(q.id);
  });

  it('every id an objective or reward names exists', () => {
    for (const q of QUESTS) {
      expect(q.objectives.length, q.id).toBeGreaterThan(0);
      for (const o of q.objectives) {
        if (o.poi) expect(POIS.find((p) => p.id === o.poi), `${q.id}: poi ${o.poi}`).toBeTruthy();
        if (o.type === 'collect' || o.type === 'use') expect(ITEMS[o.item], `${q.id}: ${o.item}`).toBeTruthy();
        if (o.type === 'craft') expect(RECIPE_BY_ID[o.recipe], `${q.id}: recipe ${o.recipe}`).toBeTruthy();
        if (o.type === 'read') {
          expect(ITEMS[o.note]?.use?.action, `${q.id}: ${o.note}`).toBe('read');
          expect(noteText[o.note], o.note).toBeTruthy();
        }
        if (o.type === 'survive') expect(o.hours).toBeGreaterThan(0);
        if (o.type === 'kill') expect(o.count).toBeGreaterThan(0);
      }
      for (const r of q.rewards) expect(ITEMS[r.item], `${q.id}: reward ${r.item}`).toBeTruthy();
    }
  });

  it('every quest has text with one line per objective, and every place has a name', () => {
    for (const q of QUESTS) {
      const t = questText[q.id];
      expect(t, q.id).toBeTruthy();
      expect(t.objectives, q.id).toHaveLength(q.objectives.length);
      expect(t.title.length).toBeGreaterThan(2);
      expect(t.summary.length).toBeGreaterThan(20);
      expect(t.done.length).toBeGreaterThan(10);
    }
    for (const p of POIS) expect(poiText[p.id], p.id).toBeTruthy();
    for (const [id, n] of Object.entries(noteText)) {
      expect(ITEMS[id], id).toBeTruthy();
      expect(n.body.split(/\s+/).length, id).toBeLessThan(120); // principles: notes under 120 words
    }
  });

  it('quest items are placed in containers that exist in the world data, with a theme that fits the place', () => {
    const mods = Object.values(import.meta.glob('../content/data/pois.ts', { eager: true })) as { poiSpots?: { id: string; type: string; theme: string }[] }[];
    const spots = mods[0]?.poiSpots ?? [];
    for (const p of QUEST_PLACED) {
      expect(ITEMS[p.item], p.item).toBeTruthy();
      const spot = spots.find((s) => `poi_${s.id}` === p.container);
      expect(spot, `container ${p.container} is not placed by the world`).toBeTruthy();
      expect(CONTAINER_THEMES[spot!.theme], spot!.theme).toBeTruthy();
    }
    // every note a quest asks the player to read is placed somewhere
    for (const q of QUESTS) for (const o of q.objectives) if (o.type === 'read') expect(QUEST_PLACED.some((p) => p.item === o.note), o.note).toBe(true);
  });

  it('rewards are modest: a quest pays at most 1000 in item value (the finale is the biggest) and cash is capped across the chain', () => {
    for (const q of QUESTS) {
      const value = q.rewards.reduce((s, r) => s + (ITEMS[r.item].value ?? 0) * r.count, 0);
      expect(value, q.id).toBeLessThanOrEqual(1000);
    }
    expect(QUESTS.flatMap((q) => q.rewards).filter((r) => r.item === 'cash').reduce((s, r) => s + r.count, 0)).toBeLessThanOrEqual(400);
  });
});

describe('progress rules', () => {
  it('only the first quest is active at the start, and finishing one unlocks the next', () => {
    const w = world();
    const { q, events } = mk(w);
    expect(q.active().map((x) => x.id)).toEqual(['wake']);
    expect(q.tracked).toBe('wake');
    q.report({ type: 'use', item: 'flashlight_a' });
    expect(q.state.wake.status).toBe('done');
    expect(q.state.listen.status).toBe('active');
    expect(events.map((e) => e.type)).toEqual(['step', 'done', 'started']);
    expect(w.given.map((g) => g[0])).toEqual(['radio_handheld', 'battery', 'cloth_rag']);
    expect(q.tracked).toBe('listen');
  });

  it('objectives are done in order: a later signal is ignored until it is current', () => {
    const w = world();
    const { q } = mk(w);
    q.report({ type: 'use', item: 'radio_handheld' }); // listen is not even active yet
    q.report({ type: 'craft', recipe: 'bandage' });
    expect(q.state.listen.status).toBe('locked');
    q.report({ type: 'use', item: 'flashlight_a' });
    expect(q.state.listen.step).toBe(0);
    q.report({ type: 'use', item: 'radio_handheld' });
    expect(q.state.listen.status).toBe('done');
    q.report({ type: 'craft', recipe: 'campfire_kit' }); // wrong recipe for make_do
    expect(q.state.make_do.status).toBe('active');
    q.report({ type: 'craft', recipe: 'bandage' });
    expect(q.state.make_do.status).toBe('done');
  });

  const through = (q: Quests, upTo: string) => {
    for (const id of ['wake', 'listen', 'make_do', 'route9', 'maple', 'farm', 'camp', 'crash', 'ranger']) {
      if (id === upTo) return;
      for (let i = 0; i < 12 && q.state[id].status === 'active'; i++) q.skip(id);
    }
  };

  it('go-to, fuel, event: the Route 9 quest walks the player through all three', () => {
    const w = world();
    const { q } = mk(w);
    through(q, 'route9');
    expect(q.current('route9')).toMatchObject({ type: 'goto', poi: 'fuel' });
    expect(q.target('route9')).toMatchObject({ poi: 'fuel' });
    q.tick();
    expect(q.state.route9.step).toBe(0);
    goto(w, 'fuel');
    q.tick();
    expect(q.current('route9')).toMatchObject({ type: 'fuel' });
    expect(q.counter('route9')).toEqual([0, 12]);
    w.fuel = 8;
    q.tick();
    expect(q.counter('route9')).toEqual([8, 12]);
    w.fuel = 12;
    q.tick();
    expect(q.current('route9')).toMatchObject({ type: 'event', name: 'refuel' });
    q.report({ type: 'event', name: 'campfire_lit' }); // some other signal
    expect(q.state.route9.status).toBe('active');
    q.report({ type: 'event', name: 'refuel' });
    expect(q.state.route9.status).toBe('done');
    expect(w.given).toContainEqual(['repair_kit', 1]);
  });

  it('collecting counts what is carried, and an already-held item completes at once', () => {
    const w = world();
    w.items.antibiotics = 1;
    const { q } = mk(w);
    through(q, 'maple');
    goto(w, 'maple');
    q.tick();
    q.report({ type: 'note', id: 'note_maple_sick' });
    expect(q.current('maple')).toMatchObject({ type: 'give' }); // the pills were already in the pack: on to handing them over
    q.report({ type: 'give', npc: 'eli', item: 'antibiotics' });
    expect(q.state.maple.status).toBe('done');
  });

  it('kills in an area count only there, and the counter reports progress', () => {
    const w = world();
    const { q, events } = mk(w);
    through(q, 'crash');
    const crash = POIS.find((p) => p.id === 'crash')!;
    goto(w, 'crash');
    q.tick();
    q.report({ type: 'note', id: 'note_crash_log' });
    expect(q.current('crash')).toMatchObject({ type: 'kill', count: 4 });
    q.report({ type: 'kill', x: crash.x + 300, z: crash.z }); // far away: no
    expect(q.counter('crash')).toEqual([0, 4]);
    for (let i = 0; i < 3; i++) q.report({ type: 'kill', x: crash.x + 5, z: crash.z });
    expect(q.counter('crash')).toEqual([3, 4]);
    expect(events.some((e) => e.type === 'progress' && e.n === 3)).toBe(true);
    q.report({ type: 'kill', x: crash.x, z: crash.z - 4 });
    expect(q.current('crash')).toMatchObject({ type: 'collect', item: 'adrenaline_shot' });
    w.items.adrenaline_shot = 1;
    q.tick();
    expect(q.state.crash.status).toBe('done');
  });

  it('survive counts in-game hours from when the objective began', () => {
    const w = world();
    const { q } = mk(w);
    through(q, 'camp');
    goto(w, 'camp');
    q.tick();
    q.report({ type: 'note', id: 'note_camp_diary' });
    expect(q.current('camp')).toMatchObject({ type: 'survive' });
    w.hours += 1;
    q.tick();
    expect(q.state.camp.status).toBe('active');
    expect(q.counter('camp')![0]).toBe(67);
    w.hours += 0.6;
    q.tick();
    expect(q.state.camp.status).toBe('done');
  });

  it('an event with a place needs the player there; the finale unlocks nothing after it', () => {
    const w = world();
    const { q } = mk(w);
    through(q, 'ranger');
    goto(w, 'ranger');
    q.tick();
    q.report({ type: 'note', id: 'note_ranger_log' });
    w.x = 0;
    w.z = 0;
    q.report({ type: 'event', name: 'radio' }); // from the yard: not at the lookout
    expect(q.state.ranger.status).toBe('active');
    goto(w, 'ranger');
    q.report({ type: 'event', name: 'radio', poi: 'ranger' });
    expect(q.state.ranger.status).toBe('done');
    expect(q.active().map((x) => x.id)).toEqual(['school', 'lake_dock', 'dunmore_fever']); // only side quests are left
    expect(q.active().every((x) => x.side)).toBe(true);
    expect(q.tracked).toBe('school');
    for (let n = 0; n < 40 && q.active().length; n++) for (const a of q.active()) q.skip(a.id);
    expect(q.active()).toEqual([]);
    expect(q.tracked).toBeNull();
  });

  it('a side quest runs alongside the main one and the tracker prefers the main one', () => {
    const w = world();
    const { q } = mk(w);
    through(q, 'camp');
    expect(q.state.camp.status).toBe('active');
    expect(q.state.school.status).toBe('active');
    expect(q.tracked).toBe('camp');
    q.track('school');
    expect(q.tracked).toBe('school');
    q.track('wake'); // done: cannot track
    expect(q.tracked).toBe('school');
  });

  it('notes read are remembered once, in order', () => {
    const { q } = mk(world());
    q.report({ type: 'note', id: 'note_a' });
    q.report({ type: 'note', id: 'note_b' });
    q.report({ type: 'note', id: 'note_a' });
    expect(q.notes).toEqual(['note_a', 'note_b']);
  });

  it('a note read before its objective comes up still counts (no need to find it again)', () => {
    const w = world();
    const { q } = mk(w);
    for (const id of ['wake', 'listen', 'make_do', 'route9']) for (let i = 0; i < 10 && q.state[id].status === 'active'; i++) q.skip(id);
    q.report({ type: 'note', id: 'note_maple_sick' }); // read in the house before the Maple Street objective ticked
    expect(q.current('maple')).toMatchObject({ type: 'goto' });
    goto(w, 'maple');
    q.tick();
    expect(q.current('maple')).toMatchObject({ type: 'collect' });
  });

  it('Loon Lake -> Camp Harlan: crystal to Tobin, the radio at the outpost, a kill count inside the wire, the letter back to Tobin', () => {
    const w = world();
    const { q } = mk(w);
    through(q, 'ranger'); // the chain opens after the crash site
    expect(q.state.lake_dock.status).toBe('active');
    expect(QUEST_BY_ID.lake_dock.side && QUEST_BY_ID.harlan_static.side && QUEST_BY_ID.harlan_clear.side).toBe(true);
    goto(w, 'lake');
    q.tick();
    expect(q.current('lake_dock')).toMatchObject({ type: 'collect', item: 'radio_crystal' });
    expect(q.target('lake_dock')?.poi).toBe('lake');
    w.items.radio_crystal = 1;
    q.tick();
    q.report({ type: 'give', npc: 'eli', item: 'radio_crystal' }); // wrong person
    expect(q.state.lake_dock.status).toBe('active');
    q.report({ type: 'give', npc: 'tobin', item: 'radio_crystal' });
    expect(q.state.lake_dock.status).toBe('done');
    q.report({ type: 'note', id: 'note_lake_scanner' });
    goto(w, 'outpost');
    q.tick();
    q.report({ type: 'event', name: 'radio', poi: 'lake' }); // the radio at the lake does not count
    expect(q.state.harlan_static.status).toBe('active');
    q.report({ type: 'event', name: 'radio', poi: 'outpost' });
    expect(q.state.harlan_static.status).toBe('done');
    const lake = POIS.find((p) => p.id === 'lake')!;
    const outpost = POIS.find((p) => p.id === 'outpost')!;
    q.report({ type: 'kill', x: lake.x, z: lake.z }); // not inside the wire
    expect(q.counter('harlan_clear')).toEqual([0, 8]);
    for (let i = 0; i < 8; i++) q.report({ type: 'kill', x: outpost.x + 3, z: outpost.z - 2 });
    expect(q.current('harlan_clear')).toMatchObject({ type: 'read', note: 'note_harlan_medic' });
    q.report({ type: 'note', id: 'note_harlan_medic' });
    q.report({ type: 'give', npc: 'tobin', item: 'note_harlan_medic' });
    expect(q.state.harlan_clear.status).toBe('done');
    expect(w.given.map((g) => g[0])).toContain('field_manual');
  });

  it('Dunmore: Walt gets two painkillers, the evidence key opens the locker, June is handed her letter and her bag at the diner', () => {
    const w = world();
    const { q } = mk(w);
    through(q, 'farm'); // opens after Maple Street
    expect(q.state.dunmore_fever.status).toBe('active');
    expect(q.state.dunmore_evidence.status).toBe('locked');
    goto(w, 'town');
    q.tick();
    q.report({ type: 'note', id: 'note_pharmacy_ledger' });
    expect(q.current('dunmore_fever')).toMatchObject({ type: 'collect', item: 'painkillers', count: 2 });
    w.items.painkillers = 2;
    q.tick();
    q.report({ type: 'give', npc: 'walt', item: 'painkillers' });
    expect(q.state.dunmore_fever.status).toBe('done');
    expect(q.state.dunmore_evidence.status).toBe('active');
    expect(q.state.dunmore_motel.status).toBe('active');
    // evidence locker
    goto(w, 'police');
    q.tick();
    q.report({ type: 'note', id: 'note_police_duty' });
    expect(q.current('dunmore_evidence')).toMatchObject({ type: 'collect', item: 'key_evidence' });
    w.items.key_evidence = 1;
    q.tick();
    q.report({ type: 'note', id: 'note_evidence_log' });
    expect(q.state.dunmore_evidence.status).toBe('done');
    // June: street, letter, hand-off, diner
    const town = POIS.find((p) => p.id === 'town')!;
    for (let i = 0; i < 5; i++) q.report({ type: 'kill', x: town.x + 4, z: town.z });
    q.report({ type: 'note', id: 'note_motel_letter' });
    q.report({ type: 'give', npc: 'june_diner', item: 'note_motel_letter' }); // wrong June
    expect(q.current('dunmore_motel')).toMatchObject({ type: 'give', npc: 'june' });
    q.report({ type: 'give', npc: 'june', item: 'note_motel_letter' });
    expect(q.current('dunmore_motel')).toMatchObject({ type: 'goto', poi: 'diner' });
    goto(w, 'diner');
    q.tick();
    q.report({ type: 'give', npc: 'june_diner', item: 'june_bag' });
    expect(q.state.dunmore_motel.status).toBe('done');
    expect(w.given.map((g) => g[0])).toEqual(expect.arrayContaining(['first_aid_pouch', 'police_jacket', 'hunting_jacket']));
  });

  it('quest keys open a locked container the world places, the key is placed in an unlocked one, and the hand-off NPCs pair up', () => {
    const spots = (Object.values(import.meta.glob('../content/data/pois.ts', { eager: true }))[0] as { poiSpots: { id: string; type: string }[] }).poiSpots;
    for (const [cid, key] of Object.entries(QUEST_KEYS)) {
      const spot = spots.find((s) => `poi_${s.id}` === cid);
      expect(spot, cid).toBeTruthy();
      expect(CONTAINERS[spot!.type].lock, cid).toBeGreaterThan(0);
      expect(ITEMS[key]?.value, key).toBe(0);
      const at = QUEST_PLACED.find((p) => p.item === key);
      expect(at, `${key} is placed`).toBeTruthy();
      const home = spots.find((s) => `poi_${s.id}` === at!.container)!;
      expect(CONTAINERS[home.type].lock, `${key} must not sit behind a lock`).toBe(0);
      // whatever the quest reads behind the lock is placed there
      expect(QUEST_PLACED.some((p) => p.container === cid)).toBe(true);
    }
    // every flag-shown NPC has a twin hidden by the same flag
    for (const n of NPCS.filter((x) => x.show)) expect(NPCS.some((m) => m !== n && m.show?.flag === n.show!.flag && !!m.show.not !== !!n.show!.not), n.id).toBe(true);
  });

  it('the chain reward unlocks a recipe: the field manual is a tool of a recipe, is only a quest reward, and reads as a note', () => {
    const unlocked = Object.values(RECIPE_BY_ID).filter((r) => (r.tools ?? []).some((g) => g.length === 1 && g[0] === 'field_manual'));
    expect(unlocked.map((r) => r.id)).toEqual(['ifak']);
    expect(QUEST_BY_ID.harlan_clear.rewards.map((r) => r.item)).toContain('field_manual');
    expect(QUESTS.filter((d) => d.rewards.some((r) => r.item === 'field_manual')).map((d) => d.id)).toEqual(['harlan_clear']);
    expect(ITEMS.field_manual.use?.action).toBe('read');
    expect(ITEMS.field_manual.use?.keep).toBe(true);
    expect(noteText.field_manual?.body.length).toBeGreaterThan(20);
  });

  it('the whole chain can be finished by playing it through, and ends with no active quest', () => {
    const w = world();
    const { q } = mk(w);
    for (let n = 0; n < 200 && q.active().length; n++) for (const a of q.active()) q.skip(a.id);
    expect(q.done()).toHaveLength(QUESTS.length);
    for (const d of QUESTS) expect(q.state[d.id].status).toBe('done');
    expect(w.given.length).toBeGreaterThan(20);
  });
});

describe('quest saves', () => {
  it('round-trips through JSON mid-chain: step, counter, tracker, notes', () => {
    const w = world();
    const a = mk(w).q;
    for (const id of ['wake', 'listen', 'make_do', 'route9', 'maple', 'farm', 'camp']) for (let i = 0; i < 10 && a.state[id].status === 'active'; i++) a.skip(id);
    const crash = POIS.find((p) => p.id === 'crash')!;
    goto(w, 'crash');
    a.tick();
    a.report({ type: 'note', id: 'note_crash_log' });
    a.report({ type: 'kill', x: crash.x, z: crash.z });
    a.report({ type: 'kill', x: crash.x, z: crash.z });
    a.track('crash');
    const json = JSON.parse(JSON.stringify(a.serialize()));
    const b = mk(world()).q;
    b.load(json, QUEST_SAVE_VERSION);
    expect(b.state).toEqual(a.state);
    expect(b.counter('crash')).toEqual([2, 4]);
    expect(b.tracked).toBe('crash');
    expect(b.notes).toEqual(['note_crash_log']);
    expect(JSON.stringify(b.serialize())).toBe(JSON.stringify(a.serialize()));
  });

  it('a save from an older version of the chain loads: unknown quests are ignored, new ones start locked and unlock', () => {
    const { q } = mk(world());
    q.load({ state: { wake: { status: 'done', step: 0, n: 0 }, gone_quest: { status: 'active', step: 3, n: 1 }, listen: { status: 'active', step: 99, n: 0 } }, tracked: 'gone_quest', notes: ['x'], seen: [] });
    expect(q.state.wake.status).toBe('done');
    expect(q.state.listen.status).toBe('active');
    expect(q.state.listen.step).toBe(0); // clamped to the last real objective
    expect(q.state.gone_quest).toBeUndefined();
    expect(q.tracked).toBe('listen');
    expect(q.state.make_do.status).toBe('locked');
  });

  it('a quest saved as done whose requirement is not done is demoted rather than trusted', () => {
    const { q } = mk(world());
    q.load({ state: { crash: { status: 'done', step: 3, n: 0 } }, tracked: null, notes: [], seen: [] });
    expect(q.state.crash.status).toBe('locked');
    expect(q.state.wake.status).toBe('active');
  });

  it('an empty slice (a game saved before quests existed) starts the chain', () => {
    const { q } = mk(world());
    q.load({ state: {}, tracked: null, notes: [], seen: [] });
    expect(q.active().map((x) => x.id)).toEqual(['wake']);
  });
});

describe('direction marker', () => {
  it('straight ahead is 0, to the right is positive, and the compass name follows the world not the view', () => {
    const north = { x: 0, z: -1 }; // facing north (-z)
    expect(bearing({ x: 0, z: 0 }, north, { x: 0, z: -50 }).rel).toBeCloseTo(0);
    expect(bearing({ x: 0, z: 0 }, north, { x: 0, z: -50 }).compass).toBe('N');
    expect(bearing({ x: 0, z: 0 }, north, { x: 50, z: 0 }).rel).toBeCloseTo(Math.PI / 2);
    expect(bearing({ x: 0, z: 0 }, north, { x: 50, z: 0 }).compass).toBe('E');
    expect(bearing({ x: 0, z: 0 }, north, { x: -50, z: 0 }).rel).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(bearing({ x: 0, z: 0 }, north, { x: 0, z: 50 }).rel)).toBeCloseTo(Math.PI);
    expect(bearing({ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 50, z: 0 }).rel).toBeCloseTo(0); // facing east, target east
    expect(bearing({ x: 0, z: 0 }, north, { x: 30, z: 30 }).compass).toBe('SE');
  });
});
