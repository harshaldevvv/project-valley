// node tools/audit/stalldiag.mjs   headless: walk 8 directions from spawn, log ticks where the body moves < 50% of its velocity, with the hit normals
import { launch } from './browser.mjs';
const browser = await launch();
const ctx0 = await browser.newContext();
await ctx0.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export const createHotContext=()=>({accept(){},on(){},dispose(){},prune(){},invalidate(){},data:{}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=(u)=>u;' }));
const page = await ctx0.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.mouse.click(480, 270);
if (process.env.START) await page.evaluate((s) => { window.__start = s; }, process.env.START.split(',').map(Number));
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
  window.__log = log;
  window.__start0 = window.__start ? [window.__start[0], window.__start[1]] : [p.curr.x, p.curr.z];
  return null;
});
const dist = [];
// Real key presses (ctx.controls.press only drives mouse buttons)
for (let k = 0; k < 8; k++) {
  await page.evaluate((k) => { const g = window.__gp; g.teleport(window.__start0[0], window.__start0[1], (k * Math.PI) / 4); g.setLook((k * Math.PI) / 4, 0); }, k);
  const a = await page.evaluate(() => [window.__gp.ctx.player.curr.x, window.__gp.ctx.player.curr.z]);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3200);
  await page.keyboard.up('KeyW');
  const bpos = await page.evaluate(() => [window.__gp.ctx.player.curr.x, window.__gp.ctx.player.curr.z]);
  dist.push(Math.hypot(bpos[0] - a[0], bpos[1] - a[1]).toFixed(1));
  await page.waitForTimeout(300);
}
const out2 = await page.evaluate(() => window.__log);

console.log('stall spots', out2.length, 'metres walked per direction', dist.join(' '));
console.log(out2.slice(0, 25).join('\n'));
console.log('errors', JSON.stringify(errs.slice(0, 4)));
await browser.close();
