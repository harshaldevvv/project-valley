import { LOCKPICK } from '../../content/data/containers';
import { lockpickText as T } from '../../content/text/ui';
import type { Rng } from '../../engine/rng';
import { allowedTurn, newLock, stepLock, type LockState } from '../../systems/lockpick';
import './lockpick.css';

/**
 * Lockpick minigame screen (rules in systems/lockpick.ts). Mouse positions the pick across the top of the lock;
 * A/D or LMB turns the cylinder. DOM + inline SVG over the canvas; runs on rAF while open.
 */
export interface LockpickHooks {
  sfx(id: string): void;
  onOpenChange(open: boolean): void;
  picks(): number;
  /** A pick snapped: consume one. */
  onBreak(): void;
  onSuccess(): void;
}

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag: string, attrs: Record<string, string | number>) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

export class LockpickScreen {
  readonly root = document.createElement('div');
  private face = document.createElementNS(NS, 'svg');
  private cyl = svg('g', {});
  private pick = svg('g', {});
  private pins: SVGElement[] = [];
  private info = document.createElement('div');
  private state: LockState | null = null;
  private difficulty = 1;
  private turnKeys = new Set<string>();
  private mouseDown = false;
  private raf = 0;
  private last = 0;
  private clickT = 0;
  private wasTurning = false;
  /** After a pick snaps, turning waits for a release (a held key must not eat the next pick). */
  private needRelease = false;

  constructor(private rng: Rng, private hooks: LockpickHooks, parent: HTMLElement) {
    this.root.className = 'lp-root';
    this.root.hidden = true;
    this.build();
    parent.appendChild(this.root);
    addEventListener('keydown', (e) => this.key(e, true), true);
    addEventListener('keyup', (e) => this.key(e, false), true);
    this.root.addEventListener('pointermove', (e) => this.aim(e.clientX, e.clientY));
    this.root.addEventListener('pointerdown', (e) => e.button === 0 && (this.mouseDown = true));
    addEventListener('pointerup', () => (this.mouseDown = false));
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get isOpen() {
    return !this.root.hidden;
  }

  /** Debug/test view of the hidden state. */
  get debug() {
    return this.state;
  }

  open(difficulty: number) {
    if (this.hooks.picks() <= 0) return;
    this.difficulty = difficulty;
    this.state = newLock(difficulty, this.rng);
    this.turnKeys.clear();
    this.mouseDown = false;
    this.needRelease = false;
    this.root.hidden = false;
    this.hooks.onOpenChange(true);
    this.hooks.sfx('ui_open');
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
    this.draw();
  }

  close() {
    if (!this.isOpen) return;
    cancelAnimationFrame(this.raf);
    this.root.hidden = true;
    this.state = null;
    this.hooks.onOpenChange(false);
  }

  /** Hit while picking: close with a red flash. No pick is used. */
  interrupt() {
    if (!this.isOpen) return;
    this.close();
    this.hooks.sfx('build_invalid');
    const f = document.createElement('div');
    f.className = 'lp-hurt';
    this.root.parentElement?.appendChild(f);
    setTimeout(() => f.remove(), 450);
  }

  private build() {
    const panel = document.createElement('div');
    panel.className = 'lp-panel';
    const title = document.createElement('h2');
    title.className = 'lp-title';
    this.face.setAttribute('viewBox', '-200 -200 400 400');
    this.face.classList.add('lp-face');
    const defs = svg('defs', {});
    const g1 = svg('radialGradient', { id: 'lpMetal', cx: '40%', cy: '35%', r: '75%' });
    g1.append(svg('stop', { offset: '0%', 'stop-color': '#9aa2a6' }), svg('stop', { offset: '100%', 'stop-color': '#3c4246' }));
    const g2 = svg('radialGradient', { id: 'lpBrass', cx: '40%', cy: '35%', r: '80%' });
    g2.append(svg('stop', { offset: '0%', 'stop-color': '#d8b866' }), svg('stop', { offset: '100%', 'stop-color': '#7a5d24' }));
    defs.append(g1, g2);
    // Housing + cylinder (turns) with keyhole and pins.
    const housing = svg('g', {});
    housing.append(
      svg('circle', { r: 150, fill: 'url(#lpMetal)', stroke: '#1d2124', 'stroke-width': 6 }),
      svg('circle', { r: 104, fill: '#202528' }),
    );
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      housing.append(svg('circle', { cx: Math.cos(a) * 128, cy: Math.sin(a) * 128, r: 5, fill: '#2a2f33' }));
    }
    this.cyl.append(
      svg('circle', { r: 96, fill: 'url(#lpBrass)', stroke: '#5b4519', 'stroke-width': 3 }),
      svg('path', { d: 'M -11 -46 a 15 15 0 1 1 22 0 L 16 18 L -16 18 Z', fill: '#121416' }),
    );
    // Five driver pins above the keyhole (they jitter when the pick is forced).
    for (let i = 0; i < 5; i++) {
      const p = svg('rect', { x: -26 + i * 11, y: -88, width: 7, height: 24, rx: 2, fill: '#c8ccce', stroke: '#596065', 'stroke-width': 1 });
      this.pins.push(p);
      this.cyl.append(p);
    }
    // Tension wrench at the bottom of the keyhole (part of the cylinder).
    this.cyl.append(svg('path', { d: 'M -4 14 L -4 120 L 70 120 L 70 128 L -12 128 L -12 14 Z', fill: '#6d757a', stroke: '#2b3033', 'stroke-width': 2 }));
    // The pick: long thin shaft from the centre outwards with a handle.
    this.pick.append(
      svg('rect', { x: 0, y: -2.5, width: 175, height: 5, rx: 2.5, fill: '#d6dadc', stroke: '#384045', 'stroke-width': 1 }),
      svg('rect', { x: 150, y: -7, width: 46, height: 14, rx: 4, fill: '#3b4246' }),
      svg('path', { d: 'M 0 -2.5 L -10 -9 L -12 -5 L -2 2.5 Z', fill: '#d6dadc' }),
    );
    this.face.append(defs, housing, this.cyl, this.pick);
    this.info.className = 'lp-info';
    const hint = document.createElement('div');
    hint.className = 'lp-hint';
    hint.innerHTML = T.hint;
    panel.append(title, this.face, this.info, hint);
    this.root.append(panel);
  }

