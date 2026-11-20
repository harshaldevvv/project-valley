import { Matrix4, InstancedMesh, Quaternion, Vector3 } from 'three';
import type { Game } from '../../core/game';
import { OUT } from '../../content/data/outskirts';
import { createRng } from '../../engine/rng';
import { pfWorldMaterial } from '../../engine/palette';
import type { Kit } from '../yard/kit';
import { fbm, nearTreeSpots } from '../yard/ground';
import { footprints, inClearRect, roadClearance } from './footprints';
import { loadPfm } from './models';

/**
 * Forest and undergrowth for the outskirts plateau. Trees go into `nearTreeSpots` (the yard's instanced Polyfork
 * pine/birch/oak, swaying in the wind, aiTrees.ts); a thick belt runs round the edge (the boundary wall hides behind it),
 * with clumps in the open ground and none on roads, in POI clear zones or under models. Trunks near the play area get a collider.
 */
export async function buildScatter(kit: Kit, game: Game) {
  const rng = createRng(31337);
  let trees = 0;
  for (let gx = OUT.x0 + 2; gx < OUT.x1 - 1; gx += 5.2) {
    for (let gz = OUT.z0 + 2; gz < OUT.z1 - 1; gz += 5.2) {
      const x = gx + rng.range(-2.2, 2.2), z = gz + rng.range(-2.2, 2.2);
      const edge = Math.min(x - OUT.x0, OUT.x1 - x, OUT.z1 - z, Math.abs(x) > 100 ? z - OUT.z0 : 999);
      const belt = edge < 20 ? 0.97 : edge < 32 ? 0.55 : 0;
      const clump = fbm(x * 0.028 + 70, z * 0.028 + 13) > 0.62 ? 0.7 : 0;
      const dens = Math.max(belt, clump);
      const r = rng.next();
      const sa = rng.range(0.85, 1.35), sb = rng.range(0, Math.PI * 2), sk = rng.next();
      if (r > dens) continue;
      if (inClearRect(x, z, 2) || roadClearance(x, z) < 5) continue;
      if (footprints.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 2.5)) continue;
      nearTreeSpots.push({ x, z, s: sa, a: sb, k: sk });
      trees++;
      if (edge > 4) kit.cuboid(0.25, 1.5, 0.25, x, 1.2, z, 0, 'wood');
    }
  }

  // undergrowth: bushes in the clumps and along the forest belt (one instanced mesh, no collider)
  const bush = await loadPfm('bush');
  if (bush) {
    const mats: Matrix4[] = [];
    const q = new Quaternion(), up = new Vector3(0, 1, 0);
    for (let tries = 0; tries < 6000 && mats.length < 140; tries++) {
      const x = rng.range(OUT.x0 + 3, OUT.x1 - 3), z = rng.range(OUT.z0 + 3, OUT.z1 - 3);
      if (inClearRect(x, z, 1) || roadClearance(x, z) < 3.5) continue;
      if (footprints.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 1)) continue;
      if (fbm(x * 0.05 + 9, z * 0.05 + 4) < 0.5) continue;
      const s = rng.range(0.9, 1.9);
      q.setFromAxisAngle(up, rng.range(0, 6.28));
      mats.push(new Matrix4().compose(new Vector3(x, -0.02, z), q, new Vector3(s, s * rng.range(0.9, 1.3), s)));
    }
    const inst = new InstancedMesh(bush.geo, await pfWorldMaterial(), mats.length);
    mats.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.name = `outskirts_bushes_x${mats.length}`;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    game.scene.add(inst);
  }
  return { trees };
}
