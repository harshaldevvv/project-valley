// node tools/audit/arch_shot.mjs [horde] #here   headless: one close-up per zombie archetype; with `horde`, a horde-night run with frame times.
// Check free RAM first (resource-guard --status >= 4 GB) and never leave the browser open.
import { launch } from './browser.mjs';
const out = 'docs/audit/screenshots/wip/';
const horde = process.argv.includes('horde');
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
try {
  await page.goto('http://localhost:5188/?play');
  await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  if (!horde) {
    await page.evaluate(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true; });
    for (const id of ['shambler', 'pfz_resident', 'runner', 'crawler', 'brute', 'screamer']) {
      const r = await page.evaluate(async (id) => {
        const g = window.__gp, z = g.ctx.zombies, p = g.ctx.player;
        for (const q of z.list) z.dismiss(q);
        const at = p.curr.constructor;
        const px = p.curr.x, pz = p.curr.z;
        g.teleport(px, pz, 0);
        const zb = await z.spawn(new at(px + 4.5, p.curr.y, pz - 0.5), Math.PI / 2 + 0.3, id);
        g.aimAt(zb.curr.x, zb.curr.y + 1.0, zb.curr.z);
        return `${id} hp ${Math.round(zb.hp)} crawler ${zb.crawler} model ${zb.def.model}`;
      }, id);
      console.log(r);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: out + `arch_${id}.png` });
    }
  } else {
    const run = await page.evaluate(async () => {
      const g = window.__gp, game = g.ctx.game, z = g.ctx.zombies;
      g.ctx.player.godMode = true;
      // the clock has no setter: replace the three getters with a fake clock we drive (night = 1)
      const fake = { day: 3, hours: 21.9, night: 1 };
      window.__fake = fake;
      for (const k of ['day', 'hours', 'night']) Object.defineProperty(game.time, k, { get: () => fake[k], configurable: true });
      const log = [];
      game.events.on('toast', (e) => log.push(e.text.slice(0, 50)));
      await new Promise((r) => setTimeout(r, 6000));
      log.push('phase ' + z.horde.state.phase);
      fake.hours = 22.05;
      await new Promise((r) => setTimeout(r, 22000)); // let the horde spawn and converge
      const alive = z.alive, members = z.horde.members.length;
      // frame times for 12 s with the horde on
      const dts = [];
      let last = performance.now();
      const t0 = last;
      await new Promise((res) => { const f = (t) => { dts.push(t - last); last = t; (t - t0 < 12000 ? requestAnimationFrame(f) : res()); }; requestAnimationFrame(f); });
      dts.shift();
      dts.sort((a, b) => a - b);
      const info = game.renderer.info.render;
      const kinds = {};
      for (const q of z.list) if (q.alive) kinds[q.def.id] = (kinds[q.def.id] || 0) + 1;
      return { log, alive, members, frames: dts.length, p50: +dts[Math.floor(dts.length * 0.5)].toFixed(1), p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1), max: +dts[dts.length - 1].toFixed(1), calls: info.calls ?? info.drawCalls, tris: info.triangles, kinds };
    });
    console.log(JSON.stringify(run));
    await page.screenshot({ path: out + 'horde_night.png' });
    // dawn: end of the horde, reward
    console.log('dawn', await page.evaluate(async () => {
      const g = window.__gp, game = g.ctx.game, z = g.ctx.zombies;
      const log = [];
      game.events.on('toast', (e) => log.push(e.text.slice(0, 40)));
      window.__fake.day = 4;
      window.__fake.hours = 5.6;
      await new Promise((r) => setTimeout(r, 1500));
      return JSON.stringify({ phase: z.horde.state.phase, done: z.horde.state.done, log });
    }));
  }
} finally {
  console.log('errors', JSON.stringify(errs.slice(0, 6)));
  await browser.close();
}
