import type { Objective } from '../content/data/quests';
import type { Station } from './crafting';
import type { Report } from './quests';

/**
 * Late-bound links between the pure survival rules and the world layer, so neither imports the other.
 * installCraft fills these once campfires exist; until then there is never a fire and no station.
 */
export const worldHooks = {
  /** The quest layer, for the people who hand things over (set by installQuests). */
  quests: null as null | { report(r: Report): void; status(id: string): 'locked' | 'active' | 'done'; objectives(): Objective[] },
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
