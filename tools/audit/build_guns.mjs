// node tools/audit/build_guns.mjs [id...]   builds the M4 gun models into public/assets/models/wpn/ and registers them in the manifest.
// Contract (src/gameplay/weapons/models.ts): origin = centre of the pistol grip, barrel toward -Z, y up, metres;
// nodes <id>_LOD0 (vertex coloured), optional MAG (+ <id>_MAG mesh), SOCKET_grip/muzzle/sight/support/mag empties.
// Shotgun and bolt rifle are Polyfork models (CC BY 4.0, credited in CREDITS.md) rotated/recoloured; revolver, SMG and the
// magazines are built here from boxes and cylinders.
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Matrix4, Vector3 } from 'three';
import { readFileSync, statSync, writeFileSync } from 'node:fs';

const mat4 = {
  create: () => new Matrix4(),
  translate: (o, m, v) => o.copy(m.multiply(new Matrix4().makeTranslation(...v))),
  rotateX: (o, m, a) => o.copy(m.multiply(new Matrix4().makeRotationX(a))),
  rotateY: (o, m, a) => o.copy(m.multiply(new Matrix4().makeRotationY(a))),
  scale: (o, m, v) => o.copy(m.multiply(new Matrix4().makeScale(...v))),
  multiply: (_, a, b) => new Matrix4().multiplyMatrices(a, b),
};
const vec3 = {
  sub: (_, a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross: (_, a, b) => new Vector3(...a).cross(new Vector3(...b)).toArray(),
  normalize: (_, a) => new Vector3(...a).normalize().toArray(),
  transformMat4: (_, a, m) => new Vector3(...a).applyMatrix4(m).toArray(),
};
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const srgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2)); };

/** Accumulating mesh builder: positions, normals, linear colours, indices. */
class B {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; }
  addTri(a, b, c, col) {
    const u = vec3.sub([], b, a), v = vec3.sub([], c, a), nn = vec3.normalize([], vec3.cross([], u, v));
    const base = this.p.length / 3;
    for (const q of [a, b, c]) { this.p.push(...q); this.n.push(...nn); this.c.push(...col, 1); }
    this.i.push(base, base + 1, base + 2);
  }
  /** Box centred at (cx,cy,cz), size (sx,sy,sz), pitched rx (about X) then yawed ry (about Y) around its centre. */
  box(cx, cy, cz, sx, sy, sz, hex, rx = 0, ry = 0) {
    const col = srgb(hex), m = new Matrix4().makeTranslation(cx, cy, cz).multiply(new Matrix4().makeRotationY(ry)).multiply(new Matrix4().makeRotationX(rx));
    const h = [sx / 2, sy / 2, sz / 2];
    const V = (x, y, z) => new Vector3(x * h[0], y * h[1], z * h[2]).applyMatrix4(m).toArray();
    const f = [[[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]];
    for (const q of f) { const [a, b, c, d] = q.map((t) => V(...t)); this.addTri(a, b, c, col); this.addTri(a, c, d, col); }
  }
  /** Cylinder along Z centred at (cx,cy,cz), radius r (rx,ry scale for ovals), length len. */
  cyl(cx, cy, cz, r, len, hex, seg = 8, ry = r) {
    const col = srgb(hex), z0 = cz - len / 2, z1 = cz + len / 2;
    const P = (k, z) => [cx + Math.cos((k / seg) * Math.PI * 2) * r, cy + Math.sin((k / seg) * Math.PI * 2) * ry, z];
    for (let k = 0; k < seg; k++) {
      const a = P(k, z0), b = P(k + 1, z0), c = P(k + 1, z1), d = P(k, z1);
      this.addTri(a, c, b, col); this.addTri(a, d, c, col);
      this.addTri([cx, cy, z0], b, a, col); this.addTri([cx, cy, z1], d, c, col);
    }
  }
  /** Append another doc's meshes (all nodes, world space) through a matrix and a colour remap. */
  addDoc(doc, m, remap) {
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh(); if (!mesh) continue;
      const w = new Matrix4().multiplyMatrices(m, new Matrix4().fromArray(node.getWorldMatrix()));
      const nmat = new Matrix4().copy(w).invert().transpose();
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), col = prim.getAttribute('COLOR_0'), idx = prim.getIndices();
        const base = this.p.length / 3, matName = prim.getMaterial()?.getName() ?? '';
        for (let k = 0; k < pos.getCount(); k++) {
          this.p.push(...new Vector3(...pos.getElement(k, [])).applyMatrix4(w).toArray());
          this.n.push(...new Vector3(...nor.getElement(k, [])).applyMatrix4(nmat.clone().setPosition(0, 0, 0)).normalize().toArray());
          let c = col ? col.getElement(k, []) : [0.5, 0.5, 0.5, 1];
          if (col && col.getComponentType() !== 5126) c = c.map((v) => v / (col.getNormalized() ? 1 : 255));
          this.c.push(...(remap ? remap(c, matName) : c).slice(0, 3), 1);
        }
        const count = idx ? idx.getCount() : pos.getCount();
        for (let k = 0; k < count; k++) this.i.push(base + (idx ? idx.getScalar(k) : k));
      }
    }
  }
  bounds() { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let k = 0; k < this.p.length; k += 3) for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], this.p[k + j]); mx[j] = Math.max(mx[j], this.p[k + j]); } return { mn, mx }; }
  tris() { return this.i.length / 3; }
}

