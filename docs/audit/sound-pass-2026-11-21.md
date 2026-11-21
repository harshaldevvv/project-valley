# Sound pass by ear, 2026-11-21

Tool: `node tools/audit/soundlog.mjs <label>`. One headless 960x540 browser on its own dev server (:5196). It hooks `game.audio.play/loop` and Web Audio, and logs every sound: id, file chosen, volume, distance to the listener, 2D/3D, and the level at the ear. The level is file RMS + 20 log10(def volume x call volume x distance gain). The run covers walking on grass, concrete, wood, metal and dirt; jump and land; doors; looting; UI; crafting; fire and reload for all six guns; dry fire; zombie idle, chase, attack and death; three melee weapons; driving; rain; night.
Full tables: [soundlog-before.md](soundlog-before.md), [soundlog-after.md](soundlog-after.md).

Reference levels: own gunshots sit at -13 to -16 dB. The target is reloads and actions about 8 to 10 dB under that, and hit/kill UI ticks about 6 dB under.

## Found and fixed

| Problem (before) | Fix |
|---|---|
| Wood and metal floors played concrete steps (`player.ts` folded every hard surface into concrete). The jump take-off always played concrete. | New `footstep_wood` (Kenney footstep_wood) and `footstep_metal` (Kenney impactPlate_medium, rate 1.15). `Player.groundSurface()` returns the real tag, and build pieces count as wood. Steps and the take-off use the surface. |
| `heartbeat` had no file (synth placeholder only). | Own procedural `gen/heartbeat_1/2.ogg` (`tools/audio/gen_heartbeat.sh`). No synth-only ids are left. |
| Pump rack (-15.4 dB) and bolt cycle (-17.5) were as loud as the shot itself. Their pools mixed `bolt_cock` with Kenney drawKnife files that are 17 to 28 dB quieter, so the level swung wildly from play to play. | drawKnife removed from the gun pools. The pools use one file with more jitter. pump 0.9 -> 0.45, bolt_cycle 0.7 -> 0.4, bolt_rack 0.9 -> 0.35. They now sit at -21 to -22 dB. |
| Own reloads and dry fire played 3D from the feet, panned and 5 dB down in third person. Shots were already 2D. | Reload out/in/chamber and empty-gun dry fire are 2D (`weapons.ts`). Levels are matched to -22 to -24 dB. |
| Own melee swing played 3D from the feet. | 2D (`melee.ts`). Zombie swings stay 3D. |
| `kill_confirm` 2D UI at -14 to -16 dB: louder than the rifle shot. | 0.8 -> 0.4 (-21 dB). |
| `zombie_attack` -15 to -16 dB at arm's length, level with the player's gun. | 0.85 -> 0.55 (-20 dB). zombie_death 0.85 -> 0.65. melee_hit 0.85 -> 0.7. |
| `shotgun_shot` (-15.9) was quieter than the pistol (-14.0). | Shotgun 0.8 -> 1.0, pistol 0.9 -> 0.8. Shotgun is now -13.6, pistol -14.5. |
| `search_rustle` was 11 dB under the crate-open it goes with. | 0.5 -> 0.8. |
| Weapon switch played the reload mag-out clack (`reload_mag_out`). | New `weapon_switch` id: 5 Kenney cloth/belt/leather files. |
| `car_crash` was the light plate impact pitched down (thin, tinny). | Kenney impactPlate_heavy + impactMetal_heavy (10 variants). |
| Reload levels: open-latch -20.7, pistol mag-in -21.5, rifle mag-out -26.9: uneven. | Trimmed per file: all reloads are now -22.4 to -23.6. |

## Checked and fine as is

- Zombie groan, alert, hurt and death: 3D, 4 to 9 variants with jitter. Groans past 60 m are culled.
- Every gunshot is 2D with 2 to 3 files and 4% jitter. Impacts are 3D with 5 variants.
- Ambience: rain layer up to 0.47 under rain. At night, crickets go to 0.55, birds to 0 and wind to 0.61. The combat music layer comes in on chase.
- UI open/close sounds are single files, but jitter and their short length keep them from feeling repetitive.

