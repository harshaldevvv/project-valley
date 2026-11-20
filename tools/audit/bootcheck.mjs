// node tools/audit/bootcheck.mjs [query]   headless boot: every console error/warning (deduped) after 12 s of play
import { launch } from './browser.mjs';
const [query = ''] = process.argv.slice(2);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const msgs = new Map();
page.on('pageerror', (e) => msgs.set('PAGEERROR ' + String(e).slice(0, 220), 1));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && msgs.set(m.type() + ' ' + m.text().slice(0, 220), 1));
await page.goto('http://localhost:5188/?play' + (query ? '&' + query : ''));
await page.waitForFunction(() => window.__gp && window.__gp.ctx.game.tick > 30, null, { timeout: 180000 });
await page.mouse.click(640, 360);
await page.waitForTimeout(12000);
console.log([...msgs.keys()].join('\n'));
await browser.close();
