/** Save settings (principles §12). */
export const SAVE = {
  /** Generations kept per slot. */
  generations: 3,
  /** Autosave cadence, real seconds; never during combat (defer up to `combatDeferMaxS`). */
  autosaveEveryS: 300,
  combatDeferMaxS: 60,
  /** "In combat" = took damage or fired within this many seconds. */
  combatWindowS: 10,
  /** Ask the browser for persistent storage after this much play. */
  persistAfterS: 15 * 60,
  slots: ['auto', 'quick', 'manual-1', 'manual-2', 'manual-3'],
  /** Section apply order on load: world state, then containers/contents, then the player. Unlisted sections follow. */
  loadOrder: ['world.time', 'difficulty', 'build.pieces', 'inventory', 'deathbags', 'survival', 'vehicles', 'corpses', 'player'],
};
