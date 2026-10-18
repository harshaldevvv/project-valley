/**
 * Sound table (engine-builder). id -> files under /assets/audio/ (one picked at random per play),
 * base volume 0..1, 3D falloff (inverse model, principles §14: refDistance ~2 m, rolloff 1.2),
 * maxDistance (zombies 60 m, gunshots 400 m). `synth` = procedural placeholder, no file yet.
 * Credits for every file: docs/pipeline/asset-credits.md. Re-import: tools/audio/import_cc0.py.
 */
export interface SoundDef {
  files: string[];
  volume: number;
  refDistance: number;
  maxDistance: number;
  loop?: boolean;
  /** Default ± pitch jitter (fraction). principles §4: ±4% on shots. */
  jitter?: number;
  /** Procedural placeholder used when `files` is empty or fails to load. */
  synth?: 'whoosh' | 'click' | 'thud' | 'noise' | 'beep' | 'hum';
}

const k = (name: string, n = 5) => Array.from({ length: n }, (_, i) => `kenney/${name}_${String(i).padStart(3, '0')}.ogg`);
const z = (...n: number[]) => n.map((i) => `zombie/z${String(i).padStart(2, '0')}.wav`);
const ui = (files: string[], volume = 0.5): SoundDef => ({ files, volume, refDistance: 1, maxDistance: 1, jitter: 0.02, synth: 'click' });

export const sounds: Record<string, SoundDef> = {
  // weapons
  pistol_shot: { files: ['gun/pistol_cz.wav', 'gun/pistol_22.wav'], volume: 0.9, refDistance: 4, maxDistance: 400, jitter: 0.04, synth: 'noise' },
  rifle_shot: { files: ['gun/rifle_sks.wav', 'gun/rifle_mosin.wav', 'gun/rifle_magnum.wav'], volume: 1, refDistance: 5, maxDistance: 500, jitter: 0.04, synth: 'noise' },
  shotgun_shot: { files: ['gun/shotgun.wav'], volume: 1, refDistance: 5, maxDistance: 450, jitter: 0.04, synth: 'noise' },
  dry_fire: { files: ['kenney/metalClick.ogg'], volume: 0.6, refDistance: 1, maxDistance: 15, jitter: 0.05, synth: 'click' },
  reload_mag_out: { files: ['kenney/metalLatch.ogg'], volume: 0.6, refDistance: 1, maxDistance: 15, jitter: 0.05, synth: 'click' },
  reload_mag_in: { files: k('impactPlate_light'), volume: 0.6, refDistance: 1, maxDistance: 15, jitter: 0.05, synth: 'click' },
  bolt_rack: { files: ['kenney/drawKnife1.ogg', 'kenney/drawKnife2.ogg', 'kenney/drawKnife3.ogg'], volume: 0.7, refDistance: 1, maxDistance: 20, jitter: 0.04, synth: 'click' },
  // hit feedback
  hit_body: { files: k('impactPunch_medium'), volume: 0.7, refDistance: 2, maxDistance: 40, jitter: 0.06, synth: 'thud' },
  hit_head: { files: k('impactMining'), volume: 0.8, refDistance: 2, maxDistance: 40, jitter: 0.05, synth: 'thud' },
  hit_marker: ui(['kenney/tick_001.ogg'], 0.45),
  kill_confirm: { files: k('impactSoft_heavy'), volume: 0.8, refDistance: 1, maxDistance: 1, jitter: 0.03, synth: 'thud' },
  impact_wood: { files: k('impactWood_medium'), volume: 0.6, refDistance: 2, maxDistance: 40, jitter: 0.08, synth: 'thud' },
  impact_concrete: { files: k('impactMining'), volume: 0.55, refDistance: 2, maxDistance: 40, jitter: 0.08, synth: 'thud' },
  casing_tink: { files: k('impactPlate_light'), volume: 0.15, refDistance: 1, maxDistance: 12, jitter: 0.15, synth: 'click' },
  impact_metal: { files: k('impactMetal_light'), volume: 0.6, refDistance: 2, maxDistance: 50, jitter: 0.08, synth: 'click' },
  impact_dirt: { files: k('impactSoft_medium'), volume: 0.5, refDistance: 2, maxDistance: 30, jitter: 0.1, synth: 'thud' },
  target_ping: { files: k('impactBell_heavy'), volume: 0.7, refDistance: 6, maxDistance: 150, jitter: 0.03, synth: 'beep' },
  // player movement
  footstep_grass: { files: k('footstep_grass'), volume: 0.35, refDistance: 1.5, maxDistance: 25, jitter: 0.08, synth: 'thud' },
  footstep_concrete: { files: k('footstep_concrete'), volume: 0.35, refDistance: 1.5, maxDistance: 25, jitter: 0.08, synth: 'thud' },
  jump_land: { files: k('footstep_carpet'), volume: 0.5, refDistance: 1.5, maxDistance: 25, jitter: 0.06, synth: 'thud' },
  // zombies (principles §14: max 60 m). Split of the "Zombies Sound Pack" files by length/shape, not yet by ear.
  zombie_groan: { files: ['zombie/undead-1.ogg', 'zombie/undead-2.ogg', 'zombie/undead-3.ogg', 'zombie/undead-4.ogg', 'zombie/darsycho__zombie-moans_0.ogg', ...z(2, 4, 10, 12)], volume: 0.6, refDistance: 2, maxDistance: 60, jitter: 0.08, synth: 'hum' },
  zombie_alert: { files: z(1, 8, 9, 15, 19, 20), volume: 0.85, refDistance: 3, maxDistance: 60, jitter: 0.06, synth: 'hum' },
  zombie_attack: { files: z(7, 13, 14, 22, 23), volume: 0.85, refDistance: 2, maxDistance: 60, jitter: 0.06, synth: 'hum' },
  zombie_hurt: { files: z(3, 5, 6, 11, 24), volume: 0.75, refDistance: 2, maxDistance: 60, jitter: 0.08, synth: 'hum' },
  zombie_death: { files: z(16, 17, 18, 21), volume: 0.85, refDistance: 2, maxDistance: 60, jitter: 0.05, synth: 'hum' },
  // melee
  melee_swing: { files: [], volume: 0.5, refDistance: 1, maxDistance: 15, jitter: 0.1, synth: 'whoosh' },
  melee_hit: { files: k('impactPunch_heavy'), volume: 0.85, refDistance: 2, maxDistance: 30, jitter: 0.06, synth: 'thud' },
  // vehicles
  car_engine_loop: { files: ['car/Car_Engine_Loop.ogg'], volume: 0.6, refDistance: 4, maxDistance: 120, loop: true, synth: 'hum' },
  car_start: { files: ['car/Car_Engine_Start_Up.ogg'], volume: 0.8, refDistance: 4, maxDistance: 120, synth: 'hum' },
  car_horn: { files: ['car/Car_Horn.ogg'], volume: 0.9, refDistance: 6, maxDistance: 250, synth: 'beep' },
  car_door: { files: ['car/Car_Door_Close.ogg', 'car/Car_Door_Open.ogg'], volume: 0.7, refDistance: 2, maxDistance: 40, jitter: 0.04, synth: 'thud' },
  // looting / inventory / building
  crate_open: { files: ['kenney/creak1.ogg', 'kenney/creak2.ogg', 'kenney/creak3.ogg'], volume: 0.6, refDistance: 2, maxDistance: 20, jitter: 0.05, synth: 'thud' },
  search_rustle: { files: ['kenney/cloth1.ogg', 'kenney/cloth2.ogg', 'kenney/cloth3.ogg', 'kenney/cloth4.ogg'], volume: 0.5, refDistance: 1.5, maxDistance: 15, jitter: 0.08, synth: 'noise' },
  item_pickup: ui(['kenney/handleSmallLeather.ogg', 'kenney/handleSmallLeather2.ogg', 'kenney/beltHandle1.ogg'], 0.6),
  inventory_move: ui(['kenney/dropLeather.ogg', 'kenney/clothBelt.ogg', 'kenney/clothBelt2.ogg', 'kenney/beltHandle2.ogg'], 0.5),
  build_place: { files: k('impactWood_heavy'), volume: 0.7, refDistance: 2, maxDistance: 40, jitter: 0.06, synth: 'thud' },
  build_remove: { files: k('impactPlank_medium'), volume: 0.6, refDistance: 2, maxDistance: 40, jitter: 0.06, synth: 'thud' },
  build_invalid: ui(['kenney/error_004.ogg'], 0.5),
  ui_click: ui(['kenney/click_001.ogg', 'kenney/click_002.ogg'], 0.4),
  ui_open: ui(['kenney/open_001.ogg'], 0.45),
  ui_close: ui(['kenney/close_001.ogg'], 0.45),
};

