/** Numbers for tool uses and the camp (all tunable from here). Tools themselves are items (data/items_more.ts). */

/** Campfire: placed from a kit, lit by a lighter, a match or a torch, burns for a while, warms and cooks. */
export const CAMPFIRE = {
  /** Distance in front of the player where a kit is laid, m. */
  placeAhead: 1.6,
  /** Interact reach, m. */
  reach: 2.4,
  /** Seconds a fresh fire burns; each plank added buys `plankSeconds` more, up to `maxSeconds`. */
  burnSeconds: 480,
  plankSeconds: 120,
  maxSeconds: 900,
  /** Crafting at a campfire needs a lit one within this many metres. */
  stationRadius: 3.5,
  /** Hold time to light it or add a plank, s. */
  lightSeconds: 1.2,
  /** Igniters in the order they are tried: `consumed` items are used up (a lighter is not). */
  igniters: [
    { item: 'lighter', consumed: false },
    { item: 'matches', consumed: true },
    { item: 'torch', consumed: true },
  ],
  /** Real-time warm light: one pooled point light moves to the nearest lit fire. */
  light: { color: '#ff9a4a', intensity: 90, distance: 16 },
  /** Fires kept in a save (a placed fire is forgotten past this). */
  max: 6,
};

/** Bolt cutters (and anything else that can cut): locks up to `maxLock` open without the minigame. */
export const CUT = {
  seconds: 3.5,
  maxLock: 2,
  /** Durability lost per cut (0..1; ten cuts). */
  wear: 0.1,
  tools: ['bolt_cutters'],
};

/** Binoculars: hold this key while carrying them. */
export const BINOCULARS = { key: 'KeyZ', zoom: 3.2, item: 'binoculars' };

/** The handheld radio: seconds a broadcast card stays up. */
export const RADIO = { cardSeconds: 9 };
