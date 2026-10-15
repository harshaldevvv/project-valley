import { INVENTORY, ITEMS } from '../content/data/items';
import type { GridItem, ItemDef, ItemInstance } from '../content/data/types';

/**
 * Grid inventory core (principles §8). Pure data: no DOM, no three.js. Everything here is plain,
 * JSON-serializable state, so saves and co-op can carry it unchanged.
 *
 * A Grid is a w x h cell area holding GridItems. Containers (backpacks, jackets, crates) are items
 * whose `contents` array is their grid; `gridOf(item)` gives a Grid view over it.
 */
export interface Grid {
  w: number;
  h: number;
  contents: GridItem[];
  /** The item this grid belongs to (to stop a bag going inside itself). */
  owner?: ItemInstance;
}

let nextUid = 1;
export const uidState = {
  get next() {
    return nextUid;
  },
  set next(n: number) {
    nextUid = n;
  },
};

export function defOf(item: ItemInstance | string): ItemDef {
  const id = typeof item === 'string' ? item : item.defId;
  const d = ITEMS[id];
  if (!d) throw new Error(`unknown item "${id}"`);
  return d;
}

export function newItem(defId: string, count = 1, extra: Partial<ItemInstance> = {}): ItemInstance {
  const d = defOf(defId);
  const item: ItemInstance = { uid: nextUid++, defId, count: Math.min(count, d.stack) };
  if (d.grid) item.contents = [];
  if (d.kind === 'magazine') item.rounds = 0;
  if (d.kind === 'weapon' && d.capacity !== undefined) item.rounds = 0; // internal magazine
  else if (d.kind === 'weapon' && !d.slots?.includes('melee')) item.mag = null;
  return Object.assign(item, extra);
}

/** Make `n` instances worth of a def (splits into full stacks). */
export function newItems(defId: string, count: number, extra: Partial<ItemInstance> = {}): ItemInstance[] {
  const out: ItemInstance[] = [];
  const stack = defOf(defId).stack;
  for (let left = count; left > 0; left -= stack) out.push(newItem(defId, Math.min(stack, left), { ...extra }));
  return out;
}

export function footprint(item: ItemInstance, rotated: boolean): [number, number] {
  const d = defOf(item);
  return rotated ? [d.h, d.w] : [d.w, d.h];
}

export function gridOf(item: ItemInstance | null | undefined): Grid | null {
  if (!item) return null;
  const d = defOf(item);
  if (!d.grid) return null;
  item.contents ??= [];
  return { w: d.grid.w, h: d.grid.h, contents: item.contents, owner: item };
}

/** True if `needle` is `hay` or sits anywhere inside it. */
export function containsItem(hay: ItemInstance, needle: ItemInstance): boolean {
  if (hay === needle) return true;
  for (const gi of hay.contents ?? []) if (containsItem(gi.item, needle)) return true;
  return false;
}

/** Can `item` sit at (x,y) in `grid`? `ignore` = an item already in the grid to treat as absent (moving it). */
export function canPlace(grid: Grid, item: ItemInstance, x: number, y: number, rotated: boolean, ignore?: ItemInstance): boolean {
  const [w, h] = footprint(item, rotated);
  if (x < 0 || y < 0 || x + w > grid.w || y + h > grid.h) return false;
  if (grid.owner) {
    if (containsItem(item, grid.owner)) return false; // bag into itself (or into a bag inside it)
    if (!INVENTORY.bagception && defOf(item).grid) return false;
  }
  for (const gi of grid.contents) {
    if (gi.item === item || gi.item === ignore) continue;
    const [ow, oh] = footprint(gi.item, gi.rotated);
    if (x < gi.x + ow && gi.x < x + w && y < gi.y + oh && gi.y < y + h) return false;
  }
  return true;
}

export function place(grid: Grid, item: ItemInstance, x: number, y: number, rotated: boolean): GridItem | null {
  if (!canPlace(grid, item, x, y, rotated)) return null;
  const gi = { item, x, y, rotated };
  grid.contents.push(gi);
  return gi;
}

export function removeItem(grid: Grid, item: ItemInstance): GridItem | null {
  const k = grid.contents.findIndex((gi) => gi.item === item);
  return k < 0 ? null : grid.contents.splice(k, 1)[0];
}

export function itemAt(grid: Grid, x: number, y: number): GridItem | null {
  for (const gi of grid.contents) {
    const [w, h] = footprint(gi.item, gi.rotated);
    if (x >= gi.x && x < gi.x + w && y >= gi.y && y < gi.y + h) return gi;
  }
  return null;
}

/** First free spot, row-major, upright before rotated. */
export function findFree(grid: Grid, item: ItemInstance): { x: number; y: number; rotated: boolean } | null {
  const d = defOf(item);
  for (const rotated of d.w === d.h ? [false] : [false, true])
    for (let y = 0; y < grid.h; y++)
      for (let x = 0; x < grid.w; x++) if (canPlace(grid, item, x, y, rotated)) return { x, y, rotated };
  return null;
}

export function canStack(a: ItemInstance, b: ItemInstance): boolean {
  return a !== b && a.defId === b.defId && defOf(a).stack > 1;
}

/** Move as many of `src` into `dst` as fit. Returns how many moved. */
export function mergeInto(dst: ItemInstance, src: ItemInstance): number {
  if (!canStack(dst, src)) return 0;
  const n = Math.min(src.count, defOf(dst).stack - dst.count);
  dst.count += n;
  src.count -= n;
  return n;
}

/**
 * Auto-place (pickup): top up existing stacks first, then the first free spot.
 * Returns the count that did not fit (0 = all of it went in; `item` itself may now live in the grid).
 */
export function autoPlace(grid: Grid, item: ItemInstance): number {
  for (const gi of grid.contents) {
    if (item.count <= 0) return 0;
    mergeInto(gi.item, item);
  }
  if (item.count <= 0) return 0;
  const spot = findFree(grid, item);
  if (!spot) return item.count;
  place(grid, item, spot.x, spot.y, spot.rotated);
  return 0;
}

/** Split `n` off a stack into a new instance (not placed). */
export function splitStack(item: ItemInstance, n: number): ItemInstance | null {
  if (n <= 0 || n >= item.count) return null;
  item.count -= n;
  return newItem(item.defId, n);
}

/** Visit every item in a grid; `deep` also visits inside nested containers. */
export function forEachItem(grid: Grid, fn: (gi: GridItem, grid: Grid) => void, deep = false) {
  for (const gi of [...grid.contents]) {
    fn(gi, grid);
    if (deep) {
      const inner = gridOf(gi.item);
      if (inner) forEachItem(inner, fn, true);
    }
  }
}
