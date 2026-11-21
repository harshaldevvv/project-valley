import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, type BufferGeometry } from 'three';
import { buildMuzzle, buildOptic } from '../../gameplay/weapons/attachParts';

/**
 * E4 round 2: simple low-poly pickup models built in code (own work, no third-party assets) for items with no catalog
 * match: tools, melee, throwables, ammo boxes, materials, every clothing piece and backpack. Each builder returns a
 * model in metres lying on the ground (y >= 0, long side along X); `tint` is the item's iconSwatch so variants of one
 * shape (jackets, boots, packs) read apart. PICKUP_MODELS.shapes maps item id -> builder key.
 */
type Builder = (tint: string) => Group;

const mats = new Map<string, MeshStandardMaterial>();
function mat(color: string, metal = false) {
  const k = `${color}|${metal}`;
  let m = mats.get(k);
  if (!m) mats.set(k, (m = new MeshStandardMaterial({ color, roughness: metal ? 0.45 : 0.85, metalness: metal ? 0.5 : 0, flatShading: true })));
  return m;
}
/** f < 1 darkens, f > 1 lightens towards white. */
function shade(hex: string, f: number) {
  const c = new Color(hex);
  if (f <= 1) c.multiplyScalar(f);
  else c.lerp(new Color('#ffffff'), Math.min(1, f - 1));
  return `#${c.getHexString()}`;
}

const STEEL = '#8d9398';
const DARK = '#222528';
const WOOD = '#a87a4a';
const BRASS = '#c9a24a';

function add(g: Group, geo: BufferGeometry, color: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, metal = false) {
  const m = new Mesh(geo, mat(color, metal));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  g.add(m);
  return m;
}
const box = (g: Group, w: number, h: number, d: number, color: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, metal = false) =>
  add(g, new BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz, metal);
/** Cylinder along `axis` ('y' upright, 'x' lying along X, 'z' lying along Z). r2 = radius at the +axis end. */
function cyl(g: Group, r: number, len: number, color: string, x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'y', r2 = r, seg = 8, metal = false) {
  const geo = new CylinderGeometry(r2, r, len, seg);
  if (axis === 'x') geo.rotateZ(-Math.PI / 2);
  else if (axis === 'z') geo.rotateX(Math.PI / 2);
  return add(g, geo, color, x, y, z, 0, 0, 0, metal);
}
function dome(g: Group, r: number, color: string, x: number, y: number, z: number, sy = 1, sx = 1, sz = 1) {
  const m = add(g, new SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), color, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}
const make = (fn: (g: Group) => void) => {
  const g = new Group();
  fn(g);
  return g;
};

// ---------------------------------------------------------------- melee, tools, throwables

function bat(nails: boolean): Builder {
  return () =>
    make((g) => {
      const r = 0.032;
      cyl(g, 0.014, 0.3, shade(WOOD, 0.8), -0.25, r, 0, 'x', 0.016); // handle
      cyl(g, 0.017, 0.46, WOOD, 0.13, r, 0, 'x', r); // barrel
      cyl(g, 0.02, 0.012, shade(WOOD, 0.7), -0.405, r, 0, 'x'); // knob
      cyl(g, 0.0145, 0.1, DARK, -0.33, r, 0, 'x', 0.0155); // grip tape
      if (nails)
        for (let i = 0; i < 9; i++) {
          const a = i * 2.2;
          const x = 0.1 + (i % 5) * 0.045;
          const n = cyl(g, 0.0025, 0.06, STEEL, x, r + Math.cos(a) * 0.035, Math.sin(a) * 0.035, 'y', 0.0025, 4, true);
          n.rotation.x = a;
        }
    });
}

const machete: Builder = () =>
  make((g) => {
    box(g, 0.4, 0.005, 0.05, '#a3a9ad', 0.07, 0.004, 0, 0, 0, 0, true); // blade
    box(g, 0.08, 0.005, 0.035, '#a3a9ad', 0.29, 0.004, 0.006, 0, 0.35, 0, true); // tip
    box(g, 0.4, 0.006, 0.008, shade(STEEL, 0.7), 0.07, 0.004, -0.022, 0, 0, 0, true); // spine
    box(g, 0.012, 0.016, 0.07, DARK, -0.135, 0.008, 0); // guard
    box(g, 0.13, 0.022, 0.03, '#3a2a1e', -0.21, 0.011, 0); // handle
  });

