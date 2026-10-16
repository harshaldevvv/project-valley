import { INVENTORY } from '../../content/data/items';
import type { GridItem, ItemInstance, SlotName } from '../../content/data/types';
import { weaponDefs } from '../../content/data/weapons';
import { containerText } from '../../content/text/containers';
import { itemText } from '../../content/text/items';
import { inventoryText, survivalText } from '../../content/text/ui';
import iconIndex from '../../../public/assets/icons/index.json';
import {
  autoPlace, autoPlaceInto, canPlace, sortGrid, canStack, containsItem, defOf, findFree, footprint, gridsOf, hasStorage, mergeInto, newItems, place, removeItem, splitStack, type Grid,
} from '../../systems/inventory';
import { EQUIP_SLOTS, WEAPON_SLOTS, type Loadout } from '../../systems/loadout';
import './inventory.css';

/**
 * Inventory screen (Tab): equipment + hotbar | worn grids | opened container, nested bags and the ground.
 * Plain DOM over the canvas. All rules live in systems/; this file only maps pointer gestures onto them.
 */

const T = inventoryText;

/** Rendered item icons (public/assets/icons, made by the asset pipeline). Ids without one keep the swatch tile. */
const ICONS = new Set(iconIndex.ids);
function iconImg(defId: string) {
  if (!ICONS.has(defId)) return null;
  const img = document.createElement('img');
  img.className = 'ic';
  img.src = `/assets/icons/${defId}.png`;
  img.alt = '';
  img.draggable = false;
  return img;
}
/** Size the icon to the item's unrotated box (in cells) and turn it for rotated items, so `contain` keeps its aspect. */
function fitIcon(tile: HTMLElement, w: number, h: number, rotated?: boolean) {
  const img = tile.querySelector<HTMLImageElement>('img.ic');
  if (!img || rotated === undefined) return;
  img.classList.add('cells');
  img.style.width = `calc(var(--cell) * ${w} - 8px)`;
  img.style.height = `calc(var(--cell) * ${h} - 8px)`;
  img.style.transform = `translate(-50%, -50%)${rotated ? ' rotate(90deg)' : ''}`;
}

export const itemName = (id: string) => itemText[id]?.name ?? id;
export const itemShort = (id: string) => itemText[id]?.short ?? id;
export const containerName = (defId: string) => containerText[defId]?.name ?? defId;

type Src = { kind: 'grid'; gid: string; gi: GridItem } | { kind: 'slot'; slot: SlotName } | { kind: 'new'; from: ItemInstance };
type Target =
  | { kind: 'merge' | 'load' | 'insert' | 'into'; item: ItemInstance; el: HTMLElement }
  | { kind: 'grid'; gid: string; x: number; y: number; ok: boolean }
  | { kind: 'slot'; slot: SlotName; ok: boolean; el: HTMLElement }
  | { kind: 'hot'; index: number; ok: boolean; el: HTMLElement }
  | { kind: 'ground' }
  | { kind: 'none' };

interface Press { item: ItemInstance; src: Src; el: HTMLElement; x: number; y: number; ctrl: boolean; shift: boolean }
interface Drag { item: ItemInstance; src: Src; rotated: boolean; ghost: HTMLElement; gx: number; gy: number; px: number; py: number; target: Target }

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export interface ScreenHooks {
  sfx(id: string): void;
  /** Screen opened/closed (uiScreen event). */
  onOpenChange(open: boolean): void;
  /** Feet position for the ground panel. */
  feet(): { x: number; y: number; z: number };
  /** False while another full screen (title/pause menu) is up. */
  canOpen(): boolean;
  /** Toast outside the screen (HUD). */
  toast(text: string): void;
}

export class InventoryScreen {
  readonly root = h('div', 'inv-root');
  private wrap = h('div', 'inv-wrap');
  private tip = h('div', 'inv-tip');
  private menu = h('div', 'inv-menu');
  private toastEl = h('div', 'inv-toast');
  private grids = new Map<string, Grid>();
  private refs = new WeakMap<HTMLElement, { item: ItemInstance; src: Src }>();
  private press: Press | null = null;
  private drag: Drag | null = null;
  private fp = h('div', 'inv-fp');
  private probe = h('div');
  private highlighted: HTMLElement | null = null;
  private toastTimer = 0;
  /** Open world container id (right panel), if any. */
  container: string | null = null;
  /** Bags opened from a grid (shown in the right column). */
  private bags: ItemInstance[] = [];
  /** Ground panel: nearby pickups laid out on a grid while the screen is open. */
  private vicinity: Grid = { w: INVENTORY.vicinityW, h: 3, contents: [] };
  private shown = new Set<ItemInstance>();

