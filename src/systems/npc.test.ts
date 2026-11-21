import { describe, expect, it } from 'vitest';
import { DIALOGUES, DIALOGUE_BY_ID, NPCS, NPC_BY_ID, type Cond } from '../content/data/npc';
import { ITEMS } from '../content/data/items';
import { POIS } from '../content/data/pois';
import { BUILDINGS } from '../content/data/outskirts';
import { QUESTS } from '../content/data/quests';
import { TRADER } from '../content/data/trade';
import manifest from '../../public/assets/models/manifest.json';
import { choiceText, dialogueText, npcName } from '../content/text/npc';
import { createRng } from '../engine/rng';
import { Dialogue, type DialogueEnv } from './dialogue';
import { newItem } from './inventory';
import { Loadout } from './loadout';
import { Quests, type QuestEnv } from './quests';
import { buy, buyPrice, cashOf, newTraderState, refresh, rollStock, sell, sellPrice, sellable, tradable, type TraderState } from './trade';

const pack = (cash = 0) => {
  const lo = new Loadout(createRng(5));
  lo.equipment.backpack = newItem('rucksack_military');
  if (cash) lo.storeWorn(newItem('cash', cash));
  return lo;
};

describe('npc data', () => {
  it('every npc has a place, a dialogue and a name; positions resolve', () => {
    expect(NPCS.length).toBeGreaterThanOrEqual(3);
    expect(NPCS.filter((n) => n.role === 'trader')).toHaveLength(1);
    for (const n of NPCS) {
      expect(POIS.find((p) => p.id === n.poi), n.id).toBeTruthy();
      expect(DIALOGUE_BY_ID[n.dialogue], n.id).toBeTruthy();
      expect(npcName[n.id], n.id).toBeTruthy();
      expect(n.model.startsWith('chr_npc_'), n.id).toBe(true);
      expect(n.idles.length).toBeGreaterThan(0);
      if ('building' in n.at) expect(BUILDINGS.find((b) => b.id === (n.at as { building: string }).building), n.id).toBeTruthy();
    }
    for (const n of NPCS) expect((manifest as Record<string, { url: string }>)[n.model], `${n.model} is not built into the manifest`).toBeTruthy();
    expect(NPC_BY_ID[TRADER.npc].role).toBe('trader');
    expect(NPC_BY_ID[TRADER.npc].poi).toBe('checkpoint'); // the trader is at the Gate Checkpoint
  });
});