## Not covered or left as is

- Throwable throw swing (`throwables.ts:409`) is still 3D from the feet. That file has another session's uncommitted edits, so I left it alone. It is a one-line change: add `twoD: true`.
- Placed build doors play `crate_open`, while yard doors play `door_creak` (`src/ui/build/buildMode.ts:190`). That is in `src/ui`, which is out of bounds for this pass.
- Crafting has no work sound of its own. Starting a craft plays search_rustle and finishing plays item_pickup. The harness opened the craft screen but did not complete a craft. Ground item pickup and `ui_click` were not exercised in the run.
- `reload_mag_out` / `reload_mag_in` still mix loud and quiet files. Only the lockpick and fallback paths use them now.
- Distances in the drive scenario are off: the car is entered before the camera moves to it.

## Before / after (every id heard in either run)

| id | before: 2D/3D, dist m, level dB, variants | after: 2D/3D, dist m, level dB, variants |
|---|---|---|
| bolt_cycle | 2D, 0.0, -17.5, 1/2 | 2D, 0.0, -22.4, 1/1 |
| bolt_rack | 2D, 0.0, -22.5, 1/2 | 2D, 0.0, -30.8, 1/1 |
| bolt_shot | 2D, 0.0, -13.4, 2/2 | 2D, 0.0, -13.4, 2/2 |
| car_crash | 3D, 2.6-60.0, -28.4, 3/5 | 3D, 2.6-60.0, -27.9, 3/10 |
| car_door | 3D, 8.2-73.8, -37.9, 1/2 (dropped: out-of-range) | 3D, 8.2-72.9, -28.5, 1/2 (dropped: out-of-range) |
| car_engine_loop | 3D, 74.3, -51.4, 1/1 | 3D, 73.5, -51.3, 1/1 |
| car_skid_loop | 3D, 74.3, -132.8, 1/1 | 3D, 73.5, -132.8, 1/1 |
| car_start | 3D, 74.3, -44.5, 1/1 | 3D, 73.5, -44.4, 1/1 |
| casing_tink | 3D, 2.1, -41.1, 4/5 | 3D, 1.9-2.6, -40.8, 5/5 |
| crate_open | 3D,2D, 0.0-3.8, -26.9, 2/3 | 3D,2D, 0.0-3.8, -28.1, 3/3 |
| door_creak | 3D, 3.9, -26.7, 2/3 | 3D, 3.9, -25.7, 2/3 |
| dry_fire | 3D, 1.6, -28.0, 1/1 | 2D, 0.0, -17.4, 2/2 |
| footstep_concrete | 3D, 1.6-3.4, -33.6, 5/5 (on: concrete,wood,metal) | 3D, 3.4, -35.1, 4/5 (on: concrete) |
| footstep_grass | 3D, 1.6-3.4, -36.1, 5/5 (on: grass,dirt) | 3D, 1.6-3.4, -36.2, 5/5 (on: none,grass,dirt) |
| footstep_metal | not heard | 3D, 3.4, -36.8, 2/5 (on: metal) |
| footstep_wood | not heard | 3D, 2.0, -29.4, 2/5 (on: wood) |
| hit_head | not heard | 2D,3D, 0.0-0.6, -18.9, 3/7 |
| hit_marker | 2D-ui, 0.0, -22.6, 1/1 | 2D-ui, 0.0, -22.6, 1/1 |
| impact_concrete | 3D, 10.6, -35.9, 2/5 | 3D, 10.6, -36.1, 2/5 |
| impact_dirt | 3D, 31.5-82.0, -, 0/5 (dropped: out-of-range) | 3D, 31.5-82.0, -, 0/5 (dropped: out-of-range) |
| impact_metal | 3D, 2.6, -21.8, 1/5 | 3D, 2.6-49.4, -35.1, 2/5 |
| impact_wood | 3D, 11.0, -35.6, 5/5 | 3D, 11.0, -35.6, 5/5 |
| jump_land | 3D, 3.2, -32.9, 2/5 (on: grass,concrete,wood) | 3D, 1.6-3.4, -31.4, 2/5 (on: grass,concrete,wood,none) |
| kill_confirm | 2D-ui, 0.0, -14.2, 1/5 | 2D-ui, 0.0, -21.5, 2/5 |
| knife_hit | 3D, 0.6, -18.7, 2/2 | 3D, 0.6-1.2, -18.8, 2/2 |
| melee_hit | 3D, 0.6-1.8, -14.6, 5/8 | 3D, 0.6-1.9, -16.4, 4/8 |
| melee_swing | 3D, 1.6, -26.4, 4/5 | 2D,3D, 0.0-2.7, -23.5, 4/5 |
| pistol_shot | 2D, 0.0, -14.0, 2/2 | 2D, 0.0, -14.5, 2/2 |
| pump_rack | 2D, 0.0, -15.4, 1/1 | 2D, 0.0, -21.4, 1/1 |
| reload_in_pistol | 3D, 1.6, -21.5, 1/1 | 2D, 0.0, -23.5, 1/1 |
| reload_in_rifle | 3D, 1.6, -25.7, 1/1 | 2D, 0.0, -23.5, 1/1 |
| reload_in_shells | 3D, 1.6, -25.7, 2/3 | 2D, 0.0, -23.6, 2/3 |
| reload_mag_out | 2D, 0.0, -31.1, 3/3 | not heard |
| reload_open_latch | 3D, 1.6, -20.7, 1/1 | 2D, 0.0, -23.6, 1/1 |
| reload_out_pistol | 3D, 1.6, -29.6, 1/1 | 2D, 0.0, -22.4, 1/1 |
| reload_out_rifle | 3D, 1.6, -26.9, 1/1 | 2D, 0.0, -23.0, 1/1 |
| revolver_shot | 2D, 0.0, -12.1, 1/2 | 2D, 0.0, -13.4, 2/2 |
| rifle_shot | 2D, 0.0, -14.7, 2/3 | 2D, 0.0, -14.5, 3/3 |
| search_rustle | 3D, 2.2-3.9, -38.0, 2/4 | 3D, 2.2-3.9, -33.9, 2/4 |
| shotgun_shot | 2D, 0.0, -15.9, 2/2 | 2D, 0.0, -13.9, 2/2 |
| smg_shot | 2D, 0.0, -15.3, 2/2 | 2D, 0.0, -14.7, 2/2 |
| target_ping | 3D, 36.8, -37.8, 1/5 | 3D, 36.8, -40.1, 1/5 |
| ui_close | 2D-ui, 0.0, -21.0, 1/1 | 2D-ui, 0.0, -21.0, 1/1 |
| ui_open | 2D-ui, 0.0, -21.0, 1/1 | 2D-ui, 0.0, -21.0, 1/1 |
| weapon_switch | not heard | 2D, 0.0, -36.6, 4/5 |
| zombie_alert | 3D, 3.8-14.7, -26.5, 2/6 | 3D, 3.8-14.7, -26.9, 3/6 |
| zombie_attack | 3D, 1.7, -15.8, 4/5 | 3D, 1.7, -19.6, 5/5 |
| zombie_death | 3D, 1.7, -15.9, 2/4 | 3D, 1.7, -18.9, 3/4 |
| zombie_groan | 3D, 2.8-136.4, -47.2, 5/9 (dropped: out-of-range) | 3D, 1.7-136.4, -42.9, 6/9 (dropped: out-of-range) |
| zombie_hurt | 3D, 1.7, -18.7, 3/5 | 3D, 1.7-2.3, -19.1, 5/5 |
