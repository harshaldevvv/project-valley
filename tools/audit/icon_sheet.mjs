// node tools/audit/icon_sheet.mjs <out.png> [id,id,...|new] #here   contact sheet of inventory icons on a dark tile (look at it, don't ship it).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';
const [out, which = 'all'] = process.argv.slice(2);
const ids = JSON.parse(readFileSync('public/assets/icons/index.json', 'utf8')).ids;
const list = which === 'all' ? ids : which === 'new' ? ids.slice(62) : which.split(',');
const base = pathToFileURL(resolve('public/assets/icons')).href;
const html = `<body style="margin:0;background:#1b1f22;font:11px sans-serif;color:#9aa"><div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;width:1500px">` +
  list.map((id) => `<div style="width:112px;height:112px;background:#2a3036;display:flex;flex-direction:column;align-items:center;justify-content:center"><img src="${base}/${id}.png" style="max-width:92px;max-height:80px"><span>${id}</span></div>`).join('') + '</div>';
const f = resolve(out.replace(/\.png$/, '.html'));
writeFileSync(f, html);
const b = await launch();
const p = await b.newPage({ viewport: { width: 1520, height: 900 } });
await p.goto(pathToFileURL(f).href);
await p.waitForTimeout(800);
await p.screenshot({ path: out, fullPage: true });
await b.close();
