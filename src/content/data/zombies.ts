/** Zombie archetypes + senses (principles §4 reaction ladder, §6 senses/tokens/telegraphs). */
export interface ZombieDef {
  id: string;
  model: string;
  /** Model with the clips when `model` is mesh + skeleton only (variants share the shambler's clips by bone name). */
  clipsFrom?: string;
  /** Uniform height scale baked on the model's `<id>_rig` node; capsule and head zone heights scale with it. */
  scale?: number;
  hp: number;
  legHp: number;
  walk: number; // m/s wander
  chase: number; // m/s
  crawl: number;
  turnRate: number; // rad/s
  /** Head hit-ball centre height at scale 1 (m). Default 1.62 fits the original shambler mesh; the shorter AI-made bodies use 1.46. */
  headY?: number;
  zoneMul: { body: number; limb: number }; // head uses the weapon's headMul
  attackRange: number;
  attackWindup: number; // s, telegraph (sound plays at start)
  attackRecover: number;
  attackDamage: number;
  sprintMissChance: number; // vs a player at full sprint
  circleRadius: number; // without a token
  climbTime: number; // s to climb onto a vehicle / low wall
  climbMax: number; // m
  staggerFrac: number; // of max HP within staggerWindow
  staggerWindow: number;
  staggerTime: number;
  flinchTime: number;
  corpseTime: number;
  /** Headshot multiplier factor for headgear (soldier helmet), 1 = bare head. */
  helmetMul?: number;
  /** Fraction of z_death to hold: the body is down but the arms haven't splayed yet (QA-034). */
  deathHoldAt: number;
  /** Special archetype (data/zombie_arch.ts): runner, crawler, brute or screamer. Plain zombies leave it out. */
  archetype?: string;
  /** Spawns already on the ground (the crawler): z_crawl clip and crawler hit zones from the start. */
  startsCrawling?: boolean;
  /** A landed hit knocks the player down for this long (the brute), s. */
  knockdownS?: number;
  /** Screams on first detecting the player: after `windupS` every zombie within `radius` m hears it (the screamer). */
  scream?: { windupS: number; radius: number; cooldownS: number };
}

const zombieDefsBase: Record<string, ZombieDef> = {
  shambler: {
    id: 'shambler',
    model: 'zmb_shambler_a',
    hp: 120, // QA-077: rifle body-only ≈ 6 hits, head 1; a competent rifle fight vs 5 ends ~60–80 HP
    legHp: 70,
    walk: 0.5,
    chase: 1.3,
    crawl: 0.5,
    turnRate: 4,
    zoneMul: { body: 0.5, limb: 0.35 }, // body shots stay weak so aiming for the head matters
    attackRange: 1.5,
    attackWindup: 0.6,
    attackRecover: 1.0,
    attackDamage: 10, // QA-008: 5 zombies ≈ 7 s standing still, 20 survivable 10+ s when moving
    sprintMissChance: 0.4,
    circleRadius: 2,
    climbTime: 1.75,
    climbMax: 2.2,
    staggerFrac: 0.3,
    staggerWindow: 1.5,
    staggerTime: 0.8,
    flinchTime: 0.2,
    corpseTime: 120, // searchable bodies (QA-058); horde.maxCorpses caps them
    deathHoldAt: 0.8, // flat on the ground, arms at the sides (0.62 had the legs in the air, 1.0 splays the arms)
  },
};