  constructor(private lo: Loadout, private hooks: ScreenHooks, parent: HTMLElement) {
    this.root.hidden = true;
    this.tip.hidden = this.menu.hidden = true;
    this.toastEl.style.opacity = '0';
    const hint = h('div', 'inv-hint');
    hint.innerHTML = T.hint;
    this.probe.style.cssText = 'position:absolute;visibility:hidden;width:var(--cell);height:0';
    this.root.append(this.wrap, hint, this.tip, this.menu, this.toastEl, this.probe);
    parent.appendChild(this.root);
    this.bindPointer();
    addEventListener('keydown', (e) => this.onKey(e), true);
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open(container: string | null = null) {
    this.container = container;
    if (!this.isOpen) {
      this.vicinity = { w: INVENTORY.vicinityW, h: 3, contents: [] };
      this.shown.clear();
      this.bags = [];
      this.root.hidden = false;
      this.hooks.onOpenChange(true);
      this.hooks.sfx('ui_open');
    }
    this.refresh();
  }

  close() {
    if (!this.isOpen) return;
    this.cancelDrag();
    this.hideMenu();
    this.tip.hidden = true;
    this.root.hidden = true;
    this.container = null;
    this.bags = [];
    this.hooks.onOpenChange(false);
    this.hooks.sfx('ui_close');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Re-read state and redraw (cheap: a few dozen nodes). Skipped mid-drag. */
  refresh() {
    if (!this.isOpen || this.drag) return;
    this.syncVicinity();
    this.render();
  }

  // ---------------- ground panel ----------------
  private syncVicinity() {
    const v = this.vicinity;
    for (const gi of v.contents) if (!this.shown.has(gi.item)) (this.lo.drop(gi.item, this.hooks.feet()), this.shown.add(gi.item)); // moved in = dropped
    for (const it of [...this.shown]) if (!v.contents.some((gi) => gi.item === it)) (this.lo.takePickup(it), this.shown.delete(it)); // moved out = picked up
    const onGround = new Set(this.lo.pickups.map((p) => p.item));
    for (const gi of [...v.contents]) if (!onGround.has(gi.item) || gi.item.count <= 0) (removeItem(v, gi.item), this.shown.delete(gi.item));
    for (const p of this.lo.pickupsNear(this.hooks.feet(), INVENTORY.vicinityRadius)) {
      if (this.shown.has(p.item)) continue;
      while (!findFree(v, p.item)) v.h += 1;
      const s = findFree(v, p.item)!;
      place(v, p.item, s.x, s.y, s.rotated);
      this.shown.add(p.item);
    }
    let rows = 3;
    for (const gi of v.contents) rows = Math.max(rows, gi.y + footprint(gi.item, gi.rotated)[1]);
    v.h = rows + 1; // always one free row to drop into
  }

  // ---------------- rendering ----------------
  private render() {
    this.grids.clear();
    this.wrap.replaceChildren(this.renderEquipment(), this.renderPlayer(), this.renderRight());
  }

  private renderEquipment() {
    const col = h('section', 'inv-col inv-equip');
    col.append(h('h2', '', T.equipment));
    const slots = h('div', 'inv-slots');
    for (const s of EQUIP_SLOTS) slots.append(this.slotEl(s, false));
    col.append(slots, h('h3', '', T.weapons));
    const ws = h('div', 'inv-wslots');
    for (const s of WEAPON_SLOTS) ws.append(this.slotEl(s, true));
    col.append(ws, h('h3', '', T.hotbar));
    const hb = h('div', 'inv-hotbar');
    this.lo.hotbar.forEach((defId, i) => {
      const el = h('div', 'inv-hot');
      el.dataset.hot = String(i);
      el.append(h('span', 'k', String(i + 5)));
      if (defId) {
        const n = this.lo.count(defId);
        const t = this.tileFor(defId, n > 0 ? String(n) : '0');
        if (!n) t.classList.add('none');
        t.title = itemName(defId);
        el.append(t);
      }
      hb.append(el);
    });
    col.append(hb);
    return col;
  }

  private slotEl(slot: SlotName, wide: boolean) {
    const el = h('div', 'inv-slot' + (wide ? ' wide' : ''));
    el.dataset.slot = slot;
    const item = this.lo.equipment[slot];
    if (item) {
      el.classList.add('filled');
      const t = this.itemTile(item);
      this.refs.set(t, { item, src: { kind: 'slot', slot } });
      el.append(t);
    } else el.append(h('span', 'lbl', T.slot[slot]));
    return el;
  }

  private renderPlayer() {
    const col = h('section', 'inv-col inv-player');
    col.append(h('h2', '', T.inventory));
    const worn = this.lo.playerGrids();
    if (!worn.length) col.append(h('div', 'inv-empty', T.noStorage));
    // One header per worn item; its grids (main + pockets) sit side by side and wrap.
    const bySlot = new Map<SlotName, Grid[]>();
    for (const { slot, grid } of worn) bySlot.set(slot, [...(bySlot.get(slot) ?? []), grid]);
    for (const [slot, grids] of bySlot) {
      const head = h('h3');
      head.append(h('span', 't', itemName(grids[0].owner!.defId)), this.btn(T.sort, () => grids.map((g) => sortGrid(g)).some(Boolean)));
      col.append(head, this.gridGroup(`eq:${slot}`, grids));
    }
    return col;
  }

  /** Several grids of one item (bag + side pockets, vest pouches). */
  private gridGroup(gidBase: string, grids: Grid[]) {
    const row = h('div', 'inv-grids');
    grids.forEach((g, i) => row.append(this.gridEl(`${gidBase}:${i}`, g)));
    return row;
  }

  private renderRight() {
    const col = h('section', 'inv-col inv-loot');
    const c = this.container ? this.lo.containers.get(this.container) : null;
    if (c) {
      const head = h('h2');
      head.append(h('span', 't', containerName(c.defId)), this.btn(T.sort, () => sortGrid(c.grid)), this.btn(T.takeAll, () => this.takeAll(c.grid)));
      col.append(head, this.gridEl(`c:${c.id}`, c.grid));
    }
    for (const bag of this.bags) {
      const head = h('h3');
      const x = h('span', 'x', '✕');
      x.onclick = () => ((this.bags = this.bags.filter((b) => b !== bag)), this.render());
      head.append(h('span', 't', itemName(bag.defId)), x);
      col.append(head, this.gridGroup(`bag:${bag.uid}`, gridsOf(bag)));
    }
    const gh = h(c || this.bags.length ? 'h3' : 'h2');
    gh.append(h('span', 't', T.vicinity));
    if (this.vicinity.contents.length) gh.append(this.btn(T.takeAll, () => this.takeAll(this.vicinity)));
    col.append(gh, this.gridEl('vicinity', this.vicinity));
    return col;
  }

  private btn(label: string, fn: () => boolean) {
    const b = h('button', 'hb', label);
    b.onclick = () => this.act(fn);
    return b;
  }

  /** Move everything that fits from a grid into the worn grids. */
  private takeAll(grid: Grid): boolean {
    let moved = false;
    let full = false;
    for (const gi of [...grid.contents]) {
      const n = gi.item.count;
      removeItem(grid, gi.item);
      if (this.toPlayer(gi.item)) moved = true;
      else {
        if (gi.item.count < n) moved = true;
        grid.contents.push(gi); // what didn't fit stays where it was
        full = true;
      }
    }
    if (full) this.flash(T.full);
    return moved;
  }

  private gridEl(gid: string, grid: Grid) {
    this.grids.set(gid, grid);
    const el = h('div', grid.accepts ? 'inv-grid only' : 'inv-grid');
    el.dataset.gid = gid;
    if (grid.accepts) el.title = grid.accepts.map((k) => T.kind[k] ?? k).join(' / ');
    el.style.width = `calc(var(--cell) * ${grid.w})`;
    el.style.height = `calc(var(--cell) * ${grid.h})`;
    for (const gi of grid.contents) {
      const [w, hh] = footprint(gi.item, gi.rotated);
      const t = this.itemTile(gi.item, gi.rotated);
      t.style.left = `calc(var(--cell) * ${gi.x})`;
      t.style.top = `calc(var(--cell) * ${gi.y})`;
      t.style.width = `calc(var(--cell) * ${w})`;
      t.style.height = `calc(var(--cell) * ${hh})`;
      this.refs.set(t, { item: gi.item, src: { kind: 'grid', gid, gi } });
      el.append(t);
    }
    return el;
  }

  private badge(item: ItemInstance): string {
    const d = defOf(item);
    if (d.kind === 'magazine') return `${item.rounds ?? 0}/${d.capacity}`;
    if (d.kind === 'weapon' && d.capacity !== undefined) return `${item.rounds ?? 0}/${d.capacity}`;
    if (d.kind === 'weapon' && item.mag !== undefined) {
      // Mag + chamber (mechanics keeps the chambered round in weapon.rounds).
      const n = (item.mag?.rounds ?? 0) + (item.rounds ?? 0);
      return item.mag || n ? String(n) : '—';
    }
    if (d.stack > 1) return String(item.count);
    return '';
  }

  /** `rotated` given = grid tile (icon sized in cells, turned 90° when rotated); omitted = fill a fixed slot. */
  private tileFor(defId: string, badge: string, rotated?: boolean) {
    const d = defOf(defId);
    const t = h('div', d.w === 1 ? 'inv-item narrow' : 'inv-item');
    t.style.setProperty('--sw', d.iconSwatch ?? '#555');
    const img = iconImg(defId);
    if (img) {
      t.classList.add('has-icon');
      t.append(img);
      fitIcon(t, d.w, d.h, rotated);
    }
    t.append(h('span', 'n', itemShort(defId)));
    if (badge) t.append(h('span', 'c' + (badge === '0' || badge === '—' || badge.startsWith('0/') ? ' empty' : ''), badge));
    return t;
  }

  private itemTile(item: ItemInstance, rotated?: boolean) {
    const t = this.tileFor(item.defId, this.badge(item), rotated);
    const n = (item.contents?.length ?? 0) + (item.pockets ?? []).reduce((s, p) => s + p.length, 0);
    if (n) t.append(h('span', 'bag', `▤ ${n}`));
    return t;
  }

  // ---------------- pointer ----------------
  private bindPointer() {
    const r = this.root;
    r.addEventListener('pointerdown', (e) => {
      if (!(e.target as HTMLElement).closest('.inv-menu')) this.hideMenu();
      if (e.button !== 0) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>('.inv-item');
      const ref = el && this.refs.get(el);
      if (!ref) return;
      e.preventDefault();
      this.press = { ...ref, el: el!, x: e.clientX, y: e.clientY, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey };
    });
    addEventListener('pointermove', (e) => {
      if (!this.isOpen) return;
      if (this.press && !this.drag && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 4) this.startDrag(e);
      if (this.drag) this.moveDrag(e.clientX, e.clientY);
      else this.hoverTip(e);
    });
    addEventListener('pointerup', (e) => {
      if (!this.isOpen) return;
      if (this.drag) this.endDrag();
      else if (this.press && e.button === 0) {
        const p = this.press;
        if (p.ctrl) this.act(() => this.quickMove(p.item, p.src));
        else if (p.shift) this.act(() => this.splitInPlace(p.item, p.src));
      }
      this.press = null;
    });
    r.addEventListener('dblclick', (e) => {
      const ref = this.refAt(e.target);
      if (ref) this.act(() => this.primary(ref.item, ref.src));
    });
    r.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const hot = (e.target as HTMLElement).closest<HTMLElement>('.inv-hot');
      if (hot) return this.act(() => ((this.lo.hotbar[+hot.dataset.hot!] = null), true));
      const ref = this.refAt(e.target);
      if (ref) this.showMenu(ref.item, ref.src, e.clientX, e.clientY);
    });
  }

