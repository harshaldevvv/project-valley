import { MathUtils } from 'three';
import { yard } from '../../content/data/yard';
import { weaponSlots } from '../../content/data/weapons';
import { health as HD, stamina as SD } from '../../content/data/player';
import { probe, type Ctx } from '../../gameplay/ctx';
import { vehicleText } from '../../content/text/vehicles';
import { hudText } from '../../content/text/hud';
import { SurvivalHud } from './survivalHud';

/**
 * Gameplay HUD (DOM over the canvas): crosshair (spread + blocked), hit markers, ammo + fire mode, health/stamina,
 * interaction prompt with hold ring, damage-direction wedge + vignette, toasts, reload bar, range readout, H help.
 * Writes to the DOM only when a value changes.
 */
const CSS = `
.hud{position:absolute;inset:0;pointer-events:none;font:600 13px/1.2 system-ui,sans-serif;color:#e8ecef;text-shadow:0 1px 2px #000a}
.hud .xh{position:absolute;left:50%;top:50%;width:0;height:0}
.hud .xh i{position:absolute;background:#f2f4f0;box-shadow:0 0 2px #000c}
.hud .xh .t,.hud .xh .b{width:2px;height:8px;left:-1px}
.hud .xh .l,.hud .xh .r{width:8px;height:2px;top:-1px}
.hud .xh .d{width:2px;height:2px;left:-1px;top:-1px;border-radius:1px}
.hud .xh.blocked i{background:#ff5040}
.hud .xh .ring{position:absolute;left:-9px;top:-9px;width:14px;height:14px;border:2px solid #ff5040;border-radius:50%;display:none;background:none;box-shadow:none}
.hud .xh.blocked .ring{display:block;background:none}
.hud .hm{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0}
.hud .hm i{position:absolute;width:2px;height:9px;background:#fff;left:-1px;top:-4.5px;box-shadow:0 0 2px #000}
.hud .hm.head i{background:#ff4a2a;height:11px}
.hud .hm.kill i{height:14px;width:3px;background:#ff2a1a}
.hud .hm.skull i{display:none}
.hud .hm.skull::after{content:'☠';position:absolute;left:-14px;top:-17px;width:28px;text-align:center;font:700 26px/1 system-ui;color:#ff3a22;text-shadow:0 0 3px #000,0 0 8px #000a}
.hud .ammo{position:absolute;right:28px;bottom:24px;text-align:right}
.hud .ammo .n{font:700 34px/1 system-ui;letter-spacing:.5px}
.hud .ammo .n small{font-size:18px;opacity:.7}
.hud .ammo .n[data-mags]::after{content:attr(data-mags);font:600 15px system-ui;opacity:.8;margin-left:10px;letter-spacing:.5px}
.hud .ammo .n[data-mags='']::after{content:none}
.hud .ammo .w{font-size:12px;opacity:.8;margin-top:4px;text-transform:uppercase;letter-spacing:1px}
.hud .bars{position:absolute;left:24px;bottom:24px;width:220px}
.hud .bar{height:7px;background:#0007;border-radius:4px;margin-top:6px;overflow:hidden}
.hud .bar b{display:block;height:100%;width:100%;border-radius:4px;transform-origin:left;transition:transform .08s linear}
.hud .hp b{background:#d8443a}.hud .st b{background:#e8d9a0}.hud .st.ex b{background:#8a7c50}
.hud .lbl{font-size:11px;opacity:.75;letter-spacing:1px}
.hud .prompt{position:absolute;left:50%;top:calc(50% + 46px);transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:6px 12px;background:#0009;border-radius:6px;opacity:0;transition:opacity .1s}
.hud .prompt svg{width:24px;height:24px}
.hud .prompt kbd{font:700 12px system-ui;border:1px solid #fff8;border-radius:3px;padding:1px 6px}
.hud .wedge{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0}
.hud .wedge i{position:absolute;left:-60px;top:-190px;width:120px;height:40px;background:radial-gradient(ellipse at 50% 100%,#ff2010cc,#ff201000 70%);border-radius:50% 50% 0 0}
.hud .vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,#0000 55%,#7a0000 130%);opacity:0}
.hud .toasts{position:absolute;left:50%;top:70px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
.hud .toasts div{background:#000a;padding:5px 12px;border-radius:5px;transition:opacity .4s}
.hud .rl{position:absolute;left:50%;top:calc(50% + 22px);transform:translateX(-50%);width:70px;height:3px;background:#0008;opacity:0}
.hud .rl b{display:block;height:100%;background:#fff;transform-origin:left}
.hud .range{position:absolute;right:24px;top:24px;background:#000c;color:#f4f6f2;padding:8px 12px;border-radius:6px;font:600 13px/1.5 ui-monospace,Consolas,monospace;display:none;white-space:pre}
.hud-help{position:fixed;inset:0;font:600 13px/1.3 system-ui,sans-serif;color:#e8ecef;text-shadow:0 1px 2px #000a;display:none;place-items:center;background:#000a;pointer-events:none}
.hud-help>div{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:18px 34px;background:#111c;padding:22px 28px;border-radius:10px;max-width:min(860px,94vw)}
.hud-help h3{margin:0 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.8}
.hud-help p{margin:2px 0;font-weight:400}
.hud-help kbd{display:inline-block;min-width:96px;white-space:nowrap;font:700 12px system-ui;opacity:.95}
.hud .dead{position:absolute;inset:0;display:none;place-items:center;font:700 28px system-ui;background:#3008;letter-spacing:2px}
@media (max-width:600px){.hud-help>div{grid-template-columns:1fr 1fr}}
`;

