import type { WebGPURenderer } from 'three/webgpu';

/**
 * Per-system CPU timers + frame stats overlay (F3 toggles). Budgets come from principles §13.
 * `window.__perf()` returns a snapshot for Playwright perf runs (incl. `hitchLog`: the systems of the frames around
 * each > 50 ms gap). Overlay is off by default; `?perf` in the URL starts with it on.
 * Render is split: `render` = whole renderFrame CPU, `r.scene` = scene + shadow passes, `r.post` = the rest
 * (post chain + submit); `gpuMs` (with `?gputime`) is GPU time from timestamp queries.
 *
 *   perf.begin('ai'); ...; perf.end('ai');
 */
const BUDGET_MS: Record<string, number> = { sim: 3, ai: 2, physics: 2.5, render: 5, stream: 1, ui: 1 };
const WINDOW = 600; // frames kept for percentiles (~10 s at 60 fps)
const HITCH_MS = 50;

export class Perf {
  private starts = new Map<string, number>();
  private acc = new Map<string, number>(); // ms accumulated this frame
  private prevAcc = new Map<string, number>(); // last frame's (for hitch attribution)
  /** Last 20 hitches: gap ms, when (s since load), the heaviest timers of the frame before and the frame itself. */
  hitchLog: { ms: number; at: number; prev: string; cur: string }[] = [];
  private avg = new Map<string, number>(); // smoothed ms per frame
  private frames = new Float32Array(WINDOW);
  private sorted = new Float32Array(WINDOW);
  private n = 0;
  private i = 0;
  hitches = 0;
  private el: HTMLPreElement;
  private lastPaint = 0;
  extra: Record<string, string | number> = {};

  constructor(private renderer: WebGPURenderer, private backend: string) {
    this.el = document.createElement('pre');
    this.el.id = 'perf';
    this.el.style.cssText =
      'position:fixed;top:8px;left:8px;margin:0;padding:8px 10px;font:12px/1.35 ui-monospace,Consolas,monospace;' +
      'color:#d8e0d0;background:rgba(10,12,11,.78);border-radius:6px;pointer-events:none;z-index:10;white-space:pre';
    this.el.hidden = !new URLSearchParams(location.search).has('perf');
    document.body.appendChild(this.el);
    addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        this.toggleOverlay();
      }
    });
    const w = window as unknown as { __perf: () => unknown; __perfReset: () => void };
    w.__perf = () => this.snapshot();
    w.__perfReset = () => this.reset();
  }

  /** Show/hide the overlay (F3). */
  toggleOverlay() {
    this.el.hidden = !this.el.hidden;
  }

  /** Forget history (call after loading/warm-up so one-time compile costs don't skew the stats). */
  reset() {
    this.n = this.i = this.hitches = 0;
    this.hitchLog = [];
    this.avg.clear();
  }

  begin(name: string) {
    this.starts.set(name, performance.now());
  }

  end(name: string) {
    const t = performance.now() - (this.starts.get(name) ?? performance.now());
    this.acc.set(name, (this.acc.get(name) ?? 0) + t);
  }

  /** Add an externally measured duration (ms) to this frame's timer `name`. */
  add(name: string, ms: number) {
    this.acc.set(name, (this.acc.get(name) ?? 0) + ms);
  }

  /** Call once per rendered frame with the real frame time in seconds. */
  frame(frameDt: number) {
    const ms = frameDt * 1000;
    this.frames[this.i] = ms;
    this.i = (this.i + 1) % WINDOW;
    if (this.n < WINDOW) this.n++;
    if (ms > HITCH_MS) {
      this.hitches++;
      const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ');
      this.hitchLog.push({ ms: Math.round(ms), at: +(performance.now() / 1000).toFixed(1), prev: top(this.prevAcc), cur: top(this.acc) });
      if (this.hitchLog.length > 20) this.hitchLog.shift();
    }
    for (const [k, v] of this.acc) this.avg.set(k, (this.avg.get(k) ?? v) * 0.9 + v * 0.1);
    const t = this.prevAcc;
    this.prevAcc = this.acc;
    this.acc = t;
    this.acc.clear();

    const now = performance.now();
    if (!this.el.hidden && now - this.lastPaint > 250) {
      this.lastPaint = now;
      this.paint();
    }
  }

  private pct(p: number) {
    const s = this.sorted.subarray(0, this.n);
    s.set(this.frames.subarray(0, this.n));
    s.sort();
    return s[Math.min(this.n - 1, Math.floor(p * this.n))] ?? 0;
  }

  snapshot() {
    const info = this.renderer.info.render;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      backend: this.backend,
      p50: this.pct(0.5),
      p95: this.pct(0.95),
      p99: this.pct(0.99),
      hitches: this.hitches,
      drawCalls: info.drawCalls,
      triangles: info.triangles,
      heapMB: mem ? mem.usedJSHeapSize / 1048576 : null,
      systems: Object.fromEntries(this.avg),
      hitchLog: this.hitchLog,
      ...this.extra,
    };
  }

  private paint() {
    const s = this.snapshot();
    const fps = s.p50 > 0 ? 1000 / s.p50 : 0;
    const lines = [
      `${s.backend.toUpperCase()}  ${fps.toFixed(0)} fps   p50 ${s.p50.toFixed(1)}  p95 ${s.p95.toFixed(1)}  p99 ${s.p99.toFixed(1)} ms`,
      `draws ${s.drawCalls}   tris ${(s.triangles / 1000).toFixed(1)}k   hitches>50ms ${s.hitches}` +
        (s.heapMB !== null ? `   heap ${s.heapMB.toFixed(0)} MB` : ''),
    ];
    for (const [k, v] of Object.entries(s.systems)) {
      const b = BUDGET_MS[k];
      lines.push(`${k.padEnd(8)} ${v.toFixed(2).padStart(6)} ms${b ? (v > b ? `  OVER ${b}` : `  / ${b}`) : ''}`);
    }
    for (const [k, v] of Object.entries(this.extra)) lines.push(`${k}: ${v}`);
    this.el.textContent = lines.join('\n');
  }
}
