/**
 * Weapon attachments (M4). An attachment is an ordinary inventory item (data/items_attach.ts); attaching it removes the
 * item and records its id on the gun (ItemInstance.attach, saved with the gun), detaching gives a fresh item back.
 * Extended magazines are plain magazine items with a bigger capacity, so they need no entry here.
 * Runtime: gameplay/weapons/weapons.ts (effects, parts on the model), ui/hud/optics.ts (overlays), systems/attachments.ts (rules).
 */
export type AttachSlot = 'optic' | 'muzzle';

export interface AttachDef {
  id: string;
  slot: AttachSlot;
  /** Weapon item ids it fits. */
  fits: string[];
  /** Sight-line height of the optic above the gun's SOCKET_sight (m): the gun drops by this when aiming so the optic sits on the eye line.
   *  Also the aim point the first-person ADS lock puts on the eye line (red dot: lens centre, scope: tube axis; attachParts.buildOptic). */
  rise?: number;
  /** ADS field-of-view multiplier (smaller = more zoom). Irons use 0.8 (data/player.ts fovAdsMul). */
  fovMul?: number;
  /** Screen overlay while aimed: a red dot, or a scope picture (hides the first-person arms). */
  overlay?: 'dot' | 'scope';
  /** Muzzle: shot hearing radius and muzzle flash multipliers. */
  noiseMul?: number;
  flashMul?: number;
  /** Muzzle: shot sound by weapon class (key 'default' otherwise). */
  shotSound?: Record<string, string>;
}

const ALL_GUNS = ['pistol_a', 'rifle_a', 'shotgun_a', 'bolt_a', 'revolver_a', 'smg_a'];

export const attachDefs: Record<string, AttachDef> = {
  red_dot: { id: 'red_dot', slot: 'optic', fits: ALL_GUNS, rise: 0.024, fovMul: 0.72, overlay: 'dot' },
  scope_4x: { id: 'scope_4x', slot: 'optic', fits: ['rifle_a', 'bolt_a'], rise: 0.035, fovMul: 0.27, overlay: 'scope' },
  suppressor: { id: 'suppressor', slot: 'muzzle', fits: ['pistol_a', 'rifle_a', 'bolt_a', 'smg_a'], noiseMul: 0.22, flashMul: 0.25, shotSound: { pistol: 'suppressed_pistol', smg: 'suppressed_pistol', default: 'suppressed_rifle' } },
};

export const optics = {
  /** Scope picture: radius of the clear circle (share of the shorter screen side). */
  scopeRadius: 0.4,
  dotSizePx: 7,
  dotColor: '#ff2a2a',
  showAbove: 0.88, // ADS blend above which the overlay shows
  /** Extended magazine: model scale along the magazine length. */
  extMagScale: 1.45,
};