  private refAt(t: EventTarget | null) {
    const el = (t as HTMLElement | null)?.closest<HTMLElement>('.inv-item');
    return el ? this.refs.get(el) : undefined;
  }

  private startDrag(e: PointerEvent) {
    const p = this.press!;
    this.tip.hidden = true;
    let item = p.item;
    let src = p.src;
    if (p.shift && item.count > 1) {
      // Shift+drag: carry half the stack.
      item = splitStack(p.item, Math.floor(p.item.count / 2))!;
      src = { kind: 'new', from: p.item };
      this.render();
    } else p.el.classList.add('dragging');
    const rect = p.el.getBoundingClientRect();
    const rotated = src.kind === 'grid' ? src.gi.rotated : false;
    const ghost = this.itemTile(item, rotated);
    ghost.classList.add('inv-ghost');
    this.root.append(ghost);
    this.drag = { item, src, rotated, ghost, gx: 0, gy: 0, px: e.clientX, py: e.clientY, target: { kind: 'none' } };
    // Grab point: keep the cursor over the same cell it grabbed (slot tiles are scaled, so grab the first cell).
    const cell = this.cellPx();
    const inGrid = src.kind === 'grid' || (src.kind === 'new' && !!p.el.closest('.inv-grid'));
    this.drag.gx = inGrid ? Math.min(e.clientX - rect.left, footprint(item, rotated)[0] * cell - 4) : cell / 2;
    this.drag.gy = inGrid ? Math.min(e.clientY - rect.top, footprint(item, rotated)[1] * cell - 4) : cell / 2;
    this.sizeGhost();
  }

