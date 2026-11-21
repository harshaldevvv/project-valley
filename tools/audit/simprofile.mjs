// node tools/audit/simprofile.mjs [views] [port]   CPU cost of the simulation per sim step and per frame, by system.
//   views: comma list from poiviews.json (default diner_spot,main_street). port: dev server (default 5188, env PORT too).
//   env HORDE=n (default 30): zombies spawned in a ring 10–45 m around the player per view, all hunting the player (the
//   horde-night state). env DETAIL=1 also times zombie/sim internals. env THROTTLE (default 4): CDP CPU throttle. env QUALITY (default low). env SECS (default 6).
// One HEADLESS 960x540 page (never visible, no pointer lock). Uses the game's perf timers: 'step' (whole fixed tick), each
// system's step timer, 'physics', 'r:<system>' render hooks, plus wrappers on the zombie/sim internals installed from here.
// Prints per-frame p50/p95 of the step total, steps per frame, and per-step mean of every timer. Records the PC load.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { launch } from './browser.mjs';
const [viewArg, portArg] = process.argv.slice(2);
const PORT = portArg ?? process.env.PORT ?? '5188';
const HORDE = +(process.env.HORDE ?? 30);
const RATE = +(process.env.THROTTLE ?? 4);
const SECS = +(process.env.SECS ?? 6);
const QUALITY = process.env.QUALITY ?? 'low';
const PROFILE = process.env.PROFILE === '1'; // CDP sampling profile of the measured window: top self-time functions
const DETAIL = process.env.DETAIL === '1'; // also time zombie/sim internals (adds a little overhead per call)
const views = JSON.parse(readFileSync(new URL('./poiviews.json', import.meta.url), 'utf8'));
const names = (viewArg ?? 'diner_spot,main_street').split(',');
const load = () => {
  try {
    const s = JSON.parse(execSync('node C:/Users/harsh/.claude/resource-guard.mjs --status', { encoding: 'utf8' }));
    return `RAM ${s.ram.toFixed(1)} GB free, CPU ${s.cpu.toFixed(0)}%, unity ${s.unity}, gen ${s.generators}`;
  } catch { return 'load ?'; }
};
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => { errs.push(String(e).slice(0, 160)); if (errs.length <= 3) console.log('PAGEERROR', String(e.stack ?? e).slice(0, 900)); });
page.on('console', (m) => { if (m.type() === 'error' && errs.length < 6) { errs.push(m.text().slice(0, 160)); console.log('CONSOLE', m.text().slice(0, 600)); } });
await page.routeWebSocket(/.*/, () => {});
const cdp = await page.context().newCDPSession(page);
await page.goto(`http://localhost:${PORT}/?play&noautoquality`);
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(2500);
await page.evaluate(([q, detail]) => {
  const g = window.__gp.ctx;
  g.player.godMode = true;
  if (window.engine?.quality) window.engine.quality.set(q);
  const perf = g.game.perf;
  // ---- recorder: per-frame values of every timer, step count per frame
  const R = (window.__sp = { on: false, frames: [], steps: 0, cur: 0 });
  const origEnd = perf.end.bind(perf);
  perf.end = (name) => { origEnd(name); if (name === 'step') R.cur++; };
  const origFrame = perf.frame.bind(perf);
  perf.frame = (dt) => {
    if (R.on) R.frames.push({ dt: dt * 1000, steps: R.cur, t: Object.fromEntries(perf.acc) });
    R.cur = 0;
    origFrame(dt);
  };
  // ---- wrappers on internals (timed into the same perf frame)
  const wrap = (obj, key, label) => {
    const f = obj?.[key];
    if (typeof f !== 'function') return;
    const cl = `${label}#`;
    obj[key] = function (...a) { const t0 = performance.now(); try { return f.apply(this, a); } finally { perf.add(label, performance.now() - t0); perf.add(cl, 1); } };
  };
  if (!detail) return;
  for (const k of ['survival', 'player', 'rig', 'melee', 'weapons', 'throwables', 'facing', 'interact', 'vehicles', 'targets', 'hud']) wrap(g[k], 'step', `sim.${k}`);
  const z = g.zombies;
  for (const k of ['updatePoiSpawns', 'think', 'los', 'avoid', 'spreadOut', 'doorWaypoint', 'tryClimb', 'clearAt']) wrap(z, k, `z.${k}`);
  wrap(z.horde, 'step', 'z.horde');
  wrap(z.kcc, 'computeColliderMovement', 'z.kcc');
  wrap(g.zombies, 'render', 'zr.render');
}, [QUALITY, DETAIL]);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const go = (v) => page.evaluate(([x, z, yaw, pitch]) => { window.__gp.ctx.rig.override = null; window.__gp.teleport(x, z, yaw); window.__gp.setLook(yaw, pitch); }, v);
// warm-up at full speed (each view compiles what it shows first)
for (const name of names) if (views[name]) { await go(views[name]); await page.waitForTimeout(3000); }
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
const out = [];
for (const name of names) {
  const v = views[name];
  if (!v) { out.push(`${name}: no such view`); continue; }
  await go(v);
  // streaming the new area can stall the throttled page for a while: wait until frames flow again
  await page.waitForFunction(() => new Promise((r) => { let k = 0; const f = () => (++k < 10 ? requestAnimationFrame(f) : r(true)); requestAnimationFrame(f); }), null, { timeout: 120000 });
  await page.evaluate(async (n) => {
    const g = window.__gp.ctx, zs = g.zombies;
    zs.clear();
    const p = g.player.curr;
    const tasks = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = 10 + ((i * 7) % 36);
      tasks.push(zs.spawn(new p.constructor(p.x + Math.cos(a) * r, 0.05, p.z + Math.sin(a) * r), a, zs.pickVariant(1, 1)).then((zb) => {
        zb.sense.awareness = 'searching'; zb.sense.searchLeft = 600; zb.sense.suspicion = 0.6; zb.lastKnown.copy(p);
      }).catch(() => undefined));
    }
    await Promise.all(tasks);
  }, HORDE);
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => new Promise((r) => { let k = 0; const f = () => (++k < 10 ? requestAnimationFrame(f) : r(true)); requestAnimationFrame(f); }), null, { timeout: 120000 });
  const L0 = load();
  if (PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  const r = await page.evaluate((secs) => new Promise((res) => {
    const R = window.__sp; R.frames = []; R.on = true;
    setTimeout(() => {
      R.on = false;
      const F = R.frames, n = F.length;
      const pct = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
      const steps = F.reduce((a, f) => a + f.steps, 0);
      const stepPF = F.map((f) => f.t.step ?? 0);
      const keys = new Set(); for (const f of F) for (const k in f.t) keys.add(k);
      const rows = [...keys].map((k) => { const v = F.map((f) => f.t[k] ?? 0); const tot = v.reduce((a, b) => a + b, 0); return [k, tot / n, pct(v, 0.95), tot / Math.max(1, steps)]; })
        .sort((a, b) => b[1] - a[1]);
      const zs = window.__gp.ctx.zombies.list;
      const pp = window.__gp.ctx.player.curr;
      const near = zs.filter((z) => z.alive && Math.hypot(z.curr.x - pp.x, z.curr.z - pp.z) < 20).length;
      const w = window.__gp.ctx.game.phys.world; let awake = 0, dyn = 0, kin = 0;
      w.bodies.forEach((b) => { if (b.isDynamic()) { dyn++; if (!b.isSleeping()) awake++; } else if (b.isKinematic()) kin++; });
      const cars = window.__gp.ctx.vehicles.list;
      const info = `bodies: ${dyn} dynamic (${awake} awake), ${kin} kinematic; cars ${cars.length} (${cars.filter((c) => !c.body.isSleeping()).length} awake); colliders ${w.colliders.len()}`;
      // the 5 longest frames: their own timers (what made them long, or how many catch-up steps followed)
      const longest = [...F].sort((a, b) => b.dt - a.dt).slice(0, 5).map((f) => `${f.dt.toFixed(0)} ms, ${f.steps} steps: ` + Object.entries(f.t).filter(([k]) => !k.includes('#') && !k.includes('.')).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', '));
      res({ longest, info, n, steps, frameP50: pct(F.map((f) => f.dt), 0.5), frameP95: pct(F.map((f) => f.dt), 0.95), simP50: pct(stepPF, 0.5), simP95: pct(stepPF, 0.95), perStep: (stepPF.reduce((a, b) => a + b, 0)) / Math.max(1, steps), alive: zs.filter((z) => z.alive).length, near, rows });
    }, secs * 1000);
  }), SECS);
  const L1 = load();
  if (PROFILE) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map(); let total = 0;
    const dt = profile.timeDeltas; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    for (let i = 0; i < profile.samples.length; i++) {
      const n = byId.get(profile.samples[i]); const d = dt[i] ?? 0; total += d;
      const cf = n.callFrame; const key = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop().split('?')[0]}:${cf.lineNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + d);
    }
    console.log(`
-- ${name} CPU profile, top self time (% of ${(total / 1000).toFixed(0)} ms sampled)`);
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, +(process.env.TOP ?? 45))) console.log(`${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`);
  }
  out.push({ name, r, L0, L1 });
  console.log(`\n== ${name}  frames ${r.n}, steps ${r.steps} (${(r.steps / r.n).toFixed(2)}/frame), zombies ${r.alive} (${r.near} < 20 m)`);
  console.log(`frame p50 ${r.frameP50.toFixed(1)} p95 ${r.frameP95.toFixed(1)} ms | sim/frame p50 ${r.simP50.toFixed(1)} p95 ${r.simP95.toFixed(1)} ms | sim/step mean ${r.perStep.toFixed(2)} ms | load before: ${L0} | after: ${L1}`);
  console.log(r.info);
  for (const l of r.longest) console.log('long frame:', l);
  console.log('timer                 ms/frame  p95/frame  ms/step');
  for (const [k, a, p95, s] of r.rows) if (a >= 0.05) console.log(`${k.padEnd(22)}${a.toFixed(2).padStart(8)}${p95.toFixed(2).padStart(10)}${s.toFixed(3).padStart(10)}`);
}
console.log(`\nquality=${QUALITY} cpu x${RATE} 960x540 horde=${HORDE}\n| view | sim/frame p50 | sim/frame p95 | sim/step | steps/frame | frame p95 | load |\n|---|---|---|---|---|---|---|`);
for (const o of out) if (typeof o !== 'string') console.log(`| ${o.name} | ${o.r.simP50.toFixed(1)} | ${o.r.simP95.toFixed(1)} | ${o.r.perStep.toFixed(2)} | ${(o.r.steps / o.r.n).toFixed(2)} | ${o.r.frameP95.toFixed(1)} | ${o.L0} |`);
if (errs.length) console.log('page errors:', errs.slice(0, 5));
await browser.close();
