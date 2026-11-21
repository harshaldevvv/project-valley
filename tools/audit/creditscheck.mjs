// node tools/audit/creditscheck.mjs   F3: every third-party file under public/assets/ is credited in CREDITS.md and
// docs/pipeline/asset-credits.md. Exit 1 and a list of misses otherwise. No browser.
//  - Polyfork catalog files (<slug>-<6 hex>.glb): CREDITS.md links polyfork.dev/asset/<slug>, asset-credits.md names the slug.
//  - Models made from a third-party base (rules below): the model id appears in both files.
//  - Stock audio: an asset-credits.md AUDIO/MUSIC/AMB row matches the file (globs *, ranges 1..4 / z01–z24), and that
//    row's source url is in CREDITS.md.
//  - AI-made files (audio/gen, textures, art, zmb_ai_*): the folder or file is named in CREDITS.md.
// Original files (icons, env_/prop_/kit_/wpn_ bpy builds, manifest) are skipped.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = 'public/assets';
const credits = readFileSync('CREDITS.md', 'utf8');
const table = readFileSync('docs/pipeline/asset-credits.md', 'utf8');
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(ROOT).map((f) => relative(ROOT, f).split(sep).join('/'));

// Models built on a third-party base: id -> must appear in both files.
const DERIVED = [/^chr\/chr_hero_pf/, /^chr\/chr_npc_/, /^zmb\/zmb_pfz?_/, /^veh\/veh_pickup_pf/, /^wpn\/wpn_(shotgun|bolt)_a\./];
const AI = [/^chr\/chr_(hero|body)_a/, /^audio\/gen\//, /^textures\//, /^art\//, /^zmb\/zmb_ai_/];
const ORIGINAL = [/^icons\//, /^models\/manifest\.json$/, /^models\/(env|prop|kit)\//, /^models\/wpn\/(?!wpn_(shotgun|bolt)_a\.)/,/^models\/item\/item_/, /^models\/veh\/veh_pickup_a/, /^models\/chr\/chr_(survivor_a|arms_fp)/, /^models\/zmb\/zmb_(shambler|soldier|worker|civilian_f)_a/];

// Parse the audio rows of asset-credits.md into [regex, url].
const audioRows = [];
for (const line of table.split('\n')) {
  const m = line.match(/^\| (AUDIO|MUSIC|AMB) ([^|]+)\|/);
  if (!m) continue;
  const cells = line.split('|').map((c) => c.trim());
  const url = cells.find((c) => /^https?:\/\//.test(c)) ?? '';
  let dir = '';
  const spec = m[2].replace(/\([^)]*\)/g, ' ');
  for (let tok of spec.split(/[,;\s]+/).filter(Boolean)) {
    if (m[1] !== 'AUDIO') tok = tok.replace(/\.ogg$/, '');
    const dm = tok.match(/^([\w-]+)\/(.*)$/);
    if (dm) { dir = dm[1]; tok = dm[2]; }
    if (!dir || !tok) continue;
    const esc = (s) => s.replace(/[.+?^${}()[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const rm = tok.match(/^(.*?)(\d+)(?:\.\.|–|-)(?:[a-z]*?)(\d+)$/i);
    let re;
    if (rm && +rm[3] > +rm[2]) {
      const w = rm[2].length, nums = [];
      for (let n = +rm[2]; n <= +rm[3]; n++) nums.push(String(n).padStart(w, '0'));
      re = `${esc(rm[1])}(${nums.join('|')})`;
    } else re = esc(tok);
    audioRows.push([new RegExp(`^${dir}/${re}$`), url]);
  }
}

const miss = [];
let checked = 0;
for (const f of files) {
  const stem = f.replace(/\.[^.]+$/, '');
  const base = stem.split('/').pop();
  if (ORIGINAL.some((r) => r.test(f))) continue;
  checked++;
  const pf = base.match(/^(.*-[0-9a-f]{6})$/);
  if (f.startsWith('models/') && pf) {
    if (!credits.includes(`polyfork.dev/asset/${pf[1]}`)) miss.push([f, 'CREDITS.md: no polyfork.dev/asset/' + pf[1]]);
    if (!table.includes(pf[1].replace(/-[0-9a-f]{6}$/, ''))) miss.push([f, 'asset-credits.md: slug not listed']);
    continue;
  }
  const mid = f.replace(/^models\//, '');
  if (DERIVED.some((r) => r.test(mid))) {
    const id = base.replace(/_parts$/, '');
    if (!credits.includes(id)) miss.push([f, `CREDITS.md: ${id} not named`]);
    if (!table.includes(id)) miss.push([f, `asset-credits.md: ${id} not named`]);
    continue;
  }
  if (AI.some((r) => r.test(f) || r.test(mid))) {
    const dir = f.split('/').slice(0, -1).join('/');
    const ok = credits.includes(`public/assets/${f}`) || credits.includes(`public/assets/${dir}/`) || credits.includes(`${base.replace(/_a$/, '')}`) || (mid.startsWith('zmb/zmb_ai_') && credits.includes('zmb_ai_*'));
    if (!ok) miss.push([f, 'CREDITS.md: AI-made file or folder not named']);
    continue;
  }
  if (f.startsWith('audio/')) {
    const key = stem.replace(/^audio\//, '');
    const row = audioRows.find(([re]) => re.test(key));
    if (!row) miss.push([f, 'asset-credits.md: no AUDIO row matches']);
    else if (row[1] && !credits.includes(row[1])) miss.push([f, `CREDITS.md: source ${row[1]} not linked`]);
    continue;
  }
  miss.push([f, 'unclassified: add a rule (original or third-party?)']);
}
for (const [f, why] of miss) console.log(`MISS ${f}  ${why}`);
console.log(`${checked} third-party/AI files checked, ${miss.length} misses`);
process.exit(miss.length ? 1 : 0);
