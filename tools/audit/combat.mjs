import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const OUT = 'docs/audit/screenshots/wip'; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1300,780'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push((e.stack || String(e)).slice(0, 400))); page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = false; g.sandbox(); g.spawn(10); g.teleport(40, -2.5, 0); g.setLook(0, -0.05); });
await page.waitForTimeout(3000);
for (let i = 0; i < 24; i++) {
  await gp(() => { const w = window.__gp.ctx.weapons; if (w.item?.mag && w.item.mag.rounds < 3) w.item.mag.rounds = 30; window.__gp.faceZombie(1.4); window.__gp.mouse(0, true); });
  await page.waitForTimeout(110); await gp(() => window.__gp.mouse(0, false));
  if (i % 4 === 2) await page.screenshot({ path: `${OUT}/60_combat_${i}.png` });
}
console.log('kills', await gp(() => window.__gp.ctx.zombies.kills), 'errors', errs.slice(0, 5)); await browser.close();
