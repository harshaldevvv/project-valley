import { InstancedMesh, Matrix4, Quaternion, Sphere, Vector3, type Mesh } from 'three';
import type { Game } from '../core/game';
import { loadAsset } from './assets';
import { Group, groups } from './physics';

/**
 * Many copies of one static asset in a few draw calls (principles §13: ≤ 400 draws).
 *
 *   await placeStatic(game, 'prop_crate_wood_a', [{ x: 3, y: 0, z: -4, rotY: 0.5 }, ...], { collider: true });
 *
 * - One InstancedMesh per LOD level. Every 10 rendered frames each instance is assigned to the level its
 *   camera distance picks (same distances as THREE.LOD from loadAsset), so draws = levels, not instances.
 * - All levels share one bounding sphere covering every placement (conservative frustum culling).
 * - `collider` (default true): Rapier cuboids from the asset's collider boxes, rotated/scaled per placement.
 * - `castShadow` (default true) applies to LOD0 only; far levels never cast.
 * Cost: the refresh loop is O(placements) every 10 frames (~0.02 ms per 1000 instances).
 * `yaw` is accepted as an alias of `rotY` (environment's Placement shape).
 */
export interface StaticPlacement {
  x: number;
  y?: number;
  z: number;
  rotY?: number;
  yaw?: number;
  scale?: number;
}

interface Batch {
  meshes: InstancedMesh[];
  dist2: number[]; // squared switch distance per level
  pos: Float32Array; // xyz per placement
  mats: Float32Array[]; // per level: 16 floats per placement
}

const batches: Batch[] = [];
let installed = false;
const UP = new Vector3(0, 1, 0);
const REFRESH_FRAMES = 10;

export async function placeStatic(
  game: Game,
  id: string,
  placements: StaticPlacement[],
  opts: { collider?: boolean; castShadow?: boolean; fallbackSize?: [number, number, number] } = {},
) {
  const proto = await loadAsset(id, opts.fallbackSize);
  const n = placements.length;
  const m = new Matrix4();
  const lm = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const t = new Vector3();
  const pos = new Float32Array(n * 3);
  const levels = proto.lod.levels;
  const mats = levels.map(() => new Float32Array(n * 16));
  const sphere = new Sphere();
  const pts: Vector3[] = [];
  let radius = 0;

  levels.forEach((lv, li) => {
    const src = lv.object as Mesh;
    src.updateMatrix();
    src.geometry.computeBoundingSphere();
    radius = Math.max(radius, src.geometry.boundingSphere!.radius * Math.max(src.scale.x, src.scale.y, src.scale.z) + src.position.length());
    placements.forEach((p, i) => {
      q.setFromAxisAngle(UP, p.rotY ?? p.yaw ?? 0);
      m.compose(t.set(p.x, p.y ?? 0, p.z), q, s.setScalar(p.scale ?? 1)).multiply(lm.copy(src.matrix));
      m.toArray(mats[li], i * 16);
      if (li === 0) {
        pos.set([p.x, p.y ?? 0, p.z], i * 3);
        pts.push(t.clone());
      }
    });
  });
  sphere.setFromPoints(pts);
  sphere.radius += radius * Math.max(1, ...placements.map((p) => p.scale ?? 1));

  const meshes = levels.map((lv, li) => {
    const src = lv.object as Mesh;
    const inst = new InstancedMesh(src.geometry, src.material, n);
    inst.name = `${id}_LOD${li}_x${n}`;
    inst.castShadow = li === 0 && (opts.castShadow ?? true);
    inst.receiveShadow = true;
    inst.boundingSphere = sphere;
    inst.count = 0;
    game.scene.add(inst);
    return inst;
  });

  if (opts.collider ?? true) {
    const { R, world } = game.phys;
    const g = groups(Group.STATIC, 0xffff);
    const c = new Vector3();
    for (const p of placements) {
      const yaw = p.rotY ?? p.yaw ?? 0;
      const k = p.scale ?? 1;
      q.setFromAxisAngle(UP, yaw);
      for (const b of proto.colliders) {
        c.addVectors(b.min, b.max).multiplyScalar(0.5 * k).applyQuaternion(q);
        world.createCollider(
          R.ColliderDesc.cuboid(((b.max.x - b.min.x) / 2) * k, ((b.max.y - b.min.y) / 2) * k, ((b.max.z - b.min.z) / 2) * k)
            .setTranslation(p.x + c.x, (p.y ?? 0) + c.y, p.z + c.z)
            .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
            .setCollisionGroups(g),
        );
      }
    }
  }

  const batch: Batch = { meshes, dist2: levels.map((l) => l.distance * l.distance), pos, mats };
  batches.push(batch);
  refresh(batch, game.camera.position);

  if (!installed) {
    installed = true;
    let frame = 0;
    game.addSystem({
      name: 'instLOD',
      render() {
        if (++frame % REFRESH_FRAMES) return;
        for (let i = 0; i < batches.length; i++) refresh(batches[i], game.camera.position);
      },
    });
  }
  return { meshes, count: n };
}

function refresh(b: Batch, cam: Vector3) {
  const { meshes, dist2, pos, mats } = b;
  const L = meshes.length;
  for (let l = 0; l < L; l++) meshes[l].count = 0;
  const n = pos.length / 3;
  for (let i = 0; i < n; i++) {
    const dx = pos[i * 3] - cam.x;
    const dy = pos[i * 3 + 1] - cam.y;
    const dz = pos[i * 3 + 2] - cam.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    let l = L - 1;
    while (l > 0 && d2 < dist2[l]) l--;
    const mesh = meshes[l];
    const dst = mesh.instanceMatrix.array as Float32Array;
    const src = mats[l];
    const o = mesh.count++ * 16;
    for (let k = 0; k < 16; k++) dst[o + k] = src[i * 16 + k];
  }
  for (let l = 0; l < L; l++) {
    meshes[l].instanceMatrix.needsUpdate = true;
    meshes[l].visible = meshes[l].count > 0;
  }
}
