import { Vector3 } from 'three';
import { survivalFeel as SF } from '../../content/data/player';
import { hudText as T } from '../../content/text/hud';
import { survivalText } from '../../content/text/ui';
import type { Ctx } from '../../gameplay/ctx';

/**
 * M2 survival HUD: food / water / rest bars under health and stamina (amber below 25, flashing at 0), status chips
 * with icons and labels, a bleeding screen-edge pulse, and the "Your bag" world marker (clamped to the screen edge
 * when off screen). DOM writes only on change.
 */
const CSS = `
.hud .needs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:9px}
.hud .need{display:flex;align-items:center;gap:5px}
.hud .need svg{width:14px;height:14px;flex:none;fill:#e8ecef;opacity:.85}
.hud .need .bar{flex:1;margin-top:0;height:5px}
.hud .need .bar b{background:#9fc4a0}
.hud .need.water .bar b{background:#8fb8d8}.hud .need.rest .bar b{background:#b8a8d8}
.hud .need.low .bar b{background:#e0a030}.hud .need.low svg{fill:#e0a030;opacity:1}
.hud .need.zero .bar b,.hud .need.zero svg{animation:hudflash .7s steps(2,start) infinite}
@keyframes hudflash{to{opacity:.15}}
.hud .chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.hud .chip{display:flex;align-items:center;gap:4px;padding:2px 7px 2px 4px;border-radius:10px;background:#000a;font:600 11px system-ui;letter-spacing:.3px}
.hud .chip svg{width:14px;height:14px}
.hud .chip.bad{box-shadow:inset 0 0 0 1px #ff503c88}.hud .chip.good{box-shadow:inset 0 0 0 1px #8fd08a88}
.hud .bleed{position:absolute;inset:0;background:radial-gradient(ellipse at center,#0000 50%,#a0000088 100%);opacity:0;pointer-events:none}
.hud .bag{position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:none;text-align:center;font:700 11px system-ui;color:#ffd27a;white-space:nowrap}
.hud .bag i{display:block;width:12px;height:12px;margin:0 auto 2px;border:2px solid #ffd27a;border-radius:2px;transform:rotate(45deg);background:#ffd27a33}
`;

const ICONS: Record<string, string> = {
  hunger: '<svg viewBox="0 0 16 16"><path d="M8 3c3.5 0 5.5 2.4 5.5 5.6S11.2 14 8 14 2.5 11.8 2.5 8.6 4.5 3 8 3z"/><path d="M8 3c.3-1.3 1.2-2 2.4-2.1-.2 1.2-1 2-2.4 2.1z"/></svg>',
  thirst: '<svg viewBox="0 0 16 16"><path d="M8 1.5c2.5 3.6 4.5 6.1 4.5 8.4A4.5 4.5 0 0 1 3.5 9.9C3.5 7.6 5.5 5.1 8 1.5z"/></svg>',
  fatigue: '<svg viewBox="0 0 16 16"><path d="M10.5 2.2A6 6 0 1 0 13.8 10 4.8 4.8 0 0 1 10.5 2.2z"/></svg>',
};
const STATUS: Record<string, { icon: string; color: string; good?: boolean }> = {
  bleeding: { icon: '<path d="M8 2c2.2 3.2 4 5.4 4 7.4a4 4 0 0 1-8 0C4 7.4 5.8 5.2 8 2z"/>', color: '#e0402e' },
  heavy_bleeding: { icon: '<path d="M5.5 2c1.6 2.3 3 4 3 5.5a3 3 0 0 1-6 0C2.5 6 3.9 4.3 5.5 2zM11 6c1.5 2.1 2.7 3.6 2.7 5a2.7 2.7 0 0 1-5.4 0c0-1.4 1.2-2.9 2.7-5z"/>', color: '#ff2a1a' },
  fracture: { icon: '<path d="M3 13l3.5-3.5-1-1L9 5l1 1 3-3 1 1-3 3 1 1-3.5 3.5-1-1L4 14z"/>', color: '#e8d9a0' },
  infection: { icon: '<circle cx="8" cy="8" r="2.2"/><circle cx="8" cy="3" r="1.6"/><circle cx="12.4" cy="10.5" r="1.6"/><circle cx="3.6" cy="10.5" r="1.6"/>', color: '#9ad04a' },
  well_fed: { icon: '<path d="M7 3h2v4h4v2H9v4H7V9H3V7h4z"/>', color: '#8fd08a', good: true },
  starving: { icon: '<path d="M2 7h12a6 6 0 0 1-12 0z"/>', color: '#e0a030' },
  dehydrated: { icon: '<path d="M8 2c2.2 3.2 4 5.4 4 7.4a4 4 0 0 1-8 0C4 7.4 5.8 5.2 8 2zm0 3.2C6.6 7.3 5.5 8.6 5.5 9.4a2.5 2.5 0 0 0 5 0C10.5 8.6 9.4 7.3 8 5.2z"/>', color: '#e0a030' },
  exhausted: { icon: '<path d="M3 3h6v1.5L5.3 8H9v1.5H3V8l3.7-3.5H3zM9.5 9h4v1l-2.3 2.5h2.3V14h-4v-1l2.3-2.5H9.5z"/>', color: '#b8a8d8' },
};