const grenade: Builder = () =>
  make((g) => {
    const s = add(g, new SphereGeometry(0.03, 9, 7), '#4a5a32', 0, 0.03, 0);
    s.scale.set(1.25, 1, 1);
    cyl(g, 0.012, 0.02, '#5a5e60', 0.045, 0.03, 0, 'x', 0.01, 8, true); // fuse
    box(g, 0.06, 0.004, 0.012, '#6a6e70', 0.02, 0.058, 0, 0, 0, -0.25, true); // spoon
    add(g, new CylinderGeometry(0.011, 0.011, 0.003, 10, 1, true), '#b8bcbf', 0.06, 0.045, 0.012, Math.PI / 2, 0, 0, true); // pin ring
  });

function flare(len: number): Builder {
  return (tint) =>
    make((g) => {
      const r = 0.017;
      cyl(g, r, len, tint, 0, r, 0, 'x');
      cyl(g, r * 1.05, 0.03, DARK, len / 2 - 0.01, r, 0, 'x'); // striker cap
      cyl(g, r * 1.02, 0.02, '#e8e2d0', -len / 4, r, 0, 'x'); // label band
    });
}

const binoculars: Builder = () =>
  make((g) => {
    for (const z of [-0.035, 0.035]) {
      cyl(g, 0.028, 0.1, DARK, 0, 0.03, z, 'x', 0.03);
      cyl(g, 0.02, 0.025, '#111214', -0.06, 0.03, z, 'x'); // eyecup
      cyl(g, 0.026, 0.004, '#2a4a60', 0.052, 0.03, z, 'x'); // lens
    }
    box(g, 0.05, 0.016, 0.05, '#3a3e42', -0.01, 0.045, 0); // bridge
    cyl(g, 0.008, 0.02, '#3a3e42', -0.01, 0.058, 0, 'z'); // focus wheel
  });

const lockpick: Builder = () =>
  make((g) => {
    box(g, 0.1, 0.012, 0.055, '#4a3020', 0, 0.006, 0); // leather case
    for (let i = 0; i < 3; i++) box(g, 0.09, 0.002, 0.004, STEEL, 0.06, 0.013, -0.015 + i * 0.015, 0, (i - 1) * 0.12, 0, true);
    box(g, 0.012, 0.004, 0.06, '#c9a24a', -0.045, 0.012, 0, 0, 0, 0, true); // snap
  });

const ductTape: Builder = () =>
  make((g) => {
    cyl(g, 0.05, 0.048, '#9da3a6', 0, 0.024, 0, 'y', 0.05, 14);
    cyl(g, 0.028, 0.05, '#b08a5a', 0, 0.025, 0, 'y', 0.028, 12); // cardboard core
    cyl(g, 0.024, 0.052, '#1a1a1a', 0, 0.025, 0, 'y', 0.024, 12); // hole
    box(g, 0.05, 0.002, 0.045, '#9da3a6', 0.07, 0.001, 0); // loose end on the ground
  });

const multitool: Builder = () =>
  make((g) => {
    box(g, 0.1, 0.012, 0.022, '#9a2a24', 0, 0.006, 0); // handles
    box(g, 0.1, 0.004, 0.024, STEEL, 0, 0.014, 0, 0, 0, 0, true);
    box(g, 0.05, 0.006, 0.01, STEEL, 0.07, 0.008, 0.008, 0, 0.3, 0, true); // plier jaws
    box(g, 0.05, 0.006, 0.01, STEEL, 0.07, 0.008, -0.008, 0, -0.3, 0, true);
    box(g, 0.06, 0.003, 0.012, '#b8bcbf', -0.06, 0.016, 0.02, 0, -0.5, 0, true); // flipped-out blade
  });

const boltCutters: Builder = () =>
  make((g) => {
    for (const s of [-1, 1]) {
      const a = s * 0.07;
      const h = cyl(g, 0.01, 0.42, STEEL, -0.05, 0.012, s * 0.03, 'x', 0.01, 6, true);
      h.rotation.y = a;
      const grip = cyl(g, 0.014, 0.16, '#b83228', -0.2, 0.014, s * 0.045, 'x', 0.013, 6);
      grip.rotation.y = a;
      box(g, 0.09, 0.016, 0.022, '#3a3e42', 0.2, 0.012, s * 0.012, 0, -s * 0.12, 0, true); // jaw
    }
    box(g, 0.04, 0.02, 0.05, '#3a3e42', 0.15, 0.012, 0, 0, 0, 0, true); // pivot block
  });

const canOpener: Builder = () =>
  make((g) => {
    box(g, 0.12, 0.01, 0.016, '#2a2e32', -0.02, 0.006, 0.012, 0, 0.06, 0);
    box(g, 0.12, 0.01, 0.016, '#2a2e32', -0.02, 0.006, -0.012, 0, -0.06, 0);
    box(g, 0.04, 0.014, 0.04, STEEL, 0.055, 0.008, 0, 0, 0, 0, true);
    cyl(g, 0.016, 0.01, '#b8bcbf', 0.055, 0.02, 0, 'y', 0.016, 10, true); // key
  });

