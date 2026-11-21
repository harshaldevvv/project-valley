// node tools/audit/npcclose.mjs <tag> [ids]   headless close-ups of NPCs: front (player view), face, feet/ground from the side, back,
// plus a wide view of the spot. Prints ground height vs feet so floating / sinking shows as a number.
// Writes docs/audit/screenshots/wip/<tag>_<id>_<view>.png
import { launch } from './browser.mjs';
const [tag = 'npcc', idsArg = 'hollis,wren'] = process.argv.slice(2);
const out = 'docs/audit/screenshots/wip/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__npc && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(1500);
for (const id of idsArg.split(',')) {
  await page.evaluate((id) => {
    const g = window.__gp, n = window.__npc.live.find((x) => x.def.id === id);
    g.ctx.player.godMode = true;
    const r = n.root.rotation.y, fx = -Math.sin(r), fz = -Math.cos(r);
    g.teleport(n.root.position.x + fx * 3.2, n.root.position.z + fz * 3.2, 0);
    g.aimAt(n.root.position.x, n.root.position.y + 1.3, n.root.position.z);
  }, id);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}${tag}_${id}_player.png` });
  const views = { face: [0.9, 1.55, 0, 1.5], feet: [0, 0.35, 1.6, 0.25], back: [-2.2, 1.4, 0.6, 1.0], wide: [5.5, 2.6, 2.5, 1.0], hands: [1.0, 1.1, 0.5, 1.0] };
  for (const [v, [fwd, h, side, lookH]] of Object.entries(views)) {
    const info = await page.evaluate(([id, fwd, h, side, lookH]) => {
      const g = window.__gp, n = window.__npc.live.find((x) => x.def.id === id), cam = g.ctx.game.camera;
      const r = n.root.rotation.y, fx = -Math.sin(r), fz = -Math.cos(r), rx = Math.cos(r), rz = -Math.sin(r);
      const P = n.root.position;
      g.ctx.rig.override = () => {
        cam.position.set(P.x + fx * fwd + rx * side, P.y + h, P.z + fz * fwd + rz * side);
        cam.lookAt(P.x, P.y + lookH, P.z);
        if (cam.fov !== 45) { cam.fov = 45; cam.updateProjectionMatrix(); }
        return true;
      };
      // lowest skinned vertex height is costly; use the foot bones instead
      let minFoot = Infinity;
      n.root.traverse((o) => { if (o.isBone && /foot|toe/i.test(o.name)) { const v = o.getWorldPosition(cam.position.clone()); minFoot = Math.min(minFoot, v.y); } });
      return { rootY: +P.y.toFixed(3), minFootBoneY: +minFoot.toFixed(3), pos: [+P.x.toFixed(1), +P.z.toFixed(1)], yaw: +r.toFixed(2) };
    }, [id, fwd, h, side, lookH]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}${tag}_${id}_${v}.png` });
    if (v === 'face') console.log(id, JSON.stringify(info));
  }
  await page.evaluate(() => { window.__gp.ctx.rig.override = null; });
}
console.log('errors', JSON.stringify(errs.slice(0, 5)));
await browser.close();