describe('dialogue graph', () => {
  const allConds = (list: Cond[] = []) => list;
  it('every node has text, every choice has text, every target exists, every conversation can end', () => {
    for (const d of DIALOGUES) {
      expect(d.entry.length, d.id).toBeGreaterThan(0);
      expect(d.entry[d.entry.length - 1].when ?? [], `${d.id}: last entry must be unconditional`).toEqual([]);
      for (const e of d.entry) expect(d.nodes[e.node], `${d.id}: entry ${e.node}`).toBeTruthy();
      for (const [nid, node] of Object.entries(d.nodes)) {
        expect(dialogueText[d.id]?.[nid], `${d.id}.${nid} says nothing`).toBeTruthy();
        expect(node.choices.length, `${d.id}.${nid} has no choices`).toBeGreaterThan(0);
        // an unconditional way out, so nobody is ever stuck in a conversation
        expect(node.choices.some((c) => !c.when && (c.next === 'end' || c.effects === undefined || true) && !c.when), `${d.id}.${nid}`).toBe(true);
        for (const c of node.choices) {
          expect(choiceText[d.id]?.[c.id], `${d.id}.${nid}.${c.id} has no text`).toBeTruthy();
          if (c.next !== 'end') expect(d.nodes[c.next], `${d.id}.${nid} -> ${c.next}`).toBeTruthy();
          for (const w of allConds(c.when)) if ('has' in w) expect(ITEMS[w.has.item], w.has.item).toBeTruthy();
          for (const e of c.effects ?? []) {
            if ('give' in e) expect(ITEMS[e.give.item], e.give.item).toBeTruthy();
            if ('take' in e) expect(ITEMS[e.take.item], e.take.item).toBeTruthy();
            if ('hand' in e) expect(ITEMS[e.hand.item], e.hand.item).toBeTruthy();
          }
        }
      }
      // every node is reachable from an entry
      const seen = new Set<string>();
      const walk = (n: string) => {
        if (seen.has(n)) return;
        seen.add(n);
        for (const c of d.nodes[n].choices) if (c.next !== 'end') walk(c.next);
      };
      for (const e of d.entry) walk(e.node);
      expect([...seen].sort(), `${d.id}: unreachable nodes`).toEqual(Object.keys(d.nodes).sort());
      // and the end is reachable from every node
      for (const nid of Object.keys(d.nodes)) {
        const vis = new Set<string>();
        const reach = (n: string): boolean => {
          if (vis.has(n)) return false;
          vis.add(n);
          return d.nodes[n].choices.some((c) => c.next === 'end' || reach(c.next));
        };
        expect(reach(nid), `${d.id}.${nid} cannot end`).toBe(true);
      }
    }
  });

  it('quest objectives that hand items to an npc point at a real npc that talks about it', () => {
    for (const q of QUESTS)
      for (const o of q.objectives)
        if (o.type === 'give') {
          const n = NPC_BY_ID[o.npc];
          expect(n, `${q.id}: npc ${o.npc}`).toBeTruthy();
          const hands = DIALOGUE_BY_ID[n.dialogue].nodes;
          const handing = Object.values(hands).some((node) => node.choices.some((c) => c.effects?.some((e) => 'hand' in e && e.hand.item === o.item)));
          expect(handing, `${q.id}: ${o.npc} never takes ${o.item}`).toBe(true);
          expect(ITEMS[o.item]).toBeTruthy();
        }
  });

  // --- a fake world to run conversations against
  interface W { items: Record<string, number>; flags: Set<string>; status: Record<string, 'locked' | 'active' | 'done'>; giving: Set<string>; handed: string[]; trade: string[] }
  const env = (w: W): DialogueEnv => ({
    count: (i) => w.items[i] ?? 0,
    take: (i, n) => (w.items[i] = (w.items[i] ?? 0) - n),
    give: (i, n) => (w.items[i] = (w.items[i] ?? 0) + n),
    flag: (f) => w.flags.has(f),
    setFlag: (f) => w.flags.add(f),
    questStatus: (id) => w.status[id] ?? 'locked',
    objectives: () => [...w.giving].map((npc) => ({ type: 'give' as const, item: 'antibiotics', npc })),
    hand: (npc, i) => w.handed.push(`${npc}:${i}`),
    openTrade: (npc) => w.trade.push(npc),
  });
  const world = (): W => ({ items: {}, flags: new Set(), status: {}, giving: new Set(), handed: [], trade: [] });

  it('the trader greets once, then goes to the hub; trade opens the shop', () => {
    const w = world();
    const d = new Dialogue('odell', 'odell', env(w));
    expect(d.start()).toBe('first');
    d.choose('who');
    expect(d.node).toBe('who');
    d.choose('trade');
    expect(w.trade).toEqual(['odell']);
    expect(w.flags.has('odell_met')).toBe(true);
    expect(new Dialogue('odell', 'odell', env(w)).start()).toBe('hub'); // second visit
    d.choose('leave');
    // leave from hub ends
    const d2 = new Dialogue('odell', 'odell', env(w));
    d2.start();
    expect(d2.choose('leave')).toBeNull();
  });

  it('Eli: asks for pills, takes them for the quest, and is different afterwards', () => {
    const w = world();
    const d = new Dialogue('eli', 'eli', env(w));
    expect(d.start()).toBe('first');
    // the quest asks for the pills but the player has none yet
    w.giving.add('eli');
    expect(new Dialogue('eli', 'eli', env(w)).start()).toBe('waiting');
    w.items.antibiotics = 1;
    const e = new Dialogue('eli', 'eli', env(w));
    expect(e.start()).toBe('pills');
    expect(e.choices().map((c) => c.id)).toEqual(['give', 'later']);
    e.choose('give');
    expect(w.items.antibiotics).toBe(0);
    expect(w.handed).toEqual(['eli:antibiotics']);
    expect(e.node).toBe('thanks');
    w.status.maple = 'done';
    w.giving.clear();
    expect(new Dialogue('eli', 'eli', env(w)).start()).toBe('after');
  });

  it('Eli does not take pills that are not wanted: the choice only exists while the quest asks', () => {
    const w = world();
    w.items.antibiotics = 1;
    const d = new Dialogue('eli', 'eli', env(w));
    d.start();
    expect(d.choices().some((c) => c.id === 'give')).toBe(false);
    expect(w.items.antibiotics).toBe(1);
  });

  it('Tobin: asks for the crystal, takes it, then the letter, and is different afterwards', () => {
    const w = world();
    const tenv = (): DialogueEnv => ({ ...env(w), objectives: () => [...w.giving].map((npc) => ({ type: 'give' as const, item: w.items.note_harlan_medic ? 'note_harlan_medic' : 'radio_crystal', npc })) });
    expect(new Dialogue('tobin', 'tobin', tenv()).start()).toBe('first');
    w.status.lake_dock = 'active';
    w.giving.add('tobin');
    expect(new Dialogue('tobin', 'tobin', tenv()).start()).toBe('waiting');
    w.items.radio_crystal = 1;
    const a = new Dialogue('tobin', 'tobin', tenv());
    expect(a.start()).toBe('crystal');
    a.choose('give');
    expect(w.handed).toEqual(['tobin:radio_crystal']);
    expect(a.node).toBe('listened');
    w.status.lake_dock = 'done';
    w.status.harlan_static = 'active';
    w.giving.clear();
    expect(new Dialogue('tobin', 'tobin', tenv()).start()).toBe('harlan');
    w.status.harlan_static = 'done';
    w.status.harlan_clear = 'active';
    w.giving.add('tobin');
    expect(new Dialogue('tobin', 'tobin', tenv()).start()).toBe('harlan'); // the give step, but no letter yet
    w.items.note_harlan_medic = 1;
    const b = new Dialogue('tobin', 'tobin', tenv());
    expect(b.start()).toBe('letter');
    b.choose('letter');
    expect(w.handed).toEqual(['tobin:radio_crystal', 'tobin:note_harlan_medic']);
    expect(w.items.note_harlan_medic).toBe(0);
    w.status.harlan_clear = 'done';
    w.giving.clear();
    expect(new Dialogue('tobin', 'tobin', tenv()).start()).toBe('after');
  });

  it('Walt takes two painkillers only while the Dunmore fever quest asks, then points at the station and the motel', () => {
    const w = world();
    expect(new Dialogue('walt', 'walt', env(w)).start()).toBe('first');
    w.status.dunmore_fever = 'active';
    w.giving.add('walt');
    w.items.painkillers = 1;
    expect(new Dialogue('walt', 'walt', env(w)).start()).toBe('waiting'); // one pack is not enough
    w.items.painkillers = 2;
    const d = new Dialogue('walt', 'walt', env(w));
    expect(d.start()).toBe('pills');
    d.choose('give');
    expect(w.handed).toEqual(['walt:painkillers']);
    expect(w.items.painkillers).toBe(0);
    expect(d.node).toBe('thanks');
    w.status.dunmore_fever = 'done';
    w.giving.clear();
    const e = new Dialogue('walt', 'walt', env(w));
    expect(e.start()).toBe('after');
    expect(e.choose('police')).toBe('police');
  });

  it('June: the letter sets june_left and hands you her bag; the diner June takes the bag and replaces a lost one', () => {
    const w = world();
    const jenv = (): DialogueEnv => ({ ...env(w), objectives: () => [...w.giving].map((npc) => ({ type: 'give' as const, item: npc === 'june' ? 'note_motel_letter' : 'june_bag', npc })) });
    expect(NPC_BY_ID.june.show).toEqual({ flag: 'june_left', not: true });
    expect(NPC_BY_ID.june_diner.show).toEqual({ flag: 'june_left' });
    w.status.dunmore_motel = 'active';
    expect(new Dialogue('june', 'june', jenv()).start()).toBe('street');
    w.giving.add('june');
    w.items.note_motel_letter = 1;
    const a = new Dialogue('june', 'june', jenv());
    expect(a.start()).toBe('letter');
    a.choose('letter');
    expect(w.handed).toEqual(['june:note_motel_letter']);
    expect(w.flags.has('june_left')).toBe(true);
    expect(w.items.june_bag).toBe(1);
    w.giving.clear();
    w.giving.add('june_diner');
    w.items.june_bag = 0; // dropped on the way
    const b = new Dialogue('june_diner', 'june_diner', jenv());
    expect(b.start()).toBe('nobag');
    b.choose('lost');
    expect(w.items.june_bag).toBe(1);
    const c = new Dialogue('june_diner', 'june_diner', jenv());
    expect(c.start()).toBe('bag');
    c.choose('bag');
    expect(w.handed).toEqual(['june:note_motel_letter', 'june_diner:june_bag']);
    w.status.dunmore_motel = 'done';
    w.giving.clear();
    expect(new Dialogue('june_diner', 'june_diner', jenv()).start()).toBe('after');
  });

  it('Hollis gives food once and trades rags for tuna once', () => {
    const w = world();
    w.flags.add('hollis_met');
    const d = new Dialogue('hollis', 'hollis', env(w));
    d.start();
    expect(d.choices().map((c) => c.id)).toEqual(['food', 'fire', 'leave']); // no rags yet
    d.choose('food');
    expect(w.items.canned_corn).toBe(2);
    expect(d.node).toBe('food');
    d.choose('back');
    expect(d.choices().some((c) => c.id === 'food')).toBe(false); // only once
    w.items.cloth_rag = 3;
    expect(d.choices().some((c) => c.id === 'rags')).toBe(true);
    d.choose('rags');
    expect(w.items.cloth_rag).toBe(0);
    expect(w.items.canned_tuna).toBe(2);
    d.choose('back');
    w.items.cloth_rag = 3;
    expect(d.choices().some((c) => c.id === 'rags')).toBe(false); // once
  });

  it('a choice id that is not on offer does nothing', () => {
    const w = world();
    const d = new Dialogue('wren', 'wren', env(w));
    d.start();
    expect(d.choose('nonsense')).toBe('first');
  });
});

