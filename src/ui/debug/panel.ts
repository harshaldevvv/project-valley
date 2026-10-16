import type { DebugApi } from '../../core/contracts';
import type { EventBus } from '../../core/events';

/**
 * F1 debug panel: implements DebugApi as plain DOM (no lil-gui dependency).
 *   game.debug.action('Zombies', 'Spawn 5', () => ...)
 *   game.debug.tune('Player', walk, 'speed', 0, 10, 0.1)      // slider bound live to walk.speed
 *   game.debug.toggle('Player', game.player, 'godMode')
 *   game.debug.watch('Player', 'pos', () => '...')             // refreshed 4x/s while open
 * Groups are created on first use and are collapsible. Opening emits uiScreen {name:'debug'} so the
 * mouse is released; while closed the panel has no focusable elements and steals no keys.
 */
const CSS = `
#dbg{position:fixed;top:8px;right:8px;width:320px;max-height:calc(100vh - 16px);overflow:auto;z-index:30;
 font:12px/1.4 ui-monospace,Consolas,monospace;color:#d8e0d0;background:rgba(12,14,13,.86);border:1px solid #2c3430;
 border-radius:8px;padding:6px 8px 8px;pointer-events:auto;backdrop-filter:blur(4px);scrollbar-width:thin}
#dbg[hidden]{display:none}
#dbg h1{font-size:12px;margin:0 0 6px;color:#9fb0a4;font-weight:600;letter-spacing:.08em}
#dbg details{border-top:1px solid #2a312d;padding:3px 0}
#dbg summary{cursor:pointer;color:#e9c46a;font-weight:600;padding:2px 0;user-select:none}
#dbg .row{display:flex;align-items:center;gap:6px;margin:3px 0}
#dbg .row label{flex:0 0 112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#b6c2b9}
#dbg input[type=range]{flex:1;min-width:0;accent-color:#e9c46a}
#dbg .val{flex:0 0 52px;text-align:right;color:#fff}
#dbg .btns{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0}
#dbg button{font:inherit;color:#e8ecef;background:#2a312d;border:1px solid #3d4741;border-radius:4px;padding:3px 7px;cursor:pointer}
#dbg button:hover{background:#3a443e;border-color:#e9c46a}
#dbg .watch{color:#9fd3a8;white-space:pre}
`;

export function createDebugPanel(events: EventBus, relock?: () => void): DebugApi & { readonly open: boolean; setOpen(o: boolean): void } {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'dbg';
  root.hidden = true;
  root.innerHTML = '<h1>DEBUG  (F1)</h1>';
  document.body.appendChild(root);

  const groups = new Map<string, HTMLElement>();
  const group = (name: string) => {
    let g = groups.get(name);
    if (!g) {
      const d = document.createElement('details');
      d.open = groups.size < 2;
      d.innerHTML = `<summary>${name}</summary>`;
      root.appendChild(d);
      groups.set(name, (g = d));
    }
    return g;
  };
  const row = (g: string, label: string) => {
    const r = document.createElement('div');
    r.className = 'row';
    const l = document.createElement('label');
    l.textContent = l.title = label;
    r.appendChild(l);
    group(g).appendChild(r);
    return r;
  };
  const watches: { el: HTMLElement; label: string; get: () => string }[] = [];
  const refreshers: (() => void)[] = [];

  let open = false;
  const setOpen = (o: boolean) => {
    if (o === open) return;
    open = o;
    root.hidden = !o;
    if (!o && root.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    events.emit('uiScreen', { name: 'debug', open: o });
    if (o) for (const f of refreshers) f();
  };
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && open) {
      e.stopImmediatePropagation(); // Esc closes the panel and does nothing else (QA-015)
      setOpen(false);
      return;
    }
    if (e.code !== 'F1') return;
    e.preventDefault();
    setOpen(!open);
    // F1 is a user activation (Esc is not), so closing with F1 can take the mouse back right away (QA-054).
    if (!open) relock?.();
  });
  setInterval(() => {
    if (!open) return;
    // re-sync controls with values changed elsewhere (presets, gameplay), except the one being dragged
    for (const f of refreshers) f();
    for (const w of watches) {
      let t: string;
      try {
        t = w.get();
      } catch (err) {
        t = String(err);
      }
      w.el.textContent = `${w.label}: ${t}`;
    }
  }, 250);

  return {
    get open() {
      return open;
    },
    setOpen,
    action(g, label, fn) {
      const d = group(g);
      let btns = d.lastElementChild as HTMLElement;
      if (!btns || btns.className !== 'btns') {
        btns = document.createElement('div');
        btns.className = 'btns';
        d.appendChild(btns);
      }
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = () => {
        try {
          fn();
        } catch (err) {
          console.warn(`debug action ${g}/${label} failed`, err);
        }
      };
      btns.appendChild(b);
    },
    tune(g, obj, key, min, max, step) {
      const r = row(g, key);
      const s = document.createElement('input');
      s.type = 'range';
      s.min = String(min);
      s.max = String(max);
      s.step = String(step ?? (max - min) / 100);
      const v = document.createElement('span');
      v.className = 'val';
      const show = (fromInput = false) => {
        if (!fromInput && s.matches(':active')) return; // being dragged
        const n = Number(obj[key]);
        if (!fromInput) s.value = String(n);
        v.textContent = Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(Math.abs(n) >= 10 ? 1 : 3);
      };
      s.oninput = () => {
        obj[key] = Number(s.value);
        show(true);
      };
      refreshers.push(() => show());
      show();
      r.append(s, v);
    },
    toggle(g, obj, key) {
      const r = row(g, key);
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.onchange = () => (obj[key] = c.checked);
      refreshers.push(() => (c.checked = Boolean(obj[key])));
      c.checked = Boolean(obj[key]);
      r.appendChild(c);
    },
    watch(g, label, get) {
      const el = document.createElement('div');
      el.className = 'watch';
      group(g).appendChild(el);
      watches.push({ el, label, get });
    },
  };
}
