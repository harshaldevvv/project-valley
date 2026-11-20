// node tools/audit/pfmirror.mjs   lists Polyfork GLBs whose mesh nodes have a negative-determinant world matrix (mirrored: winding flips when baked)
import { readdirSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of readdirSync('public/assets/models/pf')) {
  const d = await io.read(`public/assets/models/pf/${f}`);
  const bad = d.getRoot().listNodes().filter((n) => n.getMesh()).filter((n) => { const m = n.getWorldMatrix(); const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]); return det < 0; });
  if (bad.length) console.log(f, bad.length, 'mirrored mesh nodes');
}
