import iconIndex from '../../../public/assets/icons/index.json';
import { ITEMS } from '../../content/data/items';
import { TRADER } from '../../content/data/trade';
import type { ItemInstance } from '../../content/data/types';
import { itemText } from '../../content/text/items';
import { choiceText, dialogueText, npcName, tradeUi as T } from '../../content/text/npc';
import { screenText as K } from '../../content/text/ui';
import { assetUrl } from '../../engine/assetUrl';
import type { Dialogue } from '../../systems/dialogue';
import { buyPrice, cashOf, sellable, type TraderState } from '../../systems/trade';
import type { Loadout } from '../../systems/loadout';
import '../inventory/inventory.css';
import '../inventory/craft.css';
import './npc.css';

/**
 * Two panels in the inventory style: the conversation (bottom of the screen: name, what they say, numbered answers) and
 * the trade screen (their stock on the left with Buy, your pack on the right with Sell, cash on both sides).
 * Rules live in systems/dialogue.ts and systems/trade.ts; this only draws them and forwards clicks.
 */
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const ICONS = new Set(iconIndex.ids);
const iname = (id: string) => itemText[id]?.name ?? id;
function icon(id: string) {
  if (ICONS.has(id)) {
    const i = h('img', 'tr-ic') as HTMLImageElement;
    i.src = assetUrl(`assets/icons/${id}.png`);
    i.alt = '';
    i.draggable = false;
    return i;
  }
  const s = h('div', 'tr-ic sw');
  s.style.background = ITEMS[id]?.iconSwatch ?? '#555';
  return s;
}

export interface NpcUiHooks {
  sfx(id: string): void;
  onOpenChange(open: boolean): void;
  /** Conversation ended (or the trade closed with no conversation behind it). */
  onClosed(): void;
  buy(index: number, qty: number): string | null;
  sell(item: ItemInstance, qty: number): string | null;
}

export class NpcUi {
  readonly talk = h('div', 'dlg');
  readonly shop = h('div', 'inv-root tr-root');
  private convo: { npc: string; d: Dialogue } | null = null;
  private trading: { lo: Loadout; st: TraderState } | null = null;
  private note = '';
  /** Keyboard selection: the highlighted answer, and the trade row (column 0 = their stock, 1 = your pack). */
  private sel = 0;
  private tsel = { col: 0, row: 0 };

