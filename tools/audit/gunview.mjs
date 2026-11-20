// node tools/audit/gunview.mjs out.png url1,url2   screenshot of assets/gen/polyfork/guns.html (side view top row, top view bottom row)
import { launch } from './browser.mjs';
const [out, glb] = process.argv.slice(2);
const browser = await launch();
const n = glb.split(',').length;
const page = await browser.newPage({ viewport: { width: 450 * n, height: 760 } });
page.on('pageerror', (e) => console.log(String(e).slice(0, 200)));
await page.goto('http://localhost:5188/assets/gen/polyfork/guns.html?glb=' + glb);
await page.waitForFunction(() => document.title === 'done', null, { timeout: 60000 });
await page.screenshot({ path: out });
await browser.close();
