import { CONTAINERS } from '../content/data/containers';
import { INVENTORY, ITEMS, STARTING_KIT } from '../content/data/items';
import { LOOT } from '../content/data/loot';
import type { ItemInstance, SlotName } from '../content/data/types';
import type { LoadoutApi } from '../core/contracts';
import type { Rng } from '../engine/rng';
import {
  autoPlace, containsItem, defOf, forEachItem, gridOf, mergeInto, newItem, newItems, removeItem, uidState, type Grid,
} from './inventory';

/** A world container instance (loot crate, cabinet, car trunk). Plain data. */
export interface WorldContainer {
  id: string;
  defId: string;
  grid: Grid;
  searched: boolean;
  /** Needs a lockpick (def.lock > 0) until picked once. */
  locked: boolean;
}

/** An item lying in the world (dropped by the player). */
export interface Pickup {
  item: ItemInstance;
  x: number;
  y: number;
  z: number;
}

export const SAVE_VERSION = 1;
export interface LoadoutSave {
  v: number;
  nextUid: number;
  equipment: Partial<Record<SlotName, ItemInstance>>;
  pickups: Pickup[];
  containers: { id: string; defId: string; searched: boolean; locked?: boolean; contents: Grid['contents'] }[];
  hotbar: (string | null)[];
}

export const EQUIP_SLOTS: SlotName[] = ['head', 'face', 'eyes', 'ears', 'torso', 'armor', 'legs', 'gloves', 'feet', 'backpack', 'pouch'];
export const WEAPON_SLOTS: SlotName[] = ['primary', 'secondary', 'sidearm', 'melee'];

/**
 * Everything the player carries plus world containers and the ground pile.
 * Pure logic over plain state (rng injected); `onChange` fires after every mutation.
 */
export class Loadout implements LoadoutApi {
  equipment: Partial<Record<SlotName, ItemInstance>> = {};
  containers = new Map<string, WorldContainer>();
  /** Items on the ground. The world layer renders them; the inventory shows nearby ones in the vicinity panel. */
  pickups: Pickup[] = [];
  /** Where dropped items land (the player's feet). Installed by the game; tests leave the origin. */
  dropPosition: () => { x: number; y: number; z: number } = () => ({ x: 0, y: 0, z: 0 });
  hotbar: (string | null)[] = [...INVENTORY.hotbar];

  constructor(private rng: Rng, public onChange: () => void = () => {}) {}

  changed() {
    this.onChange();
  }

  // ---------- LoadoutApi ----------
  equipped(slot: SlotName) {
    return this.equipment[slot] ?? null;
  }

  /** Worn grids in fill order (jacket pockets, then backpack...). */
  playerGrids(): { slot: SlotName; grid: Grid }[] {
    const order = [...INVENTORY.fillOrder, ...EQUIP_SLOTS] as SlotName[];
    const out: { slot: SlotName; grid: Grid }[] = [];
    for (const slot of new Set(order)) {
      const g = gridOf(this.equipment[slot]);
      if (g) out.push({ slot, grid: g });
    }
    return out;
  }

  /** Into the worn grids (empty matching weapon slot first for weapons); else onto the ground. Never loses items. */
  give(item: ItemInstance) {
    this.giveQuiet(item);
    this.changed();
  }

  private giveQuiet(item: ItemInstance) {
    const d = defOf(item);
    if (d.slots) { // anything wearable goes straight into an empty slot (weapon, backpack, jacket...)
      const slot = d.slots?.find((s) => !this.equipment[s]);
      if (slot) {
        this.equipment[slot] = item;
        return;
      }
    }
    for (const { grid } of this.playerGrids()) if (autoPlace(grid, item) === 0) return;
    this.drop(item);
  }

  /** Onto the ground at the player's feet (small scatter so piles stay clickable). */
  drop(item: ItemInstance, at = this.dropPosition()) {
    const k = this.pickups.length;
    const a = k * 2.399; // golden-angle spiral
    const r = Math.min(0.25 + 0.12 * Math.sqrt(k % 12), 0.8);
    this.pickups.push({ item, x: at.x + Math.cos(a) * r, y: at.y, z: at.z + Math.sin(a) * r });
  }