  /** --cell is a clamp() expression, so measure it rather than parse it. */
  private cellPx() {
    return this.probe.getBoundingClientRect().width || 52;
  }

  private sizeGhost() {
    const d = this.drag!;
    const [w, hh] = footprint(d.item, d.rotated);
    const c = this.cellPx();
    const dd = defOf(d.item);
    fitIcon(d.ghost, dd.w, dd.h, d.rotated);
    d.ghost.style.width = `${w * c}px`;
    d.ghost.style.height = `${hh * c}px`;
    d.gx = Math.min(d.gx, w * c - 6);
    d.gy = Math.min(d.gy, hh * c - 6);
  }

  private moveDrag(x: number, y: number) {
    const d = this.drag!;
    d.px = x;
    d.py = y;
    d.ghost.style.left = `${x - d.gx}px`;
    d.ghost.style.top = `${y - d.gy}px`;
    d.target = this.resolve(x, y);
    this.showTarget(d.target);
  }

  private resolve(x: number, y: number): Target {
    const d = this.drag!;
    const under = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!under || !this.root.contains(under)) return { kind: 'none' };
    const dd = defOf(d.item);
    const itemEl = under.closest<HTMLElement>('.inv-item');
    const ref = itemEl && this.refs.get(itemEl);
    if (ref && ref.item !== d.item && !itemEl!.classList.contains('dragging')) {
      const t = ref.item;
      const td = defOf(t);
      if (canStack(t, d.item) && t.count < td.stack) return { kind: 'merge', item: t, el: itemEl! };
      if (dd.kind === 'ammo' && td.kind === 'magazine' && td.ammo === d.item.defId && (t.rounds ?? 0) < (td.capacity ?? 0)) return { kind: 'load', item: t, el: itemEl! };
      if (dd.kind === 'magazine' && dd.fits?.includes(t.defId)) return { kind: 'insert', item: t, el: itemEl! };
      if (!containsItem(d.item, t) && gridsOf(t).some((g) => findFree(g, d.item))) return { kind: 'into', item: t, el: itemEl! };
    }
    const slotEl = under.closest<HTMLElement>('.inv-slot');
    if (slotEl) {
      const slot = slotEl.dataset.slot as SlotName;
      return { kind: 'slot', slot, ok: this.lo.canEquip(d.item, slot), el: slotEl };
    }
    const hot = under.closest<HTMLElement>('.inv-hot');
    if (hot) return { kind: 'hot', index: +hot.dataset.hot!, ok: !!dd.use, el: hot };
    const gridEl = under.closest<HTMLElement>('.inv-grid') ?? (itemEl?.closest<HTMLElement>('.inv-grid') || null);
    if (gridEl) {
      const grid = this.grids.get(gridEl.dataset.gid!)!;
      const r = gridEl.getBoundingClientRect();
      const c = this.cellPx();
      const gx = Math.round((x - d.gx - r.left) / c);
      const gy = Math.round((y - d.gy - r.top) / c);
      return { kind: 'grid', gid: gridEl.dataset.gid!, x: gx, y: gy, ok: canPlace(grid, d.item, gx, gy, d.rotated) };
    }
    return under.closest('.inv-col') ? { kind: 'none' } : { kind: 'ground' };
  }

  private showTarget(t: Target) {
    this.highlighted?.classList.remove('target', 'ok', 'bad');
    this.highlighted = null;
    this.fp.remove();
    if (t.kind === 'merge' || t.kind === 'load' || t.kind === 'insert' || t.kind === 'into') {
      (this.highlighted = t.el).classList.add('target');
    } else if (t.kind === 'slot' || t.kind === 'hot') {
      (this.highlighted = t.el).classList.add(t.ok ? 'ok' : 'bad');
    } else if (t.kind === 'grid') {
      const el = this.wrap.querySelector<HTMLElement>(`.inv-grid[data-gid="${t.gid}"]`)!;
      const [w, hh] = footprint(this.drag!.item, this.drag!.rotated);
      const g = this.grids.get(t.gid)!;
      // Clip the footprint to the grid so it never spills over the panel.
      const x0 = Math.max(0, t.x), y0 = Math.max(0, t.y);
      const x1 = Math.min(g.w, t.x + w), y1 = Math.min(g.h, t.y + hh);
      if (x1 <= x0 || y1 <= y0) return;
      this.fp.className = 'inv-fp ' + (t.ok ? 'ok' : 'bad');
      Object.assign(this.fp.style, {
        left: `calc(var(--cell) * ${x0})`, top: `calc(var(--cell) * ${y0})`,
        width: `calc(var(--cell) * ${x1 - x0})`, height: `calc(var(--cell) * ${y1 - y0})`,
      });
      el.append(this.fp);
    }
  }

  private endDrag() {
    const d = this.drag!;
    d.target = this.resolve(d.px, d.py);
    this.drag = null;
    d.ghost.remove();
    this.showTarget({ kind: 'none' });
    this.act(() => this.dropOn(d.item, d.src, d.rotated, d.target));
  }

  private cancelDrag() {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    d.ghost.remove();
    this.showTarget({ kind: 'none' });
    if (d.src.kind === 'new') d.src.from.count += d.item.count;
    this.press = null;
  }

  // ---------------- actions ----------------
  /** Run an action; true = state changed (sound + redraw). */
  private act(fn: () => boolean | void) {
    const ok = fn();
    if (ok) {
      this.lo.changed();
      this.hooks.sfx('inventory_move');
    }
    this.syncVicinity();
    this.render();
  }

  private take(src: Src, item: ItemInstance) {
    if (src.kind === 'grid') removeItem(this.grids.get(src.gid)!, item);
    else if (src.kind === 'slot') delete this.lo.equipment[src.slot];
    this.bags = this.bags.filter((b) => b !== item);
  }

  private restore(src: Src, item: ItemInstance) {
    if (item.count <= 0) return;
    if (src.kind === 'grid') {
      const g = this.grids.get(src.gid)!;
      if (!g.contents.includes(src.gi)) g.contents.push(src.gi);
    } else if (src.kind === 'slot') this.lo.equipment[src.slot] = item;
    else if (src.kind === 'new') src.from.count += item.count;
  }

  private dropOn(item: ItemInstance, src: Src, rotated: boolean, t: Target): boolean {
    const back = () => (this.restore(src, item), false);
    switch (t.kind) {
      case 'merge': {
        const n = mergeInto(t.item, item);
        if (item.count <= 0) this.take(src, item);
        else if (src.kind === 'new') this.restore(src, item);
        return n > 0;
      }
      case 'load': {
        const n = this.lo.loadMagazine(t.item, item);
        if (src.kind === 'new') this.restore(src, item);
        else if (item.count <= 0) this.take(src, item);
        return n > 0;
      }
      case 'insert':
        if (src.kind === 'new') return back();
        this.take(src, item);
        return this.lo.insertMagazine(t.item, item) || back();
      case 'into':
        this.take(src, item);
        return autoPlaceInto(t.item, item) === 0 || back();
      case 'grid': {
        if (!t.ok) return back();
        const grid = this.grids.get(t.gid)!;
        this.take(src, item);
        return !!place(grid, item, t.x, t.y, rotated) || back();
      }
      case 'slot': {
        if (!t.ok) return back();
        const old = this.lo.equipment[t.slot];
        if (old === item) return back();
        this.take(src, item);
        this.lo.equipment[t.slot] = item;
        if (old) {
          // Swap: the old item goes where the new one came from, else anywhere.
          if (src.kind === 'grid' && place(this.grids.get(src.gid)!, old, src.gi.x, src.gi.y, src.gi.rotated)) return true;
          if (src.kind === 'slot' && this.lo.canEquip(old, src.slot)) return ((this.lo.equipment[src.slot] = old), true);
          this.toPlayer(old) || this.lo.drop(old);
        }
        if (src.kind === 'new') this.restore(src, item);
        return true;
      }
      case 'hot':
        this.restore(src, item); // binding never moves the item
        if (!t.ok) return false;
        this.lo.hotbar[t.index] = item.defId;
        return true;
      case 'ground':
        this.take(src, item);
        this.lo.drop(item);
        this.hooks.sfx('item_pickup');
        return true;
      default:
        return back();
    }
  }

  /** Into the worn grids (or an empty weapon slot). Returns true if all of it fit. */
  private toPlayer(item: ItemInstance): boolean {
    const d = defOf(item);
    const slot = d.slots?.find((s) => !this.lo.equipment[s]);
    if (slot) return ((this.lo.equipment[slot] = item), true);
    if (this.lo.storeWorn(item)) return true;
    return false;
  }

  private isPlayerSide(src: Src) {
    return src.kind === 'slot' || (src.kind === 'grid' && src.gid.startsWith('eq:'));
  }

  /** Ctrl+click: player side <-> open container (or the ground). */
  private quickMove(item: ItemInstance, src: Src): boolean {
    this.take(src, item);
    if (this.isPlayerSide(src)) {
      const c = this.container ? this.lo.containers.get(this.container) : null;
      if (c && autoPlace(c.grid, item) === 0) return true;
      if (!c) return (this.lo.drop(item), true);
    } else if (this.toPlayer(item)) return true;
    this.restore(src, item);
    this.flash(T.full);
    return false;
  }

  private splitInPlace(item: ItemInstance, src: Src): boolean {
    if (src.kind !== 'grid' || item.count < 2) return false;
    const grid = this.grids.get(src.gid)!;
    const part = splitStack(item, Math.floor(item.count / 2))!;
    // Same grid first, then (player side) the other worn grids (QA-021).
    const grids = [grid, ...(this.isPlayerSide(src) ? this.lo.playerGrids().map((p) => p.grid) : [])];
    for (const g of grids) {
      const spot = findFree(g, part);
      if (spot) return !!place(g, part, spot.x, spot.y, spot.rotated);
    }
    item.count += part.count;
    this.flash(T.full);
    return false;
  }

  private equip(item: ItemInstance, src: Src): boolean {
    const slots = defOf(item).slots ?? [];
    const slot = slots.find((s) => !this.lo.equipment[s]) ?? slots[0];
    if (!slot) return false;
    const el = this.wrap.querySelector<HTMLElement>(`.inv-slot[data-slot="${slot}"]`)!;
    return this.dropOn(item, src, false, { kind: 'slot', slot, ok: true, el });
  }

  /** Starts the timed use; effects land when it completes (systems/index), a hit interrupts it. */
  private use(item: ItemInstance): boolean {
    if (!this.lo.beginUse(item)) return false;
    this.flash(`${survivalText.using} ${itemName(item.defId)}`);
    return false; // nothing moved yet
  }

  /** Double-click: use > equip > open > quick move. */
  private primary(item: ItemInstance, src: Src): boolean {
    const d = defOf(item);
    if (d.use) return this.use(item);
    if (d.slots && src.kind !== 'slot') return this.equip(item, src);
    if (hasStorage(item) && src.kind !== 'slot') return this.openBag(item);
    return this.quickMove(item, src);
  }

  /** Boxed goods: the box becomes loose contents (ammo box -> 50 rounds) in the same place, overflow to the player. */
  private unpack(item: ItemInstance, src: Src): boolean {
    const u = defOf(item).unpack;
    if (!u || src.kind !== 'grid') return false;
    const grid = this.grids.get(src.gid)!;
    this.take(src, item);
    for (const it of newItems(u.item, u.count * item.count)) if (autoPlace(grid, it) > 0) this.lo.give(it);
    return true;
  }

  private openBag(item: ItemInstance) {
    if (!this.bags.includes(item)) this.bags.push(item);
    return false;
  }

  private loadFromInventory(mag: ItemInstance): boolean {
    const md = defOf(mag);
    let n = 0;
    for (const { grid } of this.lo.playerGrids())
      for (const gi of [...grid.contents]) if (gi.item.defId === md.ammo && (mag.rounds ?? 0) < (md.capacity ?? 0)) n += this.lo.loadMagazine(mag, gi.item);
    return n > 0;
  }

  // ---------------- context menu ----------------
  private showMenu(item: ItemInstance, src: Src, x: number, y: number) {
    const d = defOf(item);
    const opts: [string, () => boolean | void][] = [];
    if (d.use) opts.push([T.act.use, () => this.use(item)]);
    if (d.slots && src.kind !== 'slot') opts.push([T.act.equip, () => this.equip(item, src)]);
    if (src.kind === 'slot') opts.push([T.act.unequip, () => (this.take(src, item), this.toPlayer(item) || this.lo.drop(item), true)]);
    if (hasStorage(item) && src.kind !== 'slot') opts.push([T.act.open, () => this.openBag(item)]);
    if (d.unpack) opts.push([T.act.unpack, () => this.unpack(item, src)]);
    if (d.kind === 'magazine' && (item.rounds ?? 0) < (d.capacity ?? 0) && this.lo.count(d.ammo!) > 0) opts.push([T.act.load, () => this.loadFromInventory(item)]);
    if (d.kind === 'magazine' && (item.rounds ?? 0) > 0) opts.push([T.act.unload, () => this.lo.unloadMagazine(item) > 0]);
    if (item.mag) opts.push([T.act.unmag, () => (this.lo.removeMagazine(item), true)]);
    if (d.use) opts.push([T.act.bind, () => {
      const i = this.lo.hotbar.indexOf(item.defId);
      if (i < 0) this.lo.hotbar[Math.max(0, this.lo.hotbar.indexOf(null))] = item.defId;
      return true;
    }]);
    if (d.stack > 1 && item.count > 1 && src.kind === 'grid') opts.push([T.act.split, () => this.splitInPlace(item, src)]);
    if (!this.isPlayerSide(src)) opts.push([T.act.take, () => this.quickMove(item, src)]);
    if (!(src.kind === 'grid' && src.gid === 'vicinity')) opts.push([T.act.drop, () => (this.take(src, item), this.lo.drop(item), true)]);
    this.menu.replaceChildren(
      ...opts.map(([label, fn]) => {
        const b = h('button', '', label);
        b.onclick = () => (this.hideMenu(), this.act(fn));
        return b;
      }),
    );
    this.menu.hidden = false;
    this.tip.hidden = true;
    const r = this.menu.getBoundingClientRect();
    this.menu.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`;
    this.menu.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`;
  }

  private hideMenu() {
    this.menu.hidden = true;
  }

  // ---------------- tooltip ----------------
  private hoverTip(e: PointerEvent) {
    const ref = this.refAt(e.target);
    if (!ref || !this.menu.hidden) return void (this.tip.hidden = true);
    const it = ref.item;
    const d = defOf(it);
    const S = T.stat;
    const rows: [string, string, number?][] = []; // [label, value, delta vs equipped]
    // Hover-compare: against what's in the item's slot now (if it isn't that item).
    const slot = d.slots?.find((sl) => this.lo.equipment[sl]);
    const eq = slot && ref.src.kind !== 'slot' ? this.lo.equipment[slot] : undefined;
    const eqD = eq && eq !== it ? defOf(eq) : null;
    if (d.stack > 1) rows.push([S.stack, `${it.count} / ${d.stack}`]);
    if (d.kind === 'magazine') rows.push([S.rounds, `${it.rounds ?? 0} / ${d.capacity}`], [S.ammo, itemName(d.ammo!)]);
    const wd = weaponDefs[it.defId];
    const ewd = eqD ? weaponDefs[eqD.id] : undefined;
    if (wd) rows.push([S.caliber, wd.caliber], [S.damage, String(wd.damage), ewd && wd.damage - ewd.damage], [S.rpm, `${wd.rpm} rpm`, ewd && wd.rpm - ewd.rpm]);
    if (it.mag !== undefined) rows.push([S.magazine, it.mag ? `${it.mag.rounds ?? 0} / ${defOf(it.mag).capacity}` : S.none]);
    if (hasStorage(it)) {
      // "6×6 + 2×4 + 2×4 (60 cells)" — compare total cells with what's worn in that slot.
      const shape = (dd: typeof d) => [...(dd.grid ? [dd.grid] : []), ...(dd.pockets ?? [])];
      const cellsOf = (dd: typeof d) => shape(dd).reduce((s, g) => s + g.w * g.h, 0);
      const cells = cellsOf(d);
      const parts = shape(d).map((g) => `${g.w}×${g.h}`).join(' + ');
      rows.push([S.storage, `${parts} (${cells})`, eqD && hasStorage(eqD.id) ? cells - cellsOf(eqD) : undefined]);
      const only = (d.pockets ?? []).find((p) => p.accepts)?.accepts;
      if (only) rows.push([S.only, only.map((k) => T.kind[k] ?? k).join(', ')]);
    }
    if (d.use?.heal) rows.push([S.heals, `+${d.use.heal}`]);
    if (d.use?.food) rows.push([S.food, `+${d.use.food}`]);
    if (d.use?.water) rows.push([S.water, `+${d.use.water}`]);
    rows.push([S.size, `${d.w}×${d.h}`], [S.value, `$${d.value * it.count}`]);
    this.tip.replaceChildren();
    const desc = itemText[it.defId]?.description;
    const ti = iconImg(it.defId);
    if (ti) this.tip.append(Object.assign(ti, { className: 'tip-ic' }));
    this.tip.append(h('span', 'k', T.kind[d.kind] ?? d.kind), h('b', '', itemName(it.defId)));
    if (desc) this.tip.append(h('p', '', desc));
    for (const [k, v, delta] of rows) {
      const r = h('div', 's');
      const val = h('span', '', v);
      if (delta) val.append(h('em', delta > 0 ? 'up' : 'down', ` ${delta > 0 ? '+' : ''}${delta}`));
      r.append(h('span', '', k), val);
      this.tip.append(r);
    }
    if (eqD) this.tip.append(h('div', 'cmp', `${S.vsEquipped}: ${itemName(eqD.id)}`));
    this.tip.hidden = false;
    const tr = this.tip.getBoundingClientRect();
    this.tip.style.left = `${Math.min(e.clientX + 16, innerWidth - tr.width - 8)}px`;
    this.tip.style.top = `${Math.min(e.clientY + 16, innerHeight - tr.height - 8)}px`;
  }

  // ---------------- keys + toast ----------------
  private onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
    if (e.code === 'Tab') {
      e.preventDefault();
      if (!e.repeat && (this.isOpen || this.hooks.canOpen())) this.toggle();
      return;
    }
    if (!this.isOpen) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (!this.menu.hidden) this.hideMenu();
      else if (this.drag) this.cancelDrag(), this.render();
      else this.close();
    } else if (e.code === 'KeyR' && this.drag && !e.repeat) {
      const d = this.drag;
      d.rotated = !d.rotated;
      this.sizeGhost();
      this.moveDrag(d.px, d.py);
    }
  }

  flash(text: string) {
    if (!this.isOpen) return this.hooks.toast(text);
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastEl.style.opacity = '0'), 1600);
  }
}
