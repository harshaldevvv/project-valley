import { Box3, BufferGeometry, Mesh, Object3D, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gltfLoader } from '../../engine/assets';
import { assetUrl } from '../../engine/assetUrl';

/**
 * Models from the Polyfork catalog (https://polyfork.dev, free low-poly GLBs). We use the CC BY 4.0 option of their
 * licence and credit every model in CREDITS.md. Each is one flat-shaded vertex-coloured material, authored by hand,
 * so there is nothing to retexture. `h` is the target height in metres: the loader rescales the model to it and
 * puts the base centre at the origin. Local AI 3D generation is no longer used for anything complex (see the
 * progress log of 2026-11-13).
 */
export const PF: Record<string, { file: string; h: number }> = {
  tent_military: { file: 'camp-tent-3c5c89', h: 2.4 },
  generator: { file: 'site-generator-298792', h: 1.0 },
  sandbag_wall: { file: 'sandbag-wall-section-7075ee', h: 1.0 },
  barrels: { file: 'fuel-drum-d65fa4', h: 0.95 },
  wreck_sedan: { file: 'boxy-sedan-70s-7d55f7', h: 1.5 },
  dumpster: { file: 'construction-dumpster-2de7ae', h: 1.4 },
  pallet_stack: { file: 'material-pallet-6af263', h: 1.0 },
  dead_tree: { file: 'dead-tree-6795fa', h: 5 },
  burned_van: { file: 'delivery-truck-a9537e', h: 2.9 },
  shipping_container: { file: 'cargo-container-fd73bc', h: 2.6 },
  watchtower: { file: 'fire-lookout-tower-714fa1', h: 8 },
  tire_pile: { file: 'tyre-stack-ad4692', h: 1.1 },
  crate_stack: { file: 'ammo-crate-ee3ec0', h: 0.6 },
  campfire: { file: 'campfire-4390aa', h: 0.5 },
  sofa_junk: { file: 'sofa-9c0e7e', h: 0.9 },
  bush_overgrown: { file: 'bush-8bb596', h: 1.2 },
  barn: { file: 'alpine-hay-barn-3965e5', h: 8 },
  ruined_house: { file: 'gabled-farmhouse-c7534f', h: 7 },
  gas_station: { file: 'fuel-depot-e57cdc', h: 5 },
  small_church: { file: 'clapboard-church-03a6f5', h: 12 },
  water_tower: { file: 'brass-water-tower-b0c6d9', h: 18 },
  farm_silo: { file: 'grain-silo-58ca67', h: 11 },
  tree_pine: { file: 'tall-pine-tree-ab4108', h: 10 },
  tree_pine_young: { file: 'young-pine-0d7695', h: 6 },
  tree_birch: { file: 'birch-tree-181b33', h: 7.5 },
  tree_oak: { file: 'oak-tree-50ee7c', h: 8 },
};
export const pfUrl = (file: string) => assetUrl(`assets/models/pf/${file}.glb`);
export const pfFiles = Object.values(PF).map((p) => p.file);

/** Scene rescaled to the key's height, base centre at the origin. Null if the file is missing. */
export async function loadPf(key: string): Promise<Object3D | null> {
  const def = PF[key];
  if (!def) return null;
  try {
    const g = await gltfLoader.loadAsync(pfUrl(def.file));
    const o = g.scene;
    o.updateMatrixWorld(true);
    const b = new Box3().setFromObject(o);
    const sz = b.getSize(new Vector3());
    const k = def.h / Math.max(sz.y, 1e-3);
    const holder = new Object3D();
    o.scale.multiplyScalar(k);
    o.position.set(-((b.min.x + b.max.x) / 2) * k, -b.min.y * k, -((b.min.z + b.max.z) / 2) * k);
    holder.add(o);
    holder.updateMatrixWorld(true);
    holder.name = def.file;
    return holder;
  } catch (e) {
    console.warn(`polyfork model ${def.file} failed to load`, e);
    return null;
  }
}

/** One merged geometry (world transforms baked, float positions) of a normalised model, for instancing. */
export async function loadPfGeometry(key: string): Promise<{ geo: BufferGeometry; mesh: Mesh } | null> {
  const o = await loadPf(key);
  if (!o) return null;
  const geos: BufferGeometry[] = [];
  let first: Mesh | null = null;
  o.traverse((c) => {
    const m = c as Mesh;
    if (!m.isMesh) return;
    first ??= m;
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(n)) g.deleteAttribute(n);
    if (g.index) { const ni = g.toNonIndexed(); g.dispose(); geos.push(ni); } else geos.push(g);
  });
  if (!geos.length || !first) return null;
  // all parts must have the same attributes to merge
  const names = Object.keys(geos[0].attributes);
  for (const g of geos) for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
  const merged = mergeGeometries(geos, false);
  return merged ? { geo: merged, mesh: first } : null;
}
