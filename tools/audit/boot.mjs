import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route('**/assets/models/**', async (r) => { await new Promise((x) => setTimeout(x, 700)); r.continue(); });
await page.goto('http://localhost:5188/', { waitUntil: 'commit' });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'docs/audit/screenshots/wip/50_loading.png' });
await browser.close();
