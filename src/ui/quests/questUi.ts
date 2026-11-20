import iconIndex from '../../../public/assets/icons/index.json';
import { QUEST, QUESTS } from '../../content/data/quests';
import { itemText } from '../../content/text/items';
import { poiText } from '../../content/text/pois';
import { noteText, questFallback, questText, questUi as T } from '../../content/text/quests';
import { assetUrl } from '../../engine/assetUrl';
import type { Quests } from '../../systems/quests';
import '../inventory/inventory.css';
import './quests.css';

/**
 * Quest HUD tracker (top right: title, objective lines, arrow and distance to the target) and the journal panel (J) in the
 * inventory style: active and completed quests, the notes you have read, and Track buttons. DOM writes only on change.
 */
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const ICONS = new Set(iconIndex.ids);
const iname = (id: string) => itemText[id]?.name ?? id;
export const textOf = (id: string) => questText[id] ?? { ...questFallback, title: id };

/** Bearing of a target relative to where the player faces, radians (0 = straight ahead, clockwise), and its compass name. */
export function bearing(from: { x: number; z: number }, forward: { x: number; z: number }, to: { x: number; z: number }) {
  const a = (x: number, z: number) => Math.atan2(x, -z); // 0 = north (-z), clockwise toward +x
  const target = a(to.x - from.x, to.z - from.z);
  let rel = target - a(forward.x, forward.z);
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  const idx = ((Math.round((target / (Math.PI * 2)) * 8) % 8) + 8) % 8;
  return { rel, compass: T.dir[idx] };
}

export interface QuestUiHooks {
  sfx(id: string): void;
  onOpenChange(open: boolean): void;
  pos(): { x: number; z: number; fx: number; fz: number } | null;
  /** Read a note again from the journal. */
  readNote(id: string): void;
}

export class QuestUi {
  readonly tracker = h('div', 'qt');
  readonly root = h('div', 'inv-root qj-root');
  private titleEl = h('div', 'qt-title');
  private lines = h('div', 'qt-lines');
  private dirEl = h('div', 'qt-dir');
  private arrow = h('i', 'qt-arrow');
  private dirTxt = h('span');
  private key = '';
  private sel: string | null = null;
  private tab: 'active' | 'done' | 'notes' = 'active';

