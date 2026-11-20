import { BoxGeometry, BufferAttribute, BufferGeometry, Matrix4 } from 'three';

/**
 * Procedural flat-shaded, vertex-coloured geometry in the same shape as the Polyfork models (position / normal / color,
 * non-indexed), so a house built here merges into the same chunk mesh and uses the same material as the catalog props.
 */
/** Hex to the plain 0..1 floats the Polyfork models carry in their vertex colours (the pf material reads them as they are). */
export function lin(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function paint(g: BufferGeometry, hex: string, bottom: number, y0: number, y1: number): BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute('uv');
  const [r, gr, b] = lin(hex);
  const pos = ng.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const span = Math.max(y1 - y0, 1e-3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / span));
    const f = bottom + (1 - bottom) * t; // darker toward the ground (contact shade, grime)
    col[i * 3] = r * f; col[i * 3 + 1] = gr * f; col[i * 3 + 2] = b * f;
  }
  ng.setAttribute('color', new BufferAttribute(col, 3));
  return ng;
}

/** Box of size w,h,d with its base centre at (cx, y, cz), yawed about its own base centre. */
export function boxG(w: number, h: number, d: number, cx: number, y: number, cz: number, hex: string, o: { yaw?: number; bottom?: number; rotX?: number } = {}) {
  const g = new BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  if (o.rotX) g.rotateX(o.rotX);
  if (o.yaw) g.rotateY(o.yaw);
  g.translate(cx, y, cz);
  return paint(g, hex, o.bottom ?? 0.82, y, y + h);
}

/** Box centred at (cx, cy, cz) rotated about X (roof panels). */
export function panelG(w: number, h: number, d: number, cx: number, cy: number, cz: number, rotX: number, hex: string, shade = 0.9) {
  const g = new BoxGeometry(w, h, d).rotateX(rotX).translate(cx, cy, cz);
  return paint(g, hex, shade, cy - d / 2, cy + d / 2);
}

/** Double-sided flat triangle (gable ends). */
export function triG(a: [number, number, number], b: [number, number, number], c: [number, number, number], hex: string) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([...a, ...b, ...c, ...a, ...c, ...b]), 3));
  g.computeVertexNormals();
  return paint(g, hex, 0.85, Math.min(a[1], b[1], c[1]), Math.max(a[1], b[1], c[1]));
}

export const xform = (x: number, z: number, yaw: number) => new Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
