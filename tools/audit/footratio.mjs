// node tools/audit/footratio.mjs [query]   headless: per gait, planted-foot speed in the BODY frame vs body speed.
// ratio = foot backward speed / body speed while planted (1.0 = no skate; <1 feet slide forward, >1 backward),
// world slip = planted foot world speed (m/s). Use the ratio to fix clip speeds / strideScale.
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
  g.teleport(0, 0, 20);
  g.setLook(Math.PI, 0);
  const root = g.ctx.playerChar.root;
  const find = (...n) => { let r = null; root.traverse((o) => { if (!r && n.includes(o.name)) r = o; }); return r; };
  const feet = [find('LeftFoot', 'foot_L'), find('RightFoot', 'foot_R')];
  const hands = [find('LeftHand', 'hand_L'), find('RightHand', 'hand_R')];
  window.__fs = [];
  const v = new (root.position.constructor)();
  const tick = () => {
    root.updateMatrixWorld(true);
    const yaw = root.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw);
    const row = [performance.now()];
    for (const f of feet) {
      f.getWorldPosition(v);
      const dx = v.x - root.position.x, dz = v.z - root.position.z;
      // body frame: right = (c,0,-s), forward = (-s,0,-c)
      row.push(v.x, v.y - root.position.y, v.z, dx * c - dz * s, -dx * s - dz * c);
    }
    row.push(Math.hypot(g.ctx.player.vel.x, g.ctx.player.vel.z), g.ctx.player.gait, g.ctx.player.stamina ?? 0);
    for (const h of hands) { h.getWorldPosition(v); const dx = v.x - root.position.x, dz = v.z - root.position.z; row.push(-dx * s - dz * c); } // hand forward (body frame)
    window.__fs.push(row);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await install();
if (process.env.NOLOCK) await gp(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('content/data/anim.ts')); for (const x of u) (await import(x)).animPost.footLock = false; window.__nolock = u; });
if (process.env.NOLOCK) console.log('nolock modules', await gp(() => window.__nolock));
const out = [];
const run = async (name, keys, ms) => {
  await gp(() => { window.__fs.length = 0; window.__gp.teleport(0, 0, 20); });
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  const d = await gp(() => window.__fs.slice());
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(700);
  const s = d.filter((x) => x[0] - d[0][0] > 900);
  const res = [];
  if (process.env.DUMP) for (let i = 1; i < Math.min(s.length, 70); i++) { const dt = (s[i][0] - s[i - 1][0]) / 1000; const r = [0, 1].map((f) => { const o = 1 + f * 5; return `${s[i][o + 1].toFixed(3)} ${((s[i][o + 4] - s[i - 1][o + 4]) / dt + s[i][11]).toFixed(2)} ${(Math.hypot(s[i][o] - s[i - 1][o], s[i][o + 2] - s[i - 1][o + 2]) / dt).toFixed(2)}`; }); console.log((dt * 1000).toFixed(1), r.join(' | ')); }
  for (const f of [0, 1]) {
    const o = 1 + f * 5;
    const minY = Math.min(...s.map((x) => x[o + 1]));
    let slip = 0, ratio = 0, n = 0, fw = 0, lat = 0;
    for (let i = 1; i < s.length; i++) {
      if (s[i][o + 1] > minY + 0.03 || s[i - 1][o + 1] > minY + 0.03) continue;
      const dt = (s[i][0] - s[i - 1][0]) / 1000;
      if (dt <= 0) continue;
      const sp = s[i][11];
      if (sp < 0.3) continue;
      slip += Math.hypot(s[i][o] - s[i - 1][o], s[i][o + 2] - s[i - 1][o + 2]) / dt;
      // local travel along the body velocity direction: use forward+right speed magnitude projected on motion
      const lv = Math.hypot(s[i][o + 3] - s[i - 1][o + 3], s[i][o + 4] - s[i - 1][o + 4]) / dt;
      ratio += lv / sp;
      fw += (s[i][o + 4] - s[i - 1][o + 4]) / dt + sp;
      lat += Math.abs(s[i][o + 3] - s[i - 1][o + 3]) / dt;
      n++;
    }
    res.push(n ? `${(slip / n).toFixed(2)}/${(ratio / n).toFixed(2)} fwd ${(fw / n).toFixed(2)} lat ${(lat / n).toFixed(2)} n${n}` : 'n/a');
  }
  // peak foot world speed (p95 over frames): a lock catch-up snap shows up as a higher peak than the clip's swing
  const pk = [0, 1].map((f) => { const o = 1 + f * 5; const v = []; for (let i = 1; i < s.length; i++) { const dt = (s[i][0] - s[i - 1][0]) / 1000; if (dt > 0) v.push(Math.hypot(s[i][o] - s[i - 1][o], s[i][o + 2] - s[i - 1][o + 2]) / dt); } v.sort((a, b) => a - b); return v.length ? v[Math.floor(v.length * 0.97)].toFixed(1) : '-'; });
  res.push(`peak97 ${pk.join('/')}`);
  // arm swing: hand fore-aft range in the body frame (p5..p95), what the eye reads as swing
  const arm = [14, 15].map((o) => { const v = s.map((x) => x[o]).sort((a, b) => a - b); return v.length ? (v[Math.floor(v.length * 0.95)] - v[Math.floor(v.length * 0.05)]).toFixed(2) : '-'; });
  res.push(`arm ${arm.join('/')}`);
  const sp = s.length ? s.reduce((a, x) => a + x[11], 0) / s.length : 0;
  out.push(`${name.padEnd(7)} speed ${sp.toFixed(2)} gait ${s[s.length >> 1]?.[12]}  slip/ratio L ${res[0]}  R ${res[1]}  ${res[2]}  ${res[3]}`);
};
const cases = (process.env.CASES ?? 'jog,sprint,crouch').split(',');
const def = { jog: [['w'], 3500], sprint: [['Shift', 'w'], 3500], crouch: [['c', 'w'], 3000], walk: [['Alt', 'w'], 3000], aimfwd: [['w'], 3000], aimstrafe: [['d'], 3000], aimback: [['s'], 3000], aimdiag: [['w', 'a'], 3000], aimbackdiag: [['s', 'd'], 3000] };
for (const c of cases) {
  if (c.startsWith('aim')) await gp(async () => { const g = window.__gp; if (!g.ctx.weapons.sandbox) { g.sandbox(); await new Promise((r) => setTimeout(r, 1200)); } g.mouse(2, true); });
  try { await run(c, ...def[c]); } catch (e) { out.push(c + ' failed ' + String(e).slice(0, 100)); await page.waitForTimeout(3000); await install().catch(() => {}); }
  if (c === 'crouch') await page.keyboard.press('c');
  if (c.startsWith('aim')) await gp(() => window.__gp.mouse(2, false));
}
console.log(out.join('\n'));
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await browser.close();