  constructor(private q: Quests, private hooks: QuestUiHooks, parent: HTMLElement) {
    this.tracker.append(this.titleEl, this.lines, this.dirEl);
    this.dirEl.append(this.arrow, this.dirTxt);
    parent.append(this.tracker);
    this.root.hidden = true;
    parent.append(this.root);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get isOpen() {
    return !this.root.hidden;
  }
  open() {
    if (this.isOpen) return;
    this.root.hidden = false;
    this.hooks.onOpenChange(true);
    this.hooks.sfx('ui_open');
    this.renderJournal();
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
  refresh() {
    this.key = '';
    if (this.isOpen) this.renderJournal();
  }

  // ---------------- HUD tracker ----------------
  update() {
    const id = this.q.tracked;
    const live = id && this.q.state[id]?.status === 'active' ? id : null;
    const s = live ? this.q.state[live] : null;
    const counter = live ? this.q.counter(live) : null;
    const key = live ? `${live}|${s!.step}|${counter?.join('/') ?? ''}` : '';
    if (key !== this.key) {
      this.key = key;
      this.tracker.style.display = live ? '' : 'none';
      this.lines.textContent = '';
      if (live) {
        const tx = textOf(live);
        this.titleEl.textContent = `${T.tracker} · ${tx.title}`;
        const def = this.q.def(live);
        const from = Math.max(0, Math.min(s!.step - 1, def.objectives.length - QUEST.hudMaxLines));
        for (let i = from; i < Math.min(def.objectives.length, from + QUEST.hudMaxLines); i++) {
          const row = h('div', `qt-line${i < s!.step ? ' ok' : i === s!.step ? ' now' : ''}`);
          const n = i === s!.step && counter ? ` ${T.progress(counter[0], counter[1])}` : '';
          row.textContent = `${i < s!.step ? '✓' : i === s!.step ? '▸' : '·'} ${tx.objectives[i] ?? ''}${n}`;
          this.lines.append(row);
        }
      }
    }
    if (!live) return;
    const t = this.q.target(live);
    const p = this.hooks.pos();
    this.dirEl.style.display = t && p ? '' : 'none';
    if (t && p) {
      const b = bearing(p, { x: p.fx, z: p.fz }, t);
      const d = Math.max(0, Math.hypot(t.x - p.x, t.z - p.z) - t.radius * 0.5);
      this.arrow.style.transform = `rotate(${b.rel.toFixed(3)}rad)`;
      const txt = `${poiText[t.poi]?.name ?? t.poi} · ${T.meters(d)} ${b.compass}`;
      if (this.dirTxt.textContent !== txt) this.dirTxt.textContent = txt;
    }
  }

  // ---------------- journal ----------------
  private icon(item: string) {
    const e = h(ICONS.has(item) ? 'img' : 'div', 'qj-ic') as HTMLImageElement;
    if (ICONS.has(item)) (e.src = assetUrl(`assets/icons/${item}.png`)), (e.alt = '');
    return e;
  }

  private renderJournal() {
    this.root.textContent = '';
    const wrap = h('div', 'qj-wrap');
    const list = h('div', 'inv-col qj-list');
    list.append(h('h2', '', T.journal));
    const tabs = h('div', 'cr-tabs');
    for (const [k, label] of [['active', T.active], ['done', T.done], ['notes', T.notes]] as const) {
      const b = h('button', k === this.tab ? 'on' : '', label);
      b.onclick = () => ((this.tab = k), (this.sel = null), this.renderJournal());
      tabs.append(b);
    }
    list.append(tabs);
    const rows = this.tab === 'active' ? this.q.active() : this.tab === 'done' ? this.q.done() : [];
    if (this.tab === 'notes') {
      if (!this.q.notes.length) list.append(h('div', 'qj-empty', T.none));
      for (const id of this.q.notes) {
        const row = h('div', `qj-row${this.sel === id ? ' sel' : ''}`);
        row.append(this.icon(id), h('b', '', noteText[id]?.title ?? id));
        row.onclick = () => ((this.sel = id), this.renderJournal());
        list.append(row);
      }
    } else {
      if (!rows.length) list.append(h('div', 'qj-empty', T.none));
      if (!this.sel || !rows.some((r) => r.id === this.sel)) this.sel = rows[0]?.id ?? null;
      for (const r of rows) {
        const row = h('div', `qj-row${this.sel === r.id ? ' sel' : ''}`);
        const text = h('div');
        text.append(h('b', '', textOf(r.id).title), h('small', '', this.tab === 'active' ? this.q.def(r.id).objectives.map((_, i) => i).filter((i) => i < this.q.state[r.id].step).length + '/' + r.objectives.length : T.done));
        row.append(text);
        if (r.side) row.append(h('span', 'qj-tag', T.side));
        if (this.q.tracked === r.id) row.append(h('span', 'qj-tag on', T.tracked));
        row.onclick = () => ((this.sel = r.id), this.renderJournal());
        list.append(row);
      }
    }
    wrap.append(list);
    const col = h('div', 'inv-col qj-detail');
    if (this.tab === 'notes' && this.sel && noteText[this.sel]) {
      col.append(h('h2', '', noteText[this.sel].title), h('p', 'qj-note', noteText[this.sel].body));
    } else if (this.sel && this.q.state[this.sel]) col.append(...this.detail(this.sel));
    wrap.append(col);
    this.root.append(wrap, h('div', 'cr-foot', T.hint));
  }

  private detail(id: string): HTMLElement[] {
    const tx = textOf(id);
    const s = this.q.state[id];
    const def = this.q.def(id);
    const out: HTMLElement[] = [h('h2', '', tx.title), h('p', 'qj-sum', tx.summary)];
    const ul = h('div', 'qj-obj');
    def.objectives.forEach((o, i) => {
      const done = s.status === 'done' || i < s.step;
      const cur = s.status === 'active' && i === s.step;
      const c = cur ? this.q.counter(id) : null;
      const row = h('div', `qj-o${done ? ' ok' : cur ? ' now' : ''}`);
      row.textContent = `${done ? '✓' : cur ? '▸' : '·'} ${tx.objectives[i] ?? ''}${c ? ` (${T.progress(c[0], c[1])})` : ''}`;
      void o;
      ul.append(row);
    });
    out.push(ul);
    if (s.status === 'done') out.push(h('p', 'qj-done', tx.done));
    out.push(h('h3', '', T.reward));
    const rw = h('div', 'qj-rewards');
    for (const r of def.rewards) {
      const chip = h('div', 'qj-rw');
      chip.append(this.icon(r.item), h('span', '', `${iname(r.item)}${r.count > 1 ? ` ×${r.count}` : ''}`));
      rw.append(chip);
    }
    out.push(rw);
    if (s.status === 'active') {
      const b = h('button', 'cr-go', this.q.tracked === id ? T.tracked : T.track) as HTMLButtonElement;
      b.disabled = this.q.tracked === id;
      b.onclick = () => (this.q.track(id), this.key = '', this.renderJournal());
      out.push(b);
    }
    return out;
  }
}

export const allQuestIds = QUESTS.map((q) => q.id);