  /** Remove a pickup from the world (picked up / moved into a grid). */
  takePickup(item: ItemInstance): boolean {
    const k = this.pickups.findIndex((p) => p.item === item);
    if (k < 0) return false;
    this.pickups.splice(k, 1);
    return true;
  }

  /** Pick a ground item up into the worn grids (empty weapon slot first). Whatever doesn't fit stays on the ground. */
  pickUp(item: ItemInstance): boolean {
    const p = this.pickups.find((q) => q.item === item);
    if (!p) return false;
    const d = defOf(item);
    const slot = d.slots?.find((s) => !this.equipment[s]);
    if (slot) this.equipment[slot] = item;
    else for (const { grid } of this.playerGrids()) if (autoPlace(grid, item) === 0) break;
    const placed = !!slot || this.playerGrids().some(({ grid }) => grid.contents.some((gi) => gi.item === item)) || item.count <= 0;
    if (placed) this.takePickup(item);
    this.changed();
    return placed;
  }

  pickupsNear(p: { x: number; z: number }, radius: number): Pickup[] {
    return this.pickups.filter((q) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 <= radius * radius);
  }

  count(defId: string): number {
    let n = 0;
    for (const { grid } of this.playerGrids()) forEachItem(grid, (gi) => gi.item.defId === defId && (n += gi.item.count), true);
    return n;
  }

  consume(defId: string, n: number): number {
    // Smallest stacks first, so cells free up.
    const found: { item: ItemInstance; grid: Grid }[] = [];
    for (const { grid } of this.playerGrids()) forEachItem(grid, (gi, g) => gi.item.defId === defId && found.push({ item: gi.item, grid: g }), true);
    found.sort((a, b) => a.item.count - b.item.count);
    let done = 0;
    for (const f of found) {
      const k = Math.min(n - done, f.item.count);
      f.item.count -= k;
      done += k;
      if (f.item.count <= 0) removeItem(f.grid, f.item);
      if (done >= n) break;
    }
    if (done) this.changed();
    return done;
  }

  takeMagazine(weapon: ItemInstance): ItemInstance | null {
    const d = defOf(weapon);
    if (d.capacity !== undefined && d.ammo) {
      // Internal magazine: hand back loose rounds to top it up.
      const want = d.capacity - (weapon.rounds ?? 0);
      const got = want > 0 ? this.consume(d.ammo, want) : 0;
      return got ? newItem(d.ammo, got) : null;
    }
    let best: { item: ItemInstance; grid: Grid } | null = null;
    for (const { grid } of this.playerGrids())
      forEachItem(grid, (gi, g) => {
        const md = defOf(gi.item);
        if (md.kind !== 'magazine' || !md.fits?.includes(weapon.defId) || !gi.item.rounds) return;
        if (!best || gi.item.rounds > (best.item.rounds ?? 0)) best = { item: gi.item, grid: g };
      }, true);
    if (!best) return null;
    const b = best as { item: ItemInstance; grid: Grid };
    removeItem(b.grid, b.item);
    this.changed();
    return b.item;
  }

  // ---------- item actions (UI and hotbar) ----------
  canEquip(item: ItemInstance, slot: SlotName) {
    return !!defOf(item).slots?.includes(slot);
  }

  /** Remove `item` from wherever it is (slot, any grid, inside a weapon). Returns true if found. */
  detach(item: ItemInstance): boolean {
    for (const s of Object.keys(this.equipment) as SlotName[]) {
      const e = this.equipment[s];
      if (e === item) {
        delete this.equipment[s];
        return true;
      }
      if (e?.mag === item) {
        e.mag = null;
        return true;
      }
    }
    for (const g of this.allGrids()) {
      let hit = false;
      forEachItem(g, (gi, grid) => {
        if (hit) return;
        if (gi.item === item) hit = !!removeItem(grid, item);
        else if (gi.item.mag === item) {
          gi.item.mag = null;
          hit = true;
        }
      }, true);
      if (hit) return true;
    }
    if (this.takePickup(item)) return true;
    for (const p of this.pickups) {
      const g = gridOf(p.item);
      if (g) {
        let hit = false;
        forEachItem(g, (gi, grid) => !hit && gi.item === item && (hit = !!removeItem(grid, item)), true);
        if (hit) return true;
      }
    }
    return false;
  }

