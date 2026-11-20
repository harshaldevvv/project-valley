// node tools/audit/poiperf.mjs [tag] [name,name...]   headless: teleport to each view, screenshot (wip/poi_<name>.png) and log draws/tris/frame ms.
// Views come from tools/audit/poiviews.json: {name:[x,z,yaw,pitch,height?]}. Needs the dev server on 5188.
import { readFileSync } from 'node:fs';
import { launch } from './browser.mjs';
const views = JSON.parse(readFileSync(new URL('./poiviews.json', import.meta.url), 'utf8'));
const only = process.argv[3]?.split(',');
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => (m.type() === 'error') && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play&gputime');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(2500);
await page.mouse.click(640, 360);
await page.evaluate(() => { window.__gp.ctx.player.godMode = true; });
const rows = [];
for (const [name, v] of Object.entries(views)) {
  if (only && !only.includes(name)) continue;
  if (v.length === 6) {
    // free camera: [camX, camY, camZ, targetX, targetY, targetZ]; the player is teleported next to the target so the area streams in
    await page.evaluate(([cx, cy, cz, tx, ty, tz]) => {
      const g = window.__gp.ctx, cam = g.game.camera;
      window.__gp.teleport(tx, tz, 0);
      g.rig.override = () => { cam.position.set(cx, cy, cz); cam.lookAt(tx, ty, tz); cam.updateMatrixWorld(true); return true; };
    }, v);
  } else {
    const [x, z, yaw, pitch] = v;
    await page.evaluate(([x, z, yaw, pitch]) => { window.__gp.ctx.rig.override = null; window.__gp.teleport(x, z, yaw); window.__gp.setLook(yaw, pitch); }, [x, z, yaw, pitch]);
  }
  await page.waitForTimeout(2500);
  const s = await page.evaluate(() => { const p = window.__gp.ctx.game.perf.snapshot(); return { draws: p.drawCalls, tris: Math.round(p.triangles / 1000), p50: +p.p50.toFixed(1), p95: +p.p95.toFixed(1), gpuMs: p.gpuMs }; });
  await page.screenshot({ path: `docs/audit/screenshots/wip/poi_${name}.png` });
  rows.push({ name, ...s });
}
console.log(process.argv[2] ?? '', JSON.stringify(rows));
console.log('errors', errs.slice(0, 8));
await browser.close();
