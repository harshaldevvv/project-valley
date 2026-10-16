import { AdditiveBlending, CircleGeometry, Color, InstancedMesh, Matrix4 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { float, pow, uniform, uv } from 'three/tsl';
import type { Game } from '../../core/game';
import { lightPoles } from './poles';

const R = 6.5; // pool radius, m
const AHEAD = 3.3; // pool centre in front of the pole (lamps point at what they light), m
const STRENGTH = 0.35;

/**
 * Fake light pools under every lamp head (QA-052/068): one additive InstancedMesh of ground discs, so lamps
 * read from any height even though only the engine's 4 nearest point lights are real. 1 draw call.
 * ponytail: "night" is derived from the sky (scene.background) luminance because the time-of-day state isn't
 * on `game`; switch to tod.night if the engine exposes it.
 */
export function buildLampPools(game: Game) {
  const on = uniform(0);
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, fog: true });
  const r = uv().sub(0.5).length().mul(2); // 0 centre .. 1 rim
  mat.colorNode = uniform(new Color('#ffd9a0')).mul(pow(float(1).sub(r).max(0), float(2)).mul(on).mul(STRENGTH));
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -4;
  const geo = new CircleGeometry(R, 24).rotateX(-Math.PI / 2);
  const mesh = new InstancedMesh(geo, mat, lightPoles.length);
  mesh.name = 'lamp_pools';
  const m = new Matrix4();
  lightPoles.forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(p.x - Math.sin(p.yaw ?? 0) * AHEAD, 0.08, p.z - Math.cos(p.yaw ?? 0) * AHEAD)));
  mesh.computeBoundingSphere();
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.renderOrder = 1;
  game.scene.add(mesh);

  const bg = new Color();
  game.addSystem({
    name: 'lamp-pools',
    render() {
      const b = game.scene.background;
      if (!(b instanceof Color)) return;
      bg.copy(b);
      const lum = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b; // linear
      on.value = Math.min(1, Math.max(0, (0.06 - lum) / 0.05)); // night sky ~0.01, dusk ~0.15+
      mesh.visible = on.value > 0.001;
    },
  });
}