function write(id, parts, sockets, magBuilder, magSocketPos) {
  const doc = new Document(); const buf = doc.createBuffer();
  const mat = doc.createMaterial('vcol').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.85).setMetallicFactor(0);
  const mk = (b, name) => {
    const prim = doc.createPrimitive().setMaterial(mat)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(b.p)).setBuffer(buf))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(b.n)).setBuffer(buf))
      .setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(new Float32Array(b.c)).setBuffer(buf))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(b.i)).setBuffer(buf));
    return doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
  };
  const root = doc.createNode(id);
  root.addChild(mk(parts, `${id}_LOD0`));
  if (magBuilder) {
    const mn = doc.createNode('MAG').setTranslation(magSocketPos);
    const m = mk(magBuilder, `${id}_MAG`); m.setTranslation(magSocketPos.map((v) => -v)); mn.addChild(m); root.addChild(mn);
  }
  for (const [k, p] of Object.entries(sockets)) root.addChild(doc.createNode('SOCKET_' + k).setTranslation(p));
  doc.createScene('s').addChild(root);
  const path = `public/assets/models/wpn/${id}.glb`;
  return io.write(path, doc).then(() => {
    const mf = 'public/assets/models/manifest.json';
    const m = JSON.parse(readFileSync(mf, 'utf8'));
    const tris = { [`${id}_LOD0`]: parts.tris() }; if (magBuilder) tris[`${id}_MAG`] = magBuilder.tris();
    m[id] = { url: `/assets/models/wpn/${id}.glb`, category: 'wpn', tris, bytes: statSync(path).size };
    writeFileSync(mf, JSON.stringify(m, null, 2) + '\n');
    const b = parts.bounds();
    console.log(id, 'tris', parts.tris(), 'bounds', b.mn.map((v) => +v.toFixed(3)), b.mx.map((v) => +v.toFixed(3)), (statSync(path).size / 1024).toFixed(1) + ' KB');
  });
}

const steel = '#5b6168', steelDark = '#2f3338', black = '#1d1f22', wood = '#7a4f2a', woodDark = '#4a2f1a', brass = '#a8873c';
const todo = new Set(process.argv.slice(2));
const want = (id) => !todo.size || todo.has(id);

// ---------------- Revolver (6 shot, .357) ----------------
if (want('wpn_revolver_a')) {
  const b = new B();
  b.box(0, -0.04, 0.02, 0.028, 0.105, 0.045, wood, -0.28);              // grip
  b.box(0, 0.045, -0.02, 0.026, 0.055, 0.1, steel);                     // frame
  b.cyl(0, 0.052, -0.075, 0.028, 0.048, steelDark, 8);                  // cylinder
  b.cyl(0, 0.06, -0.165, 0.0115, 0.13, steel, 8);                       // barrel
  b.box(0, 0.04, -0.15, 0.016, 0.014, 0.1, steel);                      // underlug
  b.box(0, 0.083, -0.225, 0.006, 0.014, 0.008, black);                  // front sight
  b.box(0, 0.083, 0.005, 0.016, 0.008, 0.012, black);                   // rear sight
  b.box(0, 0.079, 0.032, 0.008, 0.026, 0.016, steelDark, 0.5);          // hammer
  b.box(0, 0.0, -0.035, 0.006, 0.006, 0.05, steel);                     // trigger guard bottom
  b.box(0, 0.016, -0.06, 0.006, 0.026, 0.006, steel);                   // trigger guard front
  b.box(0, 0.027, -0.012, 0.005, 0.02, 0.006, steelDark, -0.3);         // trigger
  await write('wpn_revolver_a', b, { grip: [0, 0, 0], muzzle: [0, 0.06, -0.232], sight: [0, 0.088, 0.005] }, null, null);
}