/** Visual/physical variants of the shambler (same AI). Soldiers wear kit: a little more HP. */
export const zombieDefs: Record<string, ZombieDef> = {
  ...zombieDefsBase,
  worker: { ...zombieDefsBase.shambler, id: 'worker', model: 'zmb_worker_a', clipsFrom: 'zmb_shambler_a', scale: 1.02, hp: 130 },
  soldier: { ...zombieDefsBase.shambler, id: 'soldier', model: 'zmb_soldier_a', clipsFrom: 'zmb_shambler_a', scale: 1.05, hp: 160, legHp: 90, helmetMul: 0.6 } /* tougher: kit + helmet = 2 rifle headshots */,
  ai_civilian: { ...zombieDefsBase.shambler, id: 'ai_civilian', headY: 1.4, model: 'zmb_ai_civilian_a', clipsFrom: 'zmb_shambler_a', scale: 1.04, hp: 120 },
  ai_hazmat: { ...zombieDefsBase.shambler, id: 'ai_hazmat', headY: 1.4, model: 'zmb_ai_hazmat_a', clipsFrom: 'zmb_shambler_a', scale: 1.04, hp: 150 },
  ai_soldier: { ...zombieDefsBase.shambler, id: 'ai_soldier', headY: 1.4, model: 'zmb_ai_soldier_a', clipsFrom: 'zmb_shambler_a', scale: 1.06, hp: 170, legHp: 90, helmetMul: 0.6 },
  ai_nurse: { ...zombieDefsBase.shambler, id: 'ai_nurse', headY: 1.4, model: 'zmb_ai_nurse_f_a', clipsFrom: 'zmb_shambler_a', scale: 1.0, hp: 105 },
  ai_worker: { ...zombieDefsBase.shambler, id: 'ai_worker', headY: 1.4, model: 'zmb_ai_worker_a', clipsFrom: 'zmb_shambler_a', scale: 1.05, hp: 140 },
  ai_police: { ...zombieDefsBase.shambler, id: 'ai_police', headY: 1.4, model: 'zmb_ai_police_a', clipsFrom: 'zmb_shambler_a', scale: 1.04, hp: 150 },
  ai_hoodie: { ...zombieDefsBase.shambler, id: 'ai_hoodie', headY: 1.4, model: 'zmb_ai_hoodie_f_a', clipsFrom: 'zmb_shambler_a', scale: 0.96, hp: 100 },
  ai_suit: { ...zombieDefsBase.shambler, id: 'ai_suit', headY: 1.4, model: 'zmb_ai_suit_a', clipsFrom: 'zmb_shambler_a', scale: 1.03, hp: 115 },
  pf_teen: { ...zombieDefsBase.shambler, id: 'pf_teen', headY: 1.38, model: 'zmb_pf_teen_a', scale: 1.1, hp: 100 },
  pf_ghoul: { ...zombieDefsBase.shambler, id: 'pf_ghoul', headY: 1.38, model: 'zmb_pf_ghoul_a', scale: 1.08, hp: 110 },
  pf_police: { ...zombieDefsBase.shambler, id: 'pf_police', headY: 1.38, model: 'zmb_pf_police_a', scale: 1.0, hp: 150 },
  pf_worker: { ...zombieDefsBase.shambler, id: 'pf_worker', headY: 1.38, model: 'zmb_pf_worker_a', scale: 1.0, hp: 140 },
  pf_farmer: { ...zombieDefsBase.shambler, id: 'pf_farmer', headY: 1.38, model: 'zmb_pf_farmer_a', scale: 0.98, hp: 120 },
  pf_scientist: { ...zombieDefsBase.shambler, id: 'pf_scientist', headY: 1.38, model: 'zmb_pf_scientist_a', scale: 1.03, hp: 105 },
  pf_soldier: { ...zombieDefsBase.shambler, id: 'pf_soldier', headY: 1.38, model: 'zmb_pf_soldier_a', scale: 1.0, hp: 170, legHp: 90, helmetMul: 0.6 },
  pf_ground: { ...zombieDefsBase.shambler, id: 'pf_ground', headY: 1.38, model: 'zmb_pf_ground_a', scale: 1.0, hp: 130 },
  // Zombified Polyfork civilians (tools/audit/build_pfz.sh: vertex-colour corpse skin, faded clothes, blood), same style as the hero
  pfz_farmer: { ...zombieDefsBase.shambler, id: 'pfz_farmer', headY: 1.38, model: 'zmb_pfz_farmer_a', scale: 1.0, hp: 120 },
  pfz_trucker: { ...zombieDefsBase.shambler, id: 'pfz_trucker', headY: 1.38, model: 'zmb_pfz_trucker_a', scale: 1.04, hp: 140 },
  pfz_police: { ...zombieDefsBase.shambler, id: 'pfz_police', headY: 1.38, model: 'zmb_pfz_police_a', scale: 1.02, hp: 150 },
  pfz_worker: { ...zombieDefsBase.shambler, id: 'pfz_worker', headY: 1.38, model: 'zmb_pfz_worker_a', scale: 1.02, hp: 140, helmetMul: 0.8 },
  pfz_nurse: { ...zombieDefsBase.shambler, id: 'pfz_nurse', headY: 1.38, model: 'zmb_pfz_nurse_a', scale: 0.97, hp: 105 },
  pfz_hiker: { ...zombieDefsBase.shambler, id: 'pfz_hiker', headY: 1.38, model: 'zmb_pfz_hiker_a', scale: 1.0, hp: 125 },
  pfz_resident: { ...zombieDefsBase.shambler, id: 'pfz_resident', headY: 1.38, model: 'zmb_pfz_resident_a', scale: 1.0, hp: 110 },
  pfz_waitress: { ...zombieDefsBase.shambler, id: 'pfz_waitress', headY: 1.38, model: 'zmb_pfz_waitress_a', scale: 0.96, hp: 100 },
  pfz_soldier: { ...zombieDefsBase.shambler, id: 'pfz_soldier', headY: 1.38, model: 'zmb_pfz_soldier_a', scale: 1.03, hp: 170, legHp: 90, helmetMul: 0.6 },
  pfz_patient: { ...zombieDefsBase.shambler, id: 'pfz_patient', headY: 1.38, model: 'zmb_pfz_patient_a', scale: 0.98, hp: 95 },
  pfz_hoodie: { ...zombieDefsBase.shambler, id: 'pfz_hoodie', headY: 1.38, model: 'zmb_pfz_hoodie_a', scale: 1.0, hp: 105 },
  pfz_firefighter: { ...zombieDefsBase.shambler, id: 'pfz_firefighter', headY: 1.38, model: 'zmb_pfz_firefighter_a', scale: 1.04, hp: 160, helmetMul: 0.7 },
  // ---- special archetypes (models: tools/audit/build_pfz_special.sh; numbers and spawn weights: data/zombie_arch.ts) ----
  // Runner: fast and fragile, swings sooner, hard to outrun but dies to a couple of hits.
  runner: { ...zombieDefsBase.shambler, id: 'runner', archetype: 'runner', headY: 1.38, model: 'zmb_pfz_runner_a', scale: 0.97, hp: 55, legHp: 40, walk: 1.0, chase: 4.4, crawl: 0.6, attackWindup: 0.35, attackRecover: 0.7, attackDamage: 7, sprintMissChance: 0.1, circleRadius: 1.2, staggerFrac: 0.2 },
  // Crawler: on the ground from the start, low and dark. Capsule and head ball are low (scale 0.55), the clip is z_crawl.
  crawler: { ...zombieDefsBase.shambler, id: 'crawler', archetype: 'crawler', startsCrawling: true, headY: 1.0, model: 'zmb_pfz_crawler_a', scale: 0.55, hp: 70, legHp: 999, walk: 0.5, chase: 1.6, crawl: 1.7, attackRange: 1.3, attackWindup: 0.5, attackRecover: 0.9, attackDamage: 8, sprintMissChance: 0.5, circleRadius: 1.3, climbMax: 0.3 },
  // Brute: big (scale 1.4 baked into the model), slow, a lot of HP, hardly staggers, a hit knocks you down.
  brute: { ...zombieDefsBase.shambler, id: 'brute', archetype: 'brute', headY: 1.38, model: 'zmb_pfz_brute_a', scale: 1.4, hp: 650, legHp: 420, walk: 0.45, chase: 1.0, crawl: 0.4, attackRange: 2.1, attackWindup: 1.0, attackRecover: 1.7, attackDamage: 26, sprintMissChance: 0.2, circleRadius: 2.6, climbMax: 1.4, staggerFrac: 0.6, zoneMul: { body: 0.3, limb: 0.2 }, knockdownS: 0.9, helmetMul: 0.8 },
  // Screamer: weak, but its scream tells every zombie within 55 m where you are.
  screamer: { ...zombieDefsBase.shambler, id: 'screamer', archetype: 'screamer', headY: 1.38, model: 'zmb_pfz_screamer_a', scale: 0.95, hp: 80, legHp: 50, chase: 1.5, attackDamage: 6, scream: { windupS: 1.1, radius: 55, cooldownS: 30 } },
  civilian_f: { ...zombieDefsBase.shambler, id: 'civilian_f', model: 'zmb_civilian_f_a', clipsFrom: 'zmb_shambler_a', scale: 0.93, hp: 110 },
};

