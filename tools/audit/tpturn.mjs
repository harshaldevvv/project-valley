// node tools/audit/tpturn.mjs [tag] #here   headless frame-stepped third-person turn audit (B2), 60 Hz, 960x540.
// Same stepped loop as tpfire.mjs: one call = exactly one 1/60 s sim step + one render, then a probe (+ screenshot on strip frames).
// Cases: jog180 (jog, flick the view 180°), sprint90 (sprint, flick 90°), swing (standing, mouse swing 150° over 8 frames,
// then back), aimswing (rifle, RMB held, same swing), stopstart (jog, stop, start again).
// Per case prints: body lag behind the camera (max, mean, frames until < 10°), the first frame the body moves after the
// flick, peak body turn rate (deg/frame) and the largest change of that rate between frames (snap), planted-foot slide
// while turning (cm per frame, foot within 3.5 cm of its lowest), and for stopstart the time to start/stop.
// Writes docs/audit/screenshots/wip/tpturn_<tag>_<case>.png contact sheets (every 3rd frame of the first 48) and tpturn_<tag>.json.
// Env: PORT (default 5231), SHOTS=0 skips screenshots, CASES=a,b.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch } from './browser.mjs';
const OUT = 'docs/audit/screenshots/wip';
const FR = `${OUT}/tpturn_frames`;
mkdirSync(FR, { recursive: true });
const tag = process.argv[2] ?? 'run';
const PORT = process.env.PORT ?? '5231';
const SHOTS = process.env.SHOTS !== '0';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
await page.goto(`http://localhost:${PORT}/?play`);
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(2000);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => {
  const g = window.__gp, c = g.ctx;
  c.player.godMode = true; g.data.horde.passive = true;
  g.sandbox(); c.rig.mode = 'tp';
  const root = c.playerChar.root;
  const find = (...n) => { let r = null; root.traverse((o) => { if (!r && n.includes(o.name)) r = o; }); return r; };
  const feet = [find('LeftFoot', 'foot_L'), find('RightFoot', 'foot_R')];
  const hips = find('Hips', 'hips', 'pelvis');
  const Q = root.quaternion.constructor, hq = new Q();
  const V = root.position.constructor, v = new V();
  window.__probe = () => {
    root.updateMatrixWorld(true);
    const p = c.player, cam = c.game.camera;
    return {
      cam: p.yaw, body: root.rotation.y, hip: hips ? (hips.getWorldQuaternion(hq), (v.set(0, 0, 1).applyQuaternion(hq), Math.atan2(v.x, v.z))) : 0, fy: c.facing.yaw,
      turning: !!c.playerAnim?.turning, aim: c.facing.aiming, wish: p.wish ? p.wish.length() : -1, yv: c.facing.yawVel, locked: !!p.locked, full: c.playerAnim?.full?.name ?? '', tip: c.facing.turningInPlace,
      sp: Math.hypot(p.vel.x, p.vel.z),
      feet: feet.map((f) => (f ? (f.getWorldPosition(v), [v.x, v.y, v.z]) : null)),
      camPos: [cam.position.x, cam.position.y, cam.position.z], pos: [p.position.x, p.position.y, p.position.z],
    };
  };
});
let loopOn = false;
async function manual() {
  if (loopOn) return;
  loopOn = true;
  await gp(() => {
    const r = window.__gp.ctx.game.renderer, cb = window.__cb ?? r._animation._animationLoop;
    window.__cb = cb; r.setAnimationLoop(null);
    window.__t = Math.max(window.__t ?? 0, performance.now()); cb(window.__t);
    for (let k = 0, t0 = window.__gp.ctx.game.tick; k < 400 && window.__gp.ctx.game.tick === t0; k++) { window.__t += k < 20 ? 1 : 5; cb(window.__t); }
    window.__step = () => { const t0 = window.__gp.ctx.game.tick; window.__t += 1000 / 60 + 0.001; window.__cb(window.__t); return window.__gp.ctx.game.tick - t0; };
  });
}
async function real() {
  if (!loopOn) return;
  loopOn = false;
  await gp(() => { const r = window.__gp.ctx.game.renderer; r.setAnimationLoop(window.__cb); });
}
const key = (k, held) => gp(([k, h]) => { const c = window.__gp.ctx; if (k.startsWith('Mouse')) c.controls.press(k, h); else if (h) c.game.input.held.add(k); else c.game.input.held.delete(k); }, [k, held]);
const steps = (n) => gp((n) => { let s = 0; for (let i = 0; i < n; i++) s += window.__step(); return s; }, n);

const all = {};
async function record(name, count, before) {
  const rows = [], files = [];
  for (let i = 0; i < count; i++) {
    if (before) await before(i);
    const st = await gp(() => window.__step());
    const pr = await gp(() => window.__probe());
    pr.steps = st;
    rows.push(pr);
    if (SHOTS && i < 48 && i % 3 === 0) {
      await gp(() => new Promise((res) => requestAnimationFrame(() => res())));
      const f = `${FR}/${tag}_${name}_${String(i).padStart(3, '0')}.png`;
      await page.screenshot({ path: f });
      files.push(f);
    }
  }
  if (files.length) execFileSync('python', ['tools/audit/sheet.py', `${OUT}/tpturn_${tag}_${name}.png`, '8', '0.4', ...files]);
  all[name] = rows;
  return rows;
}
async function reset(armed) {
  await real();
  for (const k of ['KeyW', 'ShiftLeft', 'Mouse2']) await key(k, false);
  await gp((armed) => {
    const g = window.__gp, c = g.ctx;
    g.teleport(0, 0, 20); g.setLook(Math.PI, -0.05);
    c.facing.yaw = c.facing.prevYaw = Math.PI; c.facing.yawVel = 0;
    c.weapons.select(armed ? 1 : 0);
  }, armed);
  await page.waitForTimeout(armed ? 2200 : 900);
  await manual();
}
const setYaw = (d) => gp((d) => { const p = window.__gp.ctx.player; window.__gp.setLook(p.yaw + d, p.pitch); }, d);
const DEG = Math.PI / 180;

