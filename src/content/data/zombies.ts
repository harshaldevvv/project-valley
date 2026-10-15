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
}

const zombieDefsBase: Record<string, ZombieDef> = {
  shambler: {
    id: 'shambler',
    model: 'zmb_shambler_a',
    hp: 150,
    legHp: 80,
    walk: 0.5,
    chase: 1.3,
    crawl: 0.5,
    turnRate: 4,
    zoneMul: { body: 0.5, limb: 0.35 },
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
    corpseTime: 10,
  },
};

/** Visual/physical variants of the shambler (same AI). Soldiers wear kit: a little more HP. */
export const zombieDefs: Record<string, ZombieDef> = {
  ...zombieDefsBase,
  worker: { ...zombieDefsBase.shambler, id: 'worker', model: 'zmb_worker_a', clipsFrom: 'zmb_shambler_a', scale: 1.02, hp: 160 },
  soldier: { ...zombieDefsBase.shambler, id: 'soldier', model: 'zmb_soldier_a', clipsFrom: 'zmb_shambler_a', scale: 1.05, hp: 190, legHp: 95 },
  civilian_f: { ...zombieDefsBase.shambler, id: 'civilian_f', model: 'zmb_civilian_f_a', clipsFrom: 'zmb_shambler_a', scale: 0.93, hp: 135 },
};

/** Spawn mix (weights, seeded RNG). */
export const zombieMix: Record<string, number> = { shambler: 0.4, worker: 0.25, civilian_f: 0.2, soldier: 0.15 };

export const senses = {
  coneDeg: 80,
  rangeDay: 25,
  rangeNight: 10,
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
  attackTokens: 2,
  attackSpacing: 0.45, // s between any two attack windups starting (no stacked hits)
  groanMin: 4,
  groanMax: 10,
  passive: false,
  shadowDist: 15, // m from the camera; skinned shadows are expensive (principles §13)
  showSenses: false,
};
