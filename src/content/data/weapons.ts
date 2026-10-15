import type { WeaponDef } from './types';

/**
 * Gun stats (principles §3). Zombie TTK targets: rifle 1 headshot / ~1.5 s body-only; pistol 1–2 headshots.
 * Zombies take reduced body/limb damage (see data/zombies.ts zoneMul), which is what makes body-only fights a loss.
 */
export const weaponDefs: Record<string, WeaponDef> = {
  pistol_a: {
    id: 'pistol_a',
    class: 'pistol',
    caliber: '9mm',
    fireModes: ['semi'],
    rpm: 360,
    damage: 32,
    pellets: 1,
    muzzleVelocity: 350,
    falloffStart: 15,
    falloffMinMul: 0.65,
    headMul: 3.5,
    adsMs: 150,
    sprintToFireMs: 150,
    recoilPitch: [0.9, 1.2],
    recoilYaw: 0.25,
    recoverPerSec: 9.2, // ~90 % back in 250 ms
    hipSpread: 2.5,
    adsSpread: 0.3,
    bloomPerShot: 0.6,
    bloomMax: 5,
    reloadTacticalS: 1.8,
    reloadEmptyS: 2.4,
    magazines: ['mag_pistol_a'],
    noise: 80,
    durabilityPerShot: 0.0005,
  },
  rifle_a: {
    id: 'rifle_a',
    class: 'rifle',
    caliber: '7.62',
    fireModes: ['auto', 'semi'],
    rpm: 600,
    damage: 40,
    pellets: 1,
    muzzleVelocity: 715,
    falloffStart: 40,
    falloffMinMul: 0.65,
    headMul: 4,
    adsMs: 250,
    sprintToFireMs: 250,
    recoilPitch: [0.55, 0.8],
    recoilYaw: 0.3,
    recoverPerSec: 9.2,
    hipSpread: 3.5,
    adsSpread: 0.12,
    bloomPerShot: 0.4,
    bloomMax: 6,
    reloadTacticalS: 2.1,
    reloadEmptyS: 2.7,
    magazines: ['mag_rifle_a'],
    noise: 150,
    durabilityPerShot: 0.0003,
  },
};

/** Feel numbers WeaponDef doesn't carry (draw time, juice, sounds, model). Keyed by weapon id. */
export interface WeaponFeel {
  model: string;
  sound: string;
  drawMs: number;
  trauma: number; // camera trauma per shot
  fovKick: number; // degrees
  viewPunch: number; // cosmetic punch, degrees
  kickBack: number; // weapon model kick, m
  recoverFrac: number; // share of each recoil kick that auto-recovers (rest stays in the view)
  magSize: number; // sandbox fallback mag size
  fallbackSize: [number, number, number]; // placeholder model box
}
export const weaponFeel: Record<string, WeaponFeel> = {
  pistol_a: { model: 'wpn_pistol_a', sound: 'pistol_shot', drawMs: 350, trauma: 0.1, fovKick: 1, viewPunch: 1.2, kickBack: 0.03, recoverFrac: 0.85, magSize: 15, fallbackSize: [0.04, 0.13, 0.2] },
  rifle_a: { model: 'wpn_rifle_a', sound: 'rifle_shot', drawMs: 600, trauma: 0.13, fovKick: 1.5, viewPunch: 0.9, kickBack: 0.035, recoverFrac: 0.8, magSize: 30, fallbackSize: [0.06, 0.2, 0.9] },
};

/** Shared ballistics (principles §3). */
export const ballistics = {
  gravity: 9.81,
  drag: 0.05, // 1/s
  maxLife: 1.5, // s
  maxRange: 600, // m
  sprintSpreadAdd: 4,
  airSpreadAdd: 6,
  moveSpreadAdd: 1.2, // at jog speed
  bloomRecoverPerSec: 9,
  shotResetS: 0.3, // pattern restarts after this pause
  magCommitAt: 0.7,
  decalBehind: 3, // m: blood decal raycast continues behind the target
};

/** Melee weapons (principles §5). */
export interface MeleeDef {
  id: string;
  model: string;
  damage: number;
  reach: number; // m
  arcDeg: number;
  rays: number;
  windup: number; // s
  active: number;
  recovery: number;
  bufferWindow: number;
  staggerOnHit: 1 | 2; // heavy = every hit, light = second hit within 1 s
  hitstopLight: number; // s
  hitstopHeavy: number;
  hitstopKill: number;
  /** Heavy swing (RMB with a melee weapon): slower, always staggers. */
  heavyDamageMul: number;
  heavyWindup: number;
  heavyRecovery: number;
  noise: number; // melee kill noise
  durabilityPerHit: number;
}
export const meleeDefs: Record<string, MeleeDef> = {
  knife_a: {
    id: 'knife_a',
    model: 'wpn_knife_a',
    damage: 55,
    reach: 1.7,
    arcDeg: 80,
    rays: 5,
    windup: 0.18,
    active: 0.1,
    recovery: 0.32,
    bufferWindow: 0.15,
    staggerOnHit: 2,
    hitstopLight: 0.05,
    hitstopHeavy: 0.1,
    hitstopKill: 0.13,
    heavyDamageMul: 1.8,
    heavyWindup: 0.38,
    heavyRecovery: 0.45,
    noise: 5,
    durabilityPerHit: 0.01,
  },
};

export const shove = {
  duration: 0.4,
  coneDeg: 100,
  range: 1.8,
  maxTargets: 3,
  stagger: 1.0,
  push: 1.5,
};

export const finisher = {
  duration: 0.8,
  range: 1.8,
};

/** Slots the number keys select, in order 1..4. */
export const weaponSlots = ['primary', 'secondary', 'sidearm', 'melee'] as const;

/** Handling shared by all weapons. */
export const handling = {
  holsterS: 0.25, // lower the current weapon before drawing the next
  adsSwayDeg: 0.15, // Lissajous sway amplitude while aiming
  adsSwayHz: 0.4,
  exhaustedSwayMul: 3,
  fpHip: [0.17, -0.16, -0.36] as [number, number, number], // viewmodel offset from the eye (m)
  fpAds: [0, -0.075, -0.26] as [number, number, number],
  muzzleFlashSize: 0.32,
  /** Weapon rotation in the skinned SOCKET_hand_R (radians XYZ); tune live if the rig's socket axes change. */
  gripRot: [0, 0, 0] as [number, number, number],
};