  allGrids(): Grid[] {
    return [...this.playerGrids().map((p) => p.grid), ...[...this.containers.values()].map((c) => c.grid)];
  }

  /** Use one consumable from a stack. Returns its use data, or null if it isn't usable. */
  use(item: ItemInstance) {
    const use = defOf(item).use;
    if (!use) return null;
    item.count -= 1;
    if (item.count <= 0) this.detach(item);
    this.changed();
    return use;
  }

  /**
   * Timed use (principles §7: 2–5 s, interruptible). The item is consumed only when the timer completes.
   * Mechanics may read `using` for the hold animation.
   */
  using: { item: ItemInstance; seconds: number; t: number } | null = null;

  beginUse(item: ItemInstance): boolean {
    const u = defOf(item).use;
    if (!u || this.using || item.count <= 0) return false;
    this.using = { item, seconds: u.seconds, t: 0 };
    this.changed();
    return true;
  }

  cancelUse(): boolean {
    if (!this.using) return false;
    this.using = null;
    this.changed();
    return true;
  }

  /** Advance the use timer; returns the item's use data when it completes (and consumes one). */
  stepUse(dt: number) {
    const u = this.using;
    if (!u) return null;
    if (u.item.count <= 0) return this.cancelUse(), null;
    if ((u.t += dt) < u.seconds) return null;
    this.using = null;
    return { defId: u.item.defId, use: this.use(u.item)! };
  }

  /** Hotbar key 5..9 (index 0..4): start using the bound item from the worn grids. */
  useHotbar(index: number): { defId: string; started: boolean } | null {
    const defId = this.hotbar[index];
    if (!defId) return null;
    let found: ItemInstance | null = null;
    for (const { grid } of this.playerGrids()) forEachItem(grid, (gi) => !found && gi.item.defId === defId && (found = gi.item), true);
    return { defId, started: !!found && this.beginUse(found) };
  }

  /** Load loose ammo into a magazine. Returns rounds loaded; the ammo stack shrinks (caller removes it at 0). */
  loadMagazine(mag: ItemInstance, ammo: ItemInstance): number {
    const md = defOf(mag);
    if (md.kind !== 'magazine' || md.ammo !== ammo.defId) return 0;
    const n = Math.min((md.capacity ?? 0) - (mag.rounds ?? 0), ammo.count);
    if (n <= 0) return 0;
    mag.rounds = (mag.rounds ?? 0) + n;
    ammo.count -= n;
    if (ammo.count <= 0) this.detach(ammo);
    this.changed();
    return n;
  }

  /** Empty a magazine back into loose ammo (given to the player). */
  unloadMagazine(mag: ItemInstance): number {
    const md = defOf(mag);
    const n = mag.rounds ?? 0;
    if (!md.ammo || n <= 0) return 0;
    mag.rounds = 0;
    for (const a of newItems(md.ammo, n)) this.giveQuiet(a);
    this.changed();
    return n;
  }

  /** Insert a magazine into a weapon; the old one goes to the inventory. */
  insertMagazine(weapon: ItemInstance, mag: ItemInstance): boolean {
    if (!defOf(mag).fits?.includes(weapon.defId) || weapon.mag === mag) return false;
    this.detach(mag);
    const old = weapon.mag;
    weapon.mag = mag;
    if (old) this.giveQuiet(old);
    this.changed();
    return true;
  }

  removeMagazine(weapon: ItemInstance) {
    const m = weapon.mag;
    if (!m) return;
    weapon.mag = null;
    this.giveQuiet(m);
    this.changed();
  }

  /** Merge a stack onto another (drag onto same item). */
  stackOnto(dst: ItemInstance, src: ItemInstance): number {
    const n = mergeInto(dst, src);
    if (n && src.count <= 0) this.detach(src);
    if (n) this.changed();
    return n;
  }

  // ---------- containers ----------
  registerContainer(id: string, defId: string): WorldContainer {
    const def = CONTAINERS[defId];
    if (!def) throw new Error(`unknown container "${defId}"`);
    let c = this.containers.get(id);
    if (!c) this.containers.set(id, (c = { id, defId, grid: { w: def.grid.w, h: def.grid.h, contents: [] }, searched: false, locked: def.lock > 0 }));
    return c;
  }

