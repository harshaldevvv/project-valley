// node tools/audit/footslide.mjs [query]   headless: per gait, how fast a planted foot slides (m/s) and how often feet cross/float
import { launch } from './browser.mjs';
const [query = ''] = process.argv.slice(2);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play' + (query ? '&' + query : ''));
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.mouse.click(480, 270);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => {
  const g = window.__gp;
  g.ctx.player.godMode = true;
  g.teleport(0, 0, 20);
  g.setLook(Math.PI, 0);
  const root = g.ctx.playerChar.root;
  const find = (...n) => { let r = null; root.traverse((o) => { if (!r && n.includes(o.name)) r = o; }); return r; };
  const feet = [find('LeftFoot', 'foot_L'), find('RightFoot', 'foot_R')];
  window.__fs = [];
  const v = new (root.position.constructor)();
  const tick = () => {
    root.updateMatrixWorld(true);
    const t = performance.now();
    window.__fs.push([t, ...feet.flatMap((f) => { f.getWorldPosition(v); return [v.x, v.y, v.z]; }), g.ctx.player.gait, Math.hypot(g.ctx.player.vel.x, g.ctx.player.vel.z)]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const segs = [];
const run = async (name, keys, ms) => {
  await gp(() => { window.__fs.length = 0; });
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  const d = await gp(() => window.__fs.slice());
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(600);
  // skip the first 0.8 s (acceleration)
  const s = d.filter((x) => x[0] - d[0][0] > 800);
  const res = [];
  for (const f of [0, 1]) {
    const ys = s.map((x) => x[2 + f * 3]);
    const minY = Math.min(...ys);
    let slide = 0, n = 0;
    for (let i = 1; i < s.length; i++) {
      const y = s[i][2 + f * 3];
      if (y > minY + 0.035) continue;
      const dt = (s[i][0] - s[i - 1][0]) / 1000;
      if (dt <= 0) continue;
      // planted foot speed relative to the ground (world), excluding the body's own travel is NOT wanted: planted = should be 0 in world
      const dx = s[i][1 + f * 3] - s[i - 1][1 + f * 3], dz = s[i][3 + f * 3] - s[i - 1][3 + f * 3];
      slide += Math.hypot(dx, dz) / dt; n++;
    }
    res.push(n ? +(slide / n).toFixed(2) : null);
  }
  const sp = s.length ? +(s.reduce((a, x) => a + x[8], 0) / s.length).toFixed(2) : 0;
  segs.push(`${name}: speed ${sp} m/s, planted-foot slide L ${res[0]} R ${res[1]} m/s, gait ${s[Math.floor(s.length / 2)]?.[7]}`);
};
await run('jog', ['w'], 3500);
await run('sprint', ['w', 'Shift'], 3500);
await run('strafe', ['d'], 3000);
await run('back', ['s'], 3000);
await run('crouch', ['c', 'w'], 3000);
await page.keyboard.press('c');
console.log(segs.join('\n'));
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await browser.close();
