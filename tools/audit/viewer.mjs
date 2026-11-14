// node tools/audit/viewer.mjs <model> <clip,clip,...> [view] [tag]   screenshots of the viewer, headless
import { launch } from './browser.mjs';
const [model = 'chr_survivor_a', clipsArg = 'idle', view = 'three', tag = 'v'] = process.argv.slice(2);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200))); page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto(`http://localhost:5188/viewer.html?model=${model}`);
await page.waitForFunction(() => window.__viewer?.ready, null, { timeout: 90000 });
if (process.env.HOLD) { await page.evaluate((h) => window.__viewer.attach('hand_R', h), process.env.HOLD); await page.waitForTimeout(800); }
const out = [];
for (const c of clipsArg.split(',')) {
  await page.evaluate(([c]) => { window.__viewer.play(c, 0); }, [c]);
  await page.waitForTimeout(500);
  const t = await page.evaluate(() => 0.5); await page.evaluate((t) => window.__viewer.setTime(t), t); await page.waitForTimeout(200);
  await page.evaluate(([v]) => window.__viewer.cam(v), [view]); await page.waitForTimeout(250);
  const f = `docs/audit/screenshots/wip/${tag}_${c}.png`; await page.screenshot({ path: f, clip: { x: 300, y: 0, width: 800, height: 760 } }); out.push(f);
}
console.log(JSON.stringify(await page.evaluate(() => window.__viewer.clips)).slice(0, 400)); console.log('errors', errs); await browser.close();
