import { ITEMS } from '../content/data/items';
import { TRADER } from '../content/data/trade';
import type { ItemDef, ItemInstance } from '../content/data/types';
import { createRng } from '../engine/rng';
import { forEachItem, newItems, uidState } from './inventory';
import { Loadout } from './loadout';

/**
 * Trade rules, pure over a Loadout (the pack) and a TraderState (stock, cash). The currency is the `cash` item.
 * See data/trade.ts for the margins and why every round trip loses money.
 */
export interface TraderState {
  /** In-game day the stock was rolled for. */
  day: number;
  /** Cash the trader can still pay today. */
  cash: number;
  stock: ItemInstance[];
}
export type TradeResult = { ok: true; paid: number } | { ok: false; reason: 'funds' | 'trader_cash' | 'stock' | 'worthless' | 'not_carried' | 'holds_items' };

export const newTraderState = (): TraderState => ({ day: 0, cash: TRADER.cashPerDay, stock: [] });

export function tradable(defId: string) {
  const d = ITEMS[defId];
  if (!d || d.value <= 0) return false;
  if (TRADER.never.includes(defId) || TRADER.neverPrefix.some((p) => defId.startsWith(p))) return false;
  return true;
}

/** What it costs you to take one. */
export const buyPrice = (d: ItemDef) => Math.max(TRADER.minPrice, Math.ceil(d.value * TRADER.buyMargin));

/** What the trader pays you for one (weapons and tools wear: the price follows durability). */
export function sellPrice(d: ItemDef, it?: ItemInstance) {
  const wear = it?.durability === undefined ? 1 : 0.4 + 0.6 * Math.max(0, Math.min(1, it.durability));
  return Math.max(TRADER.minPrice, Math.floor(d.value * TRADER.sellMargin * wear));
}

const dayHash = (day: number) => (Math.imul(day + 1, 2654435761) >>> 0) || 1;

const plain = (it: ItemInstance) => !it.contents?.length && !it.pockets?.some((p) => p.length) && !it.mag && it.durability === undefined && it.rounds === undefined && it.fuel === undefined;
const canMerge = (a: ItemInstance, b: ItemInstance) => a.defId === b.defId && ITEMS[a.defId].stack > 1 && plain(a) && plain(b);

/** A day's stock: the same every time for a given day (so reloading does not reroll it). */
export function rollStock(day: number): ItemInstance[] {
  const lo = new Loadout(createRng(dayHash(day)));
  const out: ItemInstance[] = [];
  for (const s of TRADER.stock) for (let i = 0; i < s.rolls; i++) lo.rollLoot(s.table, TRADER.tier, out);
  const merged: ItemInstance[] = [];
  for (const it of out) {
    if (!tradable(it.defId)) continue;
    const same = merged.find((m) => canMerge(m, it));
    if (same) same.count = Math.min(ITEMS[same.defId].stack, same.count + it.count);
    else merged.push(it);
  }
  return merged.slice(0, TRADER.maxStock);
}

/** New day: new stock and a full till. Same day: nothing changes. */
export function refresh(st: TraderState, day: number) {
  if (day <= st.day) return false;
  st.day = day;
  st.cash = TRADER.cashPerDay;
  st.stock = rollStock(day);
  return true;
}

export const cashOf = (lo: Loadout) => lo.count('cash');

/** Buy `qty` of the stock entry at `index`. */
export function buy(lo: Loadout, st: TraderState, index: number, qty = 1): TradeResult {
  const entry = st.stock[index];
  if (!entry || qty < 1 || entry.count < qty) return { ok: false, reason: 'stock' };
  const total = buyPrice(ITEMS[entry.defId]) * qty;
  if (cashOf(lo) < total) return { ok: false, reason: 'funds' };
  lo.consume('cash', total);
  st.cash += total; // what you pay goes into the till, so a bought-back item can be sold again
  let given: ItemInstance;
  if (qty >= entry.count) {
    st.stock.splice(index, 1);
    given = entry;
  } else {
    entry.count -= qty;
    given = { ...structuredClone(entry), uid: uidState.next++, count: qty };
  }
  lo.give(given);
  return { ok: true, paid: total };
}

/** Every carried stack the trader would take, with its unit price (for the sell list). */
export function sellable(lo: Loadout): { item: ItemInstance; unit: number }[] {
  const out: { item: ItemInstance; unit: number }[] = [];
  for (const { grid } of lo.playerGrids()) {
    forEachItem(
      grid,
      (gi) => {
        if (!tradable(gi.item.defId) || lo.holdsThings(gi.item)) return;
        out.push({ item: gi.item, unit: sellPrice(ITEMS[gi.item.defId], gi.item) });
      },
      true,
    );
  }
  return out;
}

/** Sell `qty` of a carried stack. The trader pays from today's cash and keeps the goods for sale. */
export function sell(lo: Loadout, st: TraderState, item: ItemInstance, qty = 1): TradeResult {
  if (!tradable(item.defId)) return { ok: false, reason: 'worthless' };
  if (!sellable(lo).some((s) => s.item === item)) return { ok: false, reason: lo.holdsThings(item) ? 'holds_items' : 'not_carried' };
  qty = Math.min(qty, item.count);
  if (qty < 1) return { ok: false, reason: 'not_carried' };
  const total = sellPrice(ITEMS[item.defId], item) * qty;
  if (st.cash < total) return { ok: false, reason: 'trader_cash' };
  st.cash -= total;
  const sold: ItemInstance = qty >= item.count ? item : { ...structuredClone(item), uid: uidState.next++, count: qty };
  if (qty >= item.count) lo.detach(item);
  else item.count -= qty;
  const same = st.stock.find((m) => canMerge(m, sold));
  if (same) same.count = Math.min(ITEMS[same.defId].stack, same.count + sold.count);
  else st.stock.push(sold);
  while (st.stock.length > TRADER.maxStock) st.stock.shift();
  for (const it of newItems('cash', total)) lo.give(it);
  lo.changed();
  return { ok: true, paid: total };
}
