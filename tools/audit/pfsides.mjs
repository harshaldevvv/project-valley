// node tools/audit/pfsides.mjs <id-prefix>  mean vertex colour (linear luma) of the +Z half versus the -Z half, and overall, to tell a model's front from its back
import { readdirSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const pre of process.argv.slice(2)) {
  const f = readdirSync('public/assets/models/pf').find((x) => x.startsWith(pre));
  const d = await io.read(`public/assets/models/pf/${f}`);
  const acc = { pos: [0, 0], neg: [0, 0], all: [0, 0] };
  const zs = [];
  for (const n of d.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue; const W = n.getWorldMatrix(); for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { const v = a.getElement(i, []); zs.push(W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14]); } } }
  const zc = (Math.min(...zs) + Math.max(...zs)) / 2;
  let k = 0;
  for (const n of d.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue; for (const p of m.listPrimitives()) { const c = p.getAttribute('COLOR_0'); if (!c) continue; for (let i = 0; i < c.getCount(); i++, k++) { const e = c.getElement(i, []); const l = 0.2126 * e[0] + 0.7152 * e[1] + 0.0722 * e[2]; const side = zs[k] > zc ? acc.pos : acc.neg; side[0] += l; side[1]++; acc.all[0] += l; acc.all[1]++; } } }
  const mean = (a) => (a[0] / Math.max(1, a[1])).toFixed(3);
  console.log(f, 'luma +Z', mean(acc.pos), '-Z', mean(acc.neg), 'all', mean(acc.all));
}
