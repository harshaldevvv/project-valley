/** Gameplay HUD labels (mechanics HUD). */
export const hudText = {
  health: 'HEALTH',
  stamina: 'STAMINA',
  hunger: 'FOOD',
  thirst: 'WATER',
  fatigue: 'REST',
  warmth: 'WARM',
  fuel: 'FUEL',
  yourBag: 'Your bag',
  day: (n: number) => `Day ${n}`,
  stage: (n: number) => `stage ${n}`,
  loadedReset: 'Loaded',
  died: 'YOU DIED',
  respawnIn: (s: number) => `Back on your feet in ${s}`,
  /** What death cost, by difficulty death penalty. */
  deathCost: { story: 'Nothing was lost.', survivor: 'Your pack and the gun in your hands are in a bag where you fell.', hardcore: 'Everything but your pouch is in a bag where you fell.' } as Record<string, string>,
  /** Hotbar: weapon slot short names (keys 1-4) and the empty quick slot. */
  slotShort: ['Primary', 'Secondary', 'Sidearm', 'Melee'],
  emptySlot: 'Empty',
};
