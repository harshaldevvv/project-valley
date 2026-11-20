import type { Station } from './crafting';

/**
 * Late-bound links between the pure survival rules and the world layer, so neither imports the other.
 * installCraft fills these once campfires exist; until then there is never a fire and no station.
 */
export const worldHooks = {
  /** Standing next to a lit campfire (feeds the warmth model). */
  fireNear: (): boolean => false,
  /** Stations close enough to craft at. */
  stations: (): ReadonlySet<Station> => new Set<Station>(),
};
