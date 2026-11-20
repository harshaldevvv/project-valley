import { InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { fract, instanceIndex, positionLocal, sin, time, vec3 } from 'three/tsl';
import type { Game } from '../../core/game';
import { windGust } from '../../engine/wind';
import { pfWorldMaterial } from '../../engine/palette';
import { groundHeight, nearTreeSpots } from './ground';
import { loadPfGeometry, PF } from './pfModels';

/**
 * Hill and wall trees: Polyfork low-poly trees (CC BY 4.0, see pfModels.ts), instanced per species, swaying in the
 * shared wind gust. Farther trees stay in the cheap merged kit (ground.ts). A missing model just means fewer trees.
 * (File kept under its old name; the trees used to be locally AI-generated.)
 */
const SPECIES = [
  { id: 'tree_pine', weight: 0.4 },
  { id: 'tree_pine_young', weight: 0.25 },
  { id: 'tree_birch', weight: 0.15 },
  { id: 'tree_oak', weight: 0.2 },
];

export async function buildAiTrees(game: Game) {
  const loaded = await Promise.all(SPECIES.map((sp) => loadPfGeometry(sp.id).then((g) => (g ? { sp, g } : null))));
  const buckets = loaded.filter((x): x is NonNullable<typeof x> => !!x).map((x) => ({ ...x, spots: [] as typeof nearTreeSpots }));
  if (!buckets.length) return;
  const total = buckets.reduce((a, b) => a + b.sp.weight, 0);
  for (const t of nearTreeSpots) {
    let r = t.k * total;
    for (const b of buckets) if ((r -= b.sp.weight) <= 0 || b === buckets[buckets.length - 1]) { b.spots.push(t); break; }
  }
  const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), p = new Vector3(), sc = new Vector3();
  for (const b of buckets) {
    if (!b.spots.length) continue;
    const mat = (await pfWorldMaterial()).clone() as MeshStandardNodeMaterial; // same detail look; own clone for the sway
    const phase = fract(sin(instanceIndex.toFloat().mul(12.9898)).mul(43758.5453)).mul(6.28);
    const h = positionLocal.y.div(PF[b.sp.id].h).max(0);
    const sway = sin(time.mul(1.1).add(phase)).add(sin(time.mul(2.3).add(phase.mul(1.7))).mul(0.35)).mul(h.mul(h)).mul(windGust.mul(0.2).add(0.1));
    mat.positionNode = positionLocal.add(vec3(sway, 0, sway.mul(0.45)));
    // 90 m cells so the cull system (outskirts/cull.ts) can drop far groves; one draw per species per cell
    const cells = new Map<string, typeof nearTreeSpots>();
    for (const t of b.spots) { const k = `${Math.floor(t.x / 90)},${Math.floor(t.z / 90)}`; (cells.get(k) ?? cells.set(k, []).get(k)!).push(t); }
    for (const [ck, list] of cells) {
      const inst = new InstancedMesh(b.g.geo, mat, list.length);
      inst.name = `treecell_${b.sp.id}_${ck}`;
      list.forEach((t, i) => {
        q.setFromAxisAngle(up, t.a);
        sc.setScalar(t.s);
        p.set(t.x, groundHeight(t.x, t.z) - 0.1, t.z);
        inst.setMatrixAt(i, m.compose(p, q, sc));
      });
      inst.castShadow = false; // far scenery: skip the shadow pass
      inst.receiveShadow = true;
      inst.computeBoundingSphere();
      game.scene.add(inst);
    }
  }
}
