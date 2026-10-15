// Builds 3D assets: runs each assets/source/<category>/<id>/build.py in headless Blender,
// then optimizes the GLB (dedup, prune, quantize, meshopt) and updates the manifest.
//
//   npm run assets:build                 # all assets
//   npm run assets:build -- prop_crate   # ids containing "prop_crate"
//
// BLENDER_BIN overrides the Blender path.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const BLENDER = process.env.BLENDER_BIN ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const filter = process.argv[2] ?? '';
const MANIFEST = 'public/assets/models/manifest.json';

// Art bible LOD0 triangle ceilings by id prefix (upper end of each range).
const BUDGET = { prop: 1200, bld: 12000, veh: 10000, wpn: 6000, chr: 8000, zmb: 4000, tree: 2000, kit: 2000 };

const sources = [];
for (const cat of readdirSync('assets/source')) {
  for (const id of readdirSync(join('assets/source', cat))) {
    const script = join('assets/source', cat, id, 'build.py');
    if (existsSync(script) && id.includes(filter)) sources.push({ id, script });
  }
}
if (!sources.length) throw new Error(`no assets match "${filter}"`);

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const built = {};
let failed = 0;
for (const { id, script } of sources) {
  const out = execFileSync(BLENDER, ['--background', '--python', script], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const line = out.split('\n').find((l) => l.startsWith('ASSET_REPORT '));
  if (!line) {
    console.error(out.slice(-3000));
    throw new Error(`${id}: Blender build failed`);
  }
  const report = JSON.parse(line.slice('ASSET_REPORT '.length));
  const raw = statSync(report.glb).size;

  const doc = await io.read(report.glb);
  // keepAttributes: UVs look unused (no texture in the GLB) but the runtime palette material needs them.
  await doc.transform(dedup(), prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(report.glb, doc);
  const size = statSync(report.glb).size;

  const lod0 = report.tris[`${id}_LOD0`];
  const budget = BUDGET[id.split('_')[0]];
  const over = budget && lod0 > budget;
  if (over) failed++;
  built[id] = { url: '/' + report.glb.replace(/^public\//, ''), category: report.category, tris: report.tris, bytes: size };
  console.log(`${over ? 'OVER BUDGET' : 'ok'}  ${id}  LOD0 ${lod0} tris${budget ? ` / ${budget}` : ''}  ${(raw / 1024).toFixed(0)} KB -> ${(size / 1024).toFixed(0)} KB`);
}
// Re-read right before writing: several asset builders may run in parallel (merge, don't clobber).
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
Object.assign(manifest, built);
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
if (failed) process.exit(1);
