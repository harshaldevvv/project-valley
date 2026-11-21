import iconIndex from '../../../public/assets/icons/index.json';
import { RECIPE_CATEGORIES, RECIPES } from '../../content/data/crafting';
import { ITEMS } from '../../content/data/items';
import type { ItemInstance, RecipeDef } from '../../content/data/types';
import { craftText as T } from '../../content/text/crafting';
import { itemText } from '../../content/text/items';
import { assetUrl } from '../../engine/assetUrl';
import { check, damagedWeapons, equippedUse, type Missing, type Station } from '../../systems/crafting';
import type { Loadout } from '../../systems/loadout';
import './inventory.css';
import './craft.css';

/**
 * Crafting panel (G): a recipe list by category on the left, the selected recipe on the right with what you have of each
 * input, the tools it needs and a Craft button. Rules live in systems/crafting.ts; the world starts the timed job.
 */
export interface CraftHooks {
  sfx(id: string): void;
  onOpenChange(open: boolean): void;
  /** Stations close enough right now (a lit campfire). */
  stations(): ReadonlySet<Station>;
  /** Start the timed job; the panel closes. */
  begin(r: RecipeDef, target: ItemInstance | null): void;
}

const ICONS = new Set(iconIndex.ids);
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const name = (id: string) => itemText[id]?.name ?? id;
export const recipeName = (r: RecipeDef) => T.names[r.id] ?? name(r.outputs[0]?.item ?? r.id);
function icon(id: string, cls = '') {
  if (ICONS.has(id)) {
    const i = h('img', cls) as HTMLImageElement;
    i.src = assetUrl(`assets/icons/${id}.png`);
    i.alt = '';
    i.draggable = false;
    return i;
  }
  // No rendered icon yet: a swatch tile with the item's initial, so the row never shows an empty hole.
  const s = h('div', `sw ${cls}`.trim(), (itemText[id]?.short ?? name(id)).charAt(0).toUpperCase());
  s.style.setProperty('--sw', ITEMS[id]?.iconSwatch ?? '#555');
  return s;
}

export class CraftScreen {
  readonly root = h('div', 'inv-root cr-root');
  private tab: RecipeDef['category'] = 'medical';
  private sel: RecipeDef | null = null;
  private target: ItemInstance | null = null;
  /** The recipe whose Craft button is waiting for a second click because it would use up equipped gear. */
  private confirm: RecipeDef | null = null;

  /** Rows of the current tab in display order (ready first), for keyboard navigation. */
  private order: RecipeDef[] = [];

  constructor(private lo: Loadout, private hooks: CraftHooks, parent: HTMLElement) {
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', (e) => this.onKey(e));
  }

