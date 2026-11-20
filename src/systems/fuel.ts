import { ITEMS } from '../content/data/items';
import type { ItemInstance } from '../content/data/types';
import { forEachItem } from './inventory';
import type { Loadout } from './loadout';

/** Fuel cans carried (grids only): the pure side of refuelling a car and filling cans at a pump. */
export function cans(lo: Loadout): ItemInstance[] {
  const out: ItemInstance[] = [];
  for (const { grid } of lo.playerGrids()) forEachItem(grid, (gi) => ITEMS[gi.item.defId]?.fuelCapacity && out.push(gi.item), true);
  return out;
}

/** Litres in all carried cans. */
export const carried = (lo: Loadout) => cans(lo).reduce((s, c) => s + (c.fuel ?? 0), 0);

/** Litres of empty space in all carried cans. */
export const space = (lo: Loadout) => cans(lo).reduce((s, c) => s + Math.max(0, (ITEMS[c.defId].fuelCapacity ?? 0) - (c.fuel ?? 0)), 0);

/** Pour up to `max` litres out of the fullest cans first; returns litres taken. */
export function draw(lo: Loadout, max: number) {
  let left = Math.max(0, max);
  for (const c of cans(lo).sort((a, b) => (b.fuel ?? 0) - (a.fuel ?? 0))) {
    const k = Math.min(left, c.fuel ?? 0);
    if (k <= 0) continue;
    c.fuel = (c.fuel ?? 0) - k;
    left -= k;
    if (left <= 0) break;
  }
  const taken = Math.max(0, max) - left;
  if (taken > 0) lo.changed();
  return taken;
}

/** Fill carried cans from a source holding `available` litres (emptiest first); returns litres put in. */
export function fill(lo: Loadout, available: number) {
  let left = Math.max(0, available);
  for (const c of cans(lo).sort((a, b) => (a.fuel ?? 0) - (b.fuel ?? 0))) {
    const k = Math.min(left, (ITEMS[c.defId].fuelCapacity ?? 0) - (c.fuel ?? 0));
    if (k <= 0) continue;
    c.fuel = (c.fuel ?? 0) + k;
    left -= k;
    if (left <= 0) break;
  }
  const put = Math.max(0, available) - left;
  if (put > 0) lo.changed();
  return put;
}

/** One step of a car's fuel use: litres burned this tick (idle when on, more with the pedal down). */
export function burn(idlePerS: number, drivePerS: number, throttle: number, dt: number) {
  return (idlePerS + drivePerS * Math.min(1, Math.max(0, throttle))) * dt;
}
