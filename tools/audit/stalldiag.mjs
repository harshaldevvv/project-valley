// node tools/audit/stalldiag.mjs   headless: walk 8 directions from spawn, log ticks where the body moves < 50% of its velocity, with the hit normals
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.mouse.click(480, 270);
const out = await page.evaluate(async () => {
  const g = window.__gp;
  const p = g.ctx.player;
  p.godMode = true;
  const kcc = p.kcc;
  const log = [];
  let last = null;
  const orig = p.step.bind(p);
  p.step = (dt) => {
    const x0 = p.curr.x, z0 = p.curr.z;
    orig(dt);
    const sp = Math.hypot(p.vel.x, p.vel.z);
    const d = Math.hypot(p.curr.x - x0, p.curr.z - z0);
    if (sp > 1.5 && d < sp * dt * 0.5) {
      const hits = [];
      for (let i = 0; i < kcc.numComputedCollisions(); i++) {
        const c = kcc.computedCollision(i);
        if (!c) continue;
        hits.push(`n(${c.normal1.x.toFixed(2)},${c.normal1.y.toFixed(2)},${c.normal1.z.toFixed(2)}) y${c.witness1.y.toFixed(2)} h${c.collider?.handle}`);
      }
      const key = `${p.curr.x.toFixed(1)},${p.curr.z.toFixed(1)}`;
      if (key !== last) log.push(`${key} y${p.curr.y.toFixed(2)} sp${sp.toFixed(1)} moved${(d / dt).toFixed(1)} ${hits.slice(0, 2).join(' ')}`);
      last = key;
    }
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const start = p.curr.clone();
  for (let k = 0; k < 8; k++) {
    p.teleport(start.clone(), (k * Math.PI) / 4);
    p.setLook((k * Math.PI) / 4, 0);
    g.ctx.controls.press('KeyW', true);
    await sleep(3200);
    g.ctx.controls.press('KeyW', false);
    await sleep(300);
  }
  return log;
});
console.log('stall spots', out.length);
console.log(out.slice(0, 25).join('\n'));
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await browser.close();
