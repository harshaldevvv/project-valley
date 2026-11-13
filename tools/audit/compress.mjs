// Compresses the AI-made assets in place: GLB textures -> WebP (resized), geometry -> meshopt; PNG detail textures and decals -> WebP.
// Originals are kept in assets/gen/orig (git-ignored). node tools/audit/compress.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import sharp from 'sharp';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const orig = 'assets/gen/orig'; mkdirSync(orig, { recursive: true });
const BUILDINGS = /barn|ruined_house|gas_station|small_church|farm_silo|water_tower|shipping_container|burned_van|wreck_sedan/;
let before = 0, after = 0;
const dirs = [['public/assets/models/gen', null], ['public/assets/models/zmb', /^zmb_ai_/], ['public/assets/models/chr', /^chr_survivor/]];
for (const [dir, only] of dirs) {
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.glb') && (!only || only.test(f)))) {
    const p = `${dir}/${f}`; if (!existsSync(`${orig}/${f}`)) copyFileSync(p, `${orig}/${f}`);
    const src = `${orig}/${f}`; before += statSync(src).size;
    const doc = await io.read(src);
    const size = BUILDINGS.test(f) ? 768 : 512;
    await doc.transform(dedup(), prune({ keepAttributes: true, keepLeaves: true }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 78 }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(p, doc); after += statSync(p).size;
  }
}
const imgs = [['public/assets/textures', ['grass', 'dirt', 'concrete', 'grunge'], 85], ['public/assets/textures/decals', null, 82], ['public/assets/art', ['keyart'], 80]];
for (const [dir, names, q] of imgs) {
  for (const f of readdirSync(dir).filter((f) => /\.(png|jpg)$/.test(f))) {
    const n = f.replace(/\.(png|jpg)$/, ''); if (names && !names.includes(n)) continue;
    const p = `${dir}/${f}`; before += statSync(p).size;
    const out = `${dir}/${n}.webp`; await sharp(p).webp({ quality: q }).toFile(out); after += statSync(out).size;
    mkdirSync(`${orig}/img`, { recursive: true }); copyFileSync(p, `${orig}/img/${f}`); unlinkSync(p);
  }
}
console.log(`before ${(before / 1048576).toFixed(1)} MB -> after ${(after / 1048576).toFixed(1)} MB`);
