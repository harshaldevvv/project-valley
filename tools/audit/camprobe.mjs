// node tools/audit/camprobe.mjs   headless: TP camera follow per rendered frame while jogging, sprinting, strafing, turning.
// Reports, per case: jitter = p95 |frame-to-frame change of camera velocity| (cm/frame²), offset wobble = p95 deviation of
// the camera-to-player offset (in the camera's yaw frame) from its median (cm), yaw jitter = p95 |Δ² camera yaw| (deg/frame²),
// and frame-time spread. A rigid, smooth follow has jitter ~ the player's own acceleration and near-zero wobble.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.mouse.click(480, 270);
const gp = (f, a) => page.evaluate(f, a);
const install = () => gp(() => {
  const g = window.__gp;
  g.ctx.player.godMode = true;
  g.data.horde.passive = true;
  const p = g.ctx.player;
  window.__turn = { rate: 0 };
  if (!p.__origStep) p.__origStep = p.step.bind(p);
  p.step = (dt) => { p.setLook(p.yaw + window.__turn.rate * dt, p.pitch); p.__origStep(dt); };
  const cam = g.ctx.game.camera, root = g.ctx.playerChar.root;
  window.__cp = [];
  const tick = (ts) => {
    window.__cp.push([ts, cam.position.x, cam.position.y, cam.position.z, cam.rotation.y, root.position.x, root.position.y, root.position.z, p.yaw]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await install();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const p95 = (v) => { const s = v.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length * 0.95)] : 0; };
const out = [];
async function run(name, { keys = [], rate = 0, ms = 2500 }) {
  await gp(() => { const g = window.__gp; g.teleport(0, 0, 20); g.setLook(Math.PI, 0); g.ctx.facing.yaw = g.ctx.facing.prevYaw = Math.PI; });
  await page.waitForTimeout(500);
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(700);
  await gp((r) => { window.__cp.length = 0; window.__turn.rate = r; }, rate);
  await page.waitForTimeout(ms);
  const d = await gp(() => { window.__turn.rate = 0; return window.__cp.slice(); });
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(400);
  const jit = [], wob = [], yj = [], ft = [], offs = [];
  for (let i = 0; i < d.length; i++) {
    const [, cx, cy, cz, cry, px, py, pz] = d[i];
    const c = Math.cos(cry), s = Math.sin(cry), dx = cx - px, dz = cz - pz;
    offs.push([dx * c - dz * s, cy - py, dx * s + dz * c]);
    if (i >= 2) {
      const v1 = [0, 1, 2].map((k) => d[i][1 + k] - d[i - 1][1 + k]), v0 = [0, 1, 2].map((k) => d[i - 1][1 + k] - d[i - 2][1 + k]);
      // normalise to 60 Hz frames so uneven frame times don't count as jitter
      const f1 = (d[i][0] - d[i - 1][0]) / 16.67, f0 = (d[i - 1][0] - d[i - 2][0]) / 16.67;
      jit.push(Math.hypot(...v1.map((x, k) => x / f1 - v0[k] / f0)) * 100);
      if (process.env.SPIKES && jit[jit.length - 1] > 1.5) console.log(name, i, v1.map((x, k) => ((x / f1 - v0[k] / f0) * 100).toFixed(2)).join(','), 'cam y', d[i][2].toFixed(3), 'feet y', d[i][6].toFixed(3));
      yj.push(Math.abs(wrap(d[i][4] - d[i - 1][4]) / f1 - wrap(d[i - 1][4] - d[i - 2][4]) / f0) * 57.3);
      ft.push(d[i][0] - d[i - 1][0]);
    }
  }
  if (process.env.DUMP === name) console.log(d.slice(2, 60).map((r, i) => { const q = d[i + 1]; const f = (r[0] - q[0]) / 16.67; return `${(r[0] - q[0]).toFixed(1)}:${(Math.hypot(r[1] - q[1], r[3] - q[3]) / f * 100).toFixed(2)}/${((r[2] - q[2]) / f * 100).toFixed(2)}`; }).join(' '));
  const med = [0, 1, 2].map((k) => offs.map((o) => o[k]).sort((a, b) => a - b)[offs.length >> 1]);
  if (process.env.DUMPOFF === name) console.log(offs.map((o) => Math.hypot(o[0], o[2]).toFixed(2)).join(' '));
  for (const o of offs) wob.push(Math.hypot(o[0] - med[0], o[1] - med[1], o[2] - med[2]) * 100);
  out.push(`${name.padEnd(12)} jitter p95 ${p95(jit).toFixed(2)} max ${Math.max(...jit).toFixed(1)} cm/f²  wobble p95 ${p95(wob).toFixed(1)} cm  yaw jitter p95 ${p95(yj).toFixed(2)} deg/f²  frame ms p95 ${p95(ft).toFixed(1)}  n${d.length}`);
}
const cases = {
  jog: { keys: ['w'] },
  sprint: { keys: ['Shift', 'w'] },
  strafe: { keys: ['d'] },
  turn_jog: { keys: ['w'], rate: 2 },
  turn_stand: { rate: 2 },
};
for (const [n, c] of Object.entries(cases)) {
  if (process.env.CASES && !process.env.CASES.split(',').includes(n)) continue;
  try { await run(n, c); } catch (e) { out.push(n + ' failed ' + String(e).slice(0, 100)); await page.waitForTimeout(3000); await install().catch(() => {}); }
}
console.log(out.join('\n'));
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await browser.close();
