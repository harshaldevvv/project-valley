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
await gp(() => { window.__gp.ctx.player.godMode = true; window.__gp.teleport(-20, 40, 0); window.__gp.setLook(0, -0.12); });
await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
for (let i = 0; i < 4; i++) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/80_sprint_${i}.png` }); }
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
console.log('errors', errs.slice(0, 5)); await browser.close();
