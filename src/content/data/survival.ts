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
  bleeding: { pct: [2, 4] as [number, number], every: [1, 2] as [number, number], seconds: [5, 10] as [number, number] },
  heavy_bleeding: { pct: [4, 6] as [number, number], every: [1, 1.5] as [number, number], seconds: [10, 15] as [number, number] },
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
};