const cases = {
  async jog180() {
    await reset(false); await key('KeyW', true); await steps(40);
    return record('jog180', 60, async (i) => { if (i === 0) await setYaw(180 * DEG); });
  },
  async sprint90() {
    await reset(false); await key('KeyW', true); await key('ShiftLeft', true); await steps(50);
    return record('sprint90', 60, async (i) => { if (i === 0) await setYaw(90 * DEG); });
  },
  async swing() {
    await reset(false);
    return record('swing', 90, async (i) => { if (i < 8) await setYaw(150 / 8 * DEG); else if (i >= 50 && i < 58) await setYaw(-150 / 8 * DEG); });
  },
  async aimswing() {
    await reset(true); await key('Mouse2', true); await steps(30);
    return record('aimswing', 60, async (i) => { if (i < 8) await setYaw(150 / 8 * DEG); else if (i >= 30 && i < 38) await setYaw(-150 / 8 * DEG); });
  },
  async stopstart() {
    await reset(false); await key('KeyW', true); await steps(40);
    return record('stopstart', 70, async (i) => { if (i === 0) await key('KeyW', false); if (i === 35) await key('KeyW', true); });
  },
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const D = 180 / Math.PI;
const out = [];
for (const [n, fn] of Object.entries(cases)) {
  if (process.env.CASES && !process.env.CASES.split(',').includes(n)) continue;
  let rows;
  try { rows = await fn(); } catch (e) { out.push(`${n} failed ${String(e).slice(0, 160)}`); continue; }
  const lag = rows.map((r) => Math.abs(wrap(r.body - r.cam)) * D);
  const rate = rows.map((r, i) => (i ? wrap(r.body - rows[i - 1].body) * D : 0));
  let snap = 0; for (let i = 2; i < rate.length; i++) snap = Math.max(snap, Math.abs(rate[i] - rate[i - 1]));
  const hr = rows.map((r, i) => (i ? wrap(r.hip - rows[i - 1].hip) * D : 0));
  let hsnap = 0; for (let i = 2; i < hr.length; i++) if (rows[i].sp < 0.3) hsnap = Math.max(hsnap, Math.abs(hr[i] - hr[i - 1]));
  const firstMove = rate.findIndex((x, i) => i > 0 && Math.abs(x) > 0.3);
  let settle = -1; for (let i = lag.length - 1; i >= 0; i--) if (lag[i] > 10) { settle = i + 1; break; }
  // planted-foot slide while the body turns (rate > 0.5 deg/frame) or a turn clip plays
  let slide = 0, sn = 0, smax = 0;
  for (const f of [0, 1]) {
    const ys = rows.map((r) => r.feet[f]?.[1]).filter((y) => y != null);
    const minY = Math.min(...ys);
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i].feet[f], b = rows[i - 1].feet[f];
      if (!a || !b || a[1] > minY + 0.035 || !(rows[i].turning || Math.abs(rate[i]) > 0.5)) continue;
      if (rows[i].sp > 0.3) continue; // only standing turns: a moving planted foot is the gait's job (footslide.mjs)
      const d = Math.hypot(a[0] - b[0], a[2] - b[2]) * 100;
      slide += d; sn++; smax = Math.max(smax, d);
    }
  }
  const camOff = rows.map((r) => Math.hypot(r.camPos[0] - r.pos[0], r.camPos[2] - r.pos[2]));
  let s = `${n.padEnd(10)} lag max ${Math.max(...lag).toFixed(0)}° mean ${(lag.reduce((a, b) => a + b, 0) / lag.length).toFixed(0)}° settle<10° f${settle} firstMove f${firstMove} peak ${Math.max(...rate.map(Math.abs)).toFixed(1)}°/f snap ${snap.toFixed(1)}°/f² hipSnap(stand) ${hsnap.toFixed(1)}`;
  s += ` standSlide ${sn ? (slide / sn).toFixed(2) : '-'}cm/f max ${smax.toFixed(2)} (${sn}f) turnClip ${rows.filter((r) => r.turning).length}f camArmXZ ${Math.min(...camOff).toFixed(2)}-${Math.max(...camOff).toFixed(2)}`;
  if (n === 'stopstart') {
    const sp = rows.map((r) => r.sp);
    const top = sp[0];
    const stop = sp.findIndex((x) => x < 0.1 * top), start = sp.findIndex((x, i) => i > 35 && x > 0.9 * top);
    s += ` stop<10% f${stop} start>90% f${start - 35} (jog ${top.toFixed(2)})`;
  }
  s += ` badSteps ${rows.filter((r) => r.steps !== 1).length}`;
  out.push(s);
  if (process.env.TRACE === n) console.log(rows.map((r, i) => `${i} lag ${lag[i].toFixed(0)} rate ${rate[i].toFixed(1)} hip ${hr[i].toFixed(1)} sp ${r.sp.toFixed(2)} turn ${r.turning ? 1 : 0} aim ${r.aim ? 1 : 0} wish ${r.wish.toFixed(2)} yv ${r.yv.toFixed(2)} lk ${r.locked ? 1 : 0} ${r.full}`).join('\n'));
}
await real();
writeFileSync(`${OUT}/tpturn_${tag}.json`, JSON.stringify(all));
console.log(out.join('\n'));
console.log('errors', JSON.stringify(errs.slice(0, 4)));
rmSync(FR, { recursive: true, force: true });
await browser.close();
