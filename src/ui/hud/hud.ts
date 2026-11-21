import { MathUtils } from 'three';
import { yard } from '../../content/data/yard';
import { weaponSlots } from '../../content/data/weapons';
import { health as HD, stamina as SD } from '../../content/data/player';
import { probe, type Ctx } from '../../gameplay/ctx';
import { vehicleText } from '../../content/text/vehicles';
import { hudText } from '../../content/text/hud';
import { SurvivalHud } from './survivalHud';
import { ITEMS } from '../../content/data/items';
import iconIndex from '../../../public/assets/icons/index.json';
import { assetUrl } from '../../engine/assetUrl';
import { difficulty } from '../../content/data/difficulty';
import { itemText } from '../../content/text/items';

const ICON_IDS = new Set(iconIndex.ids);

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
.hud .wedge i{position:absolute;left:-110px;top:-215px;width:220px;height:64px;background:radial-gradient(ellipse at 50% 100%,#ff3018f0,#ff301800 72%);border-radius:50% 50% 0 0;filter:drop-shadow(0 0 10px #ff2010aa)}
.hud .vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,#0000 55%,#7a0000 130%);opacity:0}
.hud .toasts{position:absolute;left:50%;top:70px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
.hud .toasts div{background:#000a;padding:5px 12px;border-radius:5px;transition:opacity .4s}
.hud .rl{position:absolute;left:50%;top:calc(50% + 22px);transform:translateX(-50%);width:70px;height:3px;background:#0008;opacity:0}
.hud .rl b{display:block;height:100%;background:#fff;transform-origin:left}
.hud .range{position:absolute;right:24px;top:24px;background:#000c;color:#f4f6f2;padding:8px 12px;border-radius:6px;font:600 13px/1.5 ui-monospace,Consolas,monospace;display:none;white-space:pre}
.hud{--display:"Bahnschrift","DIN Alternate","Barlow Condensed","Roboto Condensed","Arial Narrow",system-ui,sans-serif;--accent:#d9a441;font-family:var(--display)}
.hud .bars{left:22px;bottom:22px;width:250px;padding:12px 14px 10px;background:linear-gradient(90deg,#0a0d0cd9,#0a0d0c80);border-left:2px solid var(--accent);border-radius:2px;box-shadow:0 8px 28px #0006}
.hud .lbl{font:600 11px/1 var(--display);letter-spacing:.22em;text-transform:uppercase;color:#cdd3c8;opacity:.85}
.hud .bar{height:8px;border-radius:1px;background:#050706;box-shadow:inset 0 0 0 1px #ffffff1f;margin-top:5px}
.hud .bar b{border-radius:0;background-image:linear-gradient(180deg,#ffffff40,#ffffff00 55%,#00000040)}
.hud .hp b{background-color:#c9382f;box-shadow:0 0 10px #c9382f66}
.hud .st b{background-color:#d9c98a}
.hud .ammo{right:26px;bottom:22px;padding:10px 16px;background:linear-gradient(270deg,#0a0d0cd9,#0a0d0c80);border-right:2px solid var(--accent);border-radius:2px}
.hud .ammo .n{font:700 40px/1 var(--display);letter-spacing:.04em}
.hud .ammo .w{font:600 12px var(--display);letter-spacing:.24em;color:var(--accent);opacity:1}
.hud .prompt{background:#0a0d0ccc;border:1px solid #ffffff22;border-radius:2px;font:600 14px var(--display);letter-spacing:.08em}
.hud .prompt kbd{border-color:var(--accent);color:var(--accent);font-family:var(--display)}
.hud .toasts div{background:#0a0d0ccc;border-left:2px solid var(--accent);border-radius:2px;font-family:var(--display);letter-spacing:.06em;animation:hud-toast .28s cubic-bezier(.2,.8,.2,1) both}
/* pickup icon and rarity */
.hud .toasts div img{width:26px;height:26px;object-fit:contain;vertical-align:middle;margin:-4px 8px -4px -4px;filter:drop-shadow(0 1px 2px #000a)}
.hud .toasts div.gain[data-rarity=uncommon]{border-left-color:#62b36a}.hud .toasts div.gain[data-rarity=rare]{border-left-color:#4f8fe0}.hud .toasts div.gain[data-rarity=epic]{border-left-color:#a064d8}.hud .toasts div.gain[data-rarity=legendary]{border-left-color:#e0b040}
/* loot feedback: green edge and a short pop for pickups, red for refusals */
.hud .toasts div.gain{border-left-color:#8fd18a;color:#e9f6e6}
.hud .toasts div.gain::first-letter{color:#8fd18a;font-weight:700}
.hud .toasts div.deny{border-left-color:#e0574a;color:#f6d8d4}
@keyframes hud-toast{from{opacity:0;transform:translateY(-8px) scale(.96)}to{opacity:1;transform:none}}
.hud .range{border-radius:2px;border-left:2px solid var(--accent)}
.hud .vig{background:radial-gradient(ellipse at center,#0000 50%,#8a0000 135%)}
.hud div.dead{font:700 clamp(54px,8vw,104px)/1 var(--display);letter-spacing:.32em;text-indent:.32em;color:#c93a2e;text-shadow:0 0 40px #000c,0 4px 0 #000a;
 background:radial-gradient(ellipse at center,#1a050599 0%,#000000bb 100%);backdrop-filter:grayscale(.9);animation:hud-died 1.6s ease-out both}
@keyframes hud-died{from{opacity:0;letter-spacing:.8em}to{opacity:1;letter-spacing:.32em}}
.hud-help{position:fixed;inset:0;font:600 13px/1.3 system-ui,sans-serif;color:#e8ecef;text-shadow:0 1px 2px #000a;display:none;place-items:center;background:#000a;pointer-events:none}
.hud-help>div{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:18px 34px;background:#111c;padding:22px 28px;border-radius:10px;max-width:min(860px,94vw)}
.hud-help h3{margin:0 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.8}
.hud-help p{margin:2px 0;font-weight:400}
.hud-help kbd{display:inline-block;min-width:96px;white-space:nowrap;font:700 12px system-ui;opacity:.95}
.hud .dead{position:absolute;inset:0;display:none;place-items:center;font:700 28px system-ui;background:#3008;letter-spacing:2px}
/* UI polish round 2: death screen sub-lines, hotbar strip (1-4 weapons, 5-9 quick items) */
.hud div.dead{align-content:center;justify-items:center;gap:22px}
.hud .dead small{display:block;font:600 15px/1.4 var(--display);letter-spacing:.16em;text-indent:0;color:#e8ecef;text-shadow:0 1px 3px #000;animation:hud-fade .6s .7s both}
.hud .dead small+small{font-size:13px;letter-spacing:.24em;text-transform:uppercase;color:var(--accent)}
@keyframes hud-fade{from{opacity:0}to{opacity:1}}
.hud .hb{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;align-items:flex-end;gap:4px;padding:5px;background:#0a0d0c99;border-radius:2px}
.hud .hb .s{position:relative;width:44px;height:44px;border:1px solid #ffffff26;border-radius:2px;background:#0a0d0ccc;display:grid;place-items:center;overflow:hidden}
.hud .hb .s.w{width:62px}
.hud .hb .s.none em{max-width:100%;margin-top:9px;font-size:9px;letter-spacing:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hud .hb .s img{margin-top:4px}
.hud .hb .s img{max-width:84%;max-height:84%;object-fit:contain;filter:drop-shadow(0 1px 2px #000a)}
.hud .hb .s em{font:600 10px/1 var(--display);font-style:normal;letter-spacing:.06em;color:#cdd3c8;text-transform:uppercase;padding:0 3px;text-align:center}
.hud .hb .s i{position:absolute;left:3px;top:2px;font:700 10px/1 var(--display);font-style:normal;color:#cdd3c8}
.hud .hb .s b{position:absolute;right:3px;bottom:2px;font:700 11px/1 var(--display);color:#fff}
.hud .hb .s.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent),0 0 10px #d9a44155;background:#2a2110cc}
.hud .hb .s.on i{color:var(--accent)}
.hud .hb .s.none{border-style:dashed;opacity:.45}
.hud .hb .s.out img{filter:grayscale(1) brightness(.6)}.hud .hb .s.out b{color:#e07468}
.hud .hb .gap{width:1px;align-self:stretch;margin:2px 4px;background:#ffffff26}
.hud .ammo:has(.n:empty):has(.w:empty){display:none}
.hud .bars,.hud .toasts{transition:opacity .4s}
.hud.is-dead .bars,.hud.is-dead .toasts{opacity:0}
body.hud-dead .qt{display:none}
@media (max-width:1100px){.hud .hb .s{width:38px;height:38px}.hud .hb .s.w{width:50px}}
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
  private beatT = 0; // low-health heartbeat clock (s)
  private wedgeFrom: { x: number; z: number } | null = null;
  private vig: HTMLElement;
  private toasts: HTMLElement;
  private rl: HTMLElement;
  private rlB: HTMLElement;
  private range: HTMLElement;
  private help: HTMLElement;
  private dead: HTMLElement;
  private deadCost: HTMLElement;
  private deadT: HTMLElement;
  private hb: HTMLElement;
  private hbCells: HTMLElement[] = [];
  private screens = new Set<string>(); // open full screens (dialogue, crafting, map...): the hotbar steps aside
  private hbKey = '';
  private hbT = 0;
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
    el('', this.dead, 'span').textContent = hudText.died;
    this.deadCost = el('', this.dead, 'small');
    this.deadT = el('', this.dead, 'small');
    // Hotbar: weapon slots 1-4, then the quick items bound to 5-9
    this.hb = el('hb', this.root);
    for (let i = 0; i < 9; i++) {
      if (i === 4) el('gap', this.hb);
      const s = el(i < 4 ? 's w' : 's', this.hb);
      el('', s, 'i').textContent = String(i + 1);
      this.hbCells.push(s);
    }
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

    ctx.game.events.on('toast', ({ text, icon }) => this.toast(text, icon));
    ctx.game.events.on('playerDied', () => (this.helpOpen = false));
    // Hidden behind the title/pause menu (QA-017)
    ctx.game.events.on('uiScreen', ({ name, open }) => {
      if (name === 'menu') this.root.style.display = open ? 'none' : '';
      else if (open) this.screens.add(name);
      else this.screens.delete(name);
    });
    ctx.game.events.on('playerRespawned', () => this.screens.clear());
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

  toast(text: string, icon?: string) {
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
    if (icon && ICON_IDS.has(icon)) {
      const im = document.createElement('img');
      im.src = assetUrl(`assets/icons/${icon}.png`);
      im.alt = '';
      d.prepend(im);
      const r = ITEMS[icon]?.rarity;
      if (r && r !== 'common') d.dataset.rarity = r;
    }
    if (text.startsWith('+ ')) d.classList.add('gain');
    else if (text.startsWith('✕ ')) d.classList.add('deny');
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
    // Low-health heartbeat (below 35 %): lub-dub that speeds up as health falls, with the vignette pulsing in time
    const frac = p.hp / HD.max;
    let pulse = 0;
    if (!p.dead && frac < 0.35) {
      const rate = 1.0 + (0.35 - frac) * 3.2; // beats per second, 1.0 .. ~2.1
      const before = this.beatT;
      this.beatT += dt * rate;
      if (Math.floor(before) !== Math.floor(this.beatT)) this.ctx.sfx('heartbeat', undefined, { volume: 0.5 + (0.35 - frac), pitchJitter: 0.03 });
      if (Math.floor(before * 2 + 0.5) !== Math.floor(this.beatT * 2 + 0.5) && this.beatT % 1 > 0.2) this.ctx.sfx('heartbeat', undefined, { volume: 0.32 + (0.35 - frac) * 0.6, pitchJitter: 0.03 });
      const ph = this.beatT % 1;
      pulse = Math.max(0, 1 - ph * 3.2) * (0.35 - frac) * 1.6;
    }
    this.set('vig', this.vig, 'opacity', Math.min(1, Math.max(0, 1 - frac) * 0.9 + this.wedgeT * 0.25 + pulse).toFixed(2));

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
    if (this.cache.get('isdead') !== String(p.dead)) {
      this.cache.set('isdead', String(p.dead));
      this.root.classList.toggle('is-dead', p.dead); // vitals, toasts and the quest tracker step back behind the death card
      document.body.classList.toggle('hud-dead', p.dead);
    }
    if (p.dead) {
      this.set('dc', this.deadCost, 'text', hudText.deathCost[difficulty.deathPenalty] ?? '');
      this.set('dt', this.deadT, 'text', hudText.respawnIn(Math.max(1, Math.ceil(p.deadT))));
    }
    this.renderHotbar(dt, hide || this.screens.size > 0);
  }

  /** Hotbar strip: weapons 1-4 (held one lit), quick items 5-9 with their counts (greyed when none left). Rebuilt on change. */
  private renderHotbar(dt: number, hide: boolean) {
    this.set('hbd', this.hb, 'display', hide ? 'none' : 'flex');
    if (hide || (this.hbT -= dt) > 0) return;
    this.hbT = 0.2; // counts walk the grids: 5 Hz is plenty
    const lo = this.ctx.game.loadout;
    const quick = (lo as unknown as { hotbar?: (string | null)[] }).hotbar ?? [];
    const w = this.ctx.weapons;
    const ids: (string | null)[] = [];
    const cnt: number[] = [];
    for (let i = 0; i < 4; i++) ids.push(lo.equipped(weaponSlots[i])?.defId ?? null), cnt.push(-1);
    for (let i = 0; i < 5; i++) {
      const id = quick[i] ?? null;
      ids.push(id);
      cnt.push(id ? lo.count(id) : -1);
    }
    const active = w.item ? w.slot : -1;
    const key = `${ids.join(',')}|${cnt.join(',')}|${active}`;
    if (key === this.hbKey) return;
    this.hbKey = key;
    ids.forEach((id, i) => {
      const s = this.hbCells[i];
      s.className = `s${i < 4 ? ' w' : ''}${id ? '' : ' none'}${i === active ? ' on' : ''}${cnt[i] === 0 ? ' out' : ''}`;
      while (s.childNodes.length > 1) s.lastChild!.remove(); // keep the key number
      if (!id) {
        if (i < 4) el('', s, 'em').textContent = hudText.slotShort[i];
        return;
      }
      if (ICON_IDS.has(id)) {
        const im = document.createElement('img');
        im.src = assetUrl(`assets/icons/${id}.png`);
        im.alt = '';
        s.append(im);
      } else el('', s, 'em').textContent = itemText[id]?.short ?? itemText[id]?.name ?? id;
      if (cnt[i] >= 0) el('', s, 'b').textContent = String(cnt[i]);
    });
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
