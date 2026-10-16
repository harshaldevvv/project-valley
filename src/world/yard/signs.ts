import { BufferGeometry, CanvasTexture, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { yard, type StationId } from '../../content/data/yard';
import { stationText } from '../../content/text/stations';
import { faceToward, type Kit } from './kit';

/**
 * Sign text: every label is a 1024x512 card in one shared canvas atlas, and all text quads merge
 * into one mesh, so all signage costs a single draw call.
 */
export interface Card {
  title: string;
  sub?: string;
  /** small wrapped body text (station hint) */
  body?: string;
  bg?: string;
  fg?: string;
}

const CW = 1024, CH = 512, COLS = 2;
const cards: Card[] = [];
const quads: { geo: BufferGeometry; card: number }[] = [];

/** Text quad (w x h m) at local (0, y, front) of an object at x,z,yaw; its face looks along the object's front (-Z). */
export function text(card: Card, w: number, h: number, x: number, y: number, z: number, yaw: number, front = -0.09) {
  cards.push(card);
  const geo = new PlaneGeometry(w, h).rotateY(Math.PI).translate(0, y, front).rotateY(yaw).translate(x, 0, z);
  quads.push({ geo, card: cards.length - 1 });
}

/** Text painted flat on the ground (top of the text points along yaw's forward, -Z at yaw 0). */
export function textFlat(card: Card, w: number, h: number, x: number, y: number, z: number, yaw: number) {
  cards.push(card);
  quads.push({ geo: new PlaneGeometry(w, h).rotateX(-Math.PI / 2).rotateY(yaw).translate(x, y, z), card: cards.length - 1 });
}

/** Station sign at (x,z) facing the spawn: narrative sign text, the station label, and the tester hint. */
export function stationSign(kit: Kit, id: StationId, x: number, z: number, yaw = faceToward(x, z, yard.spawn.x, yard.spawn.z)) {
  const t = stationText[id];
  const card: Card = { title: t.sign, sub: yard.stations[id].label, body: t.hint };
  kit.place({ id: 'env_sign_board_a', size: [2, 2.2, 0.15], x, z, yaw });
  text({ bg: '#41553b', fg: '#e6e3da', ...card }, 1.84, 0.92, x, 1.6, z, yaw);
}

/** Small post-mounted plate (distance markers, notices). */
export function plateSign(kit: Kit, card: Card, x: number, z: number, yaw: number, top = 1.5, post = true) {
  if (post) kit.box(0.08, top, 0.08, 'metal_dark', x, 0, z, yaw, true);
  kit.box(0.8, 0.42, 0.04, 'paint_white_faded', x - Math.sin(yaw) * 0.06, top - 0.5, z - Math.cos(yaw) * 0.06, yaw, false, 0.8);
  text({ bg: '#d8d5cc', fg: '#262626', ...card }, 0.76, 0.38, x, top - 0.29, z, yaw, -0.085);
}

function wrap(ctx: CanvasRenderingContext2D, s: string, maxW: number) {
  const lines: string[] = [];
  let line = '';
  for (const w of s.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export function finishSigns(kit: Kit) {
  if (!quads.length) return;
  const rows = Math.ceil(cards.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = CW * COLS;
  canvas.height = CH * rows;
  const ctx = canvas.getContext('2d')!;
  cards.forEach((c, i) => {
    const ox = (i % COLS) * CW, oy = Math.floor(i / COLS) * CH;
    ctx.fillStyle = c.bg ?? '#41553b';
    ctx.fillRect(ox, oy, CW, CH);
    ctx.strokeStyle = c.fg ?? '#e6e3da';
    ctx.lineWidth = 10;
    ctx.strokeRect(ox + 22, oy + 22, CW - 44, CH - 44);
    ctx.fillStyle = c.fg ?? '#e6e3da';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fit = (text: string, px: number, weight: string, maxW: number) => {
      do ctx.font = `${weight} ${px}px "Arial Narrow", system-ui, sans-serif`;
      while (ctx.measureText(text).width > maxW && (px -= 4) > 24);
      return px;
    };
    const small = !(c.body || c.sub);
    const size = fit(c.title, small ? 230 : 112, 'bold', CW - 100);
    const titleY = small ? oy + CH / 2 : oy + 34 + size / 2;
    ctx.fillText(c.title, ox + CW / 2, titleY);
    let y = titleY + size / 2 + 40;
    if (c.sub) {
      const px = fit(c.sub, 64, 'bold', CW - 110);
      ctx.fillText(c.sub, ox + CW / 2, y);
      y += px / 2 + 44;
    }
    if (c.body) {
      // Largest font (52..36 px) that wraps the hint into the space left; readable from ~3 m.
      let px = 54, lines: string[];
      do {
        ctx.font = `${(px -= 2)}px system-ui, sans-serif`;
        lines = wrap(ctx, c.body, CW - 120);
      } while (y + lines.length * px * 1.15 > oy + CH - 40 && px > 36);
      for (const l of lines) {
        ctx.fillText(l, ox + CW / 2, y);
        y += px * 1.15;
      }
    }
  });
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;

  for (const { geo, card } of quads) {
    const u0 = (card % COLS) / COLS, v0 = 1 - (Math.floor(card / COLS) + 1) / rows; // canvas y-down, texture flipY
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / COLS, v0 + uv.getY(i) / rows);
  }
  const mesh = new Mesh(mergeGeometries(quads.map((q) => q.geo)), new MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  mesh.name = 'yard_sign_text';
  mesh.receiveShadow = true;
  kit.game.scene.add(mesh);
  cards.length = quads.length = 0;
}