const MIXES: Record<string, Record<string, number>> = {
  orig: { shambler: 0.4, worker: 0.25, civilian_f: 0.2, soldier: 0.15 },
  ai: { ai_civilian: 0.14, ai_hazmat: 0.12, ai_soldier: 0.12, ai_nurse: 0.12, ai_worker: 0.12, ai_police: 0.12, ai_hoodie: 0.13, ai_suit: 0.13 },
  pfz: { pfz_farmer: 0.09, pfz_trucker: 0.09, pfz_police: 0.08, pfz_worker: 0.08, pfz_nurse: 0.08, pfz_hiker: 0.08, pfz_resident: 0.11, pfz_waitress: 0.08, pfz_soldier: 0.07, pfz_patient: 0.07, pfz_hoodie: 0.1, pfz_firefighter: 0.07 },
  pf: { pf_teen: 0.14, pf_ghoul: 0.12, pf_police: 0.12, pf_worker: 0.12, pf_farmer: 0.12, pf_scientist: 0.12, pf_soldier: 0.13, pf_ground: 0.13 },
};
/** Which zombie set spawns: `?chars=pfz` (default since 2026-11-20: zombified Polyfork civilians, same style as the hero), `?chars=orig` (the procedural originals), `?chars=ai` (local AI models) or `?chars=pf` (clean Polyfork characters). */
export const charSet = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('chars')) || 'pfz';
/** Spawn mix (weights, seeded RNG) of the chosen set. */
export const zombieMix: Record<string, number> = MIXES[charSet] ?? MIXES.orig;

