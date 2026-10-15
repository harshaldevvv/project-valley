/** Zombie archetypes + senses (principles §4 reaction ladder, §6 senses/tokens/telegraphs). */
export interface ZombieDef {
  id: string;
  model: string;
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

export const zombieDefs: Record<string, ZombieDef> = {
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
    attackRecover: 0.9,
    attackDamage: 15,
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
};

export const horde = {
  maxAlive: 30,
  attackTokens: 3,
  groanMin: 4,
  groanMax: 10,
  passive: false,
  showSenses: false,
};
