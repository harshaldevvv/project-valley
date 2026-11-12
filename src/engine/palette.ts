import { MeshStandardNodeMaterial } from 'three/webgpu';
import { texture, uv, positionWorld, normalWorld, abs, mix, float, vec3, vec2, dot, smoothstep, clamp } from 'three/tsl';
import { BufferAttribute, BufferGeometry, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from 'three';
import palette from '../content/data/palette.json';
import { assetUrl } from './assetUrl';

/**
 * The one shared material for all palette-atlas models (art bible). GLBs ship without textures;
 * the loader swaps their placeholder material for this, so everything can batch/instance together.
 * No mipmaps: 16 px swatches would bleed into neighbours when minified.
 */
let shared: MeshStandardNodeMaterial | null = null;

export async function paletteMaterial() {
  if (shared) return shared;
  const tex: Texture = await new TextureLoader().loadAsync(assetUrl('assets/textures/palette.png'));
  tex.flipY = false; // glTF UV convention
  tex.colorSpace = SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  shared = new MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0 });
  // World-space detail (AI-generated, see CREDITS.md): luminance-only multipliers so the palette keeps its hues.
  // Top faces get grass + gravel, side faces get grime + concrete, at two scales to hide tiling; walls darken at the
  // foot (fake contact AO); a very low-frequency patch tint stops big surfaces looking printed.
  const load = async (n: string) => {
    const t = await new TextureLoader().loadAsync(assetUrl(`assets/textures/${n}.png`));
    t.wrapS = t.wrapT = RepeatWrapping;
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    return t;
  };
  const [grass, dirt, concrete, grunge] = await Promise.all([load('grass'), load('dirt'), load('concrete'), load('grunge')]);
  const lum = (n: any) => dot(n, vec3(0.2126, 0.7152, 0.0722));
  const wp = positionWorld;
  const top = smoothstep(0.55, 0.85, normalWorld.y);
  const xz = vec2(wp.x, wp.z);
  const tops = lum(texture(grass, xz.mul(0.31)).rgb).mul(0.5).add(lum(texture(grass, xz.mul(0.071).add(vec2(0.37, 0.11)))).mul(0.5))
    .mul(lum(texture(dirt, xz.mul(0.19)).rgb).mul(0.6).add(0.55));
  const nx = abs(normalWorld.x), nz = abs(normalWorld.z);
  const sideA = texture(concrete, vec2(wp.z, wp.y).mul(0.33)).rgb.mul(nx).add(texture(concrete, vec2(wp.x, wp.y).mul(0.33)).rgb.mul(nz)).div(nx.add(nz).max(0.001));
  const sideB = texture(grunge, vec2(wp.z, wp.y).mul(0.13)).rgb.mul(nx).add(texture(grunge, vec2(wp.x, wp.y).mul(0.13)).rgb.mul(nz)).div(nx.add(nz).max(0.001));
  const sides = dot(sideA, vec3(0.2126, 0.7152, 0.0722)).mul(0.55).add(dot(sideB, vec3(0.2126, 0.7152, 0.0722)).mul(0.45));
  const detailRaw = mix(sides, tops, top);
  const detail = clamp(detailRaw.sub(0.42).mul(1.5).add(1), 0.5, 1.7); // ~1 on average, +/-50% at the extremes
  const foot = float(1).sub(smoothstep(0.9, 0.0, wp.y).mul(float(1).sub(top)).mul(0.35));
  const patch = lum(texture(grunge, xz.mul(0.011)).rgb).mul(0.5).add(0.75);
  const base = texture(tex, uv());
  shared.colorNode = base.rgb.mul(detail).mul(foot).mul(mix(float(1), patch, top.mul(0.6)));
  shared.name = 'palette';
  return shared;
}

const index = new Map(palette.swatches.map((s, i) => [s.name, i]));

/** glTF-space UV for a swatch: centre column, v from lit (h=1) to shade (h=0). */
export function swatchUV(name: string, h = 0.5): [number, number] {
  const i = index.get(name);
  if (i === undefined) throw new Error(`unknown swatch ${name}`);
  const g = palette.grid;
  const cell = 1 / g;
  const col = i % g;
  const row = Math.floor(i / g);
  const top = row * cell + cell * 0.125;
  const bottom = row * cell + cell * 0.875;
  return [(col + 0.5) * cell, bottom + (top - bottom) * h];
}

/** Paints procedural geometry with one swatch (UVs follow height for the lit->shade gradient). */
export function paintGeometry<T extends BufferGeometry>(geo: T, swatch: string): T {
  const pos = geo.getAttribute('position');
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox!;
  const span = Math.max(max.y - min.y, 1e-6);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const [u, v] = swatchUV(swatch, (pos.getY(i) - min.y) / span);
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  return geo;
}
