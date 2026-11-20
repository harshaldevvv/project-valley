// node tools/audit/scale_zmb.mjs <in.glb> <out.glb> <scale>
// Multiplies the scale of the skeleton root node (<id>_rig) of a retargeted zombie. The GPU crowd bakes bone matrices from the
// scene graph, so this scales the whole animated body (a brute is the same character, bigger) with no change to the clips.
import { NodeIO } from '@gltf-transform/core';
const [src, dst, k] = process.argv.slice(2);
const io = new NodeIO();
const doc = await io.read(src);
const k1 = Number(k);
let n = 0;
for (const node of doc.getRoot().listNodes()) {
  if (!/_rig$/.test(node.getName())) continue;
  const s = node.getScale();
  node.setScale([s[0] * k1, s[1] * k1, s[2] * k1]);
  n++;
}
if (!n) throw new Error('no <id>_rig node found');
await io.write(dst, doc);
console.log('scaled', n, 'rig node(s) by', k1);