/**
 * Music and ambience (engine/atmosphere.ts). Files are built by tools/audio/build_music.py (seamless loops, loudness
 * matched); credits in docs/pipeline/asset-credits.md. Levels are 0..1 under the Music / Ambience buses (settings).
 * Fades are seconds to (almost) reach the new level; nothing ever cuts.
 */
export const atmosphere = {
  music: {
    explore: 'music/explore_empty_city.ogg',
    combat: 'music/combat_medium_alert.ogg',
    exploreLevel: 0.8,
    combatLevel: 0.75, // the fight loop is denser, so a bit under 1 sits level with explore
    toCombatS: 2.5, // crossfade into the fight layer
    toExploreS: 7, // and back out, slower
    combatAt: 0.5, // danger level (0 calm .. 1 fight, set by gameplay) that starts the fight layer
    dangerRadius: 25, // m: a zombie that has detected the player inside this = 1, one searching = 0.6
    hurtDangerS: 6, // taking damage counts as a fight for this long
    holdS: 8, // fight layer stays this long after danger drops, so it doesn't flicker
    pausedDuck: 0.45,
  },
  amb: {
    fadeS: 6,
    wind: { file: 'amb/wind.ogg', level: 0.35, nightBoost: 0.4 },
    birds: { file: 'amb/birds_day.ogg', level: 0.5 },
    crickets: { file: 'amb/crickets_night.ogg', level: 0.55 },
    crows: { files: ['amb/crows.ogg', 'amb/crow_caw.ogg'], level: 0.4, everyS: [25, 70] as [number, number] },
    groan: { level: 0.3, everyS: [45, 110] as [number, number], lowpassHz: 700 }, // a far-off zombie_groan file
  },
};