  constructor(private hooks: NpcUiHooks, parent: HTMLElement) {
    this.talk.hidden = true;
    this.shop.hidden = true;
    parent.append(this.talk, this.shop);
    addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        return this.closeAll();
      }
      if (this.trading) return this.tradeKey(e);
      if (!this.convo) return;
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (m) return this.pick(Number(m[1]) - 1);
      const n = this.convo.d.choices().length;
      if (!n) return;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.sel = (this.sel + 1) % n;
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') this.sel = (this.sel - 1 + n) % n;
      else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
        if (e.repeat) return;
        e.preventDefault();
        return this.pick(this.sel);
      } else return;
      e.preventDefault();
      this.renderTalk();
    });
  }

  get isOpen() {
    return !this.talk.hidden || !this.shop.hidden;
  }
  get tradeOpen() {
    return !this.shop.hidden;
  }

  // ---------------- conversation ----------------
  startTalk(npc: string, d: Dialogue) {
    const wasOpen = this.isOpen;
    this.convo = { npc, d };
    this.sel = 0;
    d.start();
    if (!wasOpen) {
      this.hooks.onOpenChange(true);
      this.hooks.sfx('ui_open');
    }
    this.talk.hidden = false;
    this.renderTalk();
  }

  private pick(i: number) {
    const c = this.convo;
    if (!c) return;
    const choice = c.d.choices()[i];
    if (!choice) return;
    c.d.choose(choice.id);
    this.sel = 0;
    if (!c.d.node) return this.closeAll();
    if (!this.tradeOpen) this.renderTalk();
  }

  refresh() {
    if (this.tradeOpen) this.renderShop();
    else if (!this.talk.hidden) this.renderTalk();
  }

  private renderTalk() {
    const c = this.convo;
    if (!c || !c.d.node) return;
    this.talk.textContent = '';
    const who = npcName[c.npc];
    const box = h('div', 'dlg-box');
    box.append(h('div', 'dlg-name', who ? `${who.name} · ${who.role}` : c.npc));
    box.append(h('div', 'dlg-say', dialogueText[c.d.def.id]?.[c.d.node] ?? ''));
    const list = h('div', 'dlg-choices');
    const choices = c.d.choices();
    if (this.sel >= choices.length) this.sel = 0;
    choices.forEach((ch, i) => {
      const b = h('button', `dlg-choice${i === this.sel ? ' on' : ''}`) as HTMLButtonElement;
      b.tabIndex = -1; // keys are handled above; focus would steal Space/Enter from the game
      b.append(h('span', 'dlg-n', String(i + 1)), h('span', '', choiceText[c.d.def.id]?.[ch.id] ?? ch.id));
      b.onclick = () => this.pick(i);
      b.onmouseenter = () => {
        if (this.sel === i) return;
        list.querySelector('.on')?.classList.remove('on');
        b.classList.add('on');
        this.sel = i;
      };
      list.append(b);
    });
    const keys = h('div', 'dlg-keys');
    keys.innerHTML = K.dlgKeys;
    box.append(list, keys);
    this.talk.append(box);
  }

  // ---------------- trade ----------------
  openTrade(lo: Loadout, st: TraderState) {
    const wasOpen = this.isOpen;
    this.trading = { lo, st };
    this.note = '';
    this.tsel = { col: 0, row: 0 };
    this.talk.hidden = true;
    this.shop.hidden = false;
    if (!wasOpen) {
      this.hooks.onOpenChange(true);
      this.hooks.sfx('ui_open');
    }
    this.renderShop();
  }

  private act(r: string | null) {
    this.note = r ?? '';
    this.renderShop();
  }

  private renderShop() {
    const t = this.trading;
    if (!t) return;
    const { lo, st } = t;
    this.shop.textContent = '';
    const wrap = h('div', 'tr-wrap');
    const rows: HTMLElement[][] = [[], []];
    // their stock
    const left = h('div', 'inv-col tr-col');
    left.append(h('h2', '', `${T.title} · ${T.stock}`));
    left.append(h('div', 'tr-cash', `${T.till}: $${st.cash}`));
    if (!st.stock.length) left.append(h('div', 'tr-empty', T.empty));
    // identical stacks share one row (three "Bottle of Water" rows read as a bug); Buy takes from the first stack
    const stockRows = new Map<string, { i: number; n: number; extra: string }>();
    st.stock.forEach((it, i) => {
      const d = ITEMS[it.defId];
      const extra = it.rounds !== undefined && d.kind === 'magazine' ? ` (${it.rounds}/${d.capacity})` : it.fuel !== undefined ? ` (${it.fuel} L)` : it.durability !== undefined && it.durability < 0.99 ? ` (${Math.round(it.durability * 100)}%)` : '';
      const key = `${it.defId}|${extra}`;
      const g = stockRows.get(key);
      if (g) g.n += it.count;
      else stockRows.set(key, { i, n: it.count, extra });
    });
    for (const { i, n, extra } of stockRows.values()) {
      const it = st.stock[i];
      const price = buyPrice(ITEMS[it.defId]);
      const row = h('div', `tr-row${cashOf(lo) < price ? ' poor' : ''}`);
      rows[0].push(row);
      const name = h('div', 'tr-name');
      name.append(h('b', '', `${iname(it.defId)}${extra}`), h('small', '', n > 1 ? `×${n}` : ''));
      const buyBtn = h('button', 'tr-btn', `${T.buy} $${price}`) as HTMLButtonElement;
      buyBtn.disabled = cashOf(lo) < price;
      buyBtn.tabIndex = -1;
      buyBtn.onclick = () => this.act(this.hooks.buy(i, 1));
      row.append(icon(it.defId), name, buyBtn, h('span'));
      left.append(row);
    }
    // your pack
    const right = h('div', 'inv-col tr-col');
    right.append(h('h2', '', T.yours));
    right.append(h('div', 'tr-cash', `${T.cash}: $${cashOf(lo)}`));
    const mine = sellable(lo);
    if (!mine.length) right.append(h('div', 'tr-empty', T.nothingToSell));
    // group identical stacks into one row
    const groups = new Map<string, { items: ItemInstance[]; unit: number; n: number }>();
    for (const s of mine) {
      const key = `${s.item.defId}|${s.unit}|${s.item.rounds ?? ''}|${s.item.fuel ?? ''}`;
      const g = groups.get(key) ?? { items: [], unit: s.unit, n: 0 };
      g.items.push(s.item);
      g.n += s.item.count;
      groups.set(key, g);
    }
    for (const g of groups.values()) {
      const first = g.items[0];
      const row = h('div', 'tr-row');
      rows[1].push(row);
      const name = h('div', 'tr-name');
      name.append(h('b', '', iname(first.defId)), h('small', '', g.n > 1 ? `×${g.n}` : ''));
      const one = h('button', 'tr-btn', `${T.sell} $${g.unit}`);
      one.onclick = () => this.act(this.hooks.sell(first, 1));
      one.tabIndex = -1;
      row.append(icon(first.defId), name, one);
      if (g.n > 1) {
        const all = h('button', 'tr-btn alt', `${T.sellAll}`);
        all.onclick = () => {
          let err: string | null = null;
          for (const it of [...g.items]) err = this.hooks.sell(it, it.count) ?? err;
          this.act(err);
        };
        all.tabIndex = -1;
        row.append(all);
      } else row.append(h('span')); // keeps every Sell button in one column
      right.append(row);
    }
    wrap.append(left, right);
    // keyboard selection: stay in range as stacks sell out, hop columns when one is empty
    const ts = this.tsel;
    if (!rows[ts.col].length && rows[1 - ts.col].length) ts.col = 1 - ts.col;
    ts.row = Math.max(0, Math.min(ts.row, rows[ts.col].length - 1));
    const on = rows[ts.col][ts.row];
    on?.classList.add('sel');
    this.rows = rows;
    rows.forEach((col, c) =>
      col.forEach((r, i) => {
        r.onmouseenter = () => {
          this.shop.querySelector('.tr-row.sel')?.classList.remove('sel');
          r.classList.add('sel');
          this.tsel = { col: c, row: i };
        };
      }),
    );
    const keys = h('div', 'inv-hint');
    keys.innerHTML = K.tradeKeys;
    this.shop.append(wrap, h('div', 'tr-note', this.note), h('div', 'tr-foot', K.tradeFoot(TRADER.cashPerDay)), keys);
    on?.scrollIntoView({ block: 'nearest' });
  }

  private rows: HTMLElement[][] = [[], []];
  private tradeKey(e: KeyboardEvent) {
    const ts = this.tsel;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') ts.row++;
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') ts.row--;
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
      const to = e.code === 'ArrowLeft' || e.code === 'KeyA' ? 0 : 1;
      if (to === ts.col || !this.rows[to].length) return;
      ts.col = to;
    } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
      if (e.repeat) return;
      e.preventDefault();
      (this.rows[ts.col][ts.row]?.querySelector('.tr-btn:not(:disabled)') as HTMLButtonElement | null)?.click();
      return;
    } else return;
    e.preventDefault();
    const n = this.rows[ts.col].length;
    ts.row = n ? (ts.row + n) % n : 0;
    this.renderShop();
  }

  // ---------------- close ----------------
  /** Close the trade screen and go back to the conversation if there is one. */
  closeTrade() {
    if (!this.tradeOpen) return;
    this.shop.hidden = true;
    this.trading = null;
    if (this.convo?.d.node) {
      this.talk.hidden = false;
      this.renderTalk();
    } else this.closeAll();
  }

  closeAll() {
    const was = this.isOpen;
    this.talk.hidden = true;
    this.shop.hidden = true;
    this.convo = null;
    this.trading = null;
    if (was) {
      this.hooks.onOpenChange(false);
      this.hooks.sfx('ui_close');
      this.hooks.onClosed();
    }
  }
}
