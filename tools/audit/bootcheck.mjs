// node tools/audit/bootcheck.mjs   headless: load ?play and print page errors / console errors for 25 s
import { launch } from './browser.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('PAGEERR', String(e.stack ?? e).slice(0, 500)));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log(m.type(), m.text().slice(0, 200)));
await page.goto('http://localhost:5188/?play');
await page.waitForTimeout(25000);
console.log('tick', await page.evaluate(() => window.__gp?.ctx.game.tick));
await browser.close();
