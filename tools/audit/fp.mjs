import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const OUT = 'docs/audit/screenshots/wip'; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1300,780'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200))); page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { const g = window.__gp; g.ctx.player.godMode = true; g.data.horde.passive = true; g.sandbox(); g.spawn(6); g.teleport(40, 2, 0); g.setLook(0, -0.02); });
await page.keyboard.press('KeyT'); await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/26_fp_idle.png` });
for (let i = 0; i < 10; i++) { await gp(() => { window.__gp.faceZombie(1.4); window.__gp.mouse(0, true); }); await page.waitForTimeout(90); if (i % 3 === 1) await page.screenshot({ path: `${OUT}/27_fp_fire_${i}.png` }); await gp(() => window.__gp.mouse(0, false)); }
console.log('errors', errs.slice(0, 5)); await browser.close();
