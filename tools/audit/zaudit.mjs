// node tools/audit/zaudit.mjs <tag> [types]   headless zombie audit: spawns each type 6 m in front of a god-mode player,
// films it side-on at ground level while it walks in and attacks, then kills it and films the death.
// Writes docs/audit/screenshots/wip/<tag>_<type>_<n>.png (n: 0-7 walk/attack, 8-11 death) for tools/audit/sheet.py.
// Prints root height vs ground under it per phase so sinking / floating shows as a number.
import { launch } from './browser.mjs';
const [tag = 'za', typesArg] = process.argv.slice(2);
const out = 'docs/audit/screenshots/wip/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(1500);
const types = typesArg ? typesArg.split(',') : await page.evaluate(() => Object.keys(window.__gp.data.zombieDefs).filter((k) => k.startsWith('pfz_') || ['runner', 'crawler', 'brute', 'screamer'].includes(k)));
const base = await page.evaluate(() => {
  const g = window.__gp;
  g.ctx.player.godMode = true;
  g.ctx.zombies.clear();
  const p = g.ctx.player.curr;
  return [p.x, p.z];
});
const cam = (side, h, lookH) => page.evaluate(([side, h, lookH]) => {
  const g = window.__gp, c = g.ctx.game.camera, z = g.ctx.zombies.list[0];
  g.ctx.rig.override = () => {
    if (!z) return false;
    const P = z.curr;
    c.position.set(P.x + side, P.y + h, P.z);
    c.lookAt(P.x, P.y + lookH, P.z);
    if (c.fov !== 40) { c.fov = 40; c.updateProjectionMatrix(); }
    return true;
  };
}, [side, h, lookH]);
const info = () => page.evaluate(() => {
  const g = window.__gp, z = g.ctx.zombies.list[0];
  const { R, world } = g.ctx.game.phys;
  const hit = world.castRay(new R.Ray({ x: z.curr.x, y: z.curr.y + 2, z: z.curr.z }, { x: 0, y: -1, z: 0 }), 6, true, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, z.capsule);
  const gy = hit ? z.curr.y + 2 - hit.timeOfImpact : NaN;
  return `${z.mode}/${z.anim?.crowd ? 'crowd' : 'skin'} dy=${(z.curr.y - gy).toFixed(3)}`;
});
const ready = () => page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 }).then(() => page.evaluate(() => { window.__gp.ctx.player.godMode = true; }));
for (const t of types) for (let attempt = 0; attempt < 3; attempt++) try {
  await ready();
  await page.evaluate(([t, x, zz]) => {
    const g = window.__gp;
    g.ctx.zombies.clear();
    g.teleport(x, zz, 0);
    return g.ctx.zombies.spawn({ x, y: 0.05, z: zz - 6 }, Math.PI, t);
  }, [t, ...base]);
  await page.evaluate(() => { const g = window.__gp, z = g.ctx.zombies.list[0]; z.sense.awareness = 'detected'; z.sense.lastSeen?.copy?.(g.ctx.player.curr); g.aimAt(g.ctx.zombies.list[0].curr.x, 1.2, g.ctx.zombies.list[0].curr.z); });
  await cam(4.2, 0.9, 0.85);
  const log = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(i < 4 ? 450 : 600);
    await page.screenshot({ path: `${out}${tag}_${t}_${i}.png` });
    log.push(await info());
  }
  // feet close-up from the side, at ground level
  await cam(2.0, 0.15, 0.15);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}${tag}_${t}_feet.png` });
  await cam(4.2, 0.9, 0.6);
  await page.evaluate(() => { const g = window.__gp, z = g.ctx.zombies.list[0]; g.ctx.zombies.die(z, new g.ctx.player.curr.constructor(0, 0, -1), false); });
  for (let i = 8; i < 12; i++) {
    await page.waitForTimeout([150, 400, 800, 1500][i - 8]);
    await page.screenshot({ path: `${out}${tag}_${t}_${i}.png` });
    if (i === 11) log.push(await info());
  }
  console.log(t, log.join(' | '));
  break;
} catch (e) { console.log(t, 'retry after', String(e).slice(0, 80)); await page.waitForTimeout(3000); }
await page.evaluate(() => { window.__gp.ctx.rig.override = null; });
console.log('errors', JSON.stringify(errs.slice(0, 5)));
await browser.close();
