// Builds public/assets/textures/palette.png from src/content/data/palette.json.
// Each swatch: 16x16 px vertical gradient top->bottom. Unused slots are mid-grey.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';

const pal = JSON.parse(readFileSync('src/content/data/palette.json', 'utf8'));
const { size, grid, swatches } = pal;
const cell = size / grid;
if (swatches.length > grid * grid) throw new Error(`palette has ${swatches.length} swatches, max ${grid * grid}`);
const names = new Set();
for (const s of swatches) {
  if (names.has(s.name)) throw new Error(`duplicate swatch name ${s.name}`);
  names.add(s.name);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const png = new PNG({ width: size, height: size });
for (let idx = 0; idx < grid * grid; idx++) {
  const s = swatches[idx] ?? { top: '#808080', bottom: '#808080' };
  const [a, b] = [hex(s.top), hex(s.bottom)];
  const col = idx % grid;
  const row = Math.floor(idx / grid);
  for (let y = 0; y < cell; y++) {
    const t = y / (cell - 1);
    for (let x = 0; x < cell; x++) {
      const o = ((row * cell + y) * size + col * cell + x) * 4;
      for (let c = 0; c < 3; c++) png.data[o + c] = Math.round(a[c] + (b[c] - a[c]) * t);
      png.data[o + 3] = 255;
    }
  }
}
mkdirSync('public/assets/textures', { recursive: true });
writeFileSync('public/assets/textures/palette.png', PNG.sync.write(png));
console.log(`palette.png: ${swatches.length}/${grid * grid} swatches`);