// ---------------- SMG (9 mm, compact, 30-round stick magazine) ----------------
if (want('wpn_smg_a')) {
  const b = new B(), m = new B();
  b.box(0, -0.035, 0.012, 0.03, 0.115, 0.045, black, -0.22);            // grip
  b.box(0, 0.058, -0.12, 0.048, 0.07, 0.3, steelDark);                  // receiver
  b.box(0, 0.098, -0.12, 0.03, 0.01, 0.28, steel);                      // top cover
  b.cyl(0, 0.062, -0.35, 0.025, 0.17, black, 8);                        // barrel shroud
  b.cyl(0, 0.062, -0.45, 0.009, 0.05, steel, 6);                        // muzzle
  b.box(0, 0.108, -0.42, 0.006, 0.02, 0.008, black);                    // front sight
  b.box(0, 0.108, -0.01, 0.02, 0.014, 0.012, black);                    // rear sight
  b.box(0, 0.06, 0.15, 0.014, 0.05, 0.16, steel);                       // stock tube
  b.box(0, 0.04, 0.24, 0.02, 0.1, 0.02, black);                         // butt
  b.box(0, 0.0, -0.05, 0.008, 0.008, 0.065, steelDark);                 // trigger guard
  b.box(0, 0.026, -0.015, 0.006, 0.022, 0.006, steel, -0.3);
  b.box(0, 0.05, -0.285, 0.036, 0.03, 0.1, black);                      // handguard
  b.box(0, 0.075, 0.012, 0.02, 0.02, 0.02, steel);                      // charging handle
  m.box(0, -0.065, -0.02, 0.022, 0.15, 0.04, steelDark, 0.1); m.box(0, -0.147, -0.012, 0.026, 0.012, 0.046, black, 0.1);
  await write('wpn_smg_a', b, { grip: [0, 0, 0], muzzle: [0, 0.062, -0.478], sight: [0, 0.115, -0.01], support: [0, 0.06, -0.29], mag: [0, 0.03, -0.12] }, m, [0, 0.03, -0.12]);
}

// ---------------- Pump shotgun (Polyfork "Scattergun", recoloured) ----------------
if (want('wpn_shotgun_a')) {
  const doc = await io.read('assets/gen/polyfork/scattergun-66b775.glb');
  const b = new B(); const m = mat4.create();
  // barrel is +Z in the source: turn it to -Z, then move the pistol grip (about z=-0.155, y=0.13 after the turn: +0.155) to the origin
  mat4.rotateY(m, m, Math.PI); mat4.translate(m, m, [0, -0.13, 0.155]);
  const dark = srgb('#2b2e33'), light = srgb('#5a5f66');
  b.addDoc(doc, m, (c, mat) => (mat === 'crystal' ? dark : mat === 'metal' ? c.map((v, i) => v * 0.55 + dark[i] * 0.15) : c));
  await write('wpn_shotgun_a', b, { grip: [0, 0, 0], muzzle: [0, 0.075, -0.63], sight: [0, 0.14, -0.3], support: [0, 0.03, -0.4] }, null, null);
}

// ---------------- Bolt-action hunting rifle (Polyfork) ----------------
if (want('wpn_bolt_a')) {
  const doc = await io.read('assets/gen/polyfork/bolt-action-rifle-2f1793.glb');
  // long axis is +X (muzzle toward +X): turn it to -Z; the grip point (x along the gun, y up, source units) goes to the origin
  const S = 0.92, GX = Number(process.env.GRIPX ?? -0.2), GY = Number(process.env.GRIPY ?? 0.07);
  const b2 = new B(); const m2 = mat4.create();
  mat4.rotateY(m2, m2, Math.PI / 2); mat4.scale(m2, m2, [S, S, S]); mat4.translate(m2, m2, [-GX, -GY, 0]);
  b2.addDoc(doc, m2, null);
  const bb = b2.bounds();
  await write('wpn_bolt_a', b2, { grip: [0, 0, 0], muzzle: [0, 0.14 * S, bb.mn[2] + 0.005], sight: [0, 0.17 * S, -0.3], support: [0, 0.1, -0.35] }, null, null);
}

// ---------------- Magazines (world models) ----------------
const mags = {
  wpn_mag_revolver_a: (b) => { b.cyl(0, 0, 0, 0.03, 0.05, steelDark, 8); for (let k = 0; k < 6; k++) b.cyl(Math.cos(k * 1.047) * 0.017, Math.sin(k * 1.047) * 0.017, 0.026, 0.006, 0.006, brass, 5); },
  wpn_mag_smg_a: (b) => { b.box(0, -0.065, 0, 0.022, 0.15, 0.04, steelDark, 0.1); b.box(0, -0.147, 0.008, 0.026, 0.012, 0.046, black, 0.1); },
  wpn_mag_shotgun_a: (b) => { for (let k = 0; k < 4; k++) { b.cyl(0, 0.0, -0.045 + k * 0.03, 0.0095, 0.07, '#b83a2e', 8); b.cyl(0, 0.0, -0.045 + k * 0.03 + 0.04, 0.0098, 0.014, brass, 8); } },
  wpn_mag_bolt_a: (b) => { b.box(0, 0, 0, 0.028, 0.012, 0.075, steel); for (let k = 0; k < 5; k++) b.cyl(-0.011 + k * 0.0055, 0.011, 0, 0.0028, 0.07, brass, 5); },
};
for (const [id, f] of Object.entries(mags)) if (want(id)) { const b = new B(); f(b); await write(id, b, { grip: [0, 0, 0] }, null, null); }