const el = (cls: string, parent: HTMLElement, tag = 'div') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent.appendChild(e);
  return e;
};
const _v = new Vector3();

export class SurvivalHud {
  private needs: { key: 'hunger' | 'thirst' | 'fatigue'; box: HTMLElement; fill: HTMLElement; cls: string; w: string }[] = [];
  private chips: HTMLElement;
  private chipKey = '';
  private bleed: HTMLElement;
  private bag: HTMLElement;
  private bagLbl: HTMLElement;
  private time = 0;

  constructor(private ctx: Ctx, bars: HTMLElement, root: HTMLElement) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const row = el('needs', bars);
    for (const [key, cls] of [['hunger', 'food'], ['thirst', 'water'], ['fatigue', 'rest']] as const) {
      const box = el(`need ${cls}`, row);
      box.title = T[key];
      box.innerHTML = ICONS[key];
      const fill = el('', el('bar', box), 'b');
      this.needs.push({ key, box, fill, cls: '', w: '' });
    }
    this.chips = el('chips', bars);
    this.bleed = el('bleed', root);
    root.insertBefore(this.bleed, root.firstChild);
    this.bag = el('bag', root);
    el('', this.bag, 'i');
    this.bagLbl = el('', this.bag, 'span');
  }

  render(dt: number) {
    this.time += dt;
    const s = this.ctx.survival.survival;
    const row = this.needs[0].box.parentElement!;
    row.style.display = s ? '' : 'none';
    if (!s) return;
    for (const n of this.needs) {
      const v = s[n.key];
      const w = `scaleX(${(v / 100).toFixed(3)})`;
      if (w !== n.w) (n.fill.style.transform = w), (n.w = w);
      const cls = v <= 0.01 ? 'zero low' : v < SF.needLow ? 'low' : '';
      if (cls !== n.cls) {
        n.cls = cls;
        n.box.className = `need ${n.box.classList[1]} ${cls}`;
      }
    }
    // Status chips (rebuilt only when the set / stages change)
    let key = '';
    for (const [id, st] of s.statuses) key += `${id}${st.stage ?? ''},`;
    if (key !== this.chipKey) {
      this.chipKey = key;
      this.chips.textContent = '';
      for (const [id, st] of s.statuses) {
        const def = STATUS[id];
        if (!def) continue;
        const chip = el(`chip ${def.good ? 'good' : 'bad'}`, this.chips);
        chip.innerHTML = `<svg viewBox="0 0 16 16" fill="${def.color}">${def.icon}</svg>`;
        const label = (survivalText.status[id] ?? id) + (id === 'infection' && st.stage ? ` · ${T.stage(st.stage)}` : '');
        el('', chip, 'span').textContent = label;
        chip.title = label;
      }
    }
    // Bleeding: screen-edge pulse at a heartbeat (stronger when heavy)
    const heavy = s.statuses.has('heavy_bleeding');
    const bleeding = heavy || s.statuses.has('bleeding');
    const p = this.ctx.player;
    const beat = Math.pow(Math.max(0, Math.sin(this.time * Math.PI * (heavy ? 2.6 : 2))), 6);
    this.bleed.style.opacity = bleeding && !p.dead ? ((heavy ? 0.35 : 0.2) + beat * (heavy ? 0.55 : 0.4)).toFixed(2) : '0';
    // Death bag marker
    const bags = this.ctx.survival.bags();
    const cam = this.ctx.game.camera;
    let best: { x: number; y: number; z: number } | null = null;
    let bd = SF.bagMarkerMax;
    for (const b of bags) {
      const d = Math.hypot(b.x - p.position.x, b.z - p.position.z);
      if (d < bd) (bd = d), (best = b);
    }
    if (!best || p.dead || bd < 1.5) {
      this.bag.style.display = 'none';
      return;
    }
    _v.set(best.x, best.y + 1.2, best.z).project(cam);
    const behind = _v.z > 1;
    let x = _v.x;
    let y = _v.y;
    if (behind) (x = -x), (y = -1);
    const off = behind || Math.abs(x) > 0.95 || Math.abs(y) > 0.9;
    x = Math.max(-0.95, Math.min(0.95, x));
    y = Math.max(-0.85, Math.min(0.9, y));
    this.bag.style.display = 'block';
    this.bag.style.left = `${((x + 1) / 2) * innerWidth}px`;
    this.bag.style.top = `${((1 - y) / 2) * innerHeight}px`;
    this.bag.style.opacity = off ? '0.75' : '1';
    this.bagLbl.textContent = `${T.yourBag} ${bd.toFixed(0)} m`;
  }
}