const lighter: Builder = (tint) =>
  make((g) => {
    box(g, 0.06, 0.012, 0.024, tint, 0, 0.006, 0);
    box(g, 0.016, 0.014, 0.024, STEEL, 0.035, 0.007, 0, 0, 0, 0, true); // hood
    cyl(g, 0.005, 0.01, '#3a3e42', 0.035, 0.007, 0, 'z', 0.005, 8, true); // wheel
  });

const whistle: Builder = (tint) =>
  make((g) => {
    cyl(g, 0.013, 0.03, tint, 0.01, 0.013, 0, 'z', 0.013, 10);
    box(g, 0.035, 0.012, 0.016, tint, -0.012, 0.009, 0);
    box(g, 0.006, 0.004, 0.01, DARK, -0.002, 0.016, 0); // slot
    add(g, new CylinderGeometry(0.008, 0.008, 0.003, 8, 1, true), '#b8bcbf', -0.034, 0.009, 0, Math.PI / 2, 0, 0, true); // lanyard ring
  });

const sewingKit: Builder = (tint) =>
  make((g) => {
    cyl(g, 0.05, 0.02, tint, 0, 0.01, 0, 'y', 0.05, 14); // tin
    cyl(g, 0.051, 0.006, shade(tint, 0.7), 0, 0.02, 0, 'y', 0.051, 14); // lid rim
    cyl(g, 0.01, 0.02, '#c23b32', 0.07, 0.01, 0.02, 'y', 0.01, 8); // spool
    cyl(g, 0.01, 0.02, '#2f5a8a', 0.075, 0.01, -0.015, 'y', 0.01, 8);
    box(g, 0.05, 0.002, 0.002, '#c9cdd0', 0.02, 0.024, 0.0, 0, 0.5, 0, true); // needle
  });

const flashlight: Builder = () =>
  make((g) => {
    cyl(g, 0.017, 0.15, DARK, -0.02, 0.026, 0, 'x', 0.017, 10, true);
    cyl(g, 0.017, 0.045, '#2f3437', 0.075, 0.026, 0, 'x', 0.026, 10, true); // head
    cyl(g, 0.023, 0.004, '#f2ecc0', 0.099, 0.026, 0, 'x', 0.023, 10); // lens
    box(g, 0.02, 0.006, 0.01, '#5a5e60', 0.02, 0.044, 0); // switch
  });

const pot: Builder = (tint) =>
  make((g) => {
    cyl(g, 0.1, 0.1, tint, 0, 0.05, 0, 'y', 0.1, 14, true);
    cyl(g, 0.093, 0.004, '#1c1e20', 0, 0.099, 0, 'y', 0.093, 14); // inside
    for (const s of [-1, 1]) box(g, 0.04, 0.012, 0.02, DARK, s * 0.115, 0.085, 0);
  });

/** Hot meals: a filled bowl, the food in the item's colour. */
const bowl: Builder = (tint) =>
  make((g) => {
    cyl(g, 0.05, 0.05, '#d8d2c2', 0, 0.025, 0, 'y', 0.07, 12);
    cyl(g, 0.064, 0.004, tint, 0, 0.046, 0, 'y', 0.064, 12);
  });

// ---------------------------------------------------------------- medical and food

const bandageRoll: Builder = (tint) =>
  make((g) => {
    cyl(g, 0.028, 0.06, tint, 0, 0.028, 0, 'x', 0.028, 10);
    box(g, 0.06, 0.002, 0.05, tint, 0, 0.001, 0.05); // unrolled tail
  });

const sterilePack: Builder = (tint) =>
  make((g) => {
    box(g, 0.1, 0.012, 0.075, tint, 0, 0.006, 0);
    box(g, 0.036, 0.002, 0.01, '#c23b32', 0, 0.013, 0);
    box(g, 0.01, 0.002, 0.036, '#c23b32', 0, 0.013, 0);
  });

const splint: Builder = (tint) =>
  make((g) => {
    box(g, 0.32, 0.012, 0.04, tint, 0, 0.006, -0.025);
    box(g, 0.32, 0.012, 0.04, shade(tint, 0.85), 0, 0.006, 0.025);
    for (const x of [-0.1, 0.1]) box(g, 0.03, 0.016, 0.1, '#d8d2c2', x, 0.008, 0); // straps
  });

const injector: Builder = (tint) =>
  make((g) => {
    cyl(g, 0.011, 0.12, tint, 0, 0.011, 0, 'x', 0.011, 8);
    cyl(g, 0.012, 0.025, '#e8e2d0', -0.07, 0.012, 0, 'x', 0.012, 8); // cap
    cyl(g, 0.009, 0.02, '#3a3e42', 0.07, 0.011, 0, 'x', 0.007, 8); // tip guard
  });

