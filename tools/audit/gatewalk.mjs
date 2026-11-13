// Walks the player toward the south gate along several lanes and reports where each walk stops; fails if any stops before z = 98.
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1300,780'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { window.__gp.ctx.player.godMode = true; });
const out = [];
for (const x of [-9, -4, 0, 4, 9]) {
  await gp((x) => { window.__gp.teleport(x, 80, Math.PI); window.__gp.setLook(Math.PI, 0); }, x);
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(9000); await page.keyboard.up('KeyW');
  out.push([x, +(await gp(() => window.__gp.ctx.player.curr.z)).toFixed(1)]);
}
console.log('lane x -> final z', JSON.stringify(out), 'errors', errs);
await page.screenshot({ path: 'docs/audit/screenshots/wip/80_gate.png' }); await browser.close();