  private aim(x: number, y: number) {
    if (!this.state) return;
    const r = this.face.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const a = (Math.atan2(cy - y, x - cx) * 180) / Math.PI; // 0 right, 90 up
    this.state.pick = Math.min(180, Math.max(0, a < -90 ? 180 : a));
  }

  private key(e: KeyboardEvent, down: boolean) {
    if (!this.isOpen) return;
    if (e.code === 'KeyA' || e.code === 'KeyD') {
      if (down) this.turnKeys.add(e.code);
      else this.turnKeys.delete(e.code);
      e.preventDefault();
      e.stopPropagation();
    } else if (down && e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // don't also open the pause menu
      this.close();
    } else if (down && e.code === 'Tab') {
      e.preventDefault();
      e.stopPropagation(); // no inventory on top of the lock
    }
  }

  private frame(t: number) {
    if (!this.isOpen || !this.state) return;
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    const s = this.state;
    const held = this.turnKeys.size > 0 || this.mouseDown;
    if (!held) this.needRelease = false;
    const turning = held && !this.needRelease;
    if (turning && !this.wasTurning) this.hooks.sfx('reload_mag_out');
    this.wasTurning = turning;
    const r = stepLock(s, dt, turning);
    if (s.stress > 0 && turning && (this.clickT -= dt) <= 0) {
      this.hooks.sfx('dry_fire');
      this.clickT = 0.3;
    }
    if (r === 'broke') {
      this.needRelease = true;
      this.hooks.sfx('build_invalid');
      this.hooks.onBreak();
      this.flash(T.broke);
      if (this.hooks.picks() <= 0) {
        this.flash(T.none);
        setTimeout(() => this.close(), 700);
      }
    } else if (r === 'open') {
      this.hooks.sfx('crate_open');
      this.close();
      this.hooks.onSuccess();
      return;
    }
    this.draw();
    this.raf = requestAnimationFrame((tt) => this.frame(tt));
  }

  private flashText = '';
  private flashUntil = 0;
  private flash(text: string) {
    this.flashText = text;
    this.flashUntil = performance.now() + 1200;
  }

  private draw() {
    const s = this.state!;
    const stressK = s.stress / LOCKPICK.stressSeconds;
    const jitter = s.stress > 0 ? (Math.random() - 0.5) * 4 * stressK : 0;
    const turnDeg = s.turn * 90;
    this.cyl.setAttribute('transform', `rotate(${turnDeg + jitter})`);
    // SVG y is down: the pick angle (0 right .. 180 left across the top) maps to rotate(-angle).
    this.pick.setAttribute('transform', `rotate(${turnDeg + jitter}) rotate(${-s.pick})`);
    const shaft = this.pick.firstChild as SVGElement;
    shaft.setAttribute('fill', s.stress > 0 ? `rgb(${214 + 41 * stressK}, ${218 - 150 * stressK}, ${220 - 160 * stressK})` : '#d6dadc');
    const near = allowedTurn(s);
    this.pins.forEach((p, i) => p.setAttribute('transform', `translate(0, ${s.turn > 0 ? -near * 6 * Math.abs(Math.sin(i * 1.7 + s.turn * 9)) : 0})`));
    const picks = this.hooks.picks();
    const msg = performance.now() < this.flashUntil ? `<span class="lp-flash">${this.flashText}</span>` : `${T.picks}: <b>${picks}</b>`;
    this.info.innerHTML = msg;
    (this.root.querySelector('.lp-title') as HTMLElement).textContent = `${T.title} · ${T.difficulty[this.difficulty] ?? ''}`;
    this.root.classList.toggle('stressed', s.stress > 0);
  }
}