const wrapperBar: Builder = (tint) =>
  make((g) => {
    box(g, 0.11, 0.016, 0.035, tint, 0, 0.008, 0);
    for (const s of [-1, 1]) box(g, 0.012, 0.006, 0.037, shade(tint, 0.75), s * 0.061, 0.004, 0); // crimped ends
  });

const snackBag: Builder = (tint) =>
  make((g) => {
    box(g, 0.13, 0.02, 0.1, tint, 0, 0.01, 0);
    box(g, 0.135, 0.008, 0.015, shade(tint, 0.7), 0, 0.006, -0.055); // seal
    box(g, 0.06, 0.003, 0.04, '#6a3a22', 0.01, 0.021, 0.01); // window with jerky
  });

// ---------------------------------------------------------------- ammo

function ammoBox(w: number, h: number, d: number, body: string, band: string, top?: 'shells' | 'rounds'): Builder {
  return () =>
    make((g) => {
      box(g, w, h, d, body, 0, h / 2, 0);
      box(g, w + 0.002, h * 0.35, d + 0.002, band, 0, h * 0.5, 0); // label band
      box(g, w * 0.4, 0.002, d * 0.5, '#efe9d8', -w * 0.18, h + 0.001, 0); // label
      box(g, w * 0.12, 0.002, d + 0.002, band, w * 0.12, h + 0.001, 0); // band across the lid
      if (top === 'shells') for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) cyl(g, 0.0105, 0.012, '#b83228', w * 0.2 + j * 0.022 - 0.01, h + 0.006, -0.022 + i * 0.022, 'y', 0.0105, 8);
      if (top === 'rounds') for (let i = 0; i < 4; i++) cyl(g, 0.005, 0.012, BRASS, w * 0.22, h + 0.006, -d * 0.3 + i * d * 0.2, 'y', 0.003, 6, true);
    });
}

/** 7.62 loose: two stripper clips of brass rounds. */
const stripperClips: Builder = () =>
  make((g) => {
    for (const [cx, cz] of [[0, -0.03], [0.012, 0.035]] as const) {
      box(g, 0.006, 0.006, 0.07, '#5a5e60', cx - 0.032, 0.006, cz, 0, 0, 0, true);
      for (let i = 0; i < 5; i++) {
        const z = cz - 0.028 + i * 0.014;
        cyl(g, 0.0055, 0.04, BRASS, cx - 0.01, 0.006, z, 'x', 0.0055, 6, true);
        cyl(g, 0.0055, 0.018, '#b87333', cx + 0.019, 0.006, z, 'x', 0.002, 6, true);
      }
    }
  });

// ---------------------------------------------------------------- materials

const nails: Builder = () =>
  make((g) => {
    const rot = [0.2, 1.4, 2.1, 0.7, 2.9, 1.1, 0.4, 2.5, 1.8, 0.9, 2.3, 0.1];
    rot.forEach((a, i) => {
      const x = Math.cos(i * 2.4) * 0.03;
      const z = Math.sin(i * 2.4) * 0.03;
      const n = cyl(g, 0.002, 0.07, STEEL, x, 0.003 + (i % 3) * 0.004, z, 'x', 0.002, 4, true);
      n.rotation.y = a;
      const h = cyl(g, 0.0045, 0.002, STEEL, x - Math.cos(a) * 0.035, 0.003 + (i % 3) * 0.004, z + Math.sin(a) * 0.035, 'x', 0.0045, 6, true);
      h.rotation.y = a;
    });
  });

const scrap: Builder = () =>
  make((g) => {
    box(g, 0.22, 0.006, 0.14, '#7a5a3e', 0, 0.01, 0, 0.08, 0.3, 0.05, true);
    box(g, 0.16, 0.006, 0.1, '#8d9398', 0.04, 0.03, 0.02, -0.15, -0.6, 0.1, true);
    box(g, 0.12, 0.05, 0.006, '#6a4a32', -0.05, 0.03, -0.03, 0, 1.1, 0.2, true);
    cyl(g, 0.012, 0.18, '#5a5e60', 0.02, 0.05, -0.04, 'x', 0.012, 6, true).rotation.y = 0.8;
  });

