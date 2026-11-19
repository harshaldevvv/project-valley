import { meleeDefs, type MeleeDef } from './weapons';

/**
 * More melee weapons, registered into the shared `meleeDefs` table without editing weapons.ts (another owner).
 * Balance (principles §5): the knife is the fast tool, crowbar/hammer stagger every hit, axes hit hardest but swing slowly.
 * Hand models are stand-ins (crowbar, hammer, knife) until bat, machete and axe models exist (docs/pipeline/asset-requests.md).
 */
const heavy = (id: string, model: string, o: Partial<MeleeDef>): MeleeDef => ({
  id, model, damage: 65, reach: 1.9, arcDeg: 90, rays: 5, windup: 0.24, active: 0.12, recovery: 0.4, bufferWindow: 0.15,
  staggerOnHit: 1, hitstopLight: 0.08, hitstopHeavy: 0.12, hitstopKill: 0.15, heavyDamageMul: 1.7, heavyWindup: 0.48, heavyRecovery: 0.52,
  noise: 6, durabilityPerHit: 0.007, ...o,
});

export const EXTRA_MELEE: Record<string, MeleeDef> = {
  baseball_bat: heavy('baseball_bat', 'wpn_crowbar_a', { damage: 62, reach: 2.0, noise: 6, durabilityPerHit: 0.008 }),
  machete: heavy('machete', 'wpn_knife_a', { damage: 64, reach: 1.8, arcDeg: 100, windup: 0.2, recovery: 0.34, staggerOnHit: 2, noise: 5, durabilityPerHit: 0.009, heavyDamageMul: 1.8 }),
  fire_axe: heavy('fire_axe', 'wpn_hammer_a', { damage: 92, reach: 1.8, windup: 0.34, recovery: 0.5, heavyWindup: 0.58, heavyRecovery: 0.6, noise: 7, durabilityPerHit: 0.006, heavyDamageMul: 1.9 }),
};

Object.assign(meleeDefs, EXTRA_MELEE);
