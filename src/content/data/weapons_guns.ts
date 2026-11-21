import type { WeaponDef } from './types';
import type { WeaponFeel } from './weapons';

/**
 * M4 gun depth: pump shotgun, bolt-action hunting rifle, revolver, SMG. Merged into weaponDefs / weaponFeel / weaponFx by
 * data/weapons.ts and data/fx.ts. Same rules as weapons.ts (principles §3): all four use removable magazine items
 * (shell carrier, stripper clip, speedloader, stick mag) so they ride on the existing reload flow.
 * Item rows: data/items_guns.ts. Models: tools/audit/build_guns.mjs. Loot: data/loot_guns.ts.
 */
export const GUN_DEFS: Record<string, WeaponDef> = {
  shotgun_a: {
    id: 'shotgun_a',
    class: 'shotgun',
    caliber: '12ga',
    fireModes: ['semi'],
    rpm: 72, // pump: ~0.83 s between shots (cycle sound at the midpoint)
    damage: 14, // per pellet, 8 pellets: ~112 point blank, falls off hard past 7 m
    pellets: 8,
    muzzleVelocity: 420,
    falloffStart: 7,
    falloffMinMul: 0.3,
    headMul: 2,
    adsMs: 300,
    sprintToFireMs: 300,
    recoilPitch: [3.6, 4.6],
    recoilYaw: 0.9,
    recoverPerSec: 7,
    hipSpread: 4.5,
    adsSpread: 2.8, // the pellet cone: a shotgun is never a laser
    bloomPerShot: 1.2,
    bloomMax: 6,
    reloadTacticalS: 3.2,
    reloadEmptyS: 3.8,
    magazines: ['mag_shotgun_a', 'mag_shotgun_ext'],
    noise: 170,
    durabilityPerShot: 0.0012,
  },
  bolt_a: {
    id: 'bolt_a',
    class: 'bolt',
    caliber: '.308',
    fireModes: ['semi'],
    rpm: 40, // 1.5 s per shot: the bolt must cycle
    damage: 120, // body shot stays a loss against a horde (zoneMul), a head shot kills anything
    pellets: 1,
    muzzleVelocity: 820,
    falloffStart: 120,
    falloffMinMul: 0.8,
    headMul: 3.2,
    adsMs: 380,
    sprintToFireMs: 350,
    recoilPitch: [4.2, 5.2],
    recoilYaw: 0.5,
    recoverPerSec: 6,
    hipSpread: 6,
    adsSpread: 0.04,
    bloomPerShot: 2,
    bloomMax: 7,
    reloadTacticalS: 2.8,
    reloadEmptyS: 3.3,
    magazines: ['mag_bolt_a', 'mag_bolt_ext'],
    noise: 230,
    durabilityPerShot: 0.0006,
  },
  revolver_a: {
    id: 'revolver_a',
    class: 'pistol',
    caliber: '.357',
    fireModes: ['semi'],
    rpm: 150,
    damage: 58,
    pellets: 1,
    muzzleVelocity: 440,
    falloffStart: 25,
    falloffMinMul: 0.7,
    headMul: 3.4,
    adsMs: 170,
    sprintToFireMs: 170,
    recoilPitch: [3, 3.8],
    recoilYaw: 0.6,
    recoverPerSec: 7.5,
    hipSpread: 2.6,
    adsSpread: 0.2,
    bloomPerShot: 1.4,
    bloomMax: 6,
    reloadTacticalS: 3.4,
    reloadEmptyS: 3.4,
    magazines: ['mag_revolver_a'],
    noise: 160,
    durabilityPerShot: 0.0004,
  },
  smg_a: {
    id: 'smg_a',
    class: 'smg',
    caliber: '9mm',
    fireModes: ['auto', 'semi'],
    rpm: 800,
    damage: 17,
    pellets: 1,
    muzzleVelocity: 380,
    falloffStart: 12,
    falloffMinMul: 0.5,
    headMul: 3.2,
    adsMs: 180,
    sprintToFireMs: 160,
    recoilPitch: [0.45, 0.75],
    recoilYaw: 0.4,
    recoverPerSec: 10,
    hipSpread: 3.2,
    adsSpread: 0.35,
    bloomPerShot: 0.35,
    bloomMax: 5.5,
    reloadTacticalS: 1.9,
    reloadEmptyS: 2.4,
    magazines: ['mag_smg_a', 'mag_smg_ext'],
    noise: 115,
    durabilityPerShot: 0.0004,
  },
};

export const GUN_FEEL: Record<string, WeaponFeel> = {
  shotgun_a: { model: 'wpn_shotgun_a', sound: 'shotgun_shot', drawMs: 650, trauma: 0.3, fovKick: 2.4, viewPunch: 2.2, kickBack: 0.06, kickReturnS: 0.15, recoverFrac: 0.9, magSize: 6, fallbackSize: [0.06, 0.2, 0.95], cycle: { sound: 'pump_rack', at: 0.35 }, reloadSounds: { out: 'reload_open_latch', in: 'reload_in_shells', chamber: 'pump_rack' } },
  bolt_a: { model: 'wpn_bolt_a', sound: 'bolt_shot', drawMs: 700, trauma: 0.28, fovKick: 2.2, viewPunch: 2.4, kickBack: 0.07, kickReturnS: 0.17, recoverFrac: 0.9, magSize: 5, fallbackSize: [0.05, 0.18, 1.0], cycle: { sound: 'bolt_cycle', at: 0.45 }, reloadSounds: { out: 'reload_open_latch', in: 'reload_in_rifle', chamber: 'bolt_cycle' } },
  revolver_a: { model: 'wpn_revolver_a', sound: 'revolver_shot', drawMs: 400, trauma: 0.2, fovKick: 1.6, viewPunch: 2, kickBack: 0.045, kickReturnS: 0.11, recoverFrac: 1, magSize: 6, fallbackSize: [0.04, 0.14, 0.26], reloadSounds: { out: 'reload_open_latch', in: 'reload_in_shells', chamber: 'reload_open_latch' } },
  smg_a: { model: 'wpn_smg_a', sound: 'smg_shot', drawMs: 450, trauma: 0.1, fovKick: 1, viewPunch: 0.7, kickBack: 0.025, recoverFrac: 1, magSize: 30, fallbackSize: [0.05, 0.15, 0.5], reloadSounds: { out: 'reload_out_rifle', in: 'reload_in_rifle', chamber: 'bolt_rack' } },
};

export const GUN_FX: Record<string, { flashLen: number; tracerEvery: number; casing: 'brass' | 'hull' | null; impactScale: number; smokeEvery: number }> = {
  shotgun_a: { flashLen: 0.5, tracerEvery: 0, casing: 'hull', impactScale: 0.7, smokeEvery: 1 },
  bolt_a: { flashLen: 0.45, tracerEvery: 1, casing: 'brass', impactScale: 1.4, smokeEvery: 1 },
  revolver_a: { flashLen: 0.34, tracerEvery: 0, casing: null, impactScale: 1, smokeEvery: 1 },
  smg_a: { flashLen: 0.22, tracerEvery: 4, casing: 'brass', impactScale: 0.7, smokeEvery: 4 },
};
