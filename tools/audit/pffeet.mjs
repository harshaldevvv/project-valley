// node tools/audit/pffeet.mjs <glb-id-prefix> [yMax=0.3]   where a Polyfork model touches the ground (0.5 m grid cells, centre-based), for hand-made colliders
import { readdirSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const f = readdirSync('public/assets/models/pf').find((x) => x.startsWith(process.argv[2]));
const d = await io.read(`public/assets/models/pf/${f}`);
const pts = [];
for (const n of d.getRoot().listNodes()) {
  const mesh = n.getMesh(); if (!mesh) continue; const W = n.getWorldMatrix();
  for (const p of mesh.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { const v = a.getElement(i, []); pts.push([W[0]*v[0]+W[4]*v[1]+W[8]*v[2]+W[12], W[1]*v[0]+W[5]*v[1]+W[9]*v[2]+W[13], W[2]*v[0]+W[6]*v[1]+W[10]*v[2]+W[14]]); } }
}
const thr = +process.argv[3] || 0.3;
const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[2]);
const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
const cells = {};
for (const p of pts.filter((p) => p[1] < thr)) { const k = (Math.round((p[0] - cx) * 2) / 2) + ',' + (Math.round((p[2] - cz) * 2) / 2); cells[k] = (cells[k] || 0) + 1; }
console.log(f, 'size', (Math.max(...xs) - Math.min(...xs)).toFixed(2), (Math.max(...zs) - Math.min(...zs)).toFixed(2), Object.entries(cells).map(([k, v]) => `${k}:${v}`).join(' '));