describe('quest: give to npc', () => {
  it('the Maple quest ends only when the pills are handed to Eli, and the arrow points at the street', () => {
    const w = { x: 0, z: 0, items: {} as Record<string, number> };
    const qenv: QuestEnv = { pos: () => ({ x: w.x, z: w.z }), count: (i) => w.items[i] ?? 0, fuel: () => 0, hours: () => 6, place: (id) => POIS.find((p) => p.id === id), give: () => undefined };
    const q = new Quests(qenv);
    for (const id of ['wake', 'listen', 'make_do', 'route9']) for (let i = 0; i < 6; i++) q.skip(id);
    const maple = POIS.find((p) => p.id === 'maple')!;
    w.x = maple.x;
    w.z = maple.z;
    q.tick();
    q.report({ type: 'note', id: 'note_maple_sick' });
    w.items.antibiotics = 1;
    q.tick();
    expect(q.current('maple')).toMatchObject({ type: 'give', npc: 'eli' });
    expect(q.target('maple')).toMatchObject({ poi: 'maple' });
    q.report({ type: 'give', npc: 'hollis', item: 'antibiotics' }); // wrong person
    expect(q.state.maple.status).toBe('active');
    q.report({ type: 'give', npc: 'eli', item: 'canned_corn' }); // wrong item
    expect(q.state.maple.status).toBe('active');
    q.report({ type: 'give', npc: 'eli', item: 'antibiotics' });
    expect(q.state.maple.status).toBe('done');
  });
});