type HelpGroup = { group: string; rows: [string, string][] };
const textMods = import.meta.glob('../../content/text/controls.ts', { eager: true }) as Record<string, { controlsHelp?: HelpGroup[] }>;
const FALLBACK_HELP: HelpGroup[] = [
  { group: 'Movement', rows: [['WASD', 'Move'], ['Shift', 'Sprint'], ['C', 'Crouch'], ['Space', 'Jump / vault'], ['T', 'Camera'], ['Q', 'Shoulder']] },
  { group: 'Combat', rows: [['LMB', 'Fire'], ['RMB', 'Aim'], ['R', 'Reload'], ['X', 'Fire mode'], ['V', 'Shove'], ['1–4', 'Weapons']] },
  { group: 'Other', rows: [['E', 'Interact'], ['F', 'Vehicle'], ['H', 'Help']] },
];

const el = (cls: string, parent: HTMLElement, tag = 'div') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent.appendChild(e);
  return e;
};

export class Hud {
  private root: HTMLElement;
  private xh: HTMLElement;
  private xt: HTMLElement[];
  private hm: HTMLElement;
  private hmT = 0;
  private ammoN: HTMLElement;
  private ammoW: HTMLElement;
  private hpB: HTMLElement;
  private stB: HTMLElement;
  private st: HTMLElement;
  private prompt: HTMLElement;
  private promptText: HTMLElement;
  private ring: SVGCircleElement;
  private wedge: HTMLElement;
  private wedgeT = 0;
  private wedgeFrom: { x: number; z: number } | null = null;
  private vig: HTMLElement;
  private toasts: HTMLElement;
  private rl: HTMLElement;
  private rlB: HTMLElement;
  private range: HTMLElement;
  private help: HTMLElement;
  private dead: HTMLElement;
  private cache = new Map<string, string>();
  private survival: SurvivalHud;
  private slotName = '';
  private slotT = 0;

