// node tools/audit/gunshots.mjs [weapon]   headless: equip each M4 gun, fire, reload, and take TP + FP screenshots
// docs/audit/screenshots/wip/gun_<weapon>_<fp|tp>[_ads|_fire|_reload].png ; logs ammo, rounds fired, console errors.
import { mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';
const OUT = 'docs/audit/screenshots/wip';
mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('crash', () => console.log('CRASH'));
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => (m.type() === 'error' || /audio|model/i.test(m.text())) && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.waitForTimeout(2500);
await page.mouse.click(480, 270);
await page.evaluate(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true; g.sandbox(); });
const guns = [['shotgun_a', 'primary', 'mag_shotgun_a', 0], ['bolt_a', 'primary', 'mag_bolt_a', 0], ['smg_a', 'primary', 'mag_smg_a', 0], ['revolver_a', 'sidearm', 'mag_revolver_a', 2]];
for (const [id, slotName, mag, slot] of guns) {
  if (only && only !== id) continue;
  const info = await page.evaluate(([id, slotName, mag, slot]) => {
    const w = window.__gp.ctx.weapons; const lo = w.loadout;
    const cap = { mag_shotgun_a: 6, mag_bolt_a: 5, mag_smg_a: 30, mag_revolver_a: 6 }[mag];
    const inst = { uid: 2e6 + Math.floor(Math.random() * 1e5), defId: id, count: 1, durability: 1, rounds: 1, mag: { uid: 3e6 + Math.floor(Math.random() * 1e5), defId: mag, count: 1, rounds: cap - 1 } };
    const orig = lo.equipped.bind(lo);
    lo.equipped = (s) => (s === slotName ? inst : orig(s));
    lo.takeMagazine = () => ({ uid: 4e6 + Math.floor(Math.random() * 1e5), defId: mag, count: 1, rounds: cap });
    w.select(slot === 0 ? 1 : 0); w.select(slot === 0 ? 0 : slot);
    return cap;
  }, [id, slotName, mag, slot]);
  await page.waitForTimeout(1800);
  // third person: orbit the camera to the front-right of the hero so the held gun is in view (low-ready, then raised)
  await page.evaluate(() => {
    const g = window.__gp; g.ctx.rig.mode = 'tp'; g.setLook(0, 0);
    const rig = g.ctx.rig; if (!rig.__r) rig.__r = rig.render;
    rig.render = () => {
      const p = g.ctx.player, cam = g.ctx.game.camera, y = p.yaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
      cam.position.set(p.curr.x + fx * 1.7 + rx * 1.1, p.curr.y + 1.35, p.curr.z + fz * 1.7 + rz * 1.1);
      cam.lookAt(p.curr.x + fx * 0.25, p.curr.y + 1.15, p.curr.z + fz * 0.25); cam.updateMatrixWorld(true);
    };
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/gun_${id}_tp.png` });
  await page.evaluate(() => window.__gp.mouse(2, true)); await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/gun_${id}_tp_aim.png` });
  await page.evaluate(() => { const g = window.__gp; g.mouse(2, false); g.ctx.rig.render = g.ctx.rig.__r; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const g = window.__gp; g.ctx.rig.mode = 'fp'; });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/gun_${id}_fp.png` });
  // fire
  const r0 = await page.evaluate(() => window.__gp.ctx.weapons.shotsFired);
  await page.evaluate(() => window.__gp.mouse(0, true)); await page.waitForTimeout(90);
  await page.screenshot({ path: `${OUT}/gun_${id}_fp_fire.png` });
  await page.waitForTimeout(2200); await page.evaluate(() => window.__gp.mouse(0, false));
  const r1 = await page.evaluate(() => window.__gp.ctx.weapons.shotsFired);
  await page.evaluate(() => window.__gp.mouse(2, true)); await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/gun_${id}_fp_ads.png` });
  await page.evaluate(() => window.__gp.mouse(2, false)); await page.waitForTimeout(400);
  await page.keyboard.press('r'); await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/gun_${id}_fp_reload.png` });
  await page.waitForTimeout(4200);
  const st = await page.evaluate(() => window.__gp.ctx.weapons.ammo());
  console.log(id, 'cap', info, 'shots in 2.3 s hold:', r1 - r0, 'ammo after reload', JSON.stringify(st));
}
console.log('errors', errs.slice(0, 8));
await browser.close();
