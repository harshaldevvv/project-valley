// node tools/audit/glbtree.mjs a.glb ...   print node tree (name, translation, mesh bounds, tris, material) of each GLB
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of process.argv.slice(2)) {
  const d = await io.read(f); const r = d.getRoot();
  console.log('==', f.split('/').pop(), 'mats', r.listMaterials().map(m => m.getName() + ':' + m.getBaseColorFactor().map(v => +v.toFixed(2)).join('/')).join(' '), 'tex', r.listTextures().length);
  const walk = (n, ind) => {
    let s = ind + n.getName() + ' t=' + n.getTranslation().map(v => +v.toFixed(3)) + (n.getScale().some(v => v !== 1) ? ' s=' + n.getScale().map(v => +v.toFixed(3)) : '') + (n.getRotation().some((v, i) => v !== [0, 0, 0, 1][i]) ? ' r=' + n.getRotation().map(v => +v.toFixed(3)) : '');
    const m = n.getMesh();
    if (m) for (const p of m.listPrimitives()) { const pos = p.getAttribute('POSITION'); const mn = pos.getMin([]), mx = pos.getMax([]); s += ` [mesh tris=${p.getIndices() ? p.getIndices().getCount() / 3 : pos.getCount() / 3} min=${mn.map(v => +v.toFixed(3))} max=${mx.map(v => +v.toFixed(3))} mat=${p.getMaterial()?.getName()}]`; }
    console.log(s);
    for (const c of n.listChildren()) walk(c, ind + '  ');
  };
  for (const sc of r.listScenes()) for (const n of sc.listChildren()) walk(n, '');
}
for (const f of process.argv.slice(2)) { const d = await io.read(f); for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) console.log(f.split('/').pop(), m.getName(), p.listSemantics().join(',')); }
