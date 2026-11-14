import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push((e.stack || String(e)).slice(0, 300))); page.on('console', m => (m.type() === 'error') && errs.push(m.text().slice(0, 300)));
await page.goto('http://localhost:5188/?play&webgl');
try { await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 90000 }); } catch { console.log('did not boot'); }
await page.waitForTimeout(3000);
await page.screenshot({ path: 'docs/audit/screenshots/wip/95_webgl.png' });
console.log('backend', await page.evaluate(() => window.game?.backend), 'errors', JSON.stringify(errs.slice(0, 5)));
await browser.close();
