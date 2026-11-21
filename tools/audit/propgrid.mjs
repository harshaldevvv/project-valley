// node tools/audit/propgrid.mjs key[,key...] [cell=0.25]   (cell 0 = sizes only)   headless: top-down ASCII occupancy of Polyfork models in their own frame
// (+x right, +z down the page = the model's front), triangles between 0.15 and 1.3 m. For writing `boxes` colliders.
// Needs the dev server on 5188 (loads models only, no game boot).
import { launch } from './browser.mjs';
const keys = process.argv[2].split(','), cell = +(process.argv[3] ?? 0.25);
const browser = await launch();
const page = await browser.newPage();
await page.goto('http://localhost:5188/');
const r = await page.evaluate(async ([keys, cell]) => {
  const { loadPfm } = await import('/src/world/outskirts/models.ts');
  const out = [];
  for (const k of keys) {
    const m = await loadPfm(k);
    if (!m) { out.push(`${k}: missing`); continue; }
    if (!cell) { out.push(`${k.padEnd(28)} ${m.size.x.toFixed(2)} x ${m.size.y.toFixed(2)} x ${m.size.z.toFixed(2)}`); continue; }
    const pos = m.geo.getAttribute('position').array, hx = m.size.x / 2, hz = m.size.z / 2;
    const W = Math.ceil((2 * hx) / cell), D = Math.ceil((2 * hz) / cell), g = Array.from({ length: D }, () => Array(W).fill('.'));
    for (let i = 0; i < pos.length; i += 9) for (const [a, b, c] of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1 / 3, 1 / 3, 1 / 3], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]]) {
      const x = a * pos[i] + b * pos[i + 3] + c * pos[i + 6], y = a * pos[i + 1] + b * pos[i + 4] + c * pos[i + 7], z = a * pos[i + 2] + b * pos[i + 5] + c * pos[i + 8];
      if (y < 0.15 || y > 1.3) continue;
      const ix = Math.min(W - 1, Math.floor((x + hx) / cell)), iz = Math.min(D - 1, Math.floor((z + hz) / cell));
      g[iz][ix] = '#';
    }
    out.push(`${k}: size ${m.size.x.toFixed(2)} x ${m.size.y.toFixed(2)} x ${m.size.z.toFixed(2)}; x from ${(-hx).toFixed(2)}, z from ${(-hz).toFixed(2)}, cell ${cell}\n` + g.map((row) => row.join('')).join('\n'));
  }
  return out.join('\n\n');
}, [keys, cell]);
console.log(r);
await browser.close();
