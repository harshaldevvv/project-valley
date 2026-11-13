import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage({ viewport: { width: 1800, height: 600 } });
page.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
await page.goto('http://localhost:5188/assets/gen/polyfork/view.html');
await page.waitForFunction(() => window.__done, null, { timeout: 60000 });
console.log(JSON.stringify(await page.evaluate(() => window.__info)));
await page.screenshot({ path: process.argv[2] ?? 'docs/audit/screenshots/wip/pf.png' }); await browser.close();
