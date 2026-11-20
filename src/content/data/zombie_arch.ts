/**
 * Zombie archetypes, day/night pacing and horde night (GAME_PLAN M6). Plain data; the rules are in
 * gameplay/zombies/archetypes.ts and the zombie code reads them. The archetype definitions themselves (hp, speeds, model)
 * are rows in data/zombies.ts (`zombieDefs`); this file holds what is different about each and when it spawns.
 */

/** Archetype ids that are special (everything else is the ordinary shambler mix). */
export type Archetype = 'runner' | 'crawler' | 'brute' | 'screamer';
export const ARCHETYPES: Archetype[] = ['runner', 'crawler', 'brute', 'screamer'];

/**
 * Spawn weights. The chance that a spawn is an ordinary zombie is 1; each archetype adds `base x tier x time of day`, and
 * the roll is weight / (1 + sum of weights). So tier 1 by day is mostly shamblers, tier 3 at night is a real mix.
 */
export const ARCH_SPAWN: Record<Archetype, { base: number; tier: Record<number, number>; day: number; night: number }> = {
  // fast and fragile, mostly out at night
  runner: { base: 0.1, tier: { 1: 0.7, 2: 1.2, 3: 1.6 }, day: 0.4, night: 2.2 },
  // low and slow, always a few, hard to spot in the grass
  crawler: { base: 0.09, tier: { 1: 1, 2: 1, 3: 0.9 }, day: 1, night: 1.1 },
  // big and tough: not near the start, rarer by night than you would think (they hide in the daylight shade)
  brute: { base: 0.05, tier: { 1: 0, 2: 1, 3: 2.2 }, day: 1.3, night: 1 },
  // one special: the screamer calls the others
  screamer: { base: 0.04, tier: { 1: 0, 2: 1, 3: 1.8 }, day: 0.8, night: 1.4 },
};

/** Per-archetype AI parameters (used by zombies.ts on top of the ZombieDef numbers). */
export const ARCH_AI = {
  crawler: {
    /** Starts on the ground: uses the z_crawl clip and the crawler hit zones from spawn. */
    startsCrawling: true,
    /** The crawler hides: a sight range multiplier on the player's detection of it does not exist, so it is dark and low instead. */
    note: 'low and dark; speed is def.crawl',
  },
  brute: {
    /** A hit that lands knocks the player down: no control for this long, and a heavy camera kick. */
    knockdownS: 0.9,
    /** The brute shrugs off staggers (no stagger below this fraction of its max HP in a short window). */
    staggerFrac: 0.6,
    trauma: 0.9,
  },
  screamer: {
    /** On first detecting the player it screams for this long (a telegraph), then every zombie within `radius` hears it. */
    windupS: 1.1,
    radius: 55,
    /** Seconds before it can scream again. */
    cooldownS: 30,
  },
  runner: {
    /** Runs even when only suspicious (it closes the last metres at a run). */
    runWhenSearching: true,
  },
};

/** Day and night (principles §4/§6): at night zombies sense further, move and react faster, and there are more of them; in daylight there are fewer, and tougher. */
export const DAY_NIGHT = {
  /** Spawn count multiplier for streaming zones (day, night), blended by the clock's night 0..1. */
  count: { day: 0.7, night: 1.4 },
  /** Hit point multiplier at spawn (day, night): fewer but tougher in daylight. */
  hp: { day: 1.25, night: 1.0 },
  /** Chase speed multiplier at night. */
  chase: { day: 1.0, night: 1.2 },
  /** Heard-noise radius multiplier at night. */
  hearing: { day: 1.0, night: 1.5 },
  /** Suspicion gain multiplier from sight at night. */
  suspicion: { day: 1.0, night: 1.3 },
  /** Attack windup multiplier at night (they swing sooner). */
  windup: { day: 1.0, night: 0.85 },
};

/** Horde night lite: every N in-game days, at night, a horde converges on where the player is. */
export const HORDE_NIGHT = {
  /** Off = no horde nights at all (the Settings menu toggles this; HordeNight.step checks it). */
  enabled: true,
  everyDays: 3,
  /** In-game hours: warning, start, and the dawn it ends at. */
  warnHour: 21,
  startHour: 22,
  endHour: 5.5,
  /** How many zombies, and how fast they appear (per second), and how far from the player they come from. */
  count: [15, 25] as [number, number],
  spawnPerS: 4,
  ring: [45, 75] as [number, number],
  /** The horde's idea of where you are is refreshed this often (s), so it keeps coming if you move. */
  retargetS: 6,
  /** The cap on live zombies while a horde is on (horde.maxAlive otherwise). */
  maxAlive: 48,
  /** Tier used for the archetype mix of a horde (3 = the real mix) and an extra weight for runners. */
  tier: 3,
  /** Survive to dawn with the player alive: this is given. */
  reward: [
    { item: 'cash', count: 120 },
    { item: 'ammo_9mm', count: 30 },
    { item: 'first_aid_kit', count: 1 },
    { item: 'canned_chili', count: 2 },
  ],
  /** At dawn, horde zombies farther than this from the player burn off (are removed); closer ones stay as ordinary zombies. */
  dawnRemoveBeyond: 25,
};
