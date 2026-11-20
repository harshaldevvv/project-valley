// node tools/audit/tribreak.mjs   headless: triangles per scene object (instances counted), biggest first. Needs the dev server on 5188.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(1500);
const rows = await page.evaluate(() => {
  const out = [];
  window.__gp.ctx.game.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    out.push([o.name || o.parent?.name || o.type, Math.round(n), o.isInstancedMesh ? o.count : 1]);
  });
  const agg = {};
  for (const [n, t, c] of out) { const k = n.replace(/_[-0-9,]+$/, '').replace(/_x\d+$/, ''); (agg[k] ??= [0, 0, 0]); agg[k][0] += t; agg[k][1] += c; agg[k][2]++; }
  return Object.entries(agg).sort((a, b) => b[1][0] - a[1][0]).slice(0, 25).map(([k, v]) => `${k}: ${v[0]} tris, ${v[1]} inst, ${v[2]} meshes`);
});
console.log(rows.join('\n'));
await browser.close();
