import { MeshStandardNodeMaterial } from 'three/webgpu';
import { vertexColor, sin, texture, uv, positionGeometry, positionWorld, normalWorld, abs, mix, float, vec3, vec2, dot, smoothstep, clamp } from 'three/tsl';
import { BufferAttribute, BufferGeometry, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from 'three';
import palette from '../content/data/palette.json';
import { assetUrl } from './assetUrl';

/**
 * The one shared material for all palette-atlas models (art bible). GLBs ship without textures;
 * the loader swaps their placeholder material for this, so everything can batch/instance together.
 * No mipmaps: 16 px swatches would bleed into neighbours when minified.
 */
let shared: MeshStandardNodeMaterial | null = null;

let atlas: Texture | null = null;
async function paletteAtlas() {
  if (atlas) return atlas;
  const tex: Texture = await new TextureLoader().loadAsync(assetUrl('assets/textures/palette.png'));
  tex.flipY = false; // glTF UV convention
  tex.colorSpace = SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  return (atlas = tex);
}

/** Plain atlas material: for everything that moves (characters, zombies, weapons, vehicles) and loose pieces. */
export async function paletteMaterial() {
  if (shared) return shared;
  shared = new MeshStandardNodeMaterial({ map: await paletteAtlas(), roughness: 0.85, metalness: 0 });
  shared.name = 'palette';
  return shared;
}

let grungeTex: Promise<Texture | null> | null = null;
/** The grime detail texture (shared with the world material); null if it fails to load. */
export function grungeTexture() {
  return (grungeTex ??= new TextureLoader().loadAsync(assetUrl('assets/textures/grunge.webp')).then((t) => {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }).catch(() => null));
}

let chars: MeshStandardNodeMaterial | null = null;
/** Atlas + bind-pose grime for animated characters (position taken from the rest pose, so it never swims). */
export async function paletteCharacterMaterial() {
  if (chars) return chars;
  const [plain, atlasTex, grunge] = [await paletteMaterial(), await paletteAtlas(), await grungeTexture()];
  if (!grunge) return (chars = plain);
  const bp = positionGeometry;
  const lumv = (n: any) => dot(n, vec3(0.2126, 0.7152, 0.0722));
  const gA = lumv(texture(grunge, vec2(bp.x.add(bp.z.mul(0.7)), bp.y).mul(1.4)).rgb);
  const gB = lumv(texture(grunge, vec2(bp.z.sub(bp.x.mul(0.6)), bp.y).mul(0.6).add(vec2(0.3, 0.2))).rgb);
  const wear = clamp(gA.sub(0.42).mul(1.5).add(1), 0.6, 1.4);
  const base = texture(atlasTex, uv()).rgb.mul(wear);
  const dirt = smoothstep(0.7, 0.0, bp.y).mul(0.4); // mud on boots and trouser hems
  const dust = smoothstep(0.55, 0.8, gB).mul(0.18); // pale dusty patches on the cloth
  const m = new MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0 });
  m.colorNode = mix(mix(base, base.mul(vec3(0.55, 0.46, 0.34)), dirt), vec3(0.62, 0.58, 0.5), dust);
  m.map = atlasTex;
  m.name = 'palette_character';
  return (chars = m);
}

let arms: MeshStandardNodeMaterial | null = null;
/** First-person arms: the atlas skin swatch is a saturated orange; shift skin pixels to a natural tone and add cloth wear. */
export async function paletteArmsMaterial() {
  if (arms) return arms;
  const [plain, atlasTex, grunge] = [await paletteMaterial(), await paletteAtlas(), await grungeTexture()];
  const c = texture(atlasTex, uv()).rgb;
  const skin = smoothstep(0.18, 0.36, c.x.sub(c.z)).mul(smoothstep(0.0, 0.08, c.x.sub(c.y))); // strongly orange-red pixels
  const l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  const natural = vec3(0.36, 0.2, 0.14).mul(l.mul(1.5).add(0.35));
  let col: any = mix(c, natural, skin.mul(0.85));
  void grunge; // no object-space wear on the arms: their positions are normalised int16, so the pattern scale is arbitrary
  const m = new MeshStandardNodeMaterial({ roughness: 0.8, metalness: 0 });
  m.colorNode = col;
  m.map = atlasTex;
  m.name = 'palette_arms';
  return (arms = grunge || atlasTex ? m : plain);
}

/** Colour-node snippet shared by AI-made characters: fabric/skin micro detail and grime from the grime texture, sampled in
 *  UV space (stable under skinning and meshopt quantisation): +-18 % luminance at two scales plus darkened creases. */
export function characterDetail(map: Texture, grunge: Texture | null) {
  const base = texture(map, uv()).rgb;
  if (!grunge) return base;
  const lumv = (n: any) => dot(n, vec3(0.2126, 0.7152, 0.0722));
  const fine = lumv(texture(grunge, uv().mul(9)).rgb);
  const coarse = lumv(texture(grunge, uv().mul(2.3).add(vec2(0.37, 0.11))).rgb);
  const k = clamp(fine.sub(0.45).mul(0.9).add(1), 0.78, 1.2).mul(clamp(coarse.sub(0.4).mul(0.7).add(1), 0.85, 1.12));
  return base.mul(k);
}
const detailMats = new Map<Texture, MeshStandardNodeMaterial>();
/** Material for a mesh that carries its own baked texture (AI characters): that texture plus the detail overlay. */
export async function characterDetailMaterial(map: Texture) {
  let m = detailMats.get(map);
  if (m) return m;
  const grunge = await grungeTexture();
  m = new MeshStandardNodeMaterial({ roughness: 0.82, metalness: 0 });
  m.colorNode = characterDetail(map, grunge);
  m.map = map;
  m.name = 'character_detail';
  detailMats.set(map, m);
  return m;
}

