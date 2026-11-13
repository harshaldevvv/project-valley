import { BufferAttribute, BufferGeometry, DoubleSide, InstancedMesh } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { cos, float, fract, instanceIndex, mix, positionLocal, sin, time, uniform, vec3 } from 'three/tsl';
import type { Game } from '../../core/game';

/**
 * A few crows circling over the yard by day (more of them at dusk). One instanced draw of a two-triangle flapping
 * silhouette; paths and wing beats are computed in the vertex shader, so there is no CPU cost per frame.
 */
export function buildBirds(game: Game, count = 9) {
  // body triangle + two wing triangles, wings hinged at the body (x = +-0.06)
  const v = new Float32Array([
    0, 0, -0.3, -0.06, 0, 0.1, 0.06, 0, 0.1, // body
    -0.06, 0, -0.05, -0.06, 0, 0.12, -0.7, 0, 0.1, // left wing (outer tip x = -0.7)
    0.06, 0, -0.05, 0.7, 0, 0.1, 0.06, 0, 0.12, // right wing
  ]);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(v, 3));
  const day = uniform(1);
  const id = instanceIndex.toFloat();
  const h = (k: number) => fract(sin(id.mul(12.9898).add(k * 78.233)).mul(43758.5453));
  const radius = h(1).mul(30).add(28);
  const ang = time.mul(h(2).mul(0.12).add(0.1)).mul(h(3).greaterThan(0.5).select(float(1), float(-1))).add(h(4).mul(6.28));
  const cx = h(5).mul(60).sub(30), cz = h(6).mul(60).sub(30);
  const cy = h(7).mul(18).add(30);
  const flap = sin(time.mul(h(8).mul(3).add(6)).add(h(9).mul(6.28))).mul(0.55);
  const lx = positionLocal.x, ax = lx.abs().sub(0.06).max(0);
  const local = vec3(lx, ax.mul(flap), positionLocal.z).mul(3.2); // wing tips lift and drop
  // heading follows the circle's tangent
  const hx = cos(ang).negate(), hz = sin(ang);
  const wx = local.x.mul(hz).sub(local.z.mul(hx)).mul(0), tmp = wx; // (unused, keeps TSL graph simple)
  const yaw = ang.add(1.5708);
  const rx = local.x.mul(cos(yaw)).add(local.z.mul(sin(yaw)));
  const rz = local.z.mul(cos(yaw)).sub(local.x.mul(sin(yaw)));
  const mat = new MeshBasicNodeMaterial({ side: DoubleSide, fog: false, transparent: true });
  mat.positionNode = vec3(rx.add(tmp).add(cx).add(cos(ang).mul(radius)), local.y.add(cy).add(sin(time.mul(0.7).add(id)).mul(2)), rz.add(cz).add(sin(ang).mul(radius)));
  mat.colorNode = mix(vec3(0.02, 0.02, 0.025), vec3(0.08, 0.08, 0.1), h(10));
  mat.opacityNode = day;
  const mesh = new InstancedMesh(g, mat, count);
  mesh.name = 'crows';
  mesh.frustumCulled = false;
  mesh.castShadow = mesh.receiveShadow = false;
  game.scene.add(mesh);
  game.addSystem({
    name: 'crows',
    render() {
      const d = Math.max(0, 1 - game.time.night * 1.4);
      day.value = d;
      mesh.visible = d > 0.02;
    },
  });
}
