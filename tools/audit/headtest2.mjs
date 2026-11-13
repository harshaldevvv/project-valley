// Deterministic headshot test: all zombies are put in their pen in one synchronous evaluate (no frames in between, so
// nothing moves), and rays are cast with the weapon's own collision groups from 4 m in front at fixed heights.
// Reports, per variant, the zone returned for aim heights relative to the variant's real head (bbox top of the mesh).
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1300,780'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
await page.evaluate(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true; g.spawn(40); g.teleport(0, 60, 0); });
await page.waitForTimeout(2500);
const res = await page.evaluate(() => {
  const g = window.game, ctx = window.__gp.ctx, { R, world } = g.phys;
  const G = { STATIC: 1, TERRAIN: 2, ZOMBIE: 8, VEHICLE: 16, PROJECTILE: 32, DEBRIS: 64, BUILD: 256 };
  const filt = ((G.PROJECTILE & 0xffff) << 16) | ((G.STATIC | G.TERRAIN | G.ZOMBIE | G.VEHICLE | G.BUILD | G.DEBRIS) & 0xffff);
  const out = {};
  for (const z of ctx.zombies.list) {
    if (!z.alive) continue;
    const s = z.def.scale ?? 1, id = z.def.id; out[id] ??= { n: 0, rows: {} };
    out[id].n++;
    for (const hy of [1.0, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7]) {
      const y = z.curr.y + hy * s;
      // shoot along -Z (from +Z) and along +X (from -X): two directions per height
      for (const [ox, oz, dx, dz] of [[0, 4, 0, -1], [-4, 0, 1, 0]]) {
        const ray = new R.Ray({ x: z.curr.x + ox, y, z: z.curr.z + oz }, { x: dx, y: 0, z: dz });
        const hit = world.castRay(ray, 8, true, undefined, filt);
        let zone = 'miss';
        if (hit) { const c = hit.collider; const h = ctx.hits.get(c.handle); if (h && (c.handle === z.head.handle || c.handle === z.capsule.handle)) { const t = hit.timeOfImpact; const pt = { x: ray.origin.x + dx * t, y: ray.origin.y, z: ray.origin.z + dz * t }; const zn = h.zone(c, pt); zone = zn === 'head' ? 'head' : 'body'; } else zone = 'other'; }
        const k = hy.toFixed(1); (out[id].rows[k] ??= { head: 0, body: 0, miss: 0, other: 0 })[zone]++;
      }
    }
  }
  return out;
});
for (const [id, v] of Object.entries(res)) console.log(id.padEnd(12), 'n', v.n, Object.entries(v.rows).map(([h, r]) => `${h}m:${r.head}H/${r.body}B/${r.miss}M/${r.other}O`).join('  '));
await browser.close();