const electronics: Builder = () =>
  make((g) => {
    box(g, 0.11, 0.007, 0.075, '#2f6a3a', 0, 0.0035, 0);
    box(g, 0.03, 0.006, 0.02, '#1a1a1a', -0.02, 0.007, 0.01);
    box(g, 0.018, 0.005, 0.018, '#1a1a1a', 0.025, 0.006, -0.015);
    for (let i = 0; i < 3; i++) cyl(g, 0.005, 0.012, ['#2f4a8a', '#c9a24a', '#1d1f22'][i]!, 0.03 - i * 0.012, 0.01, 0.02, 'y', 0.005, 8);
    cyl(g, 0.002, 0.08, '#c23b32', 0.0, 0.006, -0.03, 'x', 0.002, 4).rotation.y = 0.4; // wire
  });

const powderTin: Builder = () =>
  make((g) => {
    cyl(g, 0.04, 0.09, '#2a2d30', 0, 0.045, 0, 'y', 0.04, 12, true);
    cyl(g, 0.041, 0.035, '#9a2a24', 0, 0.045, 0, 'y', 0.041, 12); // label
    cyl(g, 0.012, 0.012, '#5a5e60', 0.015, 0.095, 0, 'y', 0.012, 8, true); // spout cap
  });

const pipe: Builder = () =>
  make((g) => {
    cyl(g, 0.021, 0.6, '#7d8388', 0, 0.021, 0, 'x', 0.021, 10, true);
    for (const s of [-1, 1]) cyl(g, 0.014, 0.002, '#1a1a1a', s * 0.301, 0.021, 0, 'x', 0.014, 10);
  });

const planks: Builder = () =>
  make((g) => {
    box(g, 0.8, 0.02, 0.1, '#a87a4a', 0, 0.01, -0.055);
    box(g, 0.8, 0.02, 0.1, '#96693e', 0.02, 0.01, 0.055);
    box(g, 0.8, 0.02, 0.1, '#b4895a', 0.01, 0.03, 0.0, 0, 0.06, 0);
  });

// ---------------------------------------------------------------- clothing (folded on the ground)

function jacket(style: 'jacket' | 'hoodie' | 'shirt' | 'puffer'): Builder {
  return (tint) =>
    make((g) => {
      const t = style === 'shirt' ? 0.035 : style === 'puffer' ? 0.07 : 0.05;
      box(g, 0.34, t, 0.38, tint, 0, t / 2, 0); // folded body
      box(g, 0.012, 0.002, 0.34, shade(tint, 0.7), 0, t + 0.001, 0.01); // placket / zip
      box(g, 0.14, t * 0.5, 0.05, shade(tint, 0.8), 0, t + t * 0.25, -0.17); // collar
      if (style === 'hoodie') dome(g, 0.08, shade(tint, 0.9), 0, t, -0.15, 0.45, 1.2, 0.7);
      if (style === 'shirt') for (let i = 0; i < 4; i++) cyl(g, 0.005, 0.003, '#e8e2d0', 0, t + 0.002, -0.1 + i * 0.08, 'y', 0.005, 6);
      if (style === 'puffer') for (let i = 0; i < 4; i++) cyl(g, 0.014, 0.33, shade(tint, 1.12), 0, t, -0.12 + i * 0.09, 'x', 0.014, 6);
      if (style === 'jacket') for (const s of [-1, 1]) box(g, 0.08, 0.004, 0.07, shade(tint, 0.82), s * 0.09, t + 0.002, 0.08); // pockets
    });
}

const pants: Builder = (tint) =>
  make((g) => {
    box(g, 0.24, 0.045, 0.14, tint, 0, 0.0225, -0.14); // seat
    for (const s of [-1, 1]) box(g, 0.112, 0.04, 0.3, tint, s * 0.062, 0.02, 0.09); // legs
    box(g, 0.245, 0.05, 0.03, shade(tint, 0.75), 0, 0.025, -0.21); // waistband
    for (const s of [-1, 1]) box(g, 0.06, 0.004, 0.06, shade(tint, 0.85), s * 0.062, 0.043, 0.05); // cargo pockets
  });

function vest(style: 'soft' | 'armor' | 'rig' | 'hiviz'): Builder {
  return (tint) =>
    make((g) => {
      const t = style === 'armor' ? 0.06 : 0.03;
      const len = style === 'rig' ? 0.24 : 0.38;
      for (const s of [-1, 1]) box(g, 0.15, t, len, tint, s * 0.08, t / 2, 0); // front panels
      for (const s of [-1, 1]) box(g, 0.04, t * 0.8, 0.08, shade(tint, 0.8), s * 0.11, t * 0.4, -len / 2 - 0.03); // shoulder straps
      if (style === 'armor') box(g, 0.24, 0.02, 0.24, shade(tint, 0.85), 0, t + 0.01, 0.02); // plate
      if (style === 'armor' || style === 'rig')
        for (let i = 0; i < 3; i++) box(g, 0.06, 0.03, 0.08, shade(tint, 0.75), -0.07 + i * 0.07, t + (style === 'armor' ? 0.035 : 0.015), len / 2 - 0.05); // mag pouches
      if (style === 'soft') for (const s of [-1, 1]) box(g, 0.08, 0.012, 0.07, shade(tint, 0.82), s * 0.08, t + 0.006, 0.08);
      if (style === 'hiviz') for (const z of [-0.03, 0.08]) box(g, 0.32, 0.004, 0.03, '#d8dcdc', 0, t + 0.002, z);
    });
}

