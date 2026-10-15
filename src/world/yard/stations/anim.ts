import { RingGeometry, CylinderGeometry, SpotLight } from 'three';
import { yard } from '../../../content/data/yard';
import type { Kit } from '../kit';
import { stationSign } from '../signs';

const S = yard.stations.anim; // 12 x 12 at (0, 25)

/** Round pedestal ringed by light poles, a marked viewing spot on the spawn side, one spotlight. */
export async function buildAnim(kit: Kit) {
  const { x, z } = S;
  kit.paint(new CylinderGeometry(5.8, 5.8, 0.06, 32).translate(x, 0.01, z), 'concrete', 0.6);
  kit.place({ id: 'env_pedestal_a', size: [3, 0.4, 3], x, z });

  // light pole ring: see poles.ts

  // Viewing spot: between the spawn and the pedestal, 4.5 m from its centre.
  const vz = z - 4.5;
  kit.paint(new CylinderGeometry(0.7, 0.7, 0.04, 20).translate(x, 0.04, vz), 'concrete_dark', 0.5);
  kit.paint(new RingGeometry(0.62, 0.72, 24).rotateX(-Math.PI / 2).translate(x, 0.065, vz), 'hazard_yellow', 0.8);

  const spot = new SpotLight('#ffe2b0', 60, 18, Math.PI / 7, 0.5, 2);
  spot.position.set(x, 9, z + 2);
  spot.target.position.set(x, 0.4, z);
  kit.game.scene.add(spot, spot.target);

  stationSign(kit, 'anim', x + 5, z - 6.2);
}
