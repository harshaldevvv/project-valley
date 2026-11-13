import { InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { fract, instanceIndex, positionLocal, sin, time, vec3 } from 'three/tsl';
import { windGust } from '../../engine/wind';
import type { Game } from '../../core/game';
import { gltfLoader } from '../../engine/assets';
import { assetUrl } from '../../engine/assetUrl';
import { groundHeight, nearTreeSpots } from './ground';

/**
 * Hill trees near the walls: AI-made tree models (z-image-turbo picture -> Hunyuan3D -> Blender fit, about 1k tris
 * each), instanced per species. Farther trees stay in the cheap merged kit (ground.ts). A missing model just means
 * fewer trees, never an error.
 */
const SPECIES = [
  { id: 'tree_pine', weight: 0.8, height: 9 },
  { id: 'tree_birch', weight: 0.2, height: 7.5 },
  // tree_autumn.glb is shipped but unused: at 1.4k triangles its crown decimates to a dark blob
];

export async function buildAiTrees(game: Game) {
  const loaded = await Promise.all(
    SPECIES.map((sp) => gltfLoader.loadAsync(assetUrl(`assets/models/gen/${sp.id}.glb`)).then((g) => ({ sp, g })).catch(() => null)),
  );
  const buckets = loaded.filter((x): x is NonNullable<typeof x> => !!x).map((x) => ({ ...x, spots: [] as typeof nearTreeSpots }));
  if (!buckets.length) return;
  const total = buckets.reduce((a, b) => a + b.sp.weight, 0);
  for (const t of nearTreeSpots) {
    let r = t.k * total;
    for (const b of buckets) if ((r -= b.sp.weight) <= 0 || b === buckets[buckets.length - 1]) { b.spots.push(t); break; }
  }
  const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), p = new Vector3(), sc = new Vector3();
  for (const b of buckets) {
    let mesh: Mesh | null = null;
    b.g.scene.traverse((o) => { if (!mesh && (o as Mesh).isMesh) mesh = o as Mesh; });
    if (!mesh || !b.spots.length) continue;
    const src = mesh as Mesh;
    const base = src.material as MeshStandardMaterial;
    // Node material so the crown can sway in the wind (vertex shader, per-tree phase, grows with height squared)
    const mat = new MeshStandardNodeMaterial({ map: base.map, roughness: 0.9, metalness: 0, side: 2 }); // DoubleSide: open crowns
    mat.color.setRGB(0.66, 0.74, 0.66);
    const phase = fract(sin(instanceIndex.toFloat().mul(12.9898)).mul(43758.5453)).mul(6.28);
    const h = positionLocal.y.div(b.sp.height).max(0);
    const sway = sin(time.mul(1.1).add(phase)).add(sin(time.mul(2.3).add(phase.mul(1.7))).mul(0.35)).mul(h.mul(h)).mul(windGust.mul(0.2).add(0.1));
    mat.positionNode = positionLocal.add(vec3(sway, 0, sway.mul(0.45)));
    const inst = new InstancedMesh(src.geometry, mat, b.spots.length);
    inst.name = `${b.sp.id}_x${b.spots.length}`;
    b.spots.forEach((t, i) => {
      q.setFromAxisAngle(up, t.a);
      sc.setScalar(t.s);
      p.set(t.x, groundHeight(t.x, t.z) - 0.25, t.z);
      inst.setMatrixAt(i, m.compose(p, q, sc));
    });
    inst.castShadow = false; // far scenery: skip the shadow pass
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    game.scene.add(inst);
  }
}