function boots(style: 'boot' | 'sneaker' | 'tall'): Builder {
  return (tint) =>
    make((g) => {
      const shaft = style === 'sneaker' ? 0.04 : style === 'tall' ? 0.3 : 0.14;
      const sole = style === 'sneaker' ? '#e8e4d8' : '#1a1a1a';
      for (const s of [-1, 1]) {
        const z = s * 0.06;
        box(g, 0.28, 0.025, 0.1, sole, 0, 0.0125, z); // sole
        box(g, 0.26, 0.05, 0.09, tint, 0.005, 0.05, z); // foot
        box(g, 0.11, shaft, 0.09, shade(tint, 0.92), -0.075, 0.075 + shaft / 2, z); // shaft
        if (style !== 'tall') box(g, 0.1, 0.004, 0.03, shade(tint, 0.6), 0.04, 0.077, z); // laces
      }
    });
}

const gloves: Builder = (tint) =>
  make((g) => {
    for (const s of [-1, 1]) {
      const z = s * 0.06;
      box(g, 0.1, 0.022, 0.09, tint, -0.02, 0.011, z); // palm
      box(g, 0.06, 0.024, 0.09, shade(tint, 0.85), -0.1, 0.012, z); // cuff
      for (let i = 0; i < 4; i++) box(g, 0.07, 0.016, 0.018, tint, 0.065, 0.008, z - 0.033 + i * 0.022);
      box(g, 0.05, 0.016, 0.02, tint, 0.0, 0.008, z + s * 0.06, 0, s * 0.6, 0); // thumb
    }
  });

function hat(style: 'cap' | 'beanie' | 'bucket' | 'cowboy' | 'hard'): Builder {
  return (tint) =>
    make((g) => {
      if (style === 'beanie') {
        dome(g, 0.095, tint, 0, 0.02, 0, 1.3);
        cyl(g, 0.097, 0.04, shade(tint, 0.82), 0, 0.02, 0, 'y', 0.097, 12); // cuff
        return;
      }
      if (style === 'cap') {
        dome(g, 0.095, tint, 0, 0, 0, 0.75);
        box(g, 0.09, 0.006, 0.15, shade(tint, 0.85), 0.12, 0.006, 0); // bill
        return;
      }
      if (style === 'bucket') {
        cyl(g, 0.14, 0.012, shade(tint, 0.9), 0, 0.006, 0, 'y', 0.13, 14);
        cyl(g, 0.09, 0.07, tint, 0, 0.045, 0, 'y', 0.085, 12);
        return;
      }
      if (style === 'cowboy') {
        cyl(g, 0.22, 0.01, tint, 0, 0.005, 0, 'y', 0.22, 16);
        const c = cyl(g, 0.09, 0.1, shade(tint, 0.9), 0, 0.06, 0, 'y', 0.075, 10);
        c.scale.set(1.25, 1, 0.9);
        box(g, 0.16, 0.014, 0.02, '#3a2a1e', 0, 0.02, 0.0); // band hint
        return;
      }
      dome(g, 0.11, tint, 0, 0.015, 0, 0.95); // hard hat
      cyl(g, 0.125, 0.015, tint, 0, 0.0075, 0, 'y', 0.125, 14);
      box(g, 0.03, 0.02, 0.2, shade(tint, 0.9), 0, 0.12, 0); // ridge
    });
}

const motoHelmet: Builder = (tint) =>
  make((g) => {
    const s = add(g, new SphereGeometry(0.15, 12, 9), tint, 0, 0.15, 0);
    s.scale.set(1, 0.95, 0.9);
    const v = add(g, new SphereGeometry(0.152, 10, 6, -0.8, 1.6, 1.2, 0.7), '#1a2630', 0, 0.15, 0);
    v.scale.set(1.01, 0.96, 0.92);
  });

const gasMask: Builder = (tint) =>
  make((g) => {
    const f = add(g, new SphereGeometry(0.08, 10, 7), tint, 0, 0.045, 0);
    f.scale.set(1, 0.55, 1.15);
    for (const s of [-1, 1]) cyl(g, 0.025, 0.012, '#2a4a60', -0.02, 0.085, s * 0.04, 'y', 0.025, 10); // eyes
    cyl(g, 0.035, 0.05, '#5a5e60', 0.09, 0.04, 0, 'x', 0.035, 10, true); // filter
    box(g, 0.02, 0.008, 0.2, '#1a1a1a', -0.07, 0.01, 0); // strap
  });

