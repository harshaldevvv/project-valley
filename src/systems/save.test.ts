import { describe, expect, it } from 'vitest';
import { SAVE_FORMAT, SaveManager, sha256 } from './save';
import { memoryKV } from './storage';

const setup = () => {
  const kv = memoryKV();
  const toasts: string[] = [];
  const m = new SaveManager(kv, { toast: (t) => toasts.push(t), saved: () => {}, loaded: () => {}, info: () => ({ gameDay: 2, playtimeS: 60 }) });
  const state = { a: 1, b: [1, 2] as number[] };
  const order: string[] = [];
  m.section('player', { version: 1, save: () => ({ a: state.a }), load: (d) => (order.push('player'), (state.a = (d as { a: number }).a)) });
  m.section('build.pieces', { version: 3, save: () => state.b, load: (d, v) => (order.push(`build@${v}`), (state.b = d as number[])) });
  return { kv, m, state, toasts, order };
};

describe('saves', () => {
  it('round-trips, applies in the data order, keeps 3 generations', async () => {
    const { kv, m, state, order } = setup();
    for (let i = 0; i < 5; i++) {
      state.a = i;
      await m.save('manual-1');
    }
    expect([...kv.raw.gens.keys()].sort()).toEqual(['manual-1:3', 'manual-1:4', 'manual-1:5']);
    state.a = 99;
    state.b = [];
    expect(await m.load('manual-1')).toBe(true);
    expect(state).toEqual({ a: 4, b: [1, 2] });
    expect(order).toEqual(['build@3', 'player']); // build.pieces is before player in SAVE.loadOrder
    expect((await m.list())[0]).toMatchObject({ slot: 'manual-1', gameDay: 2 });
  });

  it('a corrupted generation falls back to the previous one and says so', async () => {
    const { kv, m, state, toasts } = setup();
    state.a = 1;
    await m.save('auto');
    state.a = 2;
    await m.save('auto');
    const rec = kv.raw.gens.get('auto:2') as { json: string };
    rec.json = rec.json.replace('"a":2', '"a":7'); // bit rot: hash no longer matches
    expect(await m.load('auto')).toBe(true);
    expect(state.a).toBe(1);
    expect(toasts).toHaveLength(1);
    expect(await m.load('nope')).toBe(false);
  });

  it('migrates a v1 file to the current format', async () => {
    const { kv, m, state } = setup();
    const v1 = JSON.stringify({ format: 1, slot: 'quick', savedAt: 1, sections: { player: { v: 1, data: { a: 42 } } } });
    kv.raw.gens.set('quick:1', { json: v1, hash: await sha256(v1) });
    kv.raw.meta.set('quick', { slot: 'quick', current: 1, gens: [1], next: 2, info: { slot: 'quick', savedAt: 1, gameDay: 1, playtimeS: 0, label: '' } });
    expect(await m.load('quick')).toBe(true);
    expect(state.a).toBe(42);
    expect(SAVE_FORMAT).toBe(2);
  });

  it('exports and imports a .zsave', async () => {
    const { m, state } = setup();
    state.a = 5;
    await m.save('quick');
    const blob = await m.exportSlot('quick');
    state.a = 0;
    expect(await m.importSlot('manual-2', blob)).toBe(true);
    await m.load('manual-2');
    expect(state.a).toBe(5);
    expect(await m.importSlot('manual-3', new Blob(['junk']))).toBe(false);
  });
});
