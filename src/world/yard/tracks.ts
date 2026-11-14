import { BufferAttribute, BufferGeometry, CatmullRomCurve3, DoubleSide, Mesh, Vector3 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { dot, float, mix, positionWorld, smoothstep, texture, uv, vec3 } from 'three/tsl';
import type { Game } from '../../core/game';
import { yard } from '../../content/data/yard';
import { grungeTexture } from '../../engine/palette';
import { createRng } from '../../engine/rng';
import { cabin, farm, shop } from './cabin';
import { groundHeight } from './ground';

/**
 * Trodden tracks: continuous dirt ribbons (one merged mesh, one draw) between the stations, the gate and the three
 * interiors, so the yard reads as walked-in routes rather than isolated patches. Each route is a smoothed polyline with a
 * little lateral wander; the ribbon fades at its edges with grime-texture noise, lies 4 cm above the lawn, and is cut
 * wherever it would cross a station platform. The soft patches in worn.ts still sit along the spawn paths.
 */
const S = yard.stations;
const H = yard.half;
type Pt = [number, number];
const hub: Pt = [0, 0];
const ROUTES: { pts: Pt[]; w: number }[] = [
  { pts: [hub, [0, 40], [0, 70], [0, H - 5]], w: 3.2 }, // spawn -> south gate (the main road)
  { pts: [[S.loot.x + 7, S.loot.z + 9], [-30, 2], [S.build.x + 6, S.build.z - 14]], w: 2.2 }, // loot -> build pad
  { pts: [[S.build.x + 12, S.build.z - 3], [-20, 30], [S.anim.x - 5, S.anim.z]], w: 2.2 }, // build -> anim stand
  { pts: [[S.pen.x - S.pen.w / 2 - 3, S.pen.z + 4], [S.pen.x - 8, 12], [S.track.x - 30, S.track.z - 20]], w: 2.2 }, // pen -> vehicle track
  { pts: [[S.anim.x + 6, S.anim.z + 2], [30, 38], [S.track.x - 36, S.track.z]], w: 2.4 }, // anim -> track
  { pts: [[cabin.x + 4.5, cabin.z + 2.5], [-60, -26], [S.loot.x - 12, S.loot.z - 4]], w: 1.8 }, // cabin -> loot
  { pts: [[farm.x + 1, farm.z + 4.5], [-68, 76], [-30, H - 6]], w: 1.8 }, // farm -> gate road
  { pts: [[shop.x - 1, shop.z + 4.5], [58, -30], [S.pen.x + 14, S.pen.z - 6]], w: 1.8 }, // shop -> pen
  { pts: [[S.range.x - 18, S.range.z + 38], [-30, -30], [S.loot.x + 6, S.loot.z - 6]], w: 1.8 }, // range flank -> loot
];
const onPlatform = (x: number, z: number) =>
  Math.hypot(x, z) < 6.5 || Object.values(S).some((a) => Math.abs(x - a.x) < a.w / 2 + 0.5 && Math.abs(z - a.z) < a.d / 2 + 0.5);

export async function buildTracks(game: Game) {
  const rng = createRng(4242);
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
  let vbase = 0;
  for (const r of ROUTES) {
    const curve = new CatmullRomCurve3(r.pts.map(([x, z]) => new Vector3(x + rng.range(-1, 1), 0, z + rng.range(-1, 1))), false, 'centripetal');
    const n = Math.max(8, Math.ceil(curve.getLength() / 1.2));
    let run: { x: number; z: number; nx: number; nz: number; w: number }[] = [];
    const flush = () => {
      if (run.length > 2) {
        run.forEach((p, i) => {
          for (const side of [-1, 1]) {
            const x = p.x + p.nx * side * p.w, z = p.z + p.nz * side * p.w;
            pos.push(x, groundHeight(x, z) + 0.04, z);
            uvs.push(side < 0 ? 0 : 1, i / 4);
          }
        });
        for (let i = 0; i < run.length - 1; i++) {
          const a = vbase + i * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        vbase += run.length * 2;
      }
      run = [];
    };
    let wander = 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curve.getPoint(t), tg = curve.getTangent(t);
      wander += rng.range(-0.12, 0.12); wander *= 0.92;
      const nx = -tg.z, nz = tg.x;
      const x = p.x + nx * wander, z = p.z + nz * wander;
      if (onPlatform(x, z)) { flush(); continue; }
      run.push({ x, z, nx, nz, w: (r.w / 2) * (0.85 + 0.3 * Math.sin(i * 0.7 + r.w)) });
    }
    flush();
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const grunge = await grungeTexture();
  const mat = new MeshStandardNodeMaterial({ transparent: true, depthWrite: false, roughness: 1, metalness: 0, side: DoubleSide });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -4;
  const across = uv().x.sub(0.5).abs().mul(2); // 0 centre .. 1 edge
  const wob = grunge ? dot(texture(grunge, positionWorld.xz.mul(0.4)).rgb, vec3(0.33, 0.33, 0.34)) : float(0.5);
  const tone = grunge ? dot(texture(grunge, positionWorld.xz.mul(1.1)).rgb, vec3(0.33, 0.33, 0.34)) : float(0.5);
  mat.colorNode = mix(vec3(0.3, 0.22, 0.14), vec3(0.44, 0.34, 0.22), tone).mul(float(1).sub(across.mul(0.25)));
  mat.opacityNode = smoothstep(1.0, 0.12, across.add(wob.sub(0.5).mul(0.9))).mul(0.75);
  const mesh = new Mesh(geo, mat);
  mesh.name = 'tracks';
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  game.scene.add(mesh);
}
