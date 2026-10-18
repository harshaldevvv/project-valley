import { MeshStandardNodeMaterial } from 'three/webgpu';
import { BufferAttribute, BufferGeometry, LinearFilter, SRGBColorSpace, Texture, TextureLoader } from 'three';
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
  shared = new MeshStandardNodeMaterial({ map: tex, roughness: 0.85, metalness: 0 });
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
