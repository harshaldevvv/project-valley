// node tools/audit/addmodel.mjs <in.glb> <id> <category> <tris0,tris1,tris2>   copies the GLB into public/assets/models and registers it in the manifest
import { copyFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
const [src, id, cat, tris] = process.argv.slice(2);
const dst = `public/assets/models/${cat}/${id}.glb`;
copyFileSync(src, dst);
const mf = 'public/assets/models/manifest.json';
const m = JSON.parse(readFileSync(mf, 'utf8'));
const t = tris.split(',').map(Number);
m[id] = { url: `/assets/models/${cat}/${id}.glb`, category: cat, tris: Object.fromEntries(t.map((n, i) => [`${id}_LOD${i}`, n])), bytes: statSync(dst).size };
writeFileSync(mf, JSON.stringify(m, null, 2) + '\n');
console.log('registered', id, m[id].bytes);
