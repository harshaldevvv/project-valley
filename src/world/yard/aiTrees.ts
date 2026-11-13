import { InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
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
    const mat = src.material as MeshStandardMaterial;
    mat.roughness = 0.9; mat.metalness = 0; mat.color.setRGB(0.66, 0.74, 0.66); mat.side = 2; // DoubleSide: thin leaf cards and open crowns
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
