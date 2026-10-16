import type { BuildPieceDef } from './types';

/**
 * Modular wood kit (principles §10: wood tier 500 HP, doors/windows 70% of wall HP).
 * `size` = model size in metres, used for placeholder boxes until the Blender kit lands.
 */
const list: BuildPieceDef[] = [
  { id: 'wood_foundation', model: 'kit_wood_foundation', kind: 'foundation', tier: 'wood', hp: 500, size: [3, 0.5, 3], cost: [{ item: 'wood_planks', count: 8 }, { item: 'nails', count: 12 }] },
  { id: 'wood_wall', model: 'kit_wood_wall', kind: 'wall', tier: 'wood', hp: 500, size: [3, 3, 0.2], cost: [{ item: 'wood_planks', count: 6 }, { item: 'nails', count: 8 }] },
  { id: 'wood_doorway', model: 'kit_wood_doorway', kind: 'doorway', tier: 'wood', hp: 500, size: [3, 3, 0.2], cost: [{ item: 'wood_planks', count: 5 }, { item: 'nails', count: 8 }] },
  { id: 'wood_door', model: 'kit_wood_door', kind: 'door', tier: 'wood', hp: 350, size: [0.95, 2.05, 0.06], cost: [{ item: 'wood_planks', count: 3 }, { item: 'nails', count: 4 }] },
  { id: 'wood_window', model: 'kit_wood_window', kind: 'window', tier: 'wood', hp: 350, size: [3, 3, 0.2], cost: [{ item: 'wood_planks', count: 5 }, { item: 'nails', count: 8 }] },
  { id: 'wood_floor', model: 'kit_wood_floor', kind: 'floor', tier: 'wood', hp: 500, size: [3, 0.2, 3], cost: [{ item: 'wood_planks', count: 6 }, { item: 'nails', count: 8 }] },
  { id: 'wood_stairs', model: 'kit_wood_stairs', kind: 'stairs', tier: 'wood', hp: 500, size: [3, 3, 3], cost: [{ item: 'wood_planks', count: 8 }, { item: 'nails', count: 10 }] },
  // Half gable: one cell of a 2-row ridge gable end; tall end at local -X (pair two per gable end, rotY ±90°).
  { id: 'wood_gable', model: 'kit_wood_gable', kind: 'gable', tier: 'wood', hp: 350, size: [3, 1.5, 0.2], cost: [{ item: 'wood_planks', count: 3 }, { item: 'nails', count: 4 }] },
  { id: 'wood_roof', model: 'kit_wood_roof', kind: 'roof', tier: 'wood', hp: 500, size: [3, 1.5, 3], cost: [{ item: 'wood_planks', count: 6 }, { item: 'nails', count: 8 }] },
];

/** Order = hotkeys 1..8 and mouse-wheel order in build mode. */
export const BUILD_PIECES: BuildPieceDef[] = list;
export const BUILD_BY_ID: Record<string, BuildPieceDef> = Object.fromEntries(list.map((d) => [d.id, d]));

export const BUILD = {
  /** Snap grid cell, m (= wall width). */
  grid: 3,
  /** Storey height, m (= wall height). Floors and roofs sit on top of the walls below. */
  storey: 3,
  /** Height of a foundation's top above the ground, m. */
  foundationTop: 0.5,
  maxLevels: 3,
  /** Max ray distance from the camera for the ghost, m. */
  reach: 12,
  /** When the ray hits nothing (looking level), the ghost goes this far ahead of the camera, m. */
  placeDistance: 7,
  /** Fraction of the cost refunded when a paid piece is removed. Free pieces refund nothing (no faucet). */
  refund: 0.5,
  /** Sandbox cheat: building costs nothing (free pieces refund nothing). */
  freeBuilding: false, // debug toggle (F1 > Build); off so the salvage -> rebuild loop is real
  /** How long a blocking piece flashes red when X is refused, ms. */
  blockerFlashMs: 1200,
  /** Door hinge relative to its doorway's centre (= kit_wood_doorway SOCKET_door_hinge), local metres. */
  doorHinge: [-0.475, 0.02, 0] as [number, number, number],
  /** Door swing, degrees. */
  doorSwingDeg: 90,
};
