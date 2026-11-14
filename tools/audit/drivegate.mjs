import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
const res = [];
for (const x of [-6, 0, 6]) {
  await gp((x) => { const g = window.__gp.ctx; g.player.godMode = true; const v = g.vehicles.list[0]; const R = window.game.phys.R; v.body.setTranslation({ x, y: 1.2, z: 70 }, true); v.body.setRotation({ x: 0, y: 1, z: 0, w: 0 }, true); v.body.setLinvel({ x: 0, y: 0, z: 0 }, true); v.body.setAngvel({ x: 0, y: 0, z: 0 }, true); }, x);
  await page.waitForTimeout(1500); await gp(() => { const g = window.__gp.ctx; const v = g.vehicles.list[0]; g.player.teleport(v.doorPos.clone().setY(v.currPos.y + 0.1), 0); });
  await page.waitForTimeout(800); await page.keyboard.press('KeyF'); await page.waitForTimeout(700);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(6500); await page.keyboard.up('KeyW');
  res.push([x, await gp(() => { const v = window.__gp.ctx.vehicles.list[0]; return [window.__gp.ctx.player.inVehicle, +v.currPos.x.toFixed(1), +v.currPos.z.toFixed(1), +(v.speed * 3.6).toFixed(0)]; })]);
  await page.keyboard.press('KeyF'); await page.waitForTimeout(500);
}
console.log(JSON.stringify(res), 'errors', errs); await browser.close();
