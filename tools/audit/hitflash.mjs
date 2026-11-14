import { mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';
const OUT = 'docs/audit/screenshots/wip'; mkdirSync(OUT, { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200))); page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true; g.sandbox(); g.spawn(3); g.teleport(40, -2, 0); g.setLook(0, -0.05); });
await page.waitForTimeout(2500);
await gp(() => { const g = window.__gp.ctx; const z = g.zombies.list[0]; const p = z.curr; const cm = g.game.camera;
  g.rig.override = () => { cm.position.set(p.x + 1.4, p.y + 1.5, p.z + 2.0); cm.lookAt(p.x, p.y + 1.0, p.z); return true; }; });
await page.waitForTimeout(400);
for (let i = 0; i < 3; i++) {
  await gp(() => { const g = window.__gp.ctx; g.zombies.list[0].flash = 0.11; });
  await page.screenshot({ path: `${OUT}/25_hitflash_${i}.png` }); await page.waitForTimeout(500);
}
console.log('errors', errs.slice(0, 5)); await browser.close();