export const senses = {
  coneDeg: 80,
  rangeDay: 25,
  rangeNight: 32, // zombies sense FURTHER at night (smell and sound carry; data/zombie_arch.ts DAY_NIGHT adds speed and hearing)
  stanceCrouch: 0.6,
  buildNear: 0.5, // s to fill suspicion at point blank
  buildFar: 1.5, // s at max range
  decay: 0.25, // suspicion/s with no stimulus
  suspiciousAt: 0.3,
  loseSightS: 3, // detected -> searching after this long unseen
  searchS: 25,
  hearingBump: 0.45, // suspicion from a heard noise (never straight to detected)
  losHz: 10,
  nearRange: 3.5, // inside this, a zombie senses the player at any angle (peripheral / smell)
  nearRate: 0.8, // suspicion/s from that
};

export const horde = {
  maxAlive: 30,
  attackTokens: 3, // principles §6 (QA-008 tuning: 5 standing still ≈ 7 s, kiting survives 20)
  attackSpacing: 0.45, // s between any two attack windups starting (no stacked hits)
  groanMin: 4,
  groanMax: 10,
  passive: false,
  maxCorpses: 12, // oldest corpse removed first
  shadowDist: 15, // m from the camera; skinned shadows are expensive (principles §13)
  showSenses: false,
};