  /** ↑/↓ pick a recipe, Q/E or ←/→ switch category, Enter crafts (same rules as the button). */
  private onKey(e: KeyboardEvent) {
    if (!this.isOpen || (e.repeat && e.code === 'Enter')) return;
    const cats = RECIPE_CATEGORIES;
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      if (!this.order.length) return;
      const i = this.sel ? this.order.indexOf(this.sel) : -1;
      const n = this.order.length;
      this.sel = this.order[e.code === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n];
      this.target = null;
      this.confirm = null;
    } else if (e.code === 'KeyQ' || e.code === 'KeyE' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const d = e.code === 'KeyE' || e.code === 'ArrowRight' ? 1 : -1;
      this.tab = cats[(cats.indexOf(this.tab) + d + cats.length) % cats.length];
      this.sel = this.target = this.confirm = null;
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      this.root.querySelector<HTMLButtonElement>('.cr-go:not(:disabled)')?.click();
      e.preventDefault();
      return;
    } else return;
    e.preventDefault();
    this.hooks.sfx('ui_click');
    this.render();
    this.root.querySelector('.cr-row.sel')?.scrollIntoView({ block: 'nearest' });
  }

  get isOpen() {
    return !this.root.hidden;
  }
  open() {
    if (this.isOpen) return;
    this.root.hidden = false;
    this.hooks.onOpenChange(true);
    this.hooks.sfx('ui_open');
    this.render();
  }
  close() {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.hooks.onOpenChange(false);
    this.hooks.sfx('ui_close');
  }
  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }
  /** Redraw after the pack changed (an item picked up or used while the panel is open). */
  refresh() {
    if (this.isOpen) this.render();
  }

  private missingText(m: Missing) {
    return m.kind === 'input' ? `${name(m.item)} ${m.have}/${m.need}` : m.kind === 'tool' ? m.any.map(name).join(' / ') : m.kind === 'station' ? T.station[m.station] : T.pickWeapon;
  }

  render() {
    const st = this.hooks.stations();
    this.root.textContent = '';
    const wrap = h('div', 'cr-wrap');
    const list = h('div', 'inv-col cr-list');
    list.append(h('h2', '', T.title));
    const tabs = h('div', 'cr-tabs');
    const isReady = (r: RecipeDef) => check(this.lo, r, st, null).filter((m) => m.kind !== 'target').length === 0;
    for (const c of RECIPE_CATEGORIES) {
      const b = h('button', c === this.tab ? 'on' : '', T.categories[c] ?? c);
      // How many recipes in that category can be made right now
      const n = RECIPES.filter((r) => r.category === c && isReady(r)).length;
      if (n) b.append(h('span', 'n', String(n)));
      b.onclick = () => ((this.tab = c), (this.sel = null), (this.target = null), (this.confirm = null), this.render());
      tabs.append(b);
    }
    list.append(tabs);
    const rows = RECIPES.filter((r) => r.category === this.tab)
      .map((r) => ({ r, ready: isReady(r) }))
      .sort((a, b) => Number(b.ready) - Number(a.ready));
    this.order = rows.map((x) => x.r);
    if (!rows.length) list.append(h('div', 'inv-empty', T.empty));
    if (!this.sel || this.sel.category !== this.tab) this.sel = rows[0]?.r ?? null;
    for (const { r, ready } of rows) {
      const row = h('div', `cr-row${ready ? '' : ' no'}${r === this.sel ? ' sel' : ''}`);
      const text = h('div');
      text.append(h('b', '', recipeName(r)), h('small', '', r.inputs.map((i) => `${i.count > 1 ? i.count + '× ' : ''}${name(i.item)}`).join(', ')));
      row.append(icon(r.outputs[0]?.item ?? 'repair_kit'), text, h('span', 'dot'));
      row.onclick = () => ((this.sel = r), (this.target = null), (this.confirm = null), this.render());
      list.append(row);
    }
    wrap.append(list);
    if (this.sel) wrap.append(this.detail(this.sel, st));
    const hint = h('div', 'inv-hint');
    hint.innerHTML = T.hint; // our own text file, kbd markup only
    this.root.append(wrap, hint);
  }

  private detail(r: RecipeDef, st: ReadonlySet<Station>) {
    const col = h('div', 'inv-col cr-detail');
    const big = h('div', 'big');
    const t = h('div');
    const out = r.outputs[0];
    t.append(h('b', '', recipeName(r)), h('p', '', out ? itemText[out.item]?.description ?? '' : ''));
    big.append(icon(out?.item ?? 'repair_kit'), t);
    col.append(h('h2', '', T.makes), big);
    col.append(h('h3', '', T.needs));
    for (const i of r.inputs) {
      const have = this.lo.countAll(i.item);
      const row = h('div', `cr-need ${have >= i.count ? 'ok' : 'bad'}`);
      row.append(h('span', '', name(i.item)), h('span', '', `${have} / ${i.count}`));
      col.append(row);
    }
    if (r.tools?.length) {
      col.append(h('h3', '', T.tools));
      for (const g of r.tools) {
        const ok = g.some((x) => this.lo.countAll(x) > 0);
        const row = h('div', `cr-need ${ok ? 'ok' : 'bad'}`);
        row.append(h('span', '', g.map(name).join(' / ')), h('span', '', ok ? '✓' : '✕'));
        col.append(row);
      }
    }
    if (r.station) {
      const ok = st.has(r.station);
      const row = h('div', `cr-need ${ok ? 'ok' : 'bad'}`);
      row.append(h('span', '', T.station[r.station]), h('span', '', ok ? '✓' : '✕'));
      col.append(row);
    }
    const time = h('div', 'cr-need ok');
    time.append(h('span', '', '⏱'), h('span', '', T.time(r.seconds)));
    col.append(time);
    if (r.repair) {
      const dmg = damagedWeapons(this.lo);
      col.append(h('h3', '', dmg.length ? T.pickWeapon : T.noDamaged));
      const box = h('div', 'cr-pick');
      if (dmg.length && !dmg.includes(this.target as ItemInstance)) this.target = dmg[0];
      for (const it of dmg) {
        const b = h('button', it === this.target ? 'on' : '');
        b.append(h('span', '', name(it.defId)), h('span', '', T.durability(Math.round((it.durability ?? 1) * 100))));
        b.onclick = () => ((this.target = it), this.render());
        box.append(b);
      }
      col.append(box);
    }
    const miss = check(this.lo, r, st, this.target);
    const worn = miss.length ? [] : equippedUse(this.lo, r);
    const asking = this.confirm === r && worn.length > 0;
    const go = h('button', 'cr-go', miss.length ? T.cantCraft : asking ? T.confirm(worn.map((w) => name(w.defId)).join(', ')) : T.craft) as HTMLButtonElement;
    go.disabled = miss.length > 0;
    go.title = miss.map((m) => this.missingText(m)).join(', ');
    if (worn.length && !asking) col.append(h('div', 'cr-warn', T.usesEquipped(worn.map((w) => name(w.defId)).join(', '))));
    go.onclick = () => {
      if (check(this.lo, r, this.hooks.stations(), this.target).length) return;
      if (equippedUse(this.lo, r).length && this.confirm !== r) return ((this.confirm = r), this.render());
      this.confirm = null;
      this.hooks.begin(r, this.target);
      this.close();
    };
    col.append(go);
    // Why the button is off, readable without hovering (the title tooltip alone never shows on a controller or touch)
    if (miss.length) col.append(h('div', 'cr-why', T.why(miss.map((m) => this.missingText(m)).join(' · '))));
    return col;
  }
}