function eyewear(style: 'glasses' | 'shades' | 'goggles'): Builder {
  return (tint) =>
    make((g) => {
      if (style === 'goggles') {
        box(g, 0.05, 0.03, 0.17, '#9fb8c4', 0, 0.015, 0);
        box(g, 0.054, 0.034, 0.012, tint, 0, 0.017, 0.085);
        box(g, 0.054, 0.034, 0.012, tint, 0, 0.017, -0.085);
        box(g, 0.012, 0.004, 0.3, '#1a1a1a', -0.06, 0.002, 0); // strap
        return;
      }
      // lying flat, lenses down, temples folded across the back
      const lens = style === 'shades' ? '#0d0d10' : '#b8d0dc';
      for (const s of [-1, 1]) {
        box(g, 0.04, 0.005, 0.054, tint, 0, 0.0025, s * 0.032); // rim
        box(g, 0.034, 0.002, 0.046, lens, 0, 0.006, s * 0.032);
      }
      box(g, 0.008, 0.005, 0.014, tint, 0.012, 0.0025, 0); // bridge
      box(g, 0.005, 0.005, 0.12, tint, -0.024, 0.009, 0.004, 0, 0.04, 0); // folded temples
      box(g, 0.005, 0.005, 0.12, tint, -0.018, 0.014, -0.004, 0, -0.04, 0);
    });
}

function clothMask(style: 'surgical' | 'bandana' | 'balaclava'): Builder {
  return (tint) =>
    make((g) => {
      if (style === 'bandana') {
        const tri = cyl(g, 0.14, 0.008, tint, 0, 0.004, 0, 'y', 0.14, 3);
        tri.rotation.y = 0.3;
        cyl(g, 0.02, 0.009, shade(tint, 1.3), 0.03, 0.005, 0.02, 'y', 0.02, 6); // print dot
        return;
      }
      if (style === 'balaclava') {
        box(g, 0.18, 0.025, 0.24, tint, 0, 0.0125, 0);
        box(g, 0.11, 0.002, 0.03, '#0a0a0a', 0, 0.026, -0.04); // eye slot
        return;
      }
      box(g, 0.17, 0.008, 0.09, tint, 0, 0.004, 0);
      for (let i = 0; i < 3; i++) box(g, 0.17, 0.002, 0.004, shade(tint, 0.85), 0, 0.009, -0.025 + i * 0.025); // pleats
      for (const s of [-1, 1]) box(g, 0.004, 0.002, 0.07, '#e8e8e8', s * 0.095, 0.002, 0); // ear loops
    });
}

// ---------------------------------------------------------------- backpacks (lying on their back)

type PackOpts = { w: number; l: number; d: number; roll?: boolean; sides?: boolean; frame?: boolean; molle?: boolean; tube?: boolean; flap?: boolean };
function pack(o: PackOpts): Builder {
  return (tint) =>
    make((g) => {
      const dark = shade(tint, 0.72);
      box(g, o.w, o.d, o.l, tint, 0, o.d / 2, 0); // main bag
      dome(g, o.w / 2, tint, 0, o.d / 2, -o.l / 2, 0.4, 1, o.d / o.w).rotation.x = -Math.PI / 2; // rounded top
      box(g, o.w * 0.7, o.d * 0.35, o.l * 0.4, shade(tint, 0.88), 0, o.d + o.d * 0.17, o.l * 0.18); // front pocket
      box(g, o.w * 0.9, 0.006, 0.012, dark, 0, o.d + 0.002, -o.l * 0.12); // zip line
      if (o.flap) box(g, o.w * 1.02, o.d * 0.15, o.l * 0.35, dark, 0, o.d + o.d * 0.07, -o.l * 0.3);
      if (o.sides) for (const s of [-1, 1]) box(g, o.w * 0.18, o.d * 0.7, o.l * 0.45, shade(tint, 0.9), s * (o.w / 2 + o.w * 0.09), o.d * 0.4, o.l * 0.05);
      if (o.roll) cyl(g, o.d * 0.45, o.w * 1.1, '#5a6a4a', 0, o.d * 0.5, -o.l / 2 - o.d * 0.45, 'x', o.d * 0.45, 10); // bedroll
      if (o.frame) for (const s of [-1, 1]) cyl(g, 0.008, o.l * 1.05, '#3a3e42', s * o.w * 0.4, 0.008, 0, 'z', 0.008, 6, true);
      if (o.molle) for (let i = 0; i < 4; i++) box(g, o.w * 0.75, 0.004, 0.012, dark, 0, o.d * 1.36, o.l * 0.03 + i * o.l * 0.07);
      if (o.tube) cyl(g, 0.007, o.l * 0.8, '#1d1f22', o.w * 0.35, o.d + 0.007, 0, 'z', 0.007, 6);
      for (const s of [-1, 1]) box(g, 0.05, 0.014, o.l * 0.7, dark, s * o.w * 0.28, 0.007, 0.0); // shoulder straps underneath edge
    });
}

