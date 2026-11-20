import { RECIPES } from '../content/data/crafting';
import { ITEMS } from '../content/data/items';
import type { ItemInstance, RecipeDef } from '../content/data/types';
import { forEachItem, newItems } from './inventory';
import type { Loadout } from './loadout';

/**
 * Crafting rules, pure over a Loadout. The world only tells us which stations are close (a lit campfire).
 * `check` says why a recipe cannot be made right now; `perform` consumes the inputs and hands out the outputs.
 */
export type Station = 'campfire' | 'workbench';
export type Missing =
  | { kind: 'input'; item: string; have: number; need: number }
  | { kind: 'tool'; any: string[] }
  | { kind: 'station'; station: Station }
  | { kind: 'target' };

/** Weapons (guns and melee) that have worn down and can be repaired. */
export function damagedWeapons(lo: Loadout): ItemInstance[] {
  const out: ItemInstance[] = [];
  const seen = new Set<ItemInstance>();
  const add = (it: ItemInstance | null | undefined) => {
    if (!it || seen.has(it) || ITEMS[it.defId]?.kind !== 'weapon' || (it.durability ?? 1) >= 0.999) return;
    seen.add(it);
    out.push(it);
  };
  for (const slot of ['primary', 'secondary', 'sidearm', 'melee'] as const) add(lo.equipment[slot]);
  for (const { grid } of lo.playerGrids()) forEachItem(grid, (gi) => add(gi.item), true);
  return out;
}

/** What is missing for this recipe (empty = ready). `target` is the weapon picked for a repair. */
export function check(lo: Loadout, r: RecipeDef, stations: ReadonlySet<Station>, target?: ItemInstance | null): Missing[] {
  const miss: Missing[] = [];
  for (const i of r.inputs) {
    const have = lo.count(i.item);
    if (have < i.count) miss.push({ kind: 'input', item: i.item, have, need: i.count });
  }
  for (const group of r.tools ?? []) if (!group.some((t) => lo.count(t) > 0)) miss.push({ kind: 'tool', any: group });
  if (r.station && !stations.has(r.station)) miss.push({ kind: 'station', station: r.station });
  if (r.repair && !(target && damagedWeapons(lo).includes(target))) miss.push({ kind: 'target' });
  return miss;
}

export const canCraft = (lo: Loadout, r: RecipeDef, stations: ReadonlySet<Station>, target?: ItemInstance | null) => check(lo, r, stations, target).length === 0;

/** Make it: consume inputs, add outputs (onto the ground if the pack is full, never lost). Returns the new items. */
export function perform(lo: Loadout, r: RecipeDef, stations: ReadonlySet<Station>, target?: ItemInstance | null): ItemInstance[] | null {
  if (!canCraft(lo, r, stations, target)) return null;
  for (const i of r.inputs) lo.consume(i.item, i.count);
  if (r.repair && target) {
    target.durability = Math.min(1, (target.durability ?? 1) + r.repair.amount);
    lo.changed();
    return [];
  }
  const made: ItemInstance[] = [];
  for (const o of r.outputs) made.push(...newItems(o.item, o.count));
  for (const it of made) lo.give(it);
  return made;
}

/** Recipes grouped for the panel, ready ones first. */
export function listRecipes(lo: Loadout, stations: ReadonlySet<Station>) {
  return RECIPES.map((r) => ({ r, ready: check(lo, r, stations, null).filter((m) => m.kind !== 'target').length === 0 })).sort((a, b) => Number(b.ready) - Number(a.ready));
}

/** Value of a recipe side, for the no-free-money test. */
export const valueOf = (list: { item: string; count: number }[]) => list.reduce((s, i) => s + (ITEMS[i.item]?.value ?? 0) * i.count, 0);
