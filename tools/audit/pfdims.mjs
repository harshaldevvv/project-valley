// node tools/audit/pfdims.mjs <id-prefix> ...   native bounding-box size (w x h x d) of Polyfork GLBs in public/assets/models/pf
import { readdirSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await MeshoptDecoder.ready;
const dir = 'public/assets/models/pf';
const pre = process.argv.slice(2);
for (const f of readdirSync(dir).filter((f) => !pre.length || pre.some((p) => f.startsWith(p)))) {
  const d = await io.read(`${dir}/${f}`);
  const b = getBounds(d.getRoot().getDefaultScene() ?? d.getRoot().listScenes()[0]);
  const s = [0, 1, 2].map((i) => +(b.max[i] - b.min[i]).toFixed(2));
  console.log(f.replace('.glb', '').padEnd(40), `${s[0]} x ${s[1]} x ${s[2]}`, ' ymin', +b.min[1].toFixed(2));
}
