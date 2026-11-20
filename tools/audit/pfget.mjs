// node tools/audit/pfget.mjs <base-name> ...   downloads Polyfork catalog GLBs (CC BY 4.0) into public/assets/models/pf and prints id, tris, page.
// Looks the base name up in the cached catalog D:/AI3D/polyfork/catalog.json (a trailing -xxxxxx hash is accepted too).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const cat = JSON.parse(readFileSync('D:/AI3D/polyfork/catalog.json', 'utf8')).assets;
for (const n of process.argv.slice(2)) {
  const a = cat.find((x) => x.id === n) ?? cat.find((x) => x.id.replace(/-[0-9a-f]{6}$/, '') === n);
  if (!a) { console.log('MISSING', n); continue; }
  const out = `public/assets/models/pf/${a.id}.glb`;
  if (!existsSync(out)) writeFileSync(out, Buffer.from(await (await fetch(a.glb)).arrayBuffer()));
  console.log(`${a.id}\t${a.triangles}\t${a.title}\t${a.page}`);
}