  constructor(private ctx: Ctx) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = el('hud', ctx.game.ui);
    this.vig = el('vig', this.root);
    this.xh = el('xh', this.root);
    this.xt = ['t', 'b', 'l', 'r', 'd', 'ring'].map((c) => el(c, this.xh, 'i'));
    this.hm = el('hm', this.root);
    for (let i = 0; i < 4; i++) {
      const l = el('', this.hm, 'i');
      l.style.transform = `rotate(${45 + i * 90}deg) translateY(-11px)`;
    }
    const ammo = el('ammo', this.root);
    this.ammoN = el('n', ammo);
    this.ammoW = el('w', ammo);
    const bars = el('bars', this.root);
    el('lbl', bars).textContent = hudText.health;
    this.hpB = el('', el('bar hp', bars), 'b');
    el('lbl', bars).textContent = hudText.stamina;
    this.st = el('bar st', bars);
    this.stB = el('', this.st, 'b');
    this.survival = new SurvivalHud(ctx, bars, this.root);
    this.prompt = el('prompt', this.root);
    this.prompt.innerHTML =
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff3" stroke-width="3"/><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="56.5" stroke-dashoffset="56.5" transform="rotate(-90 12 12)"/></svg><kbd>E</kbd><span></span>';
    this.ring = this.prompt.querySelectorAll('circle')[1] as SVGCircleElement;
    this.promptText = this.prompt.querySelector('span')!;
    this.wedge = el('wedge', this.root);
    el('', this.wedge, 'i');
    this.toasts = el('toasts', this.root);
    this.rl = el('rl', this.root);
    this.rlB = el('', this.rl, 'b');
    this.range = el('range', this.root);
    // Help overlay lives above the perf overlay (z 10), outside the HUD layer
    this.help = el('hud-help', document.body);
    this.help.style.cssText = 'position:fixed;z-index:12';
    this.dead = el('dead', this.root);
    this.dead.textContent = 'YOU DIED';
    const help = Object.values(textMods)[0]?.controlsHelp ?? FALLBACK_HELP;
    const box = el('', this.help);
    for (const g of help) {
      const col = el('', box);
      el('', col, 'h3').textContent = g.group;
      for (const [k, a] of g.rows) {
        const p = el('', col, 'p');
        el('', p, 'kbd').textContent = k;
        p.append(' ' + a);
      }
    }

