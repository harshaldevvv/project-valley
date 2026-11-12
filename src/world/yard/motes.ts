import { AdditiveBlending, InstancedMesh, PlaneGeometry } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { cameraPosition, cameraViewMatrix, float, fract, instanceIndex, mix, positionLocal, sin, time, uniform, vec3 } from 'three/tsl';
import type { Game } from '../../core/game';

/**
 * Floating motes: dust and pollen by day, faint fireflies at night. One instanced draw of camera-facing quads whose
 * positions are computed in the vertex shader (a box around the camera that wraps as you move), so it costs no CPU.
 */
export function buildMotes(game: Game, count = 380) {
  const night = uniform(0);
  const SIZE = 38;
  const id = instanceIndex.toFloat();
  const h = (k: number) => fract(sin(id.mul(12.9898).add(k * 78.233)).mul(43758.5453));
  const base = vec3(h(1), h(2), h(3));
  const sway = vec3(sin(time.mul(0.7).add(base.x.mul(40))), sin(time.mul(0.9).add(base.z.mul(33))).mul(0.5), sin(time.mul(0.6).add(base.y.mul(50)))).mul(0.35);
  const p = fract(base.add(vec3(0.012, -0.004, 0.006).mul(time)).sub(cameraPosition.div(SIZE)));
  const center = cameraPosition.add(p.sub(0.5).mul(SIZE)).add(sway);
  const cy = cameraPosition.y.add(p.y.mul(3.4).sub(1.6)).max(0.2); // a low layer: knee height to just above head height
  const vm = cameraViewMatrix as any; // view-matrix columns: camera right and up in world space
  const right = vec3(vm[0].x, vm[1].x, vm[2].x);
  const up = vec3(vm[0].y, vm[1].y, vm[2].y);
  const size = mix(float(0.012), float(0.032), h(4));
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
  mat.positionNode = vec3(center.x, cy, center.z).add(right.mul(positionLocal.x).mul(size)).add(up.mul(positionLocal.y).mul(size));
  const twinkle = sin(time.mul(1.3).add(base.y.mul(90))).mul(0.5).add(0.5);
  mat.colorNode = mix(vec3(0.9, 0.85, 0.7).mul(0.6), vec3(0.55, 1.0, 0.45).mul(twinkle.mul(0.9).add(0.1)).mul(2.5), night);
  mat.opacityNode = mix(float(0.5), float(0.9), night).mul(h(5).mul(0.7).add(0.3));
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), mat, count);
  mesh.name = 'motes';
  mesh.frustumCulled = false;
  mesh.castShadow = mesh.receiveShadow = false;
  game.scene.add(mesh);
  game.addSystem({ name: 'motes', render() { night.value = game.time.night; } });
}
