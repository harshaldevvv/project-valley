// Smoke test: open the game in headed Chrome, walk forward, screenshot, print the perf snapshot.
// Fails on any page error. Needs `npm run dev` running.   node tools/perf/smoke.mjs [?query]
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:5188';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1300,780'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(BASE + '/' + (process.argv[2] ?? '?play')); // ?play skips the title menu
await page.waitForFunction(() => typeof window.__perf === 'function', null, { timeout: 60_000 });
await page.waitForTimeout(3000); // warm-up: WASM tier-up, first pipelines
await page.evaluate(() => window.__perfReset());
await page.waitForTimeout(3000);
const idle = await page.evaluate(() => window.__perf());
await page.keyboard.down('KeyW');
await page.waitForTimeout(1200);
await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(1000);
await page.keyboard.up('ShiftLeft');
await page.keyboard.up('KeyW');
await page.keyboard.press('Space');
await page.waitForTimeout(2500);
mkdirSync('artifacts', { recursive: true });
await page.screenshot({ path: 'artifacts/smoke.png' });
const perf = await page.evaluate(() => window.__perf());
console.log(JSON.stringify({ idle, afterMoving: perf }, null, 1));
const pageErrors = errors.filter((e) => !e.includes('404'));
await browser.close();
if (pageErrors.length) {
  console.error('PAGE ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
