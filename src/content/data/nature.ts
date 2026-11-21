/**
 * Nature pass on the outskirts plateau (world/outskirts/nature.ts, scatter.ts): tree species mix, rocks, logs,
 * undergrowth and the pond. Polyfork model keys (outskirts/modelFiles.ts) at native size times `s`.
 */

/** Plateau tree species by zone. Keys are PF keys in world/yard/pfModels.ts; weights are relative. */
export const TREE_MIX = {
  belt: [
    { id: 'tree_pine', w: 0.42 },
    { id: 'tree_pine_young', w: 0.2 },
    { id: 'tree_pine_stand', w: 0.16 },
    { id: 'tree_birch', w: 0.1 },
    { id: 'tree_oak', w: 0.12 },
  ],
  clump: [
    { id: 'tree_oak', w: 0.26 },
    { id: 'tree_birch', w: 0.2 },
    { id: 'tree_street', w: 0.18 },
    { id: 'tree_apple', w: 0.12 },
    { id: 'tree_pine_young', w: 0.14 },
    { id: 'tree_pine', w: 0.1 },
  ],
};
/** Trunk collider half-width per species (m, before the spot's scale). */
export const TRUNK_R: Record<string, number> = { tree_pine_stand: 0.9, tree_oak: 0.3, tree_apple: 0.22 };

/** Instanced ground props. `zone`: where they go; `solid`: box collider when bigger than `minSolid` m across. */
export interface NatureProp { key: string; count: number; s: [number, number]; zone: 'belt' | 'clump' | 'any'; solid: boolean; minSolid?: number; sink?: number; surface?: 'concrete' | 'wood' }
export const NATURE_PROPS: NatureProp[] = [
  { key: 'field-rock', count: 70, s: [0.6, 1.6], zone: 'any', solid: true, minSolid: 1.1, sink: 0.12, surface: 'concrete' },
  { key: 'medium-rock', count: 60, s: [0.6, 1.4], zone: 'any', solid: true, minSolid: 1.1, sink: 0.08, surface: 'concrete' },
  { key: 'large-boulder', count: 26, s: [0.9, 1.6], zone: 'belt', solid: true, sink: 0.1, surface: 'concrete' },
  { key: 'rock-outcrop', count: 10, s: [0.8, 1.3], zone: 'belt', solid: true, sink: 0.15, surface: 'concrete' },
  { key: 'fallen-log', count: 28, s: [0.9, 1.4], zone: 'any', solid: true, sink: 0.08, surface: 'wood' },
  { key: 'hollow-log', count: 12, s: [0.8, 1.1], zone: 'belt', solid: true, sink: 0.05, surface: 'wood' },
  { key: 'tree-stump', count: 30, s: [0.8, 1.3], zone: 'any', solid: true, minSolid: 0.7, sink: 0.04, surface: 'wood' },
  { key: 'fern-plant', count: 150, s: [0.8, 1.6], zone: 'any', solid: false, sink: 0.02 },
];
/** Nature props merge into one mesh per square of this size (m); fewer, bigger cells = fewer draws, coarser culling. */
export const NATURE_CELL = 160;
/** Rock/log clusters: centres per zone, props drawn round each within `spread` m. */
export const CLUSTERS = { count: 44, spread: 5 };

/** Meadow patches: grass tufts there grow up to this much taller (clutter.ts). */
export const MEADOW = { noise: 0.016, threshold: 0.58, tall: 1.9 };

/**
 * The pond, east of the main road between the crash road and Maple junction, in open ground. The terrain dips
 * (yard/ground.ts) by `depth` at the centre down to 0 at `r`; the centre sits on a terrain vertex (5 m grid).
 */
export const POND = { x: 30, z: 190, r: 9.5, depth: 0.85, water: -0.1, reeds: 46, lilies: 5, rocks: 9, name: 'pond_water', open: [0.2, 1.5] as [number, number] };
/** Loon Lake at the campground (outskirts_lake.ts), same rules as the pond; reeds keep off the north-east (dock) shore. */
export const LAKE = { x: -125, z: 280, r: 10, depth: 1.0, water: -0.1, reeds: 40, lilies: 7, rocks: 10, name: 'pond_lake', open: [-2.0, -0.4] as [number, number] };
/** `open`: the bank arc (radians, atan2(dz, dx)) kept free of reeds. Every water bowl the terrain dips for and nature.ts fills. */
export const WATERS = [POND, LAKE];
