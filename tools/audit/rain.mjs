import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const OUT = 'docs/audit/screenshots/wip'; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1300,780'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push((e.stack || String(e)).slice(0, 300))); page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play&gputime');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2000); await page.mouse.click(640, 360);
const gp = (f, a) => page.evaluate(f, a);
await gp(() => { window.__gp.ctx.player.godMode = true; window.__gp.teleport(-17, 2, Math.PI); window.__gp.setLook(Math.PI, -0.1); });
await page.waitForTimeout(800); await page.screenshot({ path: `${OUT}/97_dry.png` });
await gp(() => { window.__weather.override = true; });
await page.waitForTimeout(14000); await page.screenshot({ path: `${OUT}/98_rain.png` });
const ms = []; for (let i = 0; i < 6; i++) { ms.push(+(await gp(() => window.__gp.ctx.game.perf.extra.gpuMs ?? 0))); await page.waitForTimeout(300); }
console.log('gpu ms rain', ms.join(','), 'errors', errs.slice(0, 3)); await browser.close();
