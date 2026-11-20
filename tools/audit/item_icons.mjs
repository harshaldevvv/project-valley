// node tools/audit/item_icons.mjs [--force id,id|all] #here
// Renders 128 px inventory icons for every item that has none (public/assets/icons/<id>.png) and adds them to icons/index.json.
// Needs the dev server on :5188. Headless.
import { readFileSync, writeFileSync } from 'node:fs';
import { launch } from './browser.mjs';
const forceArg = process.argv.includes('--force') ? process.argv[process.argv.indexOf('--force') + 1] : '';
const idxPath = 'public/assets/icons/index.json';
const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
await page.goto('http://localhost:5188/tools/audit/item_icons.html');
await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
const all = await page.evaluate(() => window.itemIds);
const force = forceArg === 'all' ? all : forceArg ? forceArg.split(',') : [];
const todo = all.filter((id) => !idx.ids.includes(id) || force.includes(id));
console.log('rendering', todo.length, 'of', all.length);
for (const id of todo) {
  const r = await page.evaluate((i) => window.renderIcon(i), id);
  writeFileSync(`public/assets/icons/${id}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  if (!idx.ids.includes(id)) idx.ids.push(id);
  console.log(id, r.src, r.W + 'x' + r.H);
}
writeFileSync(idxPath, JSON.stringify(idx, null, 1) + '\n');
console.log('errors', JSON.stringify(errs.slice(0, 6)));
await browser.close();
