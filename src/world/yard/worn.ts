import { DoubleSide, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { dot, float, length, mix, positionWorld, smoothstep, texture, uv, vec3 } from 'three/tsl';
import type { Game } from '../../core/game';
import { yard } from '../../content/data/yard';
import { createRng } from '../../engine/rng';
import { grungeTexture } from '../../engine/palette';
import { groundSurfaceAt } from '../surfaces';
import { underDress } from './dress';
import { underGenProp } from './genProps';
import { cabin, farm, shop } from './cabin';
import { groundHeight } from './ground';

/**
 * Worn ground: soft dirt patches trampled along the paths from the spawn to every station, at the doors of the
 * interiors and round the camp fire. One instanced draw of flat quads whose edge is a noisy radial falloff (no
 * texture mask needed), tinted from the grime texture, lying a hair above the lawn.
 */
export async function buildWornGround(game: Game) {
  const rng = createRng(909);
  const spots: { x: number; z: number; r: number; a: number; k: number }[] = [];
  const add = (x: number, z: number, r: number) => spots.push({ x, z, r, a: rng.range(0, Math.PI * 2), k: rng.next() });
  const { x: sx, z: sz } = yard.spawn;
  const st = yard.stations;
  const ends: [number, number][] = [[st.loot.x + 7, st.loot.z + 9], [st.range.x, st.range.z + 6], [st.pen.x - st.pen.w / 2 - 3, st.pen.z - 1.5], [st.build.x + st.build.w / 2, st.build.z - st.build.d / 2], [st.anim.x, st.anim.z - 4.5], [st.track.x - st.track.w / 2, st.track.z - st.track.d / 2 + 4], [cabin.x + 4.5, cabin.z + 2], [shop.x, shop.z + 6], [farm.x, farm.z + 5]];
  for (const [ex, ez] of ends) {
    const len = Math.hypot(ex - sx, ez - sz), n = Math.ceil(len / 3.2);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      add(sx + (ex - sx) * t + rng.range(-1.4, 1.4), sz + (ez - sz) * t + rng.range(-1.4, 1.4), rng.range(1.8, 3.2));
    }
  }
  // trampled round doors and the camp fire
  for (const [dx, dz] of [[cabin.x + 4.4, cabin.z + 2.8], [shop.x - 1, shop.z + 4.2], [farm.x, farm.z + 3.6], [-15.5, 11.5], [-20, 13]]) for (let k = 0; k < 5; k++) add(dx + rng.range(-1.5, 1.5), dz + rng.range(-1.5, 1.5), rng.range(1.2, 2.4));
  const grunge = await grungeTexture();
  // soft gravel scatter on both sides of every path so the strip edge melts into the lawn
  const edgeSpots: typeof spots = [];
  for (const [ex, ez] of ends) {
    const len = Math.hypot(ex - sx, ez - sz), n = Math.ceil(len / 1.5);
    const nx = -(ez - sz) / len, nz = (ex - sx) / len;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      for (const side of [-1, 1]) {
        const off = side * (1.7 + rng.range(-0.2, 0.5));
        edgeSpots.push({ x: sx + (ex - sx) * t + nx * off, z: sz + (ez - sz) * t + nz * off, r: rng.range(0.6, 1.1), a: rng.range(0, Math.PI * 2), k: rng.next() });
      }
    }
  }
  // never stain a concrete platform: drop patches inside a station footprint or on the spawn hub (path ends sit on the edges)
  const onPlatform = (x: number, z: number) => Math.hypot(x - sx, z - sz) < 7 || Object.values(st).some((a) => Math.abs(x - a.x) < a.w / 2 - 0.5 && Math.abs(z - a.z) < a.d / 2 - 0.5);
  const make = (all: typeof spots, name: string, cA: [number, number, number], cB: [number, number, number], opacity: number, lift: number) => {
    const list = all.filter((q) => !onPlatform(q.x, q.z) || name.startsWith('lawn_'));
    const mat = new MeshStandardNodeMaterial({ transparent: true, depthWrite: false, roughness: 1, metalness: 0, side: DoubleSide });
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -3;
    const q = uv().sub(0.5).mul(2);
    const wob = grunge ? dot(texture(grunge, positionWorld.xz.mul(0.35)).rgb, vec3(0.33, 0.33, 0.34)) : float(0.5);
    const edge = smoothstep(1.0, 0.25, length(q).add(wob.sub(0.5).mul(0.9)));
    const tone = grunge ? dot(texture(grunge, positionWorld.xz.mul(0.8)).rgb, vec3(0.33, 0.33, 0.34)) : float(0.5);
    mat.colorNode = mix(vec3(...cA), vec3(...cB), tone);
    mat.opacityNode = edge.mul(opacity);
    const mesh = new InstancedMesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, list.length);
    mesh.name = name;
    const m = new Matrix4(), qq = new Quaternion(), up = new Vector3(0, 1, 0), p = new Vector3(), sc = new Vector3();
    list.forEach((s, i) => {
      qq.setFromAxisAngle(up, s.a);
      sc.set(s.r * 2.1, 1, s.r * 1.5 * (0.8 + s.k * 0.5));
      p.set(s.x, groundHeight(s.x, s.z) + lift, s.z);
      mesh.setMatrixAt(i, m.compose(p, qq, sc));
    });
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.computeBoundingSphere();
    game.scene.add(mesh);

  };
  make(spots, 'worn_ground', [0.27, 0.2, 0.12], [0.4, 0.31, 0.2], 0.78, 0.035);
  make(edgeSpots, 'path_edges', [0.3, 0.29, 0.26], [0.42, 0.4, 0.35], 0.5, 0.03);

  // Lawn variety: big soft tint patches on open grass (dry straw, dark clover, bare soil, fresh green), a few hundred
  // quads in four draws, so the lawn between stations stops reading as one flat green.
  const half = yard.half - 3;
  const scatter = (n: number, rmin: number, rmax: number, seedOff: number) => {
    const out: typeof spots = [];
    for (let tries = 0; out.length < n && tries < n * 12; tries++) {
      const x = rng.range(-half, half), z = rng.range(-half, half);
      const r = rng.range(rmin, rmax) * 0.55; // quad half-extent is about 1.05 r, so keep every sample under it on open grass
      const open = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]].every(([dx, dz]) => groundSurfaceAt(x + dx * r * 1.1, z + dz * r * 1.1) === 'grass');
      const inStation = Object.values(st).some((a) => Math.abs(x - a.x) < a.w / 2 + 3 + r && Math.abs(z - a.z) < a.d / 2 + 3 + r); // platforms there are not all ground regions
      if (!open || inStation || underGenProp(x, z, 1.5 + r) || underDress(x, z, 2 + r)) continue;
      if (Math.hypot(x - sx, z - sz) < 6 + r) continue;
      out.push({ x, z, r, a: rng.range(0, Math.PI * 2) + seedOff, k: rng.next() });
    }
    return out;
  };
  make(scatter(150, 3.5, 8, 0), 'lawn_dry', [0.5, 0.45, 0.2], [0.62, 0.56, 0.3], 0.5, 0.012);
  make(scatter(120, 3, 7, 1), 'lawn_clover', [0.1, 0.22, 0.07], [0.16, 0.3, 0.1], 0.55, 0.013);
  make(scatter(70, 1.5, 3.4, 2), 'lawn_soil', [0.3, 0.22, 0.14], [0.4, 0.3, 0.2], 0.6, 0.014);
  make(scatter(90, 4, 9, 3), 'lawn_fresh', [0.2, 0.36, 0.1], [0.3, 0.46, 0.16], 0.4, 0.011);
}
