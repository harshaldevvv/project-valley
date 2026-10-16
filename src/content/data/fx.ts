/**
 * Hit/shot effect tables (docs/research/vfx-impact-effects.md "Rules for our game"). Plain data; Fx reads it.
 * Colour language: red = flesh, yellow/white = hard target (metal), brown/grey = miss on the world.
 */
export type FxSurface = 'flesh' | 'wood' | 'metal' | 'dirt' | 'concrete' | 'grass' | 'rubber' | 'chainlink';

export interface BurstDef {
  pool: 'chips' | 'smoke';
  count: [number, number];
  color: string[];
  size: [number, number]; // m
  speed: [number, number]; // m/s
  cone: number; // degrees around the normal
  alongShot?: number; // 0..1 blend normal -> shot direction
  gravity: number;
  life: [number, number];
  stretch?: number; // sparks: box length = speed × stretch
  upBias?: number;
}
export interface ImpactDef {
  bursts: BurstDef[];
  /** 1-frame white star (metal, blunt hits). */
  star?: number; // size m
  decal: { pool: 'bullet' | 'blood'; color: string; size: [number, number] };
  sfx: string;
}

const BLOOD = ['#7a0f0c', '#4a0806', '#5a1a10'];

export const impacts: Record<FxSurface, ImpactDef> = {
  dirt: {
    bursts: [
      { pool: 'chips', count: [6, 10], color: ['#6b5a42', '#57452f'], size: [0.04, 0.07], speed: [2, 3], cone: 35, gravity: 9, life: [0.6, 0.8], upBias: 0.4 },
      { pool: 'smoke', count: [1, 1], color: ['#a8987c'], size: [0.12, 0.2], speed: [0.3, 0.5], cone: 30, gravity: -0.3, life: [0.8, 0.8] },
    ],
    decal: { pool: 'bullet', color: '#2c251b', size: [0.1, 0.14] },
    sfx: 'impact_dirt',
  },
  grass: {
    bursts: [
      { pool: 'chips', count: [5, 8], color: ['#4f6b2c', '#6b5a42'], size: [0.03, 0.06], speed: [2, 3], cone: 35, gravity: 9, life: [0.5, 0.7], upBias: 0.4 },
      { pool: 'smoke', count: [1, 1], color: ['#a39a80'], size: [0.1, 0.16], speed: [0.3, 0.5], cone: 30, gravity: -0.3, life: [0.7, 0.7] },
    ],
    decal: { pool: 'bullet', color: '#2c2a1b', size: [0.08, 0.12] },
    sfx: 'impact_dirt',
  },
  wood: {
    bursts: [{ pool: 'chips', count: [5, 8], color: ['#8a6a44', '#a3825a'], size: [0.025, 0.04], speed: [3, 4], cone: 40, gravity: 9, life: [0.5, 0.7], stretch: 0.03 }],
    decal: { pool: 'bullet', color: '#2a2018', size: [0.05, 0.07] },
    sfx: 'impact_wood',
  },
  metal: {
    bursts: [{ pool: 'chips', count: [6, 10], color: ['#ffe9a8', '#ffd27a', '#fff6e0'], size: [0.012, 0.018], speed: [6, 8], cone: 60, gravity: 6, life: [0.15, 0.25], stretch: 0.02 }],
    star: 0.1,
    decal: { pool: 'bullet', color: '#3a3a3a', size: [0.035, 0.045] },
    sfx: 'impact_metal',
  },
  concrete: {
    bursts: [
      { pool: 'chips', count: [6, 9], color: ['#a29c90', '#8a857a'], size: [0.03, 0.05], speed: [2.5, 3.5], cone: 40, gravity: 9, life: [0.5, 0.7] },
      { pool: 'smoke', count: [1, 2], color: ['#c9c3b6'], size: [0.12, 0.2], speed: [0.3, 0.6], cone: 30, gravity: -0.3, life: [0.8, 1.0] },
    ],
    decal: { pool: 'bullet', color: '#2b2b2b', size: [0.05, 0.07] },
    sfx: 'impact_concrete',
  },
  // Wire mesh: bullets pass through (weapons), so this only shows when something stops on it (melee, sparks)
  chainlink: {
    bursts: [{ pool: 'chips', count: [3, 5], color: ['#ffe9a8', '#ffd27a'], size: [0.01, 0.015], speed: [5, 7], cone: 60, gravity: 6, life: [0.12, 0.2], stretch: 0.02 }],
    decal: { pool: 'bullet', color: '#3a3a3a', size: [0.02, 0.03] },
    sfx: 'impact_metal',
  },
  rubber: {
    bursts: [{ pool: 'chips', count: [3, 5], color: ['#222222', '#333333'], size: [0.02, 0.035], speed: [1.5, 2.5], cone: 40, gravity: 9, life: [0.4, 0.6] }],
    decal: { pool: 'bullet', color: '#151515', size: [0.04, 0.05] },
    sfx: 'impact_dirt',
  },
  flesh: {
    bursts: [
      { pool: 'chips', count: [8, 12], color: BLOOD, size: [0.03, 0.06], speed: [2, 3], cone: 35, alongShot: 0.5, gravity: 9, life: [0.5, 0.5] },
      { pool: 'smoke', count: [1, 1], color: ['#8a1410'], size: [0.15, 0.25], speed: [0.2, 0.4], cone: 30, alongShot: 0.5, gravity: 0, life: [0.25, 0.3] },
    ],
    decal: { pool: 'blood', color: '#4a0806', size: [0.3, 0.45] },
    sfx: 'hit_body',
  },
};

/** Per-weapon shot effects. */
export const weaponFx: Record<string, { flashLen: number; tracerEvery: number; casing: 'brass' | 'hull' | null; impactScale: number; smokeEvery: number }> = {
  pistol_a: { flashLen: 0.26, tracerEvery: 0, casing: 'brass', impactScale: 0.8, smokeEvery: 1 },
  rifle_a: { flashLen: 0.4, tracerEvery: 3, casing: 'brass', impactScale: 1.1, smokeEvery: 3 },
};

export const fxTuning = {
  // Muzzle flash
  flashMs: 33,
  flashVariants: 3,
  adsFlashScale: 0.6,
  adsFlashDrop: 0.05, // m below the sight line
  lightPeak: 3,
  lightMs: 50,
  lightRange: 6,
  // Smoke / mist
  smokeOpacity: 0.15,
  smokeMaxSize: 0.4,
  smokeMinCamDist: 0.6, // puffs closer than this to the camera are hidden
  // Tracers
  tracerSpeed: 320, // visual m/s
  tracerLength: 4,
  tracerMinCamDist: 4,
  tracerCore: 0.015,
  tracerSheath: 0.04,
  // Casings
  casingRest: 3,
  casingBounce: 0.3,
  casingSound: 'casing_tink',
  casingVolume: 1, // level is set in the sound table
  casingCooldown: 0.08,
  // Decals
  decalLife: 30,
  decalFade: 2,
  // Blood pools under corpses
  poolMax: 12,
  poolRadius: [0.2, 0.4] as [number, number], // 0.4–0.8 m across (QA-044)
  poolFlatTol: 0.04, // m: pools only on flat ground (corner heights within this)
  poolGrow: 5,
  // Melee trail
  trailSamples: 14,
  trailFade: 0.12,
  // Accessibility (settings menu should expose these; F1 → FX meanwhile)
  reduceFlashing: false,
  gore: 'full' as 'full' | 'reduced' | 'off',
};
