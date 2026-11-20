// node tools/audit/turnprobe.mjs [query]   headless: body yaw vs camera yaw while the camera turns.
// Per case: max |body - camera| lag (deg), max body-yaw change per rendered frame (deg), max change of the per-frame
// turn rate between frames (deg/frame², "snap": a jump in angular velocity), mean lag.
import { launch } from './browser.mjs';
const [query = ''] = process.argv.slice(2);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play' + (query ? '&' + query : ''));
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.mouse.click(480, 270);
const gp = (f, a) => page.evaluate(f, a);
const install = () => gp(() => {
  const g = window.__gp;
  g.ctx.player.godMode = true;
  g.data.horde.passive = true;
  const p = g.ctx.player;
  window.__turn = { rate: 0, flick: 0 };
  if (!p.__origStep) p.__origStep = p.step.bind(p);
  p.step = (dt) => {
    const T = window.__turn;
    let y = p.yaw + T.rate * dt + T.flick;
    T.flick = 0;
    p.setLook(y, p.pitch);
    p.__origStep(dt);
  };
  const root = g.ctx.playerChar.root;
  window.__tr = [];
  const tick = () => {
    window.__tr.push([performance.now(), root.rotation.y, p.yaw]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await install();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const D = 180 / Math.PI;
const out = [];
async function run(name, { keys = [], rmb = false, rate = 0, flickDeg = 0, ms = 2500, armed = false, fire = false }) {
  await gp((armed) => {
    const g = window.__gp;
    g.teleport(0, 0, 20);
    g.setLook(Math.PI, 0);
    g.ctx.facing.yaw = g.ctx.facing.prevYaw = Math.PI;
    if (armed) { if (!g.ctx.weapons.sandbox) g.sandbox(); g.ctx.weapons.select(0); };
  }, armed);
  await page.waitForTimeout(armed ? 1200 : 600);
  if (rmb) await gp(() => window.__gp.mouse(2, true));
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(rmb ? 500 : 400);
  await gp(([r, f]) => { window.__tr.length = 0; window.__turn.rate = r; window.__turn.flick = f; }, [rate, flickDeg / D]);
  if (fire) { await gp(() => window.__gp.mouse(0, true)); await page.waitForTimeout(80); await gp(() => window.__gp.mouse(0, false)); }
  await page.waitForTimeout(ms);
  const d = await gp(() => { window.__turn.rate = 0; return window.__tr.slice(); });
  for (const k of keys) await page.keyboard.up(k);
  if (rmb) await gp(() => window.__gp.mouse(2, false));
  await page.waitForTimeout(500);
  let maxLag = 0, sumLag = 0, maxStep = 0, maxSnap = 0, prevW = null;
  for (let i = 1; i < d.length; i++) {
    const lag = Math.abs(wrap(d[i][1] - d[i][2])) * D;
    maxLag = Math.max(maxLag, lag);
    sumLag += lag;
    const dtf = (d[i][0] - d[i - 1][0]) / (1000 / 60); // in 60 Hz frames
    const w = (wrap(d[i][1] - d[i - 1][1]) * D) / Math.max(0.5, dtf);
    maxStep = Math.max(maxStep, Math.abs(w));
    if (prevW !== null) maxSnap = Math.max(maxSnap, Math.abs(w - prevW));
    prevW = w;
  }
  out.push(`${name.padEnd(22)} lag max ${maxLag.toFixed(0)} mean ${(sumLag / d.length).toFixed(0)}  step max ${maxStep.toFixed(1)} deg/f  snap ${maxSnap.toFixed(1)} deg/f²  frames ${d.length}`);
}
const cases = {
  stand_sweep90: { rate: Math.PI / 2, ms: 3000 },
  stand_flick120: { flickDeg: 120, ms: 2000 },
  jog_sweep120: { keys: ['w'], rate: (2 * Math.PI) / 3 },
  jog_flick180: { keys: ['w'], flickDeg: 180, ms: 1500 },
  sprint_flick90: { keys: ['Shift', 'w'], flickDeg: 90, ms: 1500 },
  armed_jog_sweep120: { armed: true, keys: ['w'], rate: (2 * Math.PI) / 3 },
  aim_stand_sweep180: { armed: true, rmb: true, rate: Math.PI, ms: 2000 },
  aim_strafe_sweep90: { armed: true, rmb: true, keys: ['d'], rate: Math.PI / 2, ms: 2000 },
  armed_fire_flick120: { armed: true, flickDeg: 120, fire: true, ms: 1500 },
};
for (const [n, c] of Object.entries(cases)) {
  if (process.env.CASES && !process.env.CASES.split(',').includes(n)) continue;
  try { await run(n, c); } catch (e) { out.push(n + ' failed ' + String(e).slice(0, 120)); await page.waitForTimeout(3000); await install().catch(() => {}); }
}
console.log(out.join('\n'));
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await browser.close();
