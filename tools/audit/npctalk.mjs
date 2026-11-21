// node tools/audit/npctalk.mjs <tag> [ids]   headless: lists each NPC's clips, opens its dialogue from the side and front,
// and films it over time (talk pose / body turn). Writes docs/audit/screenshots/wip/<tag>_<id>_talk<n>.png
import { launch } from './browser.mjs';
const [tag = 'npct', idsArg = 'odell,eli'] = process.argv.slice(2);
const out = 'docs/audit/screenshots/wip/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__npc && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(1500);
for (const id of idsArg.split(',')) {
  const info = await page.evaluate((id) => {
    const g = window.__gp, n = window.__npc.live.find((x) => x.def.id === id);
    g.ctx.player.godMode = true;
    // stand off to the NPC's right-front so a body turn shows
    const r = n.root.rotation.y, fx = -Math.sin(r), fz = -Math.cos(r), rx = Math.cos(r), rz = -Math.sin(r);
    g.teleport(n.root.position.x + fx * 1.8 + rx * 1.6, n.root.position.z + fz * 1.8 + rz * 1.6, 0);
    g.aimAt(n.root.position.x, n.root.position.y + 1.4, n.root.position.z);
    return { clips: [...n.actions.keys()] };
  }, id);
  console.log(id, JSON.stringify(info));
  await page.waitForTimeout(1500);
  await page.evaluate((id) => window.__npc.talk(id), id);
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(i === 0 ? 300 : 1200);
    await page.evaluate((id) => {
      const g = window.__gp, n = window.__npc.live.find((x) => x.def.id === id), cam = g.ctx.game.camera;
      const P = n.root.position, pp = g.ctx.game.player.position;
      g.ctx.rig.override = () => {
        // side-on to the player-NPC line, both in view
        const dx = P.x - pp.x, dz = P.z - pp.z, L = Math.hypot(dx, dz) || 1, mx = (P.x + pp.x) / 2, mz = (P.z + pp.z) / 2;
        cam.position.set(mx - (dz / L) * 3.6, P.y + 1.4, mz + (dx / L) * 3.6);
        cam.lookAt(mx, P.y + 1.0, mz);
        if (cam.fov !== 45) { cam.fov = 45; cam.updateProjectionMatrix(); }
        return true;
      };
    }, id);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${out}${tag}_${id}_talk${i}.png` });
  }
  const st = await page.evaluate((id) => {
    const n = window.__npc.live.find((x) => x.def.id === id);
    return { yaw: n.root.rotation.y, playing: [...n.actions.entries()].filter(([, a]) => a.isRunning()).map(([k, a]) => k + ':' + a.getEffectiveWeight().toFixed(2)) };
  }, id);
  console.log(id, 'talking', JSON.stringify(st));
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__gp.ctx.rig.override = null; });
  await page.waitForTimeout(500);
}
console.log('errors', JSON.stringify(errs.slice(0, 5)));
await browser.close();
