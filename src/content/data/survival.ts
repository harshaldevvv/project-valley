/**
 * Survival needs and medical (principles §7; research §1 for wound numbers). Real-time minutes at 100% drain.
 * Needs run 0..100 (100 = full / rested). Every number here is live-tunable from F1 > Survival.
 */
export const SURVIVAL = {
  /** Real minutes from full to empty at 100% drain. */
  hungerMinutes: 90,
  thirstMinutes: 60,
  /** Fatigue only builds at night (and from exertion, reported by mechanics via adjust()). Points per real minute. */
  fatigueNightPerMin: 2.5,
  /** Recovery while it is day and nothing exerts you, points per real minute. */
  fatigueDayRecoverPerMin: 1,
  /** Above this a need is "well fed" (+10% stamina regen); below `lowBelow` stamina suffers. */
  wellFedAbove: 70,
  wellFedStaminaRegen: 1.1,
  lowBelow: 25,
  lowStaminaMul: 0.85,
  /** Fatigue below this = exhausted: aim sway grows. */
  exhaustedBelow: 25,
  exhaustedAimSway: 1.35,
  /** At 0: damage per tick and tick length (s). Never instant death. */
  starveDamage: 1,
  starveEvery: 20,
  dehydrateDamage: 1,
  dehydrateEvery: 12,
  /** Debug: multiplies every drain (F1 "needs x10"). */
  debugDrainMul: 1,
};

/** Wounds. Bleeds tick a % of max HP; [min, max] ranges are rolled with the seeded rng. */
export const WOUNDS = {
  // QA-090: light bleeds stop on their own after 30-45 s (so a bandage matters); heavy bleeds never do.
  bleeding: { pct: [2, 4] as [number, number], every: [1, 2] as [number, number], seconds: [30, 45] as [number, number] | null },
  heavy_bleeding: { pct: [4, 6] as [number, number], every: [1, 1.5] as [number, number], seconds: null as [number, number] | null },
  fracture: { moveSpeed: 0.8, healSeconds: 600 },
  /** 4 stages over 3 in-game days; effects escalate. hpPerMin = HP lost per real minute. */
  infection: {
    chance: 0.15,
    /** Limb armour rating at or above this blocks infection entirely. */
    armourImmune: 3,
    totalGameDays: 3,
    stages: [
      { staminaRegen: 0.95, aimSway: 1, moveSpeed: 1, hpPerMin: 0 },
      { staminaRegen: 0.85, aimSway: 1.1, moveSpeed: 1, hpPerMin: 0 },
      { staminaRegen: 0.7, aimSway: 1.25, moveSpeed: 0.92, hpPerMin: 1 },
      { staminaRegen: 0.5, aimSway: 1.5, moveSpeed: 0.85, hpPerMin: 3 },
    ],
  },
};

/** What a zombie hit can cause (rolled in onZombieHit). Chances are 0..1. */
export const ZOMBIE_HIT = {
  bleedChance: { head: 0.35, body: 0.3, limb: 0.25 } as Record<'head' | 'body' | 'limb', number>,
  /** A hit at or above this damage bleeds heavily instead. */
  heavyBleedDamage: 20,
  fractureChance: { head: 0, body: 0.02, limb: 0.08 } as Record<'head' | 'body' | 'limb', number>,
  /** Each armour point of the worn helmet/vest cuts the bleed chance by this much (stab vest 1 = -20%, plates 3 = -60%), up to the cap. */
  armourBleedCut: 0.2,
  armourBleedCutMax: 0.8,
  /** And the fracture chance (body hits). */
  armourFractureCut: 0.15,
};

/**
 * Warmth (comfort degrees are an abstract scale, not Celsius). The equilibrium is
 *   ambient (day..night, minus rain) + worn clothing (+ fire),
 * and warmth (0..100) drifts toward `100 - (comfort - equilibrium) * coldPerDegree` (never above 100). It is gentle on
 * purpose: starting clothes keep you fine at night; you get cold when you shed clothes, sit in the rain at night, or go
 * out dressed in a T-shirt. A fire beside you warms you within seconds.
 */
export const WARMTH = {
  /** Equilibrium at or above this = fully warm. */
  comfort: 16,
  dayTemp: 19,
  nightTemp: 3,
  /** Chill from full rain; the raincoat and hats cancel part of it. */
  rainPenalty: 4,
  /** Warmth points lost per comfort degree below `comfort`. */
  coldPerDegree: 5,
  /** Points per real minute moving toward the target. */
  coolPerMin: 6,
  warmPerMin: 18,
  /** A lit campfire within `fireRadius` metres adds this to the equilibrium and heats you at `fireWarmPerMin`. */
  fireBonus: 24,
  fireRadius: 5,
  fireWarmPerMin: 60,
  /** Status thresholds. */
  coldBelow: 55,
  freezingBelow: 25,
  /** Effects (multipliers on mods). */
  cold: { staminaRegen: 0.9, aimSway: 1.1 },
  freezing: { staminaRegen: 0.7, aimSway: 1.3, moveSpeed: 0.92 },
  /** Freezing hurts slowly: HP per tick and tick length, s (only with difficulty.coldDamage). */
  freezeDamage: 1,
  freezeEvery: 20,
  /** Respawn warms you to at least this. */
  respawn: 70,
};
