import { BufferAttribute, BufferGeometry, DoubleSide, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { cameraPosition, clamp, float, mix, positionLocal, positionWorld, sin, smoothstep, time, uv, vec3, instanceIndex, fract, transformNormalToView } from 'three/tsl';
import type { Game } from '../../core/game';
import { yard } from '../../content/data/yard';
import { createRng } from '../../engine/rng';
import { groundSurfaceAt } from '../surfaces';
import { fbm, groundHeight } from './ground';

/**
 * Ground clutter (no colliders, no shadows): wind-swayed grass tufts on every grass patch of the Yard, plus
 * scattered rocks. One InstancedMesh each. Grass shrinks away with distance, so it costs nothing far off.
 */
const BLADES = 6;
function tuftGeometry() {
  const rng = createRng(5);
  const pos: number[] = [], t: number[] = [];
  for (let b = 0; b < BLADES; b++) {
    const a = (b / BLADES) * Math.PI + rng.range(-0.3, 0.3);
    const h = rng.range(0.7, 1);
    const ox = rng.range(-0.12, 0.12), oz = rng.range(-0.12, 0.12);
    const lean = rng.range(0.05, 0.22);
    const dx = Math.cos(a), dz = Math.sin(a);
    const w = 0.055;
    // tapered blade: quad lower half + tip triangle (3 tris), UV.y = height 0..1
    const P = (s: number, y: number, l: number): [number, number, number] => [ox + dx * s + dz * l * y, y * h, oz + dz * s - dx * l * y];
    const verts: [[number, number, number], number][] = [
      [P(-w, 0, lean), 0], [P(w, 0, lean), 0], [P(-w * 0.6, 0.55, lean), 0.55],
      [P(w, 0, lean), 0], [P(w * 0.6, 0.55, lean), 0.55], [P(-w * 0.6, 0.55, lean), 0.55],
      [P(-w * 0.6, 0.55, lean), 0.55], [P(w * 0.6, 0.55, lean), 0.55], [P(0, 1, lean), 1],
    ];
    for (const [v, y] of verts) { pos.push(...v); t.push(0, y); }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(t), 2));
  g.computeVertexNormals();
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // shade like the ground so tufts melt into it
  return g;
}

export function buildClutter(game: Game) {
  const rng = createRng(2026);
  const half = yard.half;
  const st = Object.values(yard.stations).map((s) => [s.x - s.w / 2 - 1, s.x + s.w / 2 + 1, s.z - s.d / 2 - 1, s.z + s.d / 2 + 1]);
  const free = (x: number, z: number) => !st.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1) && Math.hypot(x - yard.spawn.x, z - yard.spawn.z) > 4.5;

  // --- grass ---
  const spots: [number, number, number][] = [];
  const step = 0.85;
  for (let gx = -half + 1; gx < half - 1; gx += step) {
    for (let gz = -half + 1; gz < half - 1; gz += step) {
      const x = gx + rng.range(-step, step) * 0.5, z = gz + rng.range(-step, step) * 0.5;
      if (groundSurfaceAt(x, z) !== 'grass' || !free(x, z)) continue;
      const dens = 0.35 + 0.65 * fbm(x * 0.05 + 40, z * 0.05);
      if (rng.next() > dens) continue;
      spots.push([x, z, rng.next()]);
    }
  }
  // beyond the walls the hills get a thinner coat close to the wall only
  const mat = new MeshStandardNodeMaterial({ side: DoubleSide, roughness: 0.9 });
  const dist = positionWorld.sub(cameraPosition).length();
  const shrink = smoothstep(46, 22, dist); // 0 far, 1 near
  const wind = sin(time.mul(1.7).add(positionWorld.x.mul(0.55)).add(positionWorld.z.mul(0.4)))
    .add(sin(time.mul(2.9).add(positionWorld.z.mul(0.9))).mul(0.4));
  const hgt = uv().y;
  mat.positionNode = positionLocal.mul(vec3(1, shrink.mul(0.85).add(0.15).mul(shrink.greaterThan(0.02).select(float(1), float(0))), 1))
    .add(vec3(wind.mul(hgt.mul(hgt)).mul(0.07), 0, wind.mul(hgt.mul(hgt)).mul(0.04)));
  const patch = fract(sin(instanceIndex.toFloat().mul(12.9898)).mul(43758.5453));
  const dry = clamp(patch.mul(0.45).add(positionWorld.x.mul(0.013).sin().mul(0.25)), 0, 1);
  const base = mix(vec3(0.12, 0.2, 0.06), vec3(0.3, 0.29, 0.11), dry);
  const tip = mix(vec3(0.24, 0.36, 0.1), vec3(0.5, 0.45, 0.2), dry);
  mat.colorNode = mix(base, tip, hgt);
  mat.normalNode = transformNormalToView(vec3(0, 1, 0)); // same up-lit shading on both faces of a blade
  const tuft = new InstancedMesh(tuftGeometry(), mat, spots.length);
  tuft.name = 'grass_tufts';
  const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), sc = new Vector3(), p = new Vector3();
  spots.forEach(([x, z, r], i) => {
    q.setFromAxisAngle(up, r * 6.28);
    const s = 0.8 + r * 0.7;
    sc.set(s, 0.24 + r * 0.26, s);
    p.set(x, groundHeight(x, z) - 0.02, z);
    tuft.setMatrixAt(i, m.compose(p, q, sc));
  });
  tuft.castShadow = tuft.receiveShadow = false;
  tuft.frustumCulled = false;
  game.scene.add(tuft);

  // --- rocks ---
  const rockSpots: [number, number, number][] = [];
  for (let tries = 0; rockSpots.length < 90 && tries < 3000; tries++) {
    const x = rng.range(-half + 2, half - 2), z = rng.range(-half + 2, half - 2);
    if (groundSurfaceAt(x, z) !== 'grass' || !free(x, z) || fbm(x * 0.04, z * 0.04 + 9) < 0.5) continue;
    rockSpots.push([x, z, rng.range(0.15, 0.55)]);
  }
  const rockMat = new MeshStandardNodeMaterial({ roughness: 0.95, flatShading: true });
  rockMat.colorNode = mix(vec3(0.3, 0.3, 0.28), vec3(0.46, 0.45, 0.4), fract(positionWorld.x.mul(7.3).add(positionWorld.z.mul(3.1)).sin().mul(43758.5)));
  const rocks = new InstancedMesh(new IcosahedronGeometry(1, 0), rockMat, rockSpots.length);
  rockSpots.forEach(([x, z, s], i) => {
    q.setFromAxisAngle(up, rng.range(0, 6.28));
    sc.set(s * rng.range(1, 1.8), s * rng.range(0.55, 0.9), s * rng.range(1, 1.6));
    p.set(x, groundHeight(x, z) + s * 0.25, z);
    rocks.setMatrixAt(i, m.compose(p, q, sc));
  });
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  game.scene.add(rocks);
  return { tufts: spots.length, rocks: rockSpots.length };
}
