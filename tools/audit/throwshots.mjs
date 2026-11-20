// node tools/audit/throwshots.mjs [id]   headless: throw each throwable at the zombie pen, screenshots + results.
// docs/audit/screenshots/wip/throw_<id>_<aim|fly|fx1|fx2>.png ; logs zombies alive before/after, blast summary, noise events.
import { mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';
const OUT = 'docs/audit/screenshots/wip';
mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.addInitScript(() => { window.__noise = []; });
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2500);
await page.mouse.click(480, 270);
await page.evaluate(() => {
  const g = window.__gp; g.ctx.player.godMode = false; g.data.horde.passive = false; g.sandbox();
  g.ctx.game.events.on('noise', (e) => window.__noise.push(`${e.source}@${e.radius}`));
  g.teleport(0, 40, 0); g.setLook(0, -0.05);
});
await page.waitForTimeout(1500);
// zombies in the open, 12 m ahead (-Z), re-spawned before every throw
const respawn = () => page.evaluate(async () => {
  const g = window.__gp, V = g.ctx.player.curr.constructor, pc = g.ctx.player.curr;
  g.ctx.zombies.killAll?.(); g.ctx.zombies.clear?.();
  for (let i = 0; i < 8; i++) await g.ctx.zombies.spawn(new V(pc.x + ((i % 4) - 1.5) * 1.6, pc.y, pc.z - 12 - Math.floor(i / 4) * 1.6), 0);
  for (const z of g.ctx.zombies.list) { z.sense.awareness = 'unaware'; }
  g.data.horde.passive = true; // hold them still and unaware so the blast pattern is readable; flares/bottles are tested via noise events
});
for (const id of ['frag_grenade', 'molotov', 'glass_bottle', 'flare']) {
  if (only && only !== id) continue;
  await respawn();
  await page.waitForTimeout(1200);
  const pre = await page.evaluate((id) => {
    const g = window.__gp, th = g.ctx.throwables;
    g.ctx.player.hp = 100; g.ctx.player.godMode = true;
    th.sel = th.available().indexOf(id);
    g.setLook(0, -0.02);
    window.__noise.length = 0;
    return { alive: g.ctx.zombies.list.filter((z) => z.alive).length, cur: th.current(), d: g.ctx.zombies.list.length ? 12 : -1 };
  }, id);
  await page.keyboard.down('KeyN');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/throw_${id}_aim.png` });
  await page.keyboard.up('KeyN');
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/throw_${id}_fly.png` });
  await page.waitForTimeout(id === 'frag_grenade' ? 2250 : 900);
  await page.screenshot({ path: `${OUT}/throw_${id}_fx1.png` });
  await page.waitForTimeout(id === 'frag_grenade' ? 150 : id === 'molotov' ? 3000 : 1200);
  await page.screenshot({ path: `${OUT}/throw_${id}_fx2.png` });
  await page.waitForTimeout(id === 'frag_grenade' ? 300 : 100);
  await page.screenshot({ path: `${OUT}/throw_${id}_fx3.png` });
  const post = await page.evaluate(() => {
    const g = window.__gp;
    return { alive: g.ctx.zombies.list.filter((z) => z.alive).length, blast: g.ctx.throwables.lastBlast, noise: window.__noise.slice(0, 6), live: g.ctx.throwables.projectiles.length, fp: g.ctx.throwables.fires[0]?.pos.toArray().map((v) => +v.toFixed(1)), zp: g.ctx.zombies.list.filter((z) => z.alive).slice(0, 8).map((z) => z.curr.toArray().map((v) => +v.toFixed(1)).join('|')), pl: g.ctx.player.curr.toArray().map((v) => +v.toFixed(1)), fires: g.ctx.throwables.fires.length, modes: g.ctx.zombies.list.filter((z) => z.alive).map((z) => Math.round(z.hp)).join(',') };
  });
  console.log(id, 'dist', pre.d?.toFixed?.(1), 'cur', pre.cur, 'alive', pre.alive, '->', post.alive, JSON.stringify({ blast: post.blast, noise: post.noise, live: post.live, fires: post.fires, fp: post.fp, zp: post.zp, pl: post.pl }), post.modes);
  await page.waitForTimeout(2500);
}
console.log('errors', errs.slice(0, 6));
await browser.close();
