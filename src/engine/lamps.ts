import { AdditiveBlending, Color, ConeGeometry, InstancedMesh, Matrix4, PointLight, SphereGeometry } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { float, normalView, positionViewDirection, pow, uniform, uv } from 'three/tsl';
import type { Game } from '../core/game';
import type { TimeOfDay } from './timeofday';

/**
 * Night street lamps (QA-032). For every lamp head: an emissive bulb and a fake light cone (one InstancedMesh each,
 * additive, no depth write), plus REAL_LIGHTS point lights (no shadows) that follow the lamps nearest the camera.
 * The lights always exist (intensity 0 by day) so the light count never changes and no material recompiles.
 * Everything fades in with tod.night.     createLamps(game, tod, [{x, y, z}, ...])
 * Cost: 2 draws + REAL_LIGHTS point lights in the forward lighting loop.
 */
const REAL_LIGHTS = 4;
const LIGHT_INTENSITY = 70; // candela-ish (physically based); ~2 lux on the ground from 5.9 m
const LAMP_COLOR = '#ffd9a0';

export function createLamps(game: Game, tod: TimeOfDay, heads: { x: number; y: number; z: number }[]) {
  const n = heads.length;
  const on = uniform(0);
  const m = new Matrix4();

  const bulbMat = new MeshBasicNodeMaterial({ fog: false });
  bulbMat.colorNode = uniform(new Color(LAMP_COLOR)).mul(on.mul(6).add(0.15)); // HDR when lit
  const bulbs = new InstancedMesh(new SphereGeometry(0.16, 10, 6).scale(1.4, 0.5, 1.4), bulbMat, n);
  bulbs.name = 'lamp_bulbs';

  // cone from the lamp head down to the ground, brightest at the top, fading with height and at its rim
  const coneH = 5.8;
  const coneGeo = new ConeGeometry(2.6, coneH, 20, 1, true).translate(0, -coneH / 2, 0);
  const coneMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, fog: true });
  // soft silhouette: fade where the cone surface turns edge-on to the view
  const facing = pow(normalView.dot(positionViewDirection).abs(), float(1.5));
  coneMat.colorNode = uniform(new Color(LAMP_COLOR)).mul(pow(uv().y, float(1.6)).mul(facing).mul(on).mul(0.05));
  const cones = new InstancedMesh(coneGeo, coneMat, n);
  cones.name = 'lamp_cones';
  heads.forEach((h, i) => {
    bulbs.setMatrixAt(i, m.makeTranslation(h.x, h.y - 0.08, h.z));
    cones.setMatrixAt(i, m.makeTranslation(h.x, h.y - 0.1, h.z));
  });
  for (const o of [bulbs, cones]) {
    o.castShadow = o.receiveShadow = false;
    o.computeBoundingSphere();
    game.scene.add(o);
  }

  const lights = Array.from({ length: REAL_LIGHTS }, () => {
    const l = new PointLight(LAMP_COLOR, 0, 18, 2);
    l.castShadow = false;
    game.scene.add(l);
    return { l, lamp: -1, fade: 0 };
  });
  const order = new Int32Array(n);
  const dist = new Float32Array(n);
  let frame = 0;

  game.addSystem({
    name: 'lamps',
    render(_a, dt) {
      const night = Math.min(1, Math.max(0, (tod.night - 0.3) / 0.5)); // on from dusk
      on.value = night;
      cones.visible = night > 0.01; // bulbs stay visible as unlit glass by day
      if (night <= 0.01) {
        for (const s of lights) s.l.intensity = 0;
        return;
      }
      if (++frame % 10 === 0) {
        // nearest lamps to the camera (n is small: insertion sort on a typed array, no allocations)
        const c = game.camera.position;
        for (let i = 0; i < n; i++) {
          const dx = heads[i].x - c.x;
          const dz = heads[i].z - c.z;
          dist[i] = dx * dx + dz * dz;
          let j = i;
          while (j > 0 && dist[order[j - 1]] > dist[i]) {
            order[j] = order[j - 1];
            j--;
          }
          order[j] = i;
        }
        // keep lights already on a near lamp; move the others to uncovered near lamps
        for (const s of lights) {
          let near = false;
          for (let k = 0; k < REAL_LIGHTS && k < n; k++) if (order[k] === s.lamp) near = true;
          if (!near) s.lamp = -1;
        }
        for (let k = 0; k < REAL_LIGHTS && k < n; k++) {
          const lamp = order[k];
          let covered = false;
          let s: (typeof lights)[number] | null = null;
          for (const x of lights) {
            if (x.lamp === lamp) covered = true;
            else if (x.lamp === -1 && !s) s = x;
          }
          if (covered) continue;
          if (!s) break;
          s.lamp = lamp;
          s.fade = 0;
          s.l.position.set(heads[lamp].x, heads[lamp].y - 0.3, heads[lamp].z);
        }
      }
      for (const s of lights) {
        s.fade = Math.min(1, s.fade + dt * 2.5); // 0.4 s fade-in after a reassignment, no popping
        s.l.intensity = s.lamp < 0 ? 0 : LIGHT_INTENSITY * night * s.fade;
      }
    },
  });
  return { bulbs, cones, lights: lights.map((s) => s.l) };
}
