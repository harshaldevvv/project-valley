// node tools/audit/npcclips.mjs <tag> <id> <clip,clip,...>   headless: plays each clip on one NPC and films it from the front at
// 0.2 / 0.45 / 0.7 of its length. Writes docs/audit/screenshots/wip/<tag>_<clip>_<n>.png
import { launch } from './browser.mjs';
const [tag = 'npcclip', id = 'odell', clipsArg = 'idle,idle_b,idle_c,pf_idle'] = process.argv.slice(2);
const out = 'docs/audit/screenshots/wip/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__npc && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.evaluate((id) => {
  const g = window.__gp, n = window.__npc.live.find((x) => x.def.id === id), cam = g.ctx.game.camera;
  g.ctx.player.godMode = true;
  const r = n.root.rotation.y, fx = -Math.sin(r), fz = -Math.cos(r);
  g.teleport(n.root.position.x + fx * 12, n.root.position.z + fz * 12, 0);
  const P = n.root.position;
  g.ctx.rig.override = () => { cam.position.set(P.x + fx * 2.6, P.y + 1.2, P.z + fz * 2.6); cam.lookAt(P.x, P.y + 0.95, P.z); if (cam.fov !== 45) { cam.fov = 45; cam.updateProjectionMatrix(); } return true; };
}, id);
for (const c of clipsArg.split(',')) {
  const dur = await page.evaluate(([id, c]) => {
    const n = window.__npc.live.find((x) => x.def.id === id);
    n.nextIdle = 999; n.back = null;
    for (const a of n.actions.values()) a.stop();
    const a = n.actions.get(c); a.reset().play(); a.setEffectiveWeight(1);
    n.idle = a;
    return a.getClip().duration;
  }, [id, c]);
  for (const [i, f] of [0.2, 0.45, 0.7].entries()) {
    await page.evaluate(([id, c, t]) => { const n = window.__npc.live.find((x) => x.def.id === id); n.actions.get(c).time = t; n.actions.get(c).paused = true; }, [id, c, dur * f]);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}${tag}_${c}_${i}.png` });
  }
  console.log(c, dur.toFixed(2));
}
await browser.close();
