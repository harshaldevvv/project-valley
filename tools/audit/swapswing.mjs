// Starts a knife swing and swaps to the rifle in the same instant: used to throw "reading 'active'" every sim step.
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push((e.message || String(e)).slice(0, 120)));
await page.goto('http://localhost:5188/?play');
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 120000 });
await page.waitForTimeout(2500); await page.mouse.click(640, 360);
await page.evaluate(() => window.__gp.mouse(0, true)); await page.waitForTimeout(60); await page.evaluate(() => { window.__gp.sandbox(); window.__gp.mouse(0, false); });
await page.waitForTimeout(2500);
console.log('errors', errs.length, errs.slice(0, 2)); await browser.close();
