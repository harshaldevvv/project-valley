/**
 * Difficulty (principles §12). `difficulty` is the live settings object (sliders write into it, saves store it);
 * presets are starting points. Every slider can change mid-game; a changed preset becomes 'custom'.
 */
export type DeathPenalty = 'story' | 'survivor' | 'hardcore';
export interface Difficulty {
  preset: 'story' | 'survivor' | 'hardcore' | 'custom';
  /** Needs drain rate, 0..2 (0–200%). */
  hungerDrain: number;
  thirstDrain: number;
  fatigueDrain: number;
  infection: boolean;
  starvationDamage: boolean;
  deathPenalty: DeathPenalty;
}

export const DIFFICULTY_PRESETS: Record<Exclude<Difficulty['preset'], 'custom'>, Difficulty> = {
  story: { preset: 'story', hungerDrain: 0.5, thirstDrain: 0.5, fatigueDrain: 0.5, infection: false, starvationDamage: false, deathPenalty: 'story' },
  survivor: { preset: 'survivor', hungerDrain: 1, thirstDrain: 1, fatigueDrain: 1, infection: true, starvationDamage: true, deathPenalty: 'survivor' },
  hardcore: { preset: 'hardcore', hungerDrain: 1.5, thirstDrain: 1.5, fatigueDrain: 1.25, infection: true, starvationDamage: true, deathPenalty: 'hardcore' },
};

export const difficulty: Difficulty = { ...DIFFICULTY_PRESETS.survivor };

export function applyPreset(name: keyof typeof DIFFICULTY_PRESETS) {
  Object.assign(difficulty, DIFFICULTY_PRESETS[name]);
}

/** Death penalty details (principles §12). Bag lifetime in in-game days. */
export const DEATH = {
  bagDays: { story: 0, survivor: 2, hardcore: 1 } as Record<DeathPenalty, number>,
  /** Survivor: these slots go in the bag (plus the held weapon). Hardcore: every slot except the pouch. */
  survivorDrops: ['backpack'] as string[],
  /** The death bag's world beacon height, m. */
  beaconHeight: 40,
};
