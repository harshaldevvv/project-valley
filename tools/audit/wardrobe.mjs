// node tools/audit/wardrobe.mjs <tag> <view> <clip> <part:tint,part:tint,...>   screenshot of the hero wearing the listed parts
import { launch } from './browser.mjs';
const [tag, view = 'three', clip = 'idle', parts = ''] = process.argv.slice(2);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 300)));
await page.goto('http://localhost:5188/viewer.html?model=chr_hero_a');
await page.waitForFunction(() => window.__viewer?.ready, null, { timeout: 90000 });
for (const p of parts.split(',').filter(Boolean)) await page.evaluate((p) => window.__viewer.wear(p), p);
await page.evaluate(([c, v]) => { window.__viewer.cam(v); window.__viewer.play(c, 0); }, [clip, view]);
await page.waitForTimeout(800); await page.evaluate(() => window.__viewer.setTime(0.5)); await page.waitForTimeout(300);
await page.screenshot({ path: `docs/audit/screenshots/wip/${tag}.png`, clip: { x: 300, y: 0, width: 800, height: 760 } });
console.log(JSON.stringify(await page.evaluate(() => window.__viewer.outfit)), 'errors', errs); await browser.close();