    ctx.game.events.on('toast', ({ text }) => this.toast(text));
    ctx.game.events.on('playerDied', () => (this.helpOpen = false));
    // Hidden behind the title/pause menu (QA-017)
    ctx.game.events.on('uiScreen', ({ name, open }) => {
      if (name === 'menu') this.root.style.display = open ? 'none' : '';
    });
    ctx.game.events.on('playerDamaged', ({ from }) => {
      this.wedgeT = 1;
      this.wedgeFrom = from ? { x: from.x, z: from.z } : null;
      this.ctx.rig.addTrauma(0.4);
    });
  }

  private set(key: string, e: HTMLElement | SVGElement, prop: 'text' | 'opacity' | 'transform' | 'display' | 'class' | 'dash', v: string) {
    if (this.cache.get(key) === v) return;
    this.cache.set(key, v);
    if (prop === 'text') e.textContent = v;
    else if (prop === 'class') (e as HTMLElement).className = v;
    else if (prop === 'dash') e.setAttribute('stroke-dashoffset', v);
    else (e as HTMLElement).style[prop] = v;
  }

  hitMarker(head: boolean, kill: boolean) {
    // Headshot kill gets a skull (user playtest: headshots must read)
    this.hm.className = 'hm' + (head ? ' head' : '') + (kill ? ' kill' : '') + (head && kill ? ' skull' : '');
    this.cache.delete('hmo');
    this.hmT = head && kill ? 0.35 : kill ? 0.22 : 0.13;
  }

  toast(text: string) {
    // Same text already showing: restart it instead of stacking duplicates
    for (const c of this.toasts.children) {
      const t = c as HTMLElement & { _t?: number[] };
      if (t.textContent === text && t.style.opacity !== '0') {
        t._t?.forEach(clearTimeout);
        t._t = [setTimeout(() => (t.style.opacity = '0'), 1800), setTimeout(() => t.remove(), 2300)] as unknown as number[];
        return;
      }
    }
    const d = el('', this.toasts) as HTMLElement & { _t?: number[] };
    d.textContent = text;
    while (this.toasts.children.length > 4) this.toasts.firstElementChild!.remove();
    d._t = [setTimeout(() => (d.style.opacity = '0'), 1800), setTimeout(() => d.remove(), 2300)] as unknown as number[];
  }

  /** Drop a toast that no longer applies (e.g. "Empty — press R" once the reload starts, QA-049). */
  clearToast(text: string) {
    for (const c of [...this.toasts.children]) if (c.textContent === text) c.remove();
  }

  /** Show the slot name briefly when switching. */
  slot(name: string) {
    this.slotName = name;
    this.slotT = 1.2;
  }

  private uiBlocked() {
    const b = probe(this.ctx.game, 'build', 'active');
    const inv = probe(this.ctx.game, 'inventory', 'isOpen');
    try {
      return !!b?.active || !!inv?.isOpen;
    } catch {
      return false;
    }
  }

  render(dt: number) {
    const ctx = this.ctx;
    const p = ctx.player;
    const w = ctx.weapons;
    const cam = ctx.game.camera;
    const blocked = this.uiBlocked();
    const hide = blocked || p.inVehicle || p.dead;

    // Crosshair: gap = projected spread cone
    const showXh = !hide && !!w.item && !(w.adsEased > 0.85 && ctx.rig.firstPerson);
    this.set('xhd', this.xh, 'display', showXh ? 'block' : 'none');
    if (showXh) {
      const halfH = innerHeight / 2;
      const gap = w.isMelee ? 3 : Math.max(3, (Math.tan(MathUtils.degToRad(w.spread)) / Math.tan(MathUtils.degToRad(cam.fov / 2))) * halfH);
      const g = gap.toFixed(0);
      this.set('xg', this.xt[0], 'transform', `translateY(${-gap - 8}px)`);
      this.set('xg1', this.xt[1], 'transform', `translateY(${gap}px)`);
      this.set('xg2', this.xt[2], 'transform', `translateX(${-gap - 8}px)`);
      this.set('xg3', this.xt[3], 'transform', `translateX(${gap}px)`);
      this.set('xc', this.xh, 'class', 'xh' + (w.blocked && !w.isMelee ? ' blocked' : ''));
      void g;
    }
    this.hmT -= dt;
    this.set('hmo', this.hm, 'opacity', this.hmT > 0 ? '1' : '0');

    // Ammo
    const a = w.ammo();
    if (!hide && w.item) {
      const name = w.item.defId.replace(/_a$/, '').toUpperCase();
      if (a) {
        // "26+1  3 mags" (QA-066); sandbox shows ∞ mags
        const res = a.reserve === Infinity ? '∞' : String(a.reserve);
        this.set('an', this.ammoN, 'text', `${a.mag}${a.chamber ? '+1' : ''}`);
        this.ammoN.dataset.mags = `${res} mag${a.reserve === 1 ? '' : 's'}`;
        this.set('aw', this.ammoW, 'text', `${name} · ${w.fireMode()}${w.item.durability !== undefined ? ` · ${(w.item.durability * 100).toFixed(0)}%` : ''}`);
      } else {
        this.set('an', this.ammoN, 'text', '');
        this.ammoN.dataset.mags = '';
        this.set('aw', this.ammoW, 'text', name);
      }
    } else {
      const car = ctx.vehicles.driving;
      this.ammoN.dataset.mags = '';
      this.set('an', this.ammoN, 'text', car ? `${Math.abs(car.speed * 3.6).toFixed(0)} km/h` : '');
      this.set('aw', this.ammoW, 'text', car ? (car.dead ? vehicleText.hudEngineDead : vehicleText.hudCar(Math.ceil((car.hp / car.def.hp) * 100)) + (car.tipped ? vehicleText.hudFlip : '')) : '');
    }
    if (this.slotT > 0) {
      this.slotT -= dt;
      this.set('aw', this.ammoW, 'text', `${this.slotName}`);
    }

    this.survival.render(dt);
    // Bars
    this.set('hp', this.hpB, 'transform', `scaleX(${(p.hp / HD.max).toFixed(3)})`);
    this.set('st', this.stB, 'transform', `scaleX(${(p.stamina.value / SD.max).toFixed(3)})`);
    this.set('stc', this.st, 'class', 'bar st' + (p.stamina.exhausted ? ' ex' : ''));
    this.set('vig', this.vig, 'opacity', (Math.max(0, 1 - p.hp / HD.max) * 0.9 + this.wedgeT * 0.25).toFixed(2));

    // Damage wedge points toward the attacker (relative to the view yaw)
    this.wedgeT = Math.max(0, this.wedgeT - dt);
    if (this.wedgeT > 0 && this.wedgeFrom) {
      const ang = Math.atan2(this.wedgeFrom.x - p.position.x, this.wedgeFrom.z - p.position.z);
      const rel = ang - (p.yaw + Math.PI);
      this.set('wt', this.wedge, 'transform', `rotate(${(-rel * 180) / Math.PI}deg)`);
    }
    this.set('wo', this.wedge, 'opacity', this.wedgeT.toFixed(2));

    // Interaction prompt
    const it = ctx.interact;
    const text = !blocked && !p.dead ? it.promptText : null;
    this.set('po', this.prompt, 'opacity', text ? '1' : '0');
    if (text) {
      this.set('pt', this.promptText, 'text', text);
      this.set('pr', this.ring, 'dash', (56.5 * (1 - it.progress)).toFixed(1));
    }

    // Reload bar
    const r = w.reload;
    this.set('rlo', this.rl, 'opacity', r ? '1' : '0');
    if (r) this.set('rlb', this.rlB, 'transform', `scaleX(${Math.min(1, r.t / r.total).toFixed(2)})`);

    // Range readout near the firing line
    const rs = yard.stations.range;
    // Only on the firing line (QA-026)
    const near = Math.abs(p.position.x - rs.x) < rs.w / 2 && p.position.z < rs.z + 5 && p.position.z > rs.z - 4;
    this.set('rd', this.range, 'display', near && !hide ? 'block' : 'none');
    if (near && w.lastShot) {
      const s = w.lastShot;
      this.set('rt', this.range, 'text', `RANGE READOUT\nlast shot  ${s.zone === 'miss' ? 'miss' : `${s.distance.toFixed(1)} m`}\nhit        ${s.zone === 'miss' ? '—' : `${s.target} / ${s.zone}`}\ndamage     ${s.damage.toFixed(1)}\nspread     ${w.spread.toFixed(2)}°\nshots      ${w.shotsFired}`);
    } else if (near) this.set('rt', this.range, 'text', `RANGE READOUT\nfire at a target\nspread     ${w.spread.toFixed(2)}°`);

    // Help overlay (H on foot)
    this.set('hd', this.help, 'display', this.helpOpen ? 'grid' : 'none');
    this.set('dd', this.dead, 'display', p.dead ? 'grid' : 'none');
  }

  helpOpen = false;

  step() {
    const c = this.ctx.controls;
    if (!this.ctx.player.inVehicle && c.pressed('help')) this.helpOpen = !this.helpOpen;
    if (this.uiBlocked()) return; // build mode owns the digits (QA-002)
    for (let i = 0; i < 4; i++) if (c.pressed(['primary', 'secondary', 'sidearm', 'melee'][i] as 'primary')) this.slot(`${i + 1} · ${weaponSlots[i]}`);
  }
}

declare module '../../gameplay/ctx' {
  interface Ctx {
    hud: Hud;
  }
}
