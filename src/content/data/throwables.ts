/**
 * Throwables (M4): hold the throw key to aim (arc preview), release to throw. Pure data, tuned live from the debug panel.
 * Items: data/items_throw.ts. Text: content/text/throw.ts. Runtime: gameplay/throwables/throwables.ts.
 * Physics is Rapier (a small dynamic ball: bounces and rolls); `breaks` ones shatter on the first hard impact.
 */
export type ThrowEffect = 'frag' | 'fire' | 'noise' | 'flare';

export interface ThrowDef {
  id: string;
  effect: ThrowEffect;
  look: 'grenade' | 'molotov' | 'bottle' | 'flare';
  /** Seconds to detonation after the throw (frag); null = on impact or never. */
  fuse: number | null;
  /** Shatters on the first hard impact (molotov, bottle). */
  breaks: boolean;
  radius: number; // collider, m
  restitution: number;
  /** Throw speed multiplier (a bottle flies a little further than a grenade). */
  speedMul: number;
}

export const throwDefs: Record<string, ThrowDef> = {
  frag_grenade: { id: 'frag_grenade', effect: 'frag', look: 'grenade', fuse: 3, breaks: false, radius: 0.045, restitution: 0.38, speedMul: 1 },
  molotov: { id: 'molotov', effect: 'fire', look: 'molotov', fuse: null, breaks: true, radius: 0.05, restitution: 0.1, speedMul: 1 },
  glass_bottle: { id: 'glass_bottle', effect: 'noise', look: 'bottle', fuse: null, breaks: true, radius: 0.05, restitution: 0.1, speedMul: 1.1 },
  flare: { id: 'flare', effect: 'flare', look: 'flare', fuse: null, breaks: false, radius: 0.03, restitution: 0.3, speedMul: 1 },
};
/** Selection order when cycling. */
export const throwOrder = ['frag_grenade', 'molotov', 'glass_bottle', 'flare'];

export const throwTuning = {
  speed: 14, // m/s at the hand
  upBias: 0.14, // rad added above the aim ray (a lob, not a laser)
  minAimS: 0.12, // shorter taps cancel
  windupS: 0.18, // release -> leaves the hand (the arm clip plays meanwhile)
  cooldownS: 0.7,
  previewSteps: 46,
  previewDt: 0.045,
  previewSkip: 3, // first preview dots hidden so the throwable in the hand shows (audit A13)
  breakSpeed: 3.2, // m/s of sudden speed change that counts as a hard impact
  maxLifeS: 12,
  frag: {
    radius: 8, // m
    damage: 230, // at the centre (before zone multipliers: applied as flat body damage)
    minFrac: 0.2, // share of damage at the edge
    stagger: 2.2, // s, everything inside the radius that survives
    push: 0.9, // melee push distance factor (m) away from the blast
    noise: 260, // hearing radius
    playerRadius: 6, // you are hurt by your own grenade inside this
    playerDamage: 70,
    trauma: 0.8,
  },
  fire: {
    radius: 3.2,
    seconds: 10,
    dps: 16, // flat damage per second to zombies standing in it (ignores zone multipliers)
    playerDps: 9, // you burn too if you stand in it
    tickS: 0.4,
    stagger: 0.5, // burning zombies flinch
    noise: 30, // the whoomp is heard
    lightColor: '#ff8a30',
    lightIntensity: 5,
    lightRange: 14,
  },
  noise: { radius: 48, repeat: 1 }, // glass shatter: zombies come looking at the impact point
  flare: {
    seconds: 32,
    lureRadius: 38,
    lureEveryS: 2.5,
    lightColor: '#ff3a2a',
    lightIntensity: 4,
    lightRange: 20,
  },
};

/**
 * Hold pose while aiming a throwable (audit A13): the gun goes away, the right hand cocks back above the shoulder with the
 * throwable in it, the left arm points at the target. TP is two-bone IK on the hero's arms (hand targets in body space,
 * m from each shoulder: x right, y up, z forward); FP is the arms rig's knife idle with the rig lifted and tilted back.
 */
export const throwPose = {
  inHL: 0.05, // s: blend into the pose
  outHL: 0.04, // s: blend out (the throw swing takes over)
  followS: 0.32, // s after the release the gun stays away while the throw swing plays
  tp: {
    handR: [0.12, 0.2, -0.16] as [number, number, number], // behind and above the right shoulder
    poleR: [1, -0.4, -0.6] as [number, number, number], // elbow out to the side and back (body space)
    handL: [0.12, -0.02, 0.42] as [number, number, number], // left arm out toward the target
    poleL: [-0.6, -1, 0] as [number, number, number],
    /** Throwable in SOCKET_hand_R (m, rad). */
    itemPos: [0, -0.02, 0.06] as [number, number, number],
    itemRot: [0, 0, 0] as [number, number, number],
  },
  fp: {
    pivotPos: [0.08, 0.06, 0.1] as [number, number, number], // camera space: right, up and back toward the shoulder
    pivotRot: [0.1, -0.2, -0.4] as [number, number, number], // rolled so the fist rises at the right edge
    /** Throwable in the arms' SOCKET_knife (m, rad). */
    itemPos: [0, 0, 0] as [number, number, number],
    itemRot: [0, 0, 0] as [number, number, number],
  },
};
