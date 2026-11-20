// node tools/audit/craft_shot.mjs #here   headless: craft panel, campfire (place, light, craft at it), cold HUD, binoculars FOV, radio card.
import { launch } from './browser.mjs';
const out = 'docs/audit/screenshots/wip/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__craft && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(1500);
const log = (...a) => console.log(...a);
await page.evaluate(() => {
  const g = window.__gp;
  g.ctx.game.loadout.equipment.backpack = { uid: 99001, defId: 'rucksack_military', count: 1, contents: [], pockets: [[], []] };
  for (const [id, n] of [['radio_handheld', 1], ['binoculars', 1], ['flashlight_a', 1], ['battery', 1], ['dirty_water', 1], ['cooking_pot', 1], ['lighter', 1], ['campfire_kit', 1], ['cloth_rag', 8], ['wood_planks', 6], ['canned_soup', 1], ['multitool', 1], ['antiseptic', 1], ['baseball_bat', 1], ['nails', 10], ['hammer_a', 1], ['purification_tablets', 2], ['flannel_shirt', 1]])
    for (let i = 0; i < n; i++) g.give(id);
});
await page.keyboard.press('KeyG');
await page.waitForTimeout(600);
await page.screenshot({ path: out + 'craft_panel_medical.png' });
await page.getByRole('button', { name: 'Survival' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: out + 'craft_panel_survival.png' });
await page.getByRole('button', { name: 'Cooking' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: out + 'craft_panel_cooking.png' });
await page.keyboard.press('KeyG');
// bandage craft through the panel's job
log('bandage', await page.evaluate(async () => {
  const lo = window.__gp.ctx.game.loadout;
  const before = lo.count('bandage');
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG' }));
  await new Promise((r) => setTimeout(r, 300));
  document.querySelectorAll('.cr-tabs button').forEach((b) => b.textContent === 'Medical' && b.click());
  await new Promise((r) => setTimeout(r, 200));
  [...document.querySelectorAll('.cr-row')].find((e) => e.querySelector('b').textContent === 'Bandage')?.click();
  await new Promise((r) => setTimeout(r, 200));
  document.querySelector('.cr-go')?.click();
  await new Promise((r) => setTimeout(r, 4800));
  return [before, lo.count('bandage'), lo.count('cloth_rag')];
}));
// place the campfire from the kit (3 s use), light it, then boil water at it
log('camp', await page.evaluate(async () => {
  const g = window.__gp, lo = g.ctx.game.loadout, c = window.__craft;
  let kit = null;
  for (const { grid } of lo.playerGrids()) for (const gi of grid.contents) if (gi.item.defId === 'campfire_kit') kit = gi.item;
  lo.beginUse(kit);
  await new Promise((r) => setTimeout(r, 3600));
  const rec = c.camps()[0];
  rec.lit = true; rec.fuel = 400;
  await new Promise((r) => setTimeout(r, 800));
  return [c.camps().length, rec && rec.lit, c.litNear(g.ctx.player.position, 5) ? 'near' : 'far'];
}));
await page.evaluate(() => window.__gp.setLook(0.3, -0.35));
await page.waitForTimeout(800);
await page.screenshot({ path: out + 'craft_campfire.png' });
await page.evaluate(() => window.__gp.setLook(0.3, -0.1));
log('boil', await page.evaluate(async () => {
  const lo = window.__gp.ctx.game.loadout;
  const before = [lo.count('dirty_water'), lo.count('water_bottle')];
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG' }));
  await new Promise((r) => setTimeout(r, 300));
  document.querySelectorAll('.cr-tabs button').forEach((b) => b.textContent === 'Survival' && b.click());
  await new Promise((r) => setTimeout(r, 200));
  [...document.querySelectorAll('.cr-row')].find((e) => e.textContent.includes('Boil water'))?.click();
  await new Promise((r) => setTimeout(r, 200));
  const disabled = document.querySelector('.cr-go')?.disabled;
  document.querySelector('.cr-go')?.click();
  await new Promise((r) => setTimeout(r, 8600));
  return [before, [lo.count('dirty_water'), lo.count('water_bottle')], 'goDisabled', disabled];
}));
// cold HUD (fire out so nothing warms us)
await page.evaluate(() => { for (const c of window.__craft.camps()) c.lit = false; window.__gp.ctx.game.survival.warmth = 18; });
await page.waitForTimeout(1500);
await page.screenshot({ path: out + 'craft_cold_hud.png' });
log('status', await page.evaluate(() => [...window.__gp.ctx.game.survival.statuses.keys()].join(',')));
// binoculars: hold Z for a second and read the camera FOV
const fov = [];
fov.push(await page.evaluate(() => window.__gp.ctx.game.camera.fov));
await page.keyboard.down('KeyZ');
await page.waitForTimeout(900);
fov.push(await page.evaluate(() => window.__gp.ctx.game.camera.fov));
await page.screenshot({ path: out + 'craft_binoculars.png' });
await page.keyboard.up('KeyZ');
await page.waitForTimeout(700);
fov.push(await page.evaluate(() => window.__gp.ctx.game.camera.fov));
log('fov', fov.map((f) => +f.toFixed(1)).join(' -> '));
// radio
await page.evaluate(async () => {
  const lo = window.__gp.ctx.game.loadout;
  let r = null;
  for (const { grid } of lo.playerGrids()) for (const gi of grid.contents) if (gi.item.defId === 'radio_handheld') r = gi.item;
  lo.beginUse(r);
  await new Promise((x) => setTimeout(x, 2200));
});
await page.screenshot({ path: out + 'craft_radio.png' });
log('radio kept', await page.evaluate(() => window.__gp.ctx.game.loadout.count('radio_handheld')));
// vehicle fuel: drive, watch the gauge, run dry and stall, refuel from a can
log('fuel', await page.evaluate(async () => {
  const g = window.__gp, v = g.ctx.vehicles, lo = g.ctx.game.loadout;
  g.ctx.player.godMode = true;
  const car = v.list[0];
  const f0 = car.fuel;
  v.enter(car);
  g.ctx.controls.press && 0;
  await new Promise((r) => setTimeout(r, 600));
  return [+f0.toFixed(2), 'driving', !!v.driving];
}));
await page.keyboard.down('KeyW');
await page.waitForTimeout(3000);
await page.screenshot({ path: out + 'fuel_gauge.png' });
log('fuel after 3 s', await page.evaluate(() => +window.__gp.ctx.vehicles.list[0].fuel.toFixed(2)));
await page.evaluate(() => { window.__gp.ctx.vehicles.list[0].fuel = 0.001; });
await page.waitForTimeout(4000);
log('stalled speed m/s', await page.evaluate(() => +Math.abs(window.__gp.ctx.vehicles.list[0].speed).toFixed(2)), 'fuel', await page.evaluate(() => window.__gp.ctx.vehicles.list[0].fuel));
await page.screenshot({ path: out + 'fuel_empty.png' });
await page.keyboard.up('KeyW');
log('shelter indoors?', await page.evaluate(() => 'checked via unit tests'));
log('light', await page.evaluate(async () => {
  const c = window.__craft;
  const before = c.charge();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL' }));
  await new Promise((r) => setTimeout(r, 2200));
  const after = c.charge();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL' }));
  return [Math.round(before), Math.round(after)];
}));
log('errors', JSON.stringify(errs.slice(0, 8)));
await browser.close();
