import { WATERS } from '../../content/data/nature';
import { BUILDINGS, FIELDS, ROADS } from '../../content/data/outskirts';
import { POIS, type PoiDef } from '../../content/data/pois';
import { yard } from '../../content/data/yard';
import { mapText as T } from '../../content/text/map';
import { poiText, tierLabel } from '../../content/text/pois';
import '../inventory/inventory.css';
import './map.css';

/**
 * Map screen (K): the Yard and the outskirts drawn from the world data (roads, buildings, fields, water), the places you
 * have found with their risk tier, the tracked quest target and your position and facing. Plain DOM + one SVG; labels are
 * HTML on top so they stay crisp at any size. The world side (systems/installMap.ts) owns discovery and the key.
 */
export interface MapHooks {
  sfx(id: string): void;
  onOpenChange(open: boolean): void;
  /** Player position and facing (world metres, north = -Z). */
  pos(): { x: number; z: number; fx: number; fz: number } | null;
  /** Tracked quest: its title and the place its objective points at. */
  quest(): { title: string; poi: string | null; x: number; z: number } | null;
  discovered(): ReadonlySet<string>;
}

/** Map extent in world metres: the walled Yard (±100) and the outskirts plateau south of it. */
export const MAP_BOUNDS = { x0: -172, x1: 172, z0: -112, z1: 306 } as const;
const W = MAP_BOUNDS.x1 - MAP_BOUNDS.x0;
const H = MAP_BOUNDS.z1 - MAP_BOUNDS.z0;
/** World point to percent of the map box. */
export const toPct = (x: number, z: number) => ({ l: ((x - MAP_BOUNDS.x0) / W) * 100, t: ((z - MAP_BOUNDS.z0) / H) * 100 });

const SVG = 'http://www.w3.org/2000/svg';
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const s = (tag: string, attrs: Record<string, string | number>) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};
const nameOf = (id: string) => poiText[id]?.name ?? id;

/** Static terrain layer, built once (it is plain data and never changes in a run). */
function terrain() {
  const svg = s('svg', { viewBox: `${MAP_BOUNDS.x0} ${MAP_BOUNDS.z0} ${W} ${H}`, class: 'map-svg', 'aria-hidden': 'true' });
  svg.append(s('rect', { x: MAP_BOUNDS.x0, y: MAP_BOUNDS.z0, width: W, height: H, class: 'm-ground' }));
  // 50 m grid
  const grid = s('g', { class: 'm-grid' });
  for (let x = -150; x <= 150; x += 50) grid.append(s('line', { x1: x, y1: MAP_BOUNDS.z0, x2: x, y2: MAP_BOUNDS.z1 }));
  for (let z = -100; z <= 300; z += 50) grid.append(s('line', { x1: MAP_BOUNDS.x0, y1: z, x2: MAP_BOUNDS.x1, y2: z }));
  svg.append(grid);
  const half = yard.half;
  svg.append(s('rect', { x: -half, y: -half, width: half * 2, height: half * 2, class: 'm-yard' }));
  for (const f of FIELDS) svg.append(s('rect', { x: f.x - f.w / 2, y: f.z - f.d / 2, width: f.w, height: f.d, class: 'm-field' }));
  for (const w of WATERS) svg.append(s('circle', { cx: w.x, cy: w.z, r: w.r, class: 'm-water' }));
  const roads = s('g', { class: 'm-roads' });
  for (const r of ROADS) roads.append(s('line', { x1: r.ax, y1: r.az, x2: r.bx, y2: r.bz, 'stroke-width': Math.max(r.w, 4), class: r.kind === 'dirt' ? 'm-dirt' : 'm-asphalt' }));
  svg.append(roads);
  const bld = s('g', { class: 'm-bld' });
  for (const b of BUILDINGS) {
    const deg = (-b.yaw * 180) / Math.PI;
    bld.append(s('rect', { x: -b.w / 2, y: -b.d / 2, width: b.w, height: b.d, transform: `translate(${b.x} ${b.z}) rotate(${deg})` }));
  }
  svg.append(bld);
  return svg;
}

