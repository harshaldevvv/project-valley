// Shoots each AI zombie variant at head centre, lower face and chest; prints the zone the game reports.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true; g.ctx.zombies.list.forEach((z) => (z.frozen = true)); g.sandbox(); window.__zones = []; window.game.events.on('hit', (e) => window.__zones.push(e.zone)); g.spawn(24); g.teleport(40, -3.4, 0); });
await page.waitForTimeout(3000);
const res = {};
for (const hy of [1.42, 1.36, 1.3]) {
  const out = await gp(async (hy) => {
    const g = window.__gp.ctx; const zs = g.zombies.list.filter((z) => z.alive && z.def.id.startsWith('ai_')).slice(0, 8); const r = [];
    for (const z of zs) {
      window.__zones.length = 0;
      const p = z.curr; window.__gp.teleport(p.x, p.z + 4, 0); await new Promise((r) => setTimeout(r, 250));
      window.__gp.aimAt(p.x, p.y + hy * (z.def.scale ?? 1), p.z);
      window.__gp.mouse(0, true); await new Promise((r) => setTimeout(r, 90)); window.__gp.mouse(0, false); await new Promise((r) => setTimeout(r, 120));
      r.push(z.def.id + ':' + (window.__zones.join('/') || 'miss'));
    }
    return r;
  }, hy);
  res[hy] = out;
}
console.log(JSON.stringify(res)); await browser.close();
