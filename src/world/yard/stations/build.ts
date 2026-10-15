import { yard } from '../../../content/data/yard';
import { BUILD } from '../../../content/data/build';
import type { Kit } from '../kit';
import { stationSign } from '../signs';

const S = yard.stations.build; // 24 x 24 slab at (-40, 35)

/** Concrete slab with the build grid painted on it. Lines sit on world multiples of BUILD.grid (the snap grid). */
export function buildBuildPad(kit: Kit) {
  const { x, z } = S;
  const x0 = x - S.w / 2, x1 = x + S.w / 2, z0 = z - S.d / 2, z1 = z + S.d / 2;
  kit.pad(S.w, S.d, x, z, 'concrete', 0.04, 0.75);
  const g = BUILD.grid;
  for (let gx = Math.ceil(x0 / g) * g; gx <= x1; gx += g) kit.strip(gx, z0, gx, z1, 0.06, 0.05, 'concrete_dark', 0.3);
  for (let gz = Math.ceil(z0 / g) * g; gz <= z1; gz += g) kit.strip(x0, gz, x1, gz, 0.06, 0.05, 'concrete_dark', 0.3);
  // Hazard kerb around the slab edge.
  kit.strip(x0, z0, x1, z0, 0.25, 0.06, 'hazard_yellow', 0.7);
  kit.strip(x0, z1, x1, z1, 0.25, 0.06, 'hazard_yellow', 0.7);
  kit.strip(x0, z0, x0, z1, 0.25, 0.06, 'hazard_yellow', 0.7);
  kit.strip(x1, z0, x1, z1, 0.25, 0.06, 'hazard_yellow', 0.7);
  // Lumber pile by the slab (the "material yard" read).
  for (let i = 0; i < 4; i++) kit.box(3.2, 0.12, 0.9, 'wood_raw', x1 + 1.4, i * 0.13, z1 - 4, Math.PI / 2 + (i % 2) * 0.05, false, 0.4 + i * 0.15);
  kit.cuboid(0.45, 0.26, 1.6, x1 + 1.4, 0.26, z1 - 4);

  stationSign(kit, 'build', x1 + 1.5, z0 - 1.2);
}