// ---------------------------------------------------------------- registry

export const PICKUP_SHAPES: Record<string, Builder> = {
  bat: bat(false),
  bat_nails: bat(true),
  machete,
  grenade,
  flare: flare(0.2),
  road_flare: flare(0.3),
  binoculars,
  lockpick,
  duct_tape: ductTape,
  multitool,
  bolt_cutters: boltCutters,
  can_opener: canOpener,
  lighter,
  whistle,
  sewing_kit: sewingKit,
  flashlight,
  pot,
  bowl,
  bandage: bandageRoll,
  sterile_pack: sterilePack,
  splint,
  injector,
  wrapper_bar: wrapperBar,
  snack_bag: snackBag,
  red_dot: () => buildOptic('red_dot'),
  suppressor: () => buildMuzzle('suppressor', 0.021),
  ammo_9mm: ammoBox(0.08, 0.03, 0.055, '#c9b48a', '#2f5a8a'),
  ammo_9mm_box: ammoBox(0.14, 0.045, 0.09, '#c9b48a', '#2f5a8a', 'rounds'),
  ammo_762: stripperClips,
  ammo_12ga: ammoBox(0.1, 0.06, 0.075, '#8a2a24', '#e8e2d0', 'shells'),
  ammo_308: ammoBox(0.13, 0.03, 0.05, '#4f5a3a', '#d9b22f'),
  ammo_357: ammoBox(0.06, 0.035, 0.06, '#1d1f22', '#b83228'),
  nails,
  scrap_metal: scrap,
  electronics,
  gunpowder: powderTin,
  pipe,
  planks,
  jacket: jacket('jacket'),
  hoodie: jacket('hoodie'),
  shirt: jacket('shirt'),
  puffer: jacket('puffer'),
  pants,
  vest: vest('soft'),
  armor_vest: vest('armor'),
  chest_rig: vest('rig'),
  hiviz_vest: vest('hiviz'),
  boots: boots('boot'),
  sneakers: boots('sneaker'),
  tall_boots: boots('tall'),
  gloves,
  cap: hat('cap'),
  beanie: hat('beanie'),
  bucket_hat: hat('bucket'),
  cowboy_hat: hat('cowboy'),
  hard_hat: hat('hard'),
  moto_helmet: motoHelmet,
  gas_mask: gasMask,
  glasses: eyewear('glasses'),
  sunglasses: eyewear('shades'),
  goggles: eyewear('goggles'),
  surgical_mask: clothMask('surgical'),
  bandana: clothMask('bandana'),
  balaclava: clothMask('balaclava'),
  pack_small: pack({ w: 0.3, l: 0.4, d: 0.14 }),
  pack_kids: pack({ w: 0.24, l: 0.3, d: 0.11 }),
  pack_school: pack({ w: 0.3, l: 0.42, d: 0.15, flap: true }),
  pack_hiking: pack({ w: 0.32, l: 0.58, d: 0.18, sides: true }),
  pack_hiking_large: pack({ w: 0.36, l: 0.7, d: 0.22, sides: true, roll: true, frame: true }),
  pack_military: pack({ w: 0.36, l: 0.55, d: 0.2, sides: true, flap: true, molle: true }),
  pack_alice: pack({ w: 0.38, l: 0.5, d: 0.2, sides: true, flap: true, frame: true }),
  pack_assault: pack({ w: 0.32, l: 0.5, d: 0.18, molle: true }),
  pack_hydration: pack({ w: 0.24, l: 0.44, d: 0.08, tube: true }),
  pack_lab: pack({ w: 0.42, l: 0.72, d: 0.26, flap: true, sides: true }),
};

/** One built prototype per item id; each pickup gets a clone sharing geometry and materials. */
const protos = new Map<string, Group>();
export function buildPickupShape(itemId: string, shape: string, tint: string | undefined) {
  let p = protos.get(itemId);
  if (!p) {
    const b = PICKUP_SHAPES[shape];
    if (!b) return null;
    protos.set(itemId, (p = b(tint ?? '#7a7a70')));
  }
  return p.clone(true);
}
