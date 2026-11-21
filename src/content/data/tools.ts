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
  light: { color: '#ff9a4a', intensity: 24, distance: 14 },
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

/** A read note stays up for its length: base seconds plus per word, clamped (was a flat 14 s: long notes vanished mid-read). */
export const NOTE_CARD = { minSeconds: 8, maxSeconds: 30, secondsPerWord: 0.32 };

/** Vehicle fuel. A full tank lasts about 25 minutes of flat-out driving; a jerrycan (20 L) about 7. */
export const VEHICLE_FUEL = {
  /** Fraction of the tank a car starts with (and spawns with): enough to leave the yard, not to roam forever. */
  startFraction: 0.55,
  /** Litres per second with the engine on and not pushing (idling in gear), and extra at full throttle. */
  idleLPerS: 0.006,
  driveLPerS: 0.045,
  /** Hold time to pour a can into the tank, s, and litres poured per second. */
  refuelSeconds: 3,
  pourLPerS: 12,
  /** HUD gauge turns amber below this fraction. */
  lowFraction: 0.2,
};

/** Route 9 fuel stop pumps (positions from data/outskirts.ts 'pump island'; finite: no pump refills itself). */
export const PUMPS = {
  spots: [
    { x: -14, z: 152.4 },
    { x: -14, z: 155.6 },
  ],
  /** Litres each pump still holds at the start. */
  reserveLiters: 100,
  fillSeconds: 4,
  reach: 2.6,
};

/** Fuel found in a jerrycan from loot: this share of a full can, rolled. */
export const JERRYCAN_LOOT = { min: 0, max: 0.6 };

/** Light sources (flashlight, headlamp, lantern). The L key and the hotbar toggle the beam; batteries power it. */
export const LIGHT = {
  /** Usable when worn or when bound to the hotbar (a quick slot). */
  items: ['flashlight_a', 'headlamp', 'camping_lantern'],
  batteryItem: 'battery',
  /** Seconds of light one battery gives, and what a new game starts charged with. */
  batterySeconds: 900,
  startSeconds: 900,
  /** Toast a warning at this many seconds left. */
  warnSeconds: 60,
};