export class MapScreen {
  readonly root = h('div', 'inv-root map-root');
  private box = h('div', 'map-box');
  private marks = h('div', 'map-marks');
  private player = h('div', 'map-player');
  private questEl = h('div', 'map-quest');
  private side = h('section', 'inv-col map-side');
  private sel: string | null = null;
  private terrainBuilt = false;
  private lastKey = '';

  constructor(private hooks: MapHooks, parent: HTMLElement) {
    this.root.hidden = true;
    const col = h('section', 'inv-col map-col');
    const head = h('h2');
    head.append(h('span', 't', T.title), h('small', 'map-region', T.region));
    this.player.append(h('i'));
    this.questEl.append(h('i'));
    this.box.append(this.marks, this.questEl, this.player, h('span', 'map-north', T.north));
    col.append(head, this.box);
    const wrap = h('div', 'map-wrap');
    wrap.append(col, this.side);
    const hint = h('div', 'inv-hint');
    hint.innerHTML = T.hint;
    this.root.append(wrap, hint);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    parent.append(this.root);
  }

  get isOpen() {
    return !this.root.hidden;
  }
  open() {
    if (this.isOpen) return;
    if (!this.terrainBuilt) {
      this.box.prepend(terrain());
      this.terrainBuilt = true;
    }
    this.root.hidden = false;
    this.lastKey = '';
    this.hooks.onOpenChange(true);
    this.hooks.sfx('ui_open');
    this.refresh();
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

  private found(): PoiDef[] {
    const d = this.hooks.discovered();
    return POIS.filter((p) => d.has(p.id));
  }

  /** Arrow keys walk the found-places list. Returns true when the key was used. */
  key(code: string): boolean {
    if (!this.isOpen) return false;
    const list = this.found();
    if (!list.length || (code !== 'ArrowDown' && code !== 'ArrowUp')) return false;
    const i = list.findIndex((p) => p.id === this.sel);
    const n = code === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
    this.select(list[i < 0 ? 0 : n].id);
    return true;
  }

  private select(id: string | null) {
    this.sel = this.sel === id ? null : id;
    this.hooks.sfx('ui_click');
    this.refresh();
  }

  /** Rebuild markers and the side panel (on open and when discovery or the quest changes). */
  refresh() {
    if (!this.isOpen) return;
    const found = this.found();
    const q = this.hooks.quest();
    this.marks.replaceChildren();
    for (const p of found) {
      const { l, t } = toPct(p.x, p.z);
      const m = h('button', `map-poi t${p.tier}${p.id === this.sel ? ' sel' : ''}${q?.poi === p.id ? ' q' : ''}`);
      m.style.left = `${l}%`;
      m.style.top = `${t}%`;
      m.title = `${nameOf(p.id)} · ${tierLabel[p.tier]}`;
      m.setAttribute('aria-label', m.title);
      m.append(h('i'), h('span', '', nameOf(p.id)));
      m.onclick = () => this.select(p.id);
      this.marks.append(m);
    }
    const yl = toPct(0, -yard.half + 10);
    const ylab = h('span', 'map-area', T.yard);
    ylab.style.left = `${yl.l}%`;
    ylab.style.top = `${yl.t}%`;
    this.marks.append(ylab);

    this.questEl.hidden = !q;
    if (q) {
      const { l, t } = toPct(q.x, q.z);
      this.questEl.style.left = `${l}%`;
      this.questEl.style.top = `${t}%`;
      this.questEl.title = T.tracking(q.title);
    }
    this.renderSide(found, q);
    this.placeLabels();
    this.update();
  }

  /**
   * Greedy label placement: each label tries right, left, below, above its dot (then corner-anchored below/above, for places at the map edge) and takes the first spot that stays inside
   * the map and clear of every dot and of labels already placed. 16 places at most, once per refresh.
   */
  private placeLabels() {
    const box = this.box.getBoundingClientRect();
    const pois = [...this.marks.querySelectorAll<HTMLElement>('.map-poi')];
    const dots = pois.map((p) => p.querySelector('i')!.getBoundingClientRect());
    const taken: DOMRect[] = [];
    // The quest diamond blocks labels too, except its own place's label
    const qd = this.questEl.hidden ? null : this.questEl.querySelector('i')!.getBoundingClientRect();
    if (qd) taken.push(qd);
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    pois.forEach((p, i) => {
      const span = p.querySelector('span')!;
      let best = 'r';
      for (const side of ['r', 'l', 'b', 't', 'br', 'bl', 'tr', 'tl']) {
        span.className = side;
        const r = span.getBoundingClientRect();
        const inside = r.left >= box.left + 2 && r.right <= box.right - 2 && r.top >= box.top + 2 && r.bottom <= box.bottom - 2;
        if (inside && !dots.some((d, j) => j !== i && hit(r, d)) && !taken.some((t) => hit(r, t) && !(t === qd && p.classList.contains('q')))) {
          best = side;
          break;
        }
      }
      span.className = best;
      taken.push(span.getBoundingClientRect());
    });
  }

  private renderSide(found: PoiDef[], q: ReturnType<MapHooks['quest']>) {
    const sd = this.side;
    sd.replaceChildren();
    // Selected place (or the quest) on top: what the player came here to read.
    const at = this.hooks.pos();
    const dist = (x: number, z: number) => (at ? T.distance(Math.hypot(x - at.x, z - at.z)) : '');
    const sel = found.find((p) => p.id === this.sel);
    sd.append(h('h2', '', T.places));
    const qBox = h('div', 'map-track');
    if (q) {
      qBox.append(h('span', 'qi'), h('b', '', T.tracking(q.title)), h('small', '', `${q.poi ? nameOf(q.poi) + ' · ' : ''}${dist(q.x, q.z)}`));
    } else qBox.append(h('span', 'qi off'), h('small', '', T.noQuest));
    sd.append(qBox);
    if (sel) {
      const card = h('div', `map-card t${sel.tier}`);
      card.append(h('b', '', nameOf(sel.id)), h('span', 'risk', `${tierLabel[sel.tier]} · ${dist(sel.x, sel.z)}`), h('p', '', poiText[sel.id]?.hook ?? ''));
      sd.append(card);
    }
    sd.append(h('h3', '', T.found(found.length, POIS.length)));
    if (!found.length) sd.append(h('div', 'inv-empty', T.none));
    const list = h('div', 'map-list');
    for (const p of found) {
      const row = h('button', `map-row t${p.tier}${p.id === this.sel ? ' sel' : ''}`);
      row.append(h('i'), h('span', '', nameOf(p.id)), h('small', '', dist(p.x, p.z)));
      row.onclick = () => this.select(p.id);
      list.append(row);
    }
    sd.append(list);
    sd.append(h('h3', '', T.legend));
    const lg = h('div', 'map-legend');
    const item = (cls: string, label: string) => {
      const r = h('div');
      r.append(h('i', cls), h('span', '', label));
      lg.append(r);
    };
    item('lg-you', T.you);
    item('lg-quest', T.quest);
    for (const t of [1, 2, 3] as const) item(`lg-tier t${t}`, tierLabel[t]);
    item('lg-road', T.asphalt);
    item('lg-dirt', T.dirt);
    item('lg-water', T.water);
    sd.append(lg);
  }

  /** Per-frame while open: the player arrow (cheap: two style writes, only when it moved). */
  update() {
    if (!this.isOpen) return;
    const p = this.hooks.pos();
    this.player.hidden = !p;
    if (!p) return;
    const { l, t } = toPct(p.x, p.z);
    const deg = (Math.atan2(p.fx, -p.fz) * 180) / Math.PI; // 0 = north, clockwise
    const key = `${l.toFixed(2)}|${t.toFixed(2)}|${deg.toFixed(0)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.player.style.left = `${l}%`;
    this.player.style.top = `${t}%`;
    this.player.style.setProperty('--rot', `${deg}deg`);
  }
}