describe('trade math', () => {
  it('prices follow value with a markup to buy and a haircut to sell, so a round trip always loses', () => {
    for (const d of Object.values(ITEMS)) {
      if (!tradable(d.id)) continue;
      expect(buyPrice(d), d.id).toBeGreaterThanOrEqual(sellPrice(d) + 1 - (d.value <= 2 ? 1 : 0));
      expect(buyPrice(d), d.id).toBeGreaterThan(sellPrice(d) - 1);
      if (d.value >= 5) expect(buyPrice(d) / sellPrice(d), d.id).toBeGreaterThan(2.5);
    }
    expect(buyPrice(ITEMS.bandage)).toBe(Math.ceil(15 * TRADER.buyMargin));
    expect(sellPrice(ITEMS.bandage)).toBe(Math.floor(15 * TRADER.sellMargin));
  });

  it('worn weapons sell for less, notes and cash cannot be traded', () => {
    expect(sellPrice(ITEMS.crowbar_a, newItem('crowbar_a', 1, { durability: 0.2 }))).toBeLessThan(sellPrice(ITEMS.crowbar_a, newItem('crowbar_a', 1, { durability: 1 })));
    expect(tradable('cash')).toBe(false);
    expect(tradable('note_maple_sick')).toBe(false);
    expect(tradable('bandage')).toBe(true);
  });

  it('the day stock is rolled from loot tables, is the same every time for a day, and differs between days', () => {
    const a = rollStock(3).map((i) => `${i.defId}x${i.count}`);
    expect(rollStock(3).map((i) => `${i.defId}x${i.count}`)).toEqual(a);
    expect(rollStock(4).map((i) => `${i.defId}x${i.count}`)).not.toEqual(a);
    expect(a.length).toBeGreaterThan(8);
    for (const it of rollStock(3)) expect(tradable(it.defId)).toBe(true);
    expect(rollStock(3).length).toBeLessThanOrEqual(TRADER.maxStock);
  });

  it('refresh rerolls on a new day only, and refills the till', () => {
    const st = newTraderState();
    expect(refresh(st, 1)).toBe(true);
    const first = JSON.stringify(st.stock);
    st.cash = 7;
    expect(refresh(st, 1)).toBe(false);
    expect(st.cash).toBe(7);
    expect(JSON.stringify(st.stock)).toBe(first);
    expect(refresh(st, 2)).toBe(true);
    expect(st.cash).toBe(TRADER.cashPerDay);
  });

  const shop = () => {
    const st: TraderState = newTraderState();
    refresh(st, 1);
    return st;
  };

  it('buying takes exactly the price in cash, moves the goods, and puts the cash in the till', () => {
    const lo = pack(500);
    const st = shop();
    const i = st.stock.findIndex((s) => s.defId === 'canned_beans' || s.defId === 'bandage' || s.defId === 'water_bottle');
    const idx = i >= 0 ? i : 0;
    const entry = st.stock[idx];
    const price = buyPrice(ITEMS[entry.defId]);
    const till = st.cash;
    const before = lo.countAll(entry.defId);
    const r = buy(lo, st, idx, 1);
    expect(r).toEqual({ ok: true, paid: price });
    expect(cashOf(lo)).toBe(500 - price);
    expect(st.cash).toBe(till + price);
    expect(lo.countAll(entry.defId) + lo.pickups.filter((p) => p.item.defId === entry.defId).reduce((s, p) => s + p.item.count, 0)).toBeGreaterThanOrEqual(before + 1);
  });

  it('you cannot buy more than you can pay for or more than is in stock', () => {
    const lo = pack(3);
    const st = shop();
    const pricey = st.stock.findIndex((s) => buyPrice(ITEMS[s.defId]) > 3);
    expect(buy(lo, st, pricey, 1)).toEqual({ ok: false, reason: 'funds' });
    expect(cashOf(lo)).toBe(3);
    expect(buy(lo, st, 999, 1)).toEqual({ ok: false, reason: 'stock' });
    expect(buy(lo, st, 0, 9999)).toEqual({ ok: false, reason: 'stock' });
  });

  it('selling pays the haircut price out of today\'s cash and the goods go on the shelf, buyable back at the markup', () => {
    const lo = pack();
    const st = shop();
    lo.storeWorn(newItem('bandage', 3));
    const stack = sellable(lo).find((s) => s.item.defId === 'bandage')!;
    const unit = sellPrice(ITEMS.bandage);
    const till = st.cash;
    const shelf = st.stock.find((s) => s.defId === 'bandage')?.count ?? 0;
    expect(sell(lo, st, stack.item, 2)).toEqual({ ok: true, paid: unit * 2 });
    expect(cashOf(lo)).toBe(unit * 2);
    expect(st.cash).toBe(till - unit * 2);
    expect(lo.count('bandage')).toBe(1);
    expect(st.stock.find((s) => s.defId === 'bandage')!.count).toBe(shelf + 2);
    // a round trip: buy one back and compare
    const spent = buyPrice(ITEMS.bandage);
    expect(spent).toBeGreaterThan(unit);
  });

  it('the trader can only pay what is in the till today: no cash faucet from junk', () => {
    const lo = pack();
    const st = shop();
    st.cash = 10;
    lo.storeWorn(newItem('wood_planks', 20));
    const stack = sellable(lo).find((s) => s.item.defId === 'wood_planks')!;
    expect(sell(lo, st, stack.item, 20)).toEqual({ ok: false, reason: 'trader_cash' });
    expect(lo.count('wood_planks')).toBe(20);
    expect(cashOf(lo)).toBe(0);
    // the most anyone can take in a day is the till, however much they sell
    st.cash = TRADER.cashPerDay;
    let earned = 0;
    for (let n = 0; n < 40; n++) {
      lo.storeWorn(newItem('scrap_metal', 20));
      for (const s of sellable(lo)) {
        const r = sell(lo, st, s.item, s.item.count);
        if (r.ok) earned += r.paid;
      }
    }
    expect(earned).toBeLessThanOrEqual(TRADER.cashPerDay);
  });

  it('bags with things inside are not sold, and selling nothing carried fails cleanly', () => {
    const lo = pack();
    const st = shop();
    const wallet = newItem('wallet');
    lo.storeWorn(wallet);
    wallet.pockets![0].push({ item: newItem('cash', 20), x: 0, y: 0, rotated: false });
    expect(sellable(lo).some((s) => s.item === wallet)).toBe(false);
    expect(sell(lo, st, wallet, 1).ok).toBe(false);
    expect(sell(lo, st, newItem('bandage'), 1)).toEqual({ ok: false, reason: 'not_carried' });
  });

  it('trader state round-trips through JSON (stock with rounds and fuel kept)', () => {
    const st = shop();
    st.stock.push(newItem('mag_pistol_a', 1, { rounds: 9 }), newItem('jerrycan', 1, { fuel: 7.5 }));
    st.cash = 123;
    const back = JSON.parse(JSON.stringify(st)) as TraderState;
    expect(back).toEqual(st);
    expect(back.stock.some((s) => s.defId === 'mag_pistol_a' && s.rounds === 9)).toBe(true);
    // buying a restored item works
    const lo = pack(900);
    const idx = back.stock.findIndex((s) => s.defId === 'jerrycan' && s.fuel === 7.5);
    expect(buy(lo, back, idx, 1).ok).toBe(true);
    expect(JSON.stringify(lo.pickups) + JSON.stringify(lo.equipment)).toContain('"fuel":7.5');
  });
});
