// node tools/audit/pfunused.mjs [--delete]  Polyfork GLBs in public/assets/models/pf that no code or data references (by base name or file id)
import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
const src = ['src/content/data/outskirts.ts', 'src/content/data/outskirts_town.ts', 'src/content/data/outskirts_outpost.ts', 'src/content/data/outskirts_fill.ts', 'src/world/outskirts/index.ts', 'src/world/outskirts/scatter.ts', 'src/content/data/pois.ts', 'src/world/yard/pfModels.ts', 'src/world/yard/genProps.ts', 'src/content/data/outfit.ts'].map((f) => readFileSync(f, 'utf8')).join('\n');
const tracked = new Set(execSync('git ls-files public/assets/models/pf').toString().split('\n').map((s) => s.split('/').pop()));
for (const f of readdirSync('public/assets/models/pf')) {
  const id = f.replace('.glb', ''), base = id.replace(/-[0-9a-f]{6}$/, '');
  if (src.includes(`'${base}'`) || src.includes(id)) continue;
  console.log(tracked.has(f) ? 'tracked-unused' : 'new-unused', f);
  if (process.argv.includes('--delete') && !tracked.has(f)) unlinkSync(`public/assets/models/pf/${f}`);
}
