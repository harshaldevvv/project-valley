// node tools/audit/pickupshots.mjs [id,id,...] #here   headless: drop items in a row in front of the player and screenshot them
// from above-front, to check pickup models (E4: size, orientation, no grey placeholder box). Default: the E4 batch.
// docs/audit/screenshots/wip/pickups_<n>.png (8 items per shot, labelled in the log left to right). Exit 1 on console errors.
import { mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';

const OUT = 'docs/audit/screenshots/wip';
mkdirSync(OUT, { recursive: true });
// NEAR=1: closer, zoomed row for small items (0.75 m ahead, 0.11 m apart, steeper look, FP fov 24)
const NEAR = !!process.env.NEAR;
const IDS = (process.argv[2] ?? 'wrench,tarp,cash,rope,copper_wire,note_camp_diary,earmuffs,campfire_kit,torch,spear,scope_4x,ammo_tin,glass_bottle,molotov,medkit,fuel_can,repair_kit').split(',');
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text().slice(0, 300)));
await page.goto(process.env.URL ?? 'http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30 && window.__gp.ctx.game.loadout, null, { timeout: 240000 });
await page.waitForTimeout(2000);
await page.evaluate(async (NEAR) => {
  const live = (f) => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.split('?')[0].endsWith(f)).pop() ?? f;
  window.__newItem = (await import(live('/src/systems/inventory.ts'))).newItem;
  const g = window.__gp;
  g.ctx.player.godMode = true;
  g.data.horde.passive = true;
  g.teleport(0, 40, 0);
  g.setLook(0, NEAR ? -1.2 : -0.95);
  if (NEAR) g.data.cameraFeel.fovFp = 24; // zoomed in to judge small items
  g.ctx.rig.mode = 'fp';
  g.ctx.weapons.select(3);
}, NEAR);
for (let s = 0; s * 8 < IDS.length; s++) {
  const batch = IDS.slice(s * 8, s * 8 + 8);
  await page.evaluate(([batch, NEAR]) => {
    const g = window.__gp, lo = g.ctx.game.loadout, p = g.ctx.player.curr;
    for (const pk of [...lo.pickups]) lo.pickups.splice(lo.pickups.indexOf(pk), 1);
    // a row 1.3 m ahead of the player (facing -Z), 0.3 m apart, left to right
    const [gap, dist] = NEAR ? [0.11, 0.75] : [0.3, 1.3];
    batch.forEach((id, i) => lo.pickups.push({ item: window.__newItem(id), x: p.x - 3.5 * gap + i * gap, y: p.y, z: p.z - dist }));
    g.ctx.game.events.emit('inventoryChanged', {});
  }, [batch, NEAR]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/pickups_${NEAR ? 'near_' : ''}${s + 1}.png` });
  console.log(`pickups_${NEAR ? 'near_' : ''}${s + 1}.png: ${batch.join(', ')}`);
}
console.log(errs.length ? `errors: ${errs.slice(0, 5).join(' | ')}` : 'no console errors');
await browser.close();
process.exit(errs.length ? 1 : 0);
