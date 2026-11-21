// node tools/audit/gpuprofile.mjs [quality] [renderScale] [views]   frame-time p50/p95 per view, weak-GPU emulation.
//   quality: high|medium|low|none (none = whatever the game picks, no override; default none). renderScale overrides the preset's.
//   views: comma list from poiviews.json (default diner_spot,main_street,dept_store,outpost_gate,lake_shore).
// One HEADLESS 960x540 page (never visible, no pointer lock), CDP CPU throttling x4 (env THROTTLE=n to change). Frame times are the page's own
// requestAnimationFrame deltas over 6 s per view (after 2.5 s to settle). Needs the dev server on 5188.
// Records the PC load (resource-guard --status) beside the numbers: the PC often runs Unity builds.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { launch } from './browser.mjs';
const [quality = 'none', scaleArg, viewArg] = process.argv.slice(2);
const views = JSON.parse(readFileSync(new URL('./poiviews.json', import.meta.url), 'utf8'));
const names = (viewArg ?? 'diner_spot,main_street,dept_store,outpost_gate,lake_shore').split(',');
const load = () => {
  try {
    const s = JSON.parse(execSync('node C:/Users/harsh/.claude/resource-guard.mjs --status', { encoding: 'utf8' }));
    return `RAM ${s.ram.toFixed(1)} GB free, CPU ${s.cpu.toFixed(0)}%, unity ${s.unity}, gen ${s.generators}`;
  } catch { return 'load ?'; }
};
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.routeWebSocket(/.*/, () => {});
const cdp = await page.context().newCDPSession(page);
await page.goto('http://localhost:5188/?play&noautoquality&gputime');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(2500);
await page.evaluate(([q, sc]) => {
  window.__gp.ctx.player.godMode = true;
  const e = window.engine;
  if (q.startsWith('{')) { Object.assign(e.post.settings, JSON.parse(q)); e.post.apply(); } // raw post settings
  else if (q !== 'none' && e.quality) e.quality.set(q);
  if (sc) { e.post.settings.renderScale = +sc; e.post.apply(); }
}, [quality, scaleArg]);
const go = (v) => v.length === 6
  ? page.evaluate(([cx, cy, cz, tx, ty, tz]) => { const g = window.__gp.ctx, cam = g.game.camera; window.__gp.teleport(tx, tz, 0); g.rig.override = () => { cam.position.set(cx, cy, cz); cam.lookAt(tx, ty, tz); cam.updateMatrixWorld(true); return true; }; }, v)
  : page.evaluate(([x, z, yaw, pitch]) => { window.__gp.ctx.rig.override = null; window.__gp.teleport(x, z, yaw); window.__gp.setLook(yaw, pitch); }, v);
// warm-up pass at full CPU speed: a settings change recompiles materials, and each view compiles what it shows first
for (const name of names) if (views[name]) { await go(views[name]); await page.waitForTimeout(3000); }
const RATE = +(process.env.THROTTLE ?? 4); // THROTTLE=1 measures unthrottled
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
const rows = [];
for (const name of names) {
  const v = views[name];
  if (!v) { rows.push(`${name}: no such view`); continue; }
  await go(v);
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => new Promise((res) => {
    const d = []; let last = performance.now(); const end = last + 6000;
    const f = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else {
      d.sort((a, b) => a - b); const p = (q) => d[Math.min(d.length - 1, Math.floor(q * d.length))];
      res({ p50: p(0.5), p95: p(0.95), n: d.length, draws: window.__gp.ctx.game.perf.snapshot().drawCalls, gpu: window.__gp.ctx.game.perf.extra.gpuMs ?? '-', post: window.__gp.ctx.game.perf.extra.post, top: Object.entries(window.__gp.ctx.game.perf.snapshot().systems).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ') });
    } };
    requestAnimationFrame(f);
  }));
  rows.push(`| ${name} | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.gpu} | ${r.draws} | ${r.post} | ${load()} |`);
  console.log(rows.at(-1), '   cpu ms:', r.top);
}
console.log(`\nquality=${quality} scale=${scaleArg ?? '(preset)'} cpu x4 960x540\n| view | p50 ms | p95 ms | draws | post | load |\n|---|---|---|---|---|---|\n${rows.join('\n')}`);
if (errs.length) console.log('page errors:', errs.slice(0, 5));
await browser.close();
