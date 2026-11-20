import iconIndex from '../../../public/assets/icons/index.json';
import { ITEMS } from '../../content/data/items';
import { TRADER } from '../../content/data/trade';
import type { ItemInstance } from '../../content/data/types';
import { itemText } from '../../content/text/items';
import { choiceText, dialogueText, npcName, npcUi, tradeUi as T } from '../../content/text/npc';
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
      const m = /^Digit([1-9])$/.exec(e.code);
      if (m && this.convo && !this.trading) this.pick(Number(m[1]) - 1);
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
    c.d.choices().forEach((ch, i) => {
      const b = h('button', 'dlg-choice');
      b.append(h('span', 'dlg-n', String(i + 1)), h('span', '', choiceText[c.d.def.id]?.[ch.id] ?? ch.id));
      b.onclick = () => this.pick(i);
      list.append(b);
    });
    box.append(list, h('div', 'cr-foot', npcUi.hint));
    this.talk.append(box);
  }

  // ---------------- trade ----------------
  openTrade(lo: Loadout, st: TraderState) {
    const wasOpen = this.isOpen;
    this.trading = { lo, st };
    this.note = '';
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
    // their stock
    const left = h('div', 'inv-col tr-col');
    left.append(h('h2', '', `${T.title} · ${T.stock}`));
    left.append(h('div', 'tr-cash', `${T.till}: $${st.cash}`));
    if (!st.stock.length) left.append(h('div', 'tr-empty', T.empty));
    st.stock.forEach((it, i) => {
      const d = ITEMS[it.defId];
      const price = buyPrice(d);
      const row = h('div', `tr-row${cashOf(lo) < price ? ' poor' : ''}`);
      const name = h('div', 'tr-name');
      const extra = it.rounds !== undefined && d.kind === 'magazine' ? ` (${it.rounds}/${d.capacity})` : it.fuel !== undefined ? ` (${it.fuel} L)` : it.durability !== undefined && it.durability < 0.99 ? ` (${Math.round(it.durability * 100)}%)` : '';
      name.append(h('b', '', `${iname(it.defId)}${extra}`), h('small', '', it.count > 1 ? `×${it.count}` : ''));
      const buyBtn = h('button', 'tr-btn', `${T.buy} $${price}`) as HTMLButtonElement;
      buyBtn.disabled = cashOf(lo) < price;
      buyBtn.onclick = () => this.act(this.hooks.buy(i, 1));
      row.append(icon(it.defId), name, buyBtn);
      left.append(row);
    });
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
      const name = h('div', 'tr-name');
      name.append(h('b', '', iname(first.defId)), h('small', '', g.n > 1 ? `×${g.n}` : ''));
      const one = h('button', 'tr-btn', `${T.sell} $${g.unit}`);
      one.onclick = () => this.act(this.hooks.sell(first, 1));
      row.append(icon(first.defId), name, one);
      if (g.n > 1) {
        const all = h('button', 'tr-btn alt', `${T.sellAll}`);
        all.onclick = () => {
          let err: string | null = null;
          for (const it of [...g.items]) err = this.hooks.sell(it, it.count) ?? err;
          this.act(err);
        };
        row.append(all);
      }
      right.append(row);
    }
    wrap.append(left, right);
    this.shop.append(wrap, h('div', 'tr-note', this.note), h('div', 'cr-foot', `${T.hint} · till ${TRADER.cashPerDay}/day`));
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
