import { DoubleSide, Mesh, PlaneGeometry, TextureLoader, SRGBColorSpace } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { dot, smoothstep, texture, uv, vec3 } from 'three/tsl';
import type { Game } from '../../core/game';
import { yard } from '../../content/data/yard';
import { assetUrl } from '../../engine/assetUrl';

/**
 * Spray-paint, stencils and chalk on the perimeter wall (AI-generated artwork, see CREDITS.md). The pictures are dark
 * paint on white; the shader turns white into transparency, so they sit on the wall's own concrete detail and light.
 */
type Wall = 'N' | 'E' | 'S' | 'W';
const DECALS: { tex: string; wall: Wall; t: number; y: number; size: number; roll?: number; strength?: number }[] = [
  { tex: 'safe_zone', wall: 'W', t: -10, y: 1.55, size: 2.6 },
  { tex: 'red_x', wall: 'N', t: -62, y: 1.5, size: 2.2, roll: 0.05 },
  { tex: 'biohazard', wall: 'E', t: -30, y: 1.5, size: 1.7 },
  { tex: 'evac_arrow', wall: 'E', t: 30, y: 1.45, size: 2.8, roll: -0.03 },
  { tex: 'graffiti_survive', wall: 'W', t: 32, y: 1.5, size: 2.5, roll: -0.04 },
  { tex: 'skull_tag', wall: 'E', t: 64, y: 1.4, size: 1.8 },
  { tex: 'tally_marks', wall: 'N', t: 48, y: 1.3, size: 1.5, strength: 0.7 },
  { tex: 'evac_arrow', wall: 'S', t: -34, y: 1.45, size: 2.6 },
  { tex: 'red_x', wall: 'W', t: -52, y: 1.4, size: 1.8, roll: -0.08 },
  { tex: 'biohazard', wall: 'N', t: 14, y: 1.5, size: 1.5 },
  { tex: 'graffiti_survive', wall: 'S', t: 40, y: 1.5, size: 2.2, roll: 0.03 },
];

export async function buildWallDecals(game: Game) {
  const loader = new TextureLoader();
  const cache = new Map<string, MeshStandardNodeMaterial | null>();
  const matFor = async (name: string, strength: number) => {
    const key = `${name}:${strength}`;
    if (cache.has(key)) return cache.get(key)!;
    let m: MeshStandardNodeMaterial | null = null;
    try {
      const t = await loader.loadAsync(assetUrl(`assets/textures/decals/${name}.webp`));
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
      const px = texture(t, uv());
      const lum = dot(px.rgb, vec3(0.2126, 0.7152, 0.0722));
      m = new MeshStandardNodeMaterial({ transparent: true, depthWrite: false, roughness: 0.95, metalness: 0, side: DoubleSide });
      m.polygonOffset = true;
      m.polygonOffsetFactor = -2;
      m.colorNode = px.rgb.mul(0.78);
      m.opacityNode = smoothstep(0.86, 0.45, lum).mul(strength);
    } catch {
      m = null;
    }
    cache.set(key, m);
    return m;
  };
  const h = yard.half - 0.16; // inner face of the 0.3 m wall
  for (const d of DECALS) {
    const mat = await matFor(d.tex, d.strength ?? 0.92);
    if (!mat) continue;
    const mesh = new Mesh(new PlaneGeometry(d.size, d.size), mat);
    const [x, z, yaw] = d.wall === 'N' ? [d.t, -h, 0] : d.wall === 'S' ? [d.t, h, Math.PI] : d.wall === 'E' ? [h, d.t, -Math.PI / 2] : [-h, d.t, Math.PI / 2];
    mesh.position.set(x, d.y, z);
    mesh.rotation.set(0, yaw, d.roll ?? 0, 'YXZ');
    mesh.receiveShadow = true;
    mesh.name = `decal_${d.tex}`;
    game.scene.add(mesh);
  }
}