let armsVc: MeshStandardNodeMaterial | null = null;
/** First-person arms with baked vertex colours (smooth subdivided mesh, no UVs). */
export function armsVertexMaterial() {
  return (armsVc ??= (() => {
    const m = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
    m.name = 'arms_vc';
    return m;
  })());
}

let gear: MeshStandardNodeMaterial | null = null;
/** Atlas + object-space wear for held gear (weapons, tools): scratches, soot and glossier dark metal. */
export async function paletteGearMaterial() {
  if (gear) return gear;
  const [plain, atlasTex, grunge] = [await paletteMaterial(), await paletteAtlas(), await grungeTexture()];
  if (!grunge) return (gear = plain);
  const lp = positionGeometry;
  const lumv = (n: any) => dot(n, vec3(0.2126, 0.7152, 0.0722));
  const gA = lumv(texture(grunge, vec2(lp.x.add(lp.z), lp.y.add(lp.z.mul(0.5))).mul(3.2)).rgb);
  const gB = lumv(texture(grunge, vec2(lp.z.mul(2.1), lp.y.add(lp.x).mul(2.6)).add(vec2(0.4, 0.1))).rgb);
  const base = texture(atlasTex, uv()).rgb.mul(clamp(gA.sub(0.42).mul(1.7).add(1), 0.55, 1.5));
  // wood (the saturated orange-brown swatches): darker, less orange, with grain along the barrel axis
  const woodMask = smoothstep(0.2, 0.34, base.x.sub(base.z)).mul(smoothstep(0.02, 0.1, base.x.sub(base.y)));
  const grain = sin(lp.z.mul(70).add(gA.mul(7)).add(lp.y.mul(25))).mul(0.5).add(0.5);
  const woodCol = vec3(0.16, 0.075, 0.035).mul(grain.mul(0.35).add(0.75)).mul(lumv(base).mul(0.9).add(0.5));
  const col = mix(base, woodCol, woodMask.mul(0.8)).add(smoothstep(0.58, 0.8, gB).mul(0.1)); // bright scratches
  const m = new MeshStandardNodeMaterial({ metalness: 0 });
  m.colorNode = col;
  m.roughnessNode = mix(float(0.42), float(0.85), smoothstep(0.08, 0.3, lumv(base)));
  m.map = atlasTex;
  m.name = 'palette_gear';
  return (gear = m);
}

let world: MeshStandardNodeMaterial | null = null;
let detailFactor: any = null; // TSL node: the world-space surface detail multiplier (built with the world material)
let pfMat: MeshStandardNodeMaterial | null = null;

/**
 * World-detail material for vertex-coloured static models (Polyfork props, buildings, trees): their own colours times the
 * same grass/dirt/concrete/grime detail as the palette world, plus a slight desaturation toward the lawn so hand-made
 * models and AI-textured ground read as one art style. Static objects only (world-space projection).
 */
export async function pfWorldMaterial() {
  if (pfMat) return pfMat;
  await paletteWorldMaterial();
  const m = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  if (detailFactor) {
    const c = vertexColor().rgb;
    const l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    const soft = mix(vec3(l), c, 0.88).mul(vec3(0.96, 0.97, 0.93)); // 12 % desaturated, a touch warmer
    m.colorNode = soft.mul(0.92).add(0.035).mul(mix(float(1), detailFactor, 0.8)); // lift near-black vertex colours a little
  }
  m.name = 'pf_world';
  return (pfMat = m);
}
/**
 * The atlas plus world-space surface detail, for STATIC world geometry only (merged yard mesh, instanced statics):
 * the detail is projected from world position, so it would swim on anything that moves.
 * AI-generated textures (see CREDITS.md) as luminance-only multipliers so the palette keeps its hues. Top faces get
 * grass + gravel, side faces grime + concrete, at two scales to hide tiling; walls darken at the foot (fake contact
 * AO); a very low-frequency patch tint stops big surfaces looking printed. If a texture fails to load, the plain
 * material is returned instead.
 */
export async function paletteWorldMaterial() {
  if (world) return world;
  const plain = await paletteMaterial();
  const tex = await paletteAtlas();
  const load = async (n: string) => {
    const t = await new TextureLoader().loadAsync(assetUrl(`assets/textures/${n}.webp`));
    t.wrapS = t.wrapT = RepeatWrapping;
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    return t;
  };
  let tx: Texture[];
  try {
    tx = await Promise.all(['grass', 'dirt', 'concrete', 'grunge'].map(load));
  } catch (e) {
    console.warn('detail textures failed to load; using the plain palette', e);
    return (world = plain);
  }
  const [grass, dirt, concrete, grunge] = tx;
  const m = new MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0 });
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
  detailFactor = detail.mul(foot).mul(mix(float(1), patch, top.mul(0.6)));
  m.colorNode = base.rgb.mul(detailFactor);
  m.map = tex;
  m.name = 'palette_world';
  return (world = m);
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
