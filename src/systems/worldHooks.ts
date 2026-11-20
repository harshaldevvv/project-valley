import type { Station } from './crafting';

/**
 * Late-bound links between the pure survival rules and the world layer, so neither imports the other.
 * installCraft fills these once campfires exist; until then there is never a fire and no station.
 */
export const worldHooks = {
  /** Under a roof or inside a building (cached by the world layer, a few times a second). */
  sheltered: (): boolean => false,
  /** Pour up to `max` litres out of the carried jerrycans; returns what came out. */
  takeFuel: (_max: number): number => 0,
  /** Litres in the carried jerrycans. */
  fuelCarried: (): number => 0,
  /** Cars' fuel levels by index (set by gameplay/vehicles). */
  carFuel: { get: (): number[] => [], set: (_a: number[]): void => {} },
  /** Standing next to a lit campfire (feeds the warmth model). */
  fireNear: (): boolean => false,
  /** Stations close enough to craft at. */
  stations: (): ReadonlySet<Station> => new Set<Station>(),
};