  /** Forget a container (zombie corpse despawned). Whatever was left in it is gone with the body. */
  removeContainer(id: string) {
    this.containers.delete(id);
  }

  /** First open rolls the loot; refill-on-open containers re-roll every time. */
  openContainer(id: string): WorldContainer {
    const c = this.containers.get(id);
    if (!c) throw new Error(`container "${id}" not registered`);
    const def = CONTAINERS[c.defId];
    if (!c.searched || def.refillOnOpen) {
      if (def.refillOnOpen) c.grid.contents.length = 0;
      for (const item of this.rollLoot(def.lootTable)) autoPlace(c.grid, item);
      c.searched = true;
      this.changed();
    }
    return c;
  }

  rollLoot(tableId: string): ItemInstance[] {
    const t = LOOT[tableId];
    if (!t) return [];
    const out: ItemInstance[] = [];
    const make = (item: string, count: number, rounds?: number) => {
      const d = defOf(item);
      const extra: Partial<ItemInstance> = {};
      if (d.kind === 'magazine') extra.rounds = rounds === -1 ? d.capacity : rounds ?? this.rng.int(0, d.capacity ?? 0);
      if (d.kind === 'weapon' && rounds === -1) {
        // Loaded weapon: insert a full magazine that fits it (or fill an internal magazine).
        const md = Object.values(ITEMS).find((m) => m.kind === 'magazine' && m.fits?.includes(item));
        if (md) extra.mag = newItem(md.id, 1, { rounds: md.capacity });
        else if (d.capacity !== undefined) extra.rounds = d.capacity;
      }
      if (d.stack > 1) out.push(...newItems(item, count, extra));
      else for (let i = 0; i < count; i++) out.push(newItem(item, 1, { ...extra }));
    };
    for (const g of t.guaranteed ?? []) make(g.item, g.count, g.rounds);
    const total = t.entries.reduce((s, e) => s + e.weight, 0);
    const rolls = this.rng.int(t.rolls[0], t.rolls[1]);
    for (let r = 0; r < rolls && total > 0; r++) {
      let pick = this.rng.next() * total;
      const e = t.entries.find((en) => (pick -= en.weight) < 0) ?? t.entries[t.entries.length - 1];
      make(e.item, this.rng.int(e.count[0], e.count[1]));
    }
    return out;
  }

  // ---------- kit / reset ----------
  clear() {
    this.equipment = {};
    this.changed();
  }

  giveStartingKit() {
    for (const [slot, id] of Object.entries(STARTING_KIT.equip)) if (!this.equipment[slot as SlotName]) this.equipment[slot as SlotName] = newItem(id);
    for (const { item, count } of STARTING_KIT.items) for (const it of newItems(item, count)) this.giveQuiet(it);
    this.changed();
  }

  // ---------- save ----------
  serialize(): LoadoutSave {
    return structuredClone({
      v: SAVE_VERSION,
      nextUid: uidState.next,
      equipment: this.equipment,
      pickups: this.pickups,
      // Zombie bodies are transient (they despawn); everything else persists.
      containers: [...this.containers.values()].filter((c) => !c.id.startsWith('zbody_')).map((c) => ({ id: c.id, defId: c.defId, searched: c.searched, locked: c.locked, contents: c.grid.contents })),
      hotbar: this.hotbar,
    });
  }

  load(save: LoadoutSave) {
    if (save.v !== SAVE_VERSION) throw new Error(`loadout save v${save.v} has no migration to v${SAVE_VERSION}`);
    const s = structuredClone(save);
    uidState.next = Math.max(uidState.next, s.nextUid);
    this.equipment = s.equipment;
    this.pickups = s.pickups;
    this.containers.clear();
    for (const c of s.containers) {
      const def = CONTAINERS[c.defId];
      this.containers.set(c.id, { id: c.id, defId: c.defId, searched: c.searched, locked: c.locked ?? def.lock > 0, grid: { w: def.grid.w, h: def.grid.h, contents: c.contents } });
    }
    this.hotbar = s.hotbar;
    this.changed();
  }
}

export { containsItem };
