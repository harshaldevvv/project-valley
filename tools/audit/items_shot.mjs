// node tools/audit/items_shot.mjs #here   headless: give many items, open the inventory, screenshot; then drop items on the ground and screenshot.
import { launch } from './browser.mjs';
const out = 'docs/audit/screenshots/wip/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(1500);
const groups = {
  1: ['rucksack_military', 'chest_rig', 'police_jacket', 'jeans', 'combat_boots', 'gloves_tactical', 'hard_hat', 'sunglasses', 'canned_chili', 'canned_peaches', 'soda_can', 'thermos', 'water_jug', 'first_aid_kit', 'tourniquet', 'antiseptic', 'adrenaline_shot', 'lighter', 'matches', 'multitool', 'battery', 'screws', 'baseball_bat', 'machete', 'fire_axe', 'tackle_box', 'first_aid_pouch', 'mag_pouch'],
};
const res = await page.evaluate((ids) => {
  const g = window.__gp;
  const lo = g.ctx.game.loadout;
  const left = [];
  for (const id of ids) { try { const r = g.give(id); if (r) left.push(id + ':' + r); } catch (e) { left.push(id + ' ERR ' + e.message); } }
  return left;
}, groups[1]);
console.log('give leftovers', JSON.stringify(res));
await page.keyboard.press('Tab');
await page.waitForTimeout(800);
await page.screenshot({ path: out + 'items_inventory.png' });
await page.keyboard.press('Tab');
// ground pickups: lay items in a grid in front of the player (yaw 0 faces -z)
await page.evaluate(() => {
  const g = window.__gp;
  const lo = g.ctx.game.loadout;
  const p = g.ctx.player.position;
  const ids = ['apple', 'bread_loaf', 'chocolate_bar', 'soda_can', 'first_aid_kit', 'water_jug', 'jerrycan', 'compass', 'daypack', 'duffel_bag', 'messenger_bag', 'bike_helmet', 'riot_helmet', 'radio_handheld', 'fire_axe', 'tackle_box', 'canned_chili', 'crackers', 'dirty_water', 'tourniquet', 'jeans', 'combat_boots', 'rucksack_military', 'battery'];
  g.setLook(0, -0.9);
  ids.forEach((id, i) => lo.pickups.push({ item: { uid: 9000 + i, defId: id, count: 1 }, x: p.x + (i % 6) * 0.55 - 1.4, y: p.y, z: p.z - 1.3 - Math.floor(i / 6) * 0.55 }));
  lo.changed();
});
await page.waitForTimeout(2500);
await page.screenshot({ path: out + 'items_ground.png' });
console.log('errors', JSON.stringify(errs.slice(0, 8)));
await browser.close();
