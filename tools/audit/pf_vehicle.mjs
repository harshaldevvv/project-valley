// node tools/audit/pf_vehicle.mjs <polyfork-pickup.glb> <out.glb> <new_id>
// Converts a Polyfork car to this game's vehicle contract: front toward -Z (Polyfork faces +Z, so rotate 180 deg about Y,
// baked into the vertices), wheels as empties WHEEL_FL/FR/RL/RR at the wheel centres with the wheel mesh centred on them,
// body + doors as plain meshes, sockets driver / door_L / trunk. Vertex colours are kept.
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
const [src, dst, id] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const flip = (x, y, z) => [-x, y, -z];
const mulV = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const mulN = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
const parts = [];
const done = new Set(); // primitives of one mesh can share a vertex buffer: transform each accessor once
for (const n of root.listNodes()) {
  const mesh = n.getMesh(); if (!mesh) continue;
  const m = n.getWorldMatrix(); const name = n.getName();
  const wheel = /^wheel-(fl|fr|rl|rr)-mesh$/.exec(name);
  const c = [m[12], m[13], m[14]];
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL'); const v = [0, 0, 0];
    if (done.has(pos)) continue; done.add(pos);
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v); let w = mulV(m, v); if (wheel) w = [w[0] - c[0], w[1] - c[1], w[2] - c[2]];
      pos.setElement(i, flip(...w));
    }
    if (nor) for (let i = 0; i < nor.getCount(); i++) { nor.getElement(i, v); nor.setElement(i, flip(...mulN(m, v))); }
  }
  parts.push({ name, mesh, wheel: wheel?.[1].toUpperCase(), centre: flip(...c) });
}
for (const ch of scene.listChildren()) scene.removeChild(ch);
const top = doc.createNode(id); scene.addChild(top);
let bodyN = 0;
for (const p of parts) {
  if (p.wheel) {
    const w = doc.createNode('WHEEL_' + p.wheel).setTranslation(p.centre); top.addChild(w);
    w.addChild(doc.createNode(`${id}_WHEEL_${p.wheel}`).setMesh(p.mesh));
  } else top.addChild(doc.createNode(`${id}_body${bodyN++}`).setMesh(p.mesh));
}
for (const [n, t] of [['driver', [-0.4, 1.45, -0.55]], ['door_L', [-0.95, 1.0, -0.71]], ['trunk', [0, 0.9, 2.45]]]) top.addChild(doc.createNode('SOCKET_' + n).setTranslation(t));
await doc.transform(prune({ keepLeaves: true, keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(dst, doc);
console.log('wrote', dst, parts.map((p) => p.wheel ? `${p.wheel}@${p.centre.map((v) => v.toFixed(2))}` : p.name).join(' '));
