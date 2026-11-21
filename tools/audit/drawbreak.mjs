// node tools/audit/drawbreak.mjs <view>[,view...]   headless: at each poiviews.json view, meshes inside the camera frustum grouped by
// name prefix (each is >= 1 draw in the main pass; shadow casters draw again per cascade). Needs the dev server on 5188.
import { readFileSync } from 'node:fs';
import { launch } from './browser.mjs';
const views = JSON.parse(readFileSync(new URL('./poiviews.json', import.meta.url), 'utf8'));
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.routeWebSocket(/.*/, () => {});
await page.goto('http://localhost:5188/?play&noautoquality');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 240000 });
await page.waitForTimeout(2500);
await page.evaluate((q) => { window.__gp.ctx.player.godMode = true; if (q) window.engine.quality.set(q); }, process.env.QUALITY ?? ''); // QUALITY=low|medium|high applies a preset
for (const name of process.argv[2].split(',')) {
  const v = views[name];
  if (v.length === 6) await page.evaluate(([cx, cy, cz, tx, ty, tz]) => { const g = window.__gp.ctx, cam = g.game.camera; window.__gp.teleport(tx, tz, 0); g.rig.override = () => { cam.position.set(cx, cy, cz); cam.lookAt(tx, ty, tz); cam.updateMatrixWorld(true); return true; }; }, v);
  else await page.evaluate(([x, z, yaw, pitch]) => { window.__gp.ctx.rig.override = null; window.__gp.teleport(x, z, yaw); window.__gp.setLook(yaw, pitch); }, v);
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const g = window.__gp.ctx.game, cam = g.camera;
    const M = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
    const planes = [];
    const e = M.elements; // Gribb-Hartmann
    const P = (a, b, c, d) => { const l = Math.hypot(a, b, c); planes.push([a / l, b / l, c / l, d / l]); };
    P(e[3] + e[0], e[7] + e[4], e[11] + e[8], e[15] + e[12]); P(e[3] - e[0], e[7] - e[4], e[11] - e[8], e[15] - e[12]);
    P(e[3] + e[1], e[7] + e[5], e[11] + e[9], e[15] + e[13]); P(e[3] - e[1], e[7] - e[5], e[11] - e[9], e[15] - e[13]);
    P(e[3] + e[2], e[7] + e[6], e[11] + e[10], e[15] + e[14]); P(e[3] - e[2], e[7] - e[6], e[11] - e[10], e[15] - e[14]);
    const agg = {}; let total = 0, shadow = 0;
    g.scene.traverseVisible((o) => {
      if (!o.isMesh && !o.isSkinnedMesh && !o.isPoints && !o.isLine) return;
      if (o.frustumCulled !== false) {
        const geo = o.geometry; if (!geo.boundingSphere) geo.computeBoundingSphere();
        const s = geo.boundingSphere.clone().applyMatrix4(o.matrixWorld);
        if (o.isInstancedMesh && o.boundingSphere) { s.copy(o.boundingSphere).applyMatrix4(o.matrixWorld); }
        for (const p of planes) if (p[0] * s.center.x + p[1] * s.center.y + p[2] * s.center.z + p[3] < -s.radius) return;
      }
      const n = Array.isArray(o.material) ? o.material.length : 1;
      let top = o; while (top.parent && top.parent !== g.scene) top = top.parent; const k = (top.name || top.type) + '/' + (o.name || o.type).replace(/[_-]?[-0-9.,]+$/, '').replace(/_x\d+$/, '').slice(0, 40);
      (agg[k] ??= [0, 0])[0] += n; if (o.castShadow) { agg[k][1] += n; shadow += n; } total += n;
    });
    return { total, shadow, rows: Object.entries(agg).sort((a, b) => b[1][0] - a[1][0]).slice(0, +(window.__rows ?? 200)).map(([k, v]) => `${v[0]}\t${v[1]}sh\t${k}`) };
  });
  const d = await page.evaluate(() => window.__gp.ctx.game.perf.snapshot().drawCalls);
  console.log(`== ${name}: renderer draws ${d}, in-frustum meshes ${r.total} (shadow casters ${r.shadow})\n${r.rows.join('\n')}`);
}
await browser.close();
