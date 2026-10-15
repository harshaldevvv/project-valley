import { BUILD, BUILD_BY_ID } from '../content/data/build';
import type { BuildPieceDef } from '../content/data/types';

/**
 * Base-building rules (principles §10), pure: snapping on the build grid, support and occupancy.
 * Pieces are plain data; the world layer (src/ui/build) renders them and owns colliders.
 *
 * Grid: world-aligned cells of BUILD.grid metres (cell edges on multiples of BUILD.grid); `area` only bounds it. Foundations fill a cell at ground level;
 * walls/doorways/windows sit on cell edges at a level k (y = foundationTop + k*storey);
 * floors/roofs fill a cell on top of the walls of level k-1; doors sit inside doorways.
 */
export interface Piece {
  uid: number;
  defId: string;
  x: number;
  y: number;
  z: number;
  /** Yaw, radians. */
  rot: number;
  /** Paid from the inventory (or world-placed): refunds on removal. Free-built pieces refund nothing. */
  paid: boolean;
  open?: boolean;
}

export interface Area {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface Slot {
  key: string;
  x: number;
  y: number;
  z: number;
  rot: number;
}

const QUARTER = Math.PI / 2;
const EDGE_KINDS = new Set(['wall', 'doorway', 'window', 'gable']);

export const pieceDef = (id: string): BuildPieceDef => {
  const d = BUILD_BY_ID[id];
  if (!d) throw new Error(`unknown build piece "${id}"`);
  return d;
};

/** Normalize any position + yaw onto the piece's grid slot. */
export function slotOf(defId: string, x: number, y: number, z: number, rot: number): Slot {
  const d = pieceDef(defId);
  const G = BUILD.grid;
  const S = BUILD.storey;
  const ft = BUILD.foundationTop;
  const cell = (v: number) => Math.floor(v / G + 1e-6);
  const line = (v: number) => Math.round(v / G);
  const level = (min: number) => Math.min(BUILD.maxLevels, Math.max(min, Math.round((y - ft) / S)));
  const steps = ((Math.round(rot / QUARTER) % 4) + 4) % 4;
  if (d.kind === 'foundation' || d.kind === 'floor' || d.kind === 'roof' || d.kind === 'stairs') {
    const i = cell(x);
    const j = cell(z);
    const cx = (i + 0.5) * G;
    const cz = (j + 0.5) * G;
    if (d.kind === 'foundation') return { key: `F:${i}:${j}`, x: cx, y: 0, z: cz, rot: steps * QUARTER };
    const k = level(d.kind === 'stairs' ? 0 : 1);
    return { key: `${d.kind === 'stairs' ? 'S' : 'T'}:${i}:${j}:${k}`, x: cx, y: ft + k * S, z: cz, rot: steps * QUARTER };
  }
  // Edge pieces (and doors, which live in a doorway's edge).
  const k = level(0);
  const prefix = d.kind === 'door' ? 'D' : 'E';
  // Gables are asymmetric (tall end at local -X), so they keep their full facing; other edge pieces are symmetric.
  const keep = d.kind === 'gable';
  if (steps % 2 === 0) {
    const i = cell(x);
    const jl = line(z);
    return { key: `${prefix}:h:${i}:${jl}:${k}`, x: (i + 0.5) * G, y: ft + k * S, z: jl * G, rot: keep ? steps * QUARTER : 0 };
  }
  const il = line(x);
  const j = cell(z);
  return { key: `${prefix}:v:${il}:${j}:${k}`, x: il * G, y: ft + k * S, z: (j + 0.5) * G, rot: keep ? steps * QUARTER : QUARTER };
}

export const slotOfPiece = (p: Piece) => slotOf(p.defId, p.x, p.y, p.z, p.rot);

type ByKey = Map<string, Piece>;
export function indexPieces(pieces: Piece[]): ByKey {
  return new Map(pieces.map((p) => [slotOfPiece(p).key, p]));
}

const kindAt = (by: ByKey, key: string) => {
  const p = by.get(key);
  return p ? pieceDef(p.defId).kind : null;
};

function floorHasWalls(by: ByKey, i: number, j: number, k: number) {
  const b = k - 1;
  return [`E:h:${i}:${j}:${b}`, `E:h:${i}:${j + 1}:${b}`, `E:v:${i}:${j}:${b}`, `E:v:${i + 1}:${j}:${b}`].some((key) => by.has(key));
}

/** Is a piece in this slot held up by what's in `by`? */
export function isSupported(defId: string, slot: Slot, by: ByKey): boolean {
  const kind = pieceDef(defId).kind;
  const [, a, b, c, d] = slot.key.split(':');
  if (kind === 'foundation') return true;
  if (kind === 'door') return kindAt(by, 'E' + slot.key.slice(1)) === 'doorway';
  if (kind === 'stairs') {
    const [i, j, k] = [+a, +b, +c];
    return k === 0 ? by.has(`F:${i}:${j}`) : kindAt(by, `T:${i}:${j}:${k}`) === 'floor';
  }
  if (kind === 'floor' || kind === 'roof') {
    const [i, j, k] = [+a, +b, +c];
    if (floorHasWalls(by, i, j, k)) return true;
    // One-cell overhang from a floor that stands on walls.
    if (kind === 'floor')
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (kindAt(by, `T:${i + di}:${j + dj}:${k}`) === 'floor' && floorHasWalls(by, i + di, j + dj, k)) return true;
    return false;
  }
  // Edge pieces: cells on either side of the edge.
  const axis = a;
  const [p, q, k] = [+b, +c, +d];
  const cells = axis === 'h' ? [[p, q - 1], [p, q]] : [[p - 1, q], [p, q]];
  if (k === 0) return cells.some(([i, j]) => by.has(`F:${i}:${j}`));
  return by.has(`E:${axis}:${p}:${q}:${k - 1}`) || cells.some(([i, j]) => kindAt(by, `T:${i}:${j}:${k}`) === 'floor');
}

/** Cell pieces must lie fully inside; edge pieces need their midpoint inside. */
function inArea(s: Slot, area: Area, cellPiece: boolean) {
  const e = (cellPiece ? BUILD.grid / 2 : 0) - 1e-3;
  return s.x >= area.x0 + e && s.x <= area.x1 - e && s.z >= area.z0 + e && s.z <= area.z1 - e;
}

export type PlaceCheck = Slot & { valid: boolean; reason?: 'area' | 'occupied' | 'support' };

export function checkSlot(defId: string, slot: Slot, pieces: Piece[], area: Area): PlaceCheck {
  const by = indexPieces(pieces);
  if (!inArea(slot, area, /^[FTS]:/.test(slot.key))) return { ...slot, valid: false, reason: 'area' };
  if (by.has(slot.key)) return { ...slot, valid: false, reason: 'occupied' };
  if (!isSupported(defId, slot, by)) return { ...slot, valid: false, reason: 'support' };
  return { ...slot, valid: true };
}

/**
 * Where the selected piece goes for a look-at point `hit` (ray hit on ground/pieces).
 * `turns` = R presses (quarter turns): cells rotate, edge pieces flip to another side of the cell.
 */
export function snapToHit(defId: string, hit: { x: number; y: number; z: number }, turns: number, pieces: Piece[], area: Area): PlaceCheck {
  const d = pieceDef(defId);
  const G = BUILD.grid;
  const ft = BUILD.foundationTop;
  const S = BUILD.storey;
  if (d.kind === 'door') {
    // Snap into the nearest doorway.
    let best: Piece | null = null;
    let bd = 2.5 * 2.5;
    for (const p of pieces) {
      if (pieceDef(p.defId).kind !== 'doorway') continue;
      const dd = (p.x - hit.x) ** 2 + (p.z - hit.z) ** 2 + ((p.y + 1.2 - hit.y) * 0.5) ** 2;
      if (dd < bd) [best, bd] = [p, dd];
    }
    const s = best ? slotOf(defId, best.x, best.y, best.z, best.rot) : slotOf(defId, hit.x, hit.y, hit.z, 0);
    return best ? checkSlot(defId, s, pieces, area) : { ...s, valid: false, reason: 'support' };
  }
  if (!EDGE_KINDS.has(d.kind)) {
    const y = d.kind === 'foundation' ? 0 : ft + Math.round((hit.y - ft) / S) * S;
    return checkSlot(defId, slotOf(defId, hit.x, y, hit.z, turns * QUARTER), pieces, area);
  }
  // Edge: nearest side of the cell under the hit point, plus R turns.
  const i = Math.floor(hit.x / G);
  const j = Math.floor(hit.z / G);
  const dx = hit.x - ((i + 0.5) * G);
  const dz = hit.z - ((j + 0.5) * G);
  const near = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 2 : 0; // 0 N, 1 E, 2 S, 3 W
  const side = (near + turns) % 4;
  const k = Math.max(0, Math.floor((hit.y - ft + 0.3) / S));
  const y = ft + k * S;
  const cx = (i + 0.5) * G;
  const cz = (j + 0.5) * G;
  const [x, z, rot] = [
    [cx, cz - G / 2, 0],
    [cx + G / 2, cz, QUARTER],
    [cx, cz + G / 2, 0],
    [cx - G / 2, cz, QUARTER],
  ][side];
  return checkSlot(defId, slotOf(defId, x, y, z, rot), pieces, area);
}

/** Removing `p` must not leave anything floating. */
export function canRemove(p: Piece, pieces: Piece[]): boolean {
  const rest = pieces.filter((q) => q !== p);
  const by = indexPieces(rest);
  return rest.every((q) => isSupported(q.defId, slotOfPiece(q), by));
}

export function refundOf(p: Piece): { item: string; count: number }[] {
  if (!p.paid) return [];
  return pieceDef(p.defId)
    .cost.map((c) => ({ item: c.item, count: Math.floor(c.count * BUILD.refund) }))
    .filter((c) => c.count > 0);
}
