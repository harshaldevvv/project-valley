import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const d = await io.read(f); const r = d.getRoot();
  const sk = r.listSkins()[0];
  console.log('==', f.split('/').pop(), 'meshes', r.listMeshes().length, 'skins', r.listSkins().length, 'anims', r.listAnimations().map(a => a.getName()).join(','), 'mats', r.listMaterials().length, 'tex', r.listTextures().length);
  if (sk) console.log('  joints', sk.listJoints().map(j => j.getName()).join(' '));
}
