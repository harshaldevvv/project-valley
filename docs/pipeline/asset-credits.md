# Asset credits and licences

Every third-party asset or base mesh used in the game is listed here.

| asset id | source | author | licence | url | notes |
|---|---|---|---|---|---|
| AUDIO kenney/footstep_*, impact* (hit_body, hit_head, kill_confirm, impact_*, target_ping, jump_land, melee_hit, build_place/remove, reload_mag_in) | Kenney "Impact Sounds" 1.0 | Kenney (kenney.nl) | CC0 | https://kenney.nl/assets/impact-sounds | copied as-is (.ogg) by tools/audio/import_cc0.py |
| AUDIO kenney/click_*, open_001, close_001, error_004, tick_001, confirmation_001 (ui_*, hit_marker, build_invalid) | Kenney "Interface Sounds" | Kenney (kenney.nl) | CC0 | https://kenney.nl/assets/interface-sounds | as-is |
| AUDIO kenney/metalClick, metalLatch, drawKnife*, creak*, cloth*, handleSmallLeather*, beltHandle*, dropLeather, clothBelt* (dry_fire, reload_mag_out, bolt_rack, crate_open, search_rustle, item_pickup, inventory_move) | Kenney "RPG Audio" | Kenney (kenney.nl) | CC0 | https://kenney.nl/assets/rpg-audio | as-is |
| AUDIO gun/pistol_22, gun/rifle_magnum (pistol_shot, rifle_shot) | "Gunshots" (22 Pistol, 22 Magnum) | kurt (OpenGameArt) | CC0 | https://opengameart.org/content/gunshots | mono 32 kHz, first shot only, trimmed + normalised (import_cc0.py) |
| AUDIO gun/pistol_cz, gun/rifle_sks, gun/rifle_mosin, gun/shotgun (pistol_shot, rifle_shot, shotgun_shot) | "Gunshot Sounds" (cz, sks, mosin, shotty) | tabasco (OpenGameArt) | CC0 | https://opengameart.org/content/gunshot-sounds | mono 32 kHz, trimmed + normalised |
| AUDIO gun/pistol_1911, pistol_ppq, rifle_ak, rifle_ar15, rifle_sks2, shotgun_nova, shotgun_m12 (pistol_shot, rifle_shot, shotgun_shot body layer); gun/pistol_tail, rifle_tail, shotgun_tail (distant tail layer) | "The Free Firearm Sound Library" (Prepared SFX Library: 1911 A_42P/A_34P, Walther PPQ X_39P, AK-47 C_28P, AR-15 D_32P/D_24P, SKS U_14P, Nova O_21P/O_17P, Model 12 K_22P) | Ben Jaszczak et al. (OpenGameArt, uploaded by Ylmir) | CC0 | https://opengameart.org/content/the-free-firearm-sound-library | 96 kHz stereo -> 48 kHz mono, leading silence trimmed, body 0.9-1.4 s, tails 3 s lowpassed 2.5 kHz, peak about -2 dB, OGG Vorbis q5 (D:/AI3D/dl scripts) |
| AUDIO gun/reload_out_ar, reload_in_ar, reload_out_pistol, reload_in_pistol, bolt_cock (reload_mag_out, reload_mag_in, bolt_rack) | "Gun reload sounds" (assaultriflereload1, gunreload1, shotguncock; airsoft guns) | Joaken (OpenGameArt) | CC0 | https://opengameart.org/content/gun-reload-sounds | cut by silence gaps (not verified by ear which phase each cut is), mono 48 kHz, OGG |
| AUDIO melee/swing_1..4 (melee_swing) | "20 Sword Sound Effects (Attacks and Clashes)" (sword.3, .4, .6, .7; knives rubbed together) | StarNinjas (OpenGameArt) | CC0 | https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes | trimmed, mono 48 kHz, OGG |
| AUDIO melee/swing_5 (melee_swing) | "3 melee sounds" (melee sound.wav) | qubodup, edited by remaxim (OpenGameArt) | CC0 | https://opengameart.org/content/3-melee-sounds | trimmed, mono 48 kHz, OGG |
| AUDIO melee/knife_stab_1, knife_stab_2 (knife_hit) | Kenney "RPG Audio" knife_slice, knife_slice2 via "150 Combat Sound Effects" (LICENSES.txt s03, CC0) | Kenney (OpenGameArt compilation by MedicineStorm) | CC0 | https://opengameart.org/content/150-combat-sound-effects | trimmed, mono 48 kHz, OGG |
| AUDIO throw/boom, throw/crack, throw/whoomp (explosion, frag_crack, molotov_burst) | Kenney "Sci-fi Sounds" low_frequency_explosion_000, explosion_crunch_001, explosion_crunch_000 via "150 Combat Sound Effects" (LICENSES.txt s04, CC0) | Kenney (OpenGameArt compilation by MedicineStorm) | CC0 | https://opengameart.org/content/150-combat-sound-effects | trimmed, mono 48 kHz, OGG; whoomp lowpassed 2.2 kHz |
| AUDIO throw/glass_1..3 (glass_break) | "BreakGlass_01..03" from CoMiGo's Bleeps and Bloops via "150 Combat Sound Effects" (s01, CC0) | Cosmo Myzrail Gorynych (OpenGameArt compilation by MedicineStorm) | CC0 | https://opengameart.org/content/150-combat-sound-effects | trimmed, mono 48 kHz, OGG |
| AUDIO throw/flare (flare_ignite) | "Retro Explosion Swoshes 04" from Kronbits 200 Free SFX via "150 Combat Sound Effects" (s05, CC0) | Kronbits (OpenGameArt compilation by MedicineStorm) | CC0 | https://opengameart.org/content/150-combat-sound-effects | trimmed, mono 48 kHz, OGG |
| AUDIO gun/supp_pistol, gun/supp_rifle (suppressed_pistol, suppressed_rifle) | "The Free Firearm Sound Library" (Walther PPQ X_39P, AK-47 C_28P), lowpassed 2.0 / 1.4 kHz and shortened to 0.5 / 0.7 s | Ben Jaszczak et al. (OpenGameArt, uploaded by Ylmir) | CC0 | https://opengameart.org/content/the-free-firearm-sound-library | mono 48 kHz, OGG; no tail layer |
| AUDIO zombie/z01–z24 (zombie_groan/alert/attack/hurt/death) | "Zombies Sound Pack" | artisticdude (OpenGameArt) | CC0 | https://opengameart.org/content/zombies-sound-pack | 24-bit -> 16-bit mono 22 kHz; split into ids by length, not yet by ear |
| AUDIO zombie/undead-1..4 (zombie_groan) | "Undead Moans" | AntumDeluge (OpenGameArt) | CC0 | https://opengameart.org/content/undead-moans | as-is |
| AUDIO zombie/darsycho__zombie-moans_0 (zombie_groan) | "Zombie moans" | darsycho (OpenGameArt) | CC0 | https://opengameart.org/content/zombie-moans | as-is |
| AUDIO car/Car_Engine_Loop, Car_Engine_Loop_2, Car_Engine_Start_Up, Car_Horn, Car_Door_* (car_engine_loop, car_start, car_horn, car_door) | "Car Sound Effects Pack (Low Quality)" | ggbotnet (OpenGameArt) | CC0 | https://opengameart.org/content/car-sound-effects-pack-low-quality | as-is |
| AUDIO car/tyre_skid_loop (car_skid_loop) | procedural, `tools/audio/gen_car_skid.sh` (ffmpeg FM squeal + band-passed noise) | Project Valley (own work) | Own work, no third-party audio | n/a | 2 s seamless loop; car_crash / car_land reuse Kenney impactPlate_light / impactSoft_heavy (CC0, listed above) |
| AUDIO melee_swing | procedural (Web Audio synth placeholder in src/engine/audio.ts) | engine-builder | n/a | — | replace with a CC0 whoosh when found |
| wpn_pistol_a, wpn_mag_pistol_a (reference only) | Beretta 92 / M9 published dimensions (217 mm long, 125 mm barrel) | Wikipedia | CC BY-SA text, dimensions only; nothing shipped | https://en.wikipedia.org/wiki/Beretta_92 | modelled from scratch in bpy; no images downloaded |
| wpn_rifle_a, wpn_mag_rifle_a (reference only) | AKM published dimensions (880 mm long, 415 mm barrel) | Wikipedia | CC BY-SA text, dimensions only; nothing shipped | https://en.wikipedia.org/wiki/AKM | modelled from scratch in bpy; no images downloaded |
| veh_pickup_a (reference only) | 1999-2006 Chevrolet Silverado regular-cab dimensions | Wikipedia | CC BY-SA text, dimensions only; nothing shipped | https://en.wikipedia.org/wiki/Chevrolet_Silverado | modelled from scratch in bpy; no images downloaded |
| env_*, prop_* (M1), kit_wood_* | original | asset-builder (bpy build scripts) | project-owned | - | no third-party meshes or images |
| chr_survivor_a (idle, idle_b) | 100STYLE `Neutral/Neutral_ID.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| chr_survivor_a (idle_c) | 100STYLE `Depressed/Depressed_ID.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| chr_survivor_a (walk) | 100STYLE `Neutral/Neutral_FW.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| chr_survivor_a (run, sprint) | 100STYLE `Neutral/Neutral_FR.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| chr_survivor_a (walk_back) | 100STYLE `Neutral/Neutral_BW.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| chr_survivor_a (run_back) | 100STYLE `Neutral/Neutral_BR.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| chr_survivor_a (strafe_left, strafe_right) | 100STYLE `Neutral/Neutral_SW.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| chr_survivor_a (run_strafe_left, run_strafe_right) | 100STYLE `Neutral/Neutral_SR.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| chr_survivor_a (crouch_idle) | 100STYLE `Crouched/Crouched_ID.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| chr_survivor_a (crouch_walk) | 100STYLE `Crouched/Crouched_FW.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| chr_survivor_a (turn_left_90, turn_right_90) | CMU Graphics Lab Motion Capture Database, trial 69_13 (walk, turn in place), via cgspeed BVH conversion (B. Hahne) | CMU Graphics Lab | free for all uses; no resale of the raw data | http://mocap.cs.cmu.edu/ | "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217." Retargeted and edited. Raw files not redistributed. |
| zmb_shambler_a (z_walk) | 100STYLE `Zombie/Zombie_FW.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_run) | 100STYLE `Zombie/Zombie_FR.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_idle) | 100STYLE `Zombie/Zombie_ID.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_idle_b) | 100STYLE `Depressed/Depressed_ID.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_idle_c) | 100STYLE `Old/Old_ID.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_walk_limp) | 100STYLE `LimpLeft/LimpLeft_FW.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_walk_limp_r) | 100STYLE `LimpRight/LimpRight_FW.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_walk_drag) | 100STYLE `DragLeftLeg/DragLeftLeg_FW.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_walk_drag_r) | 100STYLE `DragRightLeg/DragRightLeg_FW.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_walk_drunk) | 100STYLE `Drunk/Drunk_FW.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_run_b) | 100STYLE `Drunk/Drunk_FR.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_walk_old) | 100STYLE `Old/Old_FW.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_walk_bent) | 100STYLE `BentForward/BentForward_FW.bvh` | I. Mason, S. Starke, T. Komura | CC BY 4.0 | https://www.ianxmason.com/100style/ (Zenodo 8127870) | 100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited (modified: retargeted to our rig, cycle cut, stride/speed warped, feet locked). Raw BVH not redistributed. |
| zmb_shambler_a (z_walk_b) | CMU Graphics Lab Motion Capture Database, trial 104_41 (ZombieWalk), via cgspeed BVH conversion (B. Hahne) | CMU Graphics Lab | free for all uses; no resale of the raw data | http://mocap.cs.cmu.edu/ | "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217." Retargeted and edited. Raw files not redistributed. |
| zmb_shambler_a (z_walk_c) | CMU Graphics Lab Motion Capture Database, trial 120_22 (Zombie), via cgspeed BVH conversion (B. Hahne) | CMU Graphics Lab | free for all uses; no resale of the raw data | http://mocap.cs.cmu.edu/ | "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217." Retargeted and edited. Raw files not redistributed. |
| zmb_shambler_a (z_walk_d) | CMU Graphics Lab Motion Capture Database, trial 104_03 (Frankenstein walk), via cgspeed BVH conversion (B. Hahne) | CMU Graphics Lab | free for all uses; no resale of the raw data | http://mocap.cs.cmu.edu/ | "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217." Retargeted and edited. Raw files not redistributed. |
| zmb_shambler_a (z_crawl_b) | CMU Graphics Lab Motion Capture Database, trial 111_03 (crawling), via cgspeed BVH conversion (B. Hahne) | CMU Graphics Lab | free for all uses; no resale of the raw data | http://mocap.cs.cmu.edu/ | "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217." Retargeted and edited. Raw files not redistributed. |
| zmb_shambler_a (z_stagger) | CMU Graphics Lab Motion Capture Database, trial 105_59 (small stumble), via cgspeed BVH conversion (B. Hahne) | CMU Graphics Lab | free for all uses; no resale of the raw data | http://mocap.cs.cmu.edu/ | "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217." Retargeted and edited. Raw files not redistributed. |
| MUSIC music/explore_empty_city.ogg (explore loop) | "EmptyCity: Background Music" (EmptyCity.ogg) | yd (OpenGameArt) | CC0 | https://opengameart.org/content/emptycity-background-music | loudness matched, loops made seamless, OGG Vorbis (tools/audio/build_music.py) |
| MUSIC music/combat_medium_alert.ogg (fight loop) | "Medium Alert" (Medium Alert.mp3) | Sudocolon (OpenGameArt) | CC0 | https://opengameart.org/content/medium-alert | loudness matched, loops made seamless, OGG Vorbis (tools/audio/build_music.py) |
| AMB amb/wind.ogg | "wind whoosh loop" (wind woosh loop.ogg) | SketchMan3 (OpenGameArt) | CC0 | https://opengameart.org/content/wind-whoosh-loop | loudness matched, loops made seamless, OGG Vorbis (tools/audio/build_music.py) |
| AMB amb/birds_day.ogg | "AMB Morning Sounds (Perfect Loop)" (amb_morning.ogg) | Kresiek The Furry (OpenGameArt) | CC0 | https://opengameart.org/content/amb-morning-sounds-perfect-loop | loudness matched, loops made seamless, OGG Vorbis (tools/audio/build_music.py) |
| AMB amb/crickets_night.ogg | "Crickets Ambient Noise - loopable" (crickets.mp3) | Wolfgang_ (OpenGameArt) | CC0 | https://opengameart.org/content/crickets-ambient-noise-loopable | loudness matched, loops made seamless, OGG Vorbis (tools/audio/build_music.py) |
| AMB amb/crows.ogg | "Crows singing" (Crows.ogg) | IgnasD (OpenGameArt) | CC0 | https://opengameart.org/content/crows-singing | loudness matched, loops made seamless, OGG Vorbis (tools/audio/build_music.py) |
| AMB amb/crow_caw.ogg | "Crow caw" (crow_caw.wav) | zeroisnotnull (OpenGameArt) | CC0 | https://opengameart.org/content/crow-caw | loudness matched, loops made seamless, OGG Vorbis (tools/audio/build_music.py) |
| MODEL pf/cattail-reed, fern-plant, lily-pad-cluster, medium-rock (outskirts nature pass, world/outskirts/nature.ts) | Polyfork catalog | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/cattail-reed-6abbb3, /fern-plant-1559b8, /lily-pad-cluster-457382, /medium-rock-e08405 | GLB as-is, instanced; credited in CREDITS.md |

## Polyfork catalog models (CC BY 4.0, generated from public/assets/models/{pf,item} by tools/audit/creditscheck.mjs rules)

Credit format in CREDITS.md: *Name by Polyfork (page URL), CC BY 4.0*. Files are the catalog GLBs, rescaled/instanced in game.

| asset id | source | author | licence | url | notes |
|---|---|---|---|---|---|
| MODEL pf/a-frame-cabin-6cb550 | Polyfork catalog "A-Frame Cabin" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/a-frame-cabin-6cb550 | GLB as-is |
| MODEL pf/abandoned-shopping-trolley-3de6cb | Polyfork catalog "Abandoned Shopping Trolley" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/abandoned-shopping-trolley-3de6cb | GLB as-is |
| MODEL pf/air-ambulance-helicopter-ed9acc | Polyfork catalog "Air Ambulance Helicopter" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/air-ambulance-helicopter-ed9acc | GLB as-is |
| MODEL pf/alcove-bookcase-83894d | Polyfork catalog "Alcove Bookcase" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/alcove-bookcase-83894d | GLB as-is |
| MODEL pf/alpine-hay-barn-3965e5 | Polyfork catalog "Alpine Hay Barn" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/alpine-hay-barn-3965e5 | GLB as-is |
| MODEL pf/ambulance-van-29919a | Polyfork catalog "Ambulance Van" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/ambulance-van-29919a | GLB as-is |
| MODEL pf/ammo-crate-ee3ec0, item/ammo-crate-ee3ec0 | Polyfork catalog "Ammo Crate" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/ammo-crate-ee3ec0 | GLB as-is (item pickup model) |
| MODEL pf/antenna-mast-0954b0 | Polyfork catalog "Antenna Mast" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/antenna-mast-0954b0 | GLB as-is |
| MODEL pf/anti-aircraft-searchlight-ba3f07 | Polyfork catalog "Anti-Aircraft Searchlight" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/anti-aircraft-searchlight-ba3f07 | GLB as-is |
| MODEL pf/arc-floor-lamp-fa0b5f | Polyfork catalog "Arc Floor Lamp" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/arc-floor-lamp-fa0b5f | GLB as-is |
| MODEL pf/area-rug-5c56e2 | Polyfork catalog "Area Rug" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/area-rug-5c56e2 | GLB as-is |
| MODEL pf/auto-repair-garage-b91464 | Polyfork catalog "Auto Repair Garage" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/auto-repair-garage-b91464 | GLB as-is |
| MODEL pf/back-bar-shelf-unit-11ab89 | Polyfork catalog "Back Bar Shelf Unit" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/back-bar-shelf-unit-11ab89 | GLB as-is |
| MODEL pf/backyard-barbecue-grill-84d4ef | Polyfork catalog "Backyard Barbecue Grill" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/backyard-barbecue-grill-84d4ef | GLB as-is |
| MODEL pf/backyard-doghouse-50a492 | Polyfork catalog "Backyard Doghouse" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/backyard-doghouse-50a492 | GLB as-is |
| MODEL pf/backyard-garden-shed-38d79f | Polyfork catalog "Backyard Garden Shed" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/backyard-garden-shed-38d79f | GLB as-is |
| MODEL pf/barbed-wire-fence-section-a01906 | Polyfork catalog "Barbed Wire Fence Section" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/barbed-wire-fence-section-a01906 | GLB as-is |
| MODEL pf/bear-proof-food-locker-9144bb | Polyfork catalog "Bear-Proof Food Locker" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/bear-proof-food-locker-9144bb | GLB as-is |
| MODEL pf/bed-6e10e8 | Polyfork catalog "Bed" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/bed-6e10e8 | GLB as-is |
| MODEL pf/bedside-table-3f2b80 | Polyfork catalog "Bedside Table" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/bedside-table-3f2b80 | GLB as-is |
| MODEL pf/birch-tree-181b33 | Polyfork catalog "Birch Tree" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/birch-tree-181b33 | GLB as-is |
| MODEL pf/bistro-table-877a6d | Polyfork catalog "Bistro Table" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/bistro-table-877a6d | GLB as-is |
| MODEL pf/board-privacy-fence-run-319bef | Polyfork catalog "Board Privacy Fence Run" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/board-privacy-fence-run-319bef | GLB as-is |
| MODEL pf/bocage-hedgerow-section-4c3126 | Polyfork catalog "Bocage Hedgerow Section" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/bocage-hedgerow-section-4c3126 | GLB as-is |
| MODEL pf/boxy-sedan-70s-7d55f7 | Polyfork catalog "Boxy-sedan-70s" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/boxy-sedan-70s-7d55f7 | GLB as-is |
| MODEL pf/brass-water-tower-b0c6d9 | Polyfork catalog "Brass water tower" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/brass-water-tower-b0c6d9 | GLB as-is |
| MODEL pf/brick-church-322885 | Polyfork catalog "Brick Church" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/brick-church-322885 | GLB as-is |
| MODEL pf/bus-shelter-f786b4 | Polyfork catalog "Bus Shelter" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/bus-shelter-f786b4 | GLB as-is |
| MODEL pf/bush-8bb596 | Polyfork catalog "Bush" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/bush-8bb596 | GLB as-is |
| MODEL pf/camouflage-net-canopy-ce6249 | Polyfork catalog "Camouflage Net Canopy" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/camouflage-net-canopy-ce6249 | GLB as-is |
| MODEL pf/camp-canoe-c65d2a | Polyfork catalog "Camp Canoe" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/camp-canoe-c65d2a | GLB as-is |
| MODEL pf/camp-cooler-8ba941 | Polyfork catalog "Camp Cooler" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/camp-cooler-8ba941 | GLB as-is |
| MODEL pf/camp-notice-board-c0be42 | Polyfork catalog "Camp Notice Board" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/camp-notice-board-c0be42 | GLB as-is |
| MODEL pf/camp-tent-3c5c89 | Polyfork catalog "Camp Tent" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/camp-tent-3c5c89 | GLB as-is |
| MODEL pf/camp-water-jug-1aba54, item/camp-water-jug-1aba54 | Polyfork catalog "Camp Water Jug" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/camp-water-jug-1aba54 | GLB as-is (item pickup model) |
| MODEL pf/camper-van-8d10e2 | Polyfork catalog "Camper-van" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/camper-van-8d10e2 | GLB as-is |
| MODEL pf/campfire-4390aa | Polyfork catalog "Campfire" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/campfire-4390aa | GLB as-is |
| MODEL pf/campground-pine-stand-0bf4f2 | Polyfork catalog "Campground Pine Stand" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/campground-pine-stand-0bf4f2 | GLB as-is |
| MODEL pf/campground-rail-fence-run-524013 | Polyfork catalog "Campground Rail Fence Run" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/campground-rail-fence-run-524013 | GLB as-is |
| MODEL pf/camping-lantern-21d14b, item/camping-lantern-21d14b | Polyfork catalog "Camping Lantern" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/camping-lantern-21d14b | GLB as-is (item pickup model) |
| MODEL pf/campsite-picnic-table-361d51 | Polyfork catalog "Campsite Picnic Table" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/campsite-picnic-table-361d51 | GLB as-is |
| MODEL pf/canoe-rack-c8126e | Polyfork catalog "Canoe Rack" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/canoe-rack-c8126e | GLB as-is |
| MODEL pf/canvas-ridge-tent-f0df0d | Polyfork catalog "Canvas Ridge Tent" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/canvas-ridge-tent-f0df0d | GLB as-is |
| MODEL pf/canvas-wall-tent-de8a04 | Polyfork catalog "Canvas Wall Tent" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/canvas-wall-tent-de8a04 | GLB as-is |
| MODEL pf/cardboard-delivery-box-59cc68 | Polyfork catalog "Cardboard Delivery Box" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/cardboard-delivery-box-59cc68 | GLB as-is |
| MODEL pf/cargo-container-fd73bc | Polyfork catalog "Cargo Container" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/cargo-container-fd73bc | GLB as-is |
| MODEL pf/cattail-reed-6abbb3 | Polyfork catalog "Cattail Reed" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/cattail-reed-6abbb3 | GLB as-is |
| MODEL pf/cattle-wagon-0d3070 | Polyfork catalog "Cattle Wagon" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/cattle-wagon-0d3070 | GLB as-is |
| MODEL pf/chain-link-fence-run-6c3d68 | Polyfork catalog "Chain-Link Fence Run" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/chain-link-fence-run-6c3d68 | GLB as-is |
| MODEL pf/chicken-coop-371f97 | Polyfork catalog "Chicken Coop" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/chicken-coop-371f97 | GLB as-is |
| MODEL pf/city-bus-49fd97 | Polyfork catalog "City Bus" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/city-bus-49fd97 | GLB as-is |
| MODEL pf/clapboard-church-03a6f5 | Polyfork catalog "Clapboard Church" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/clapboard-church-03a6f5 | GLB as-is |
| MODEL pf/clock-tower-752081 | Polyfork catalog "Clock Tower" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/clock-tower-752081 | GLB as-is |
| MODEL pf/collapse-rubble-mound-4fbfed | Polyfork catalog "Collapse Rubble Mound" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/collapse-rubble-mound-4fbfed | GLB as-is |
| MODEL pf/compact-hatchback-386417 | Polyfork catalog "Compact Hatchback" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/compact-hatchback-386417 | GLB as-is |
| MODEL pf/construction-dumpster-2de7ae | Polyfork catalog "Construction Dumpster" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/construction-dumpster-2de7ae | GLB as-is |
| MODEL pf/cordwood-pile-b5229b | Polyfork catalog "Cordwood Pile" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/cordwood-pile-b5229b | GLB as-is |
| MODEL pf/corn-crop-b71f2f | Polyfork catalog "Corn Crop" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/corn-crop-b71f2f | GLB as-is |
| MODEL pf/crash-barrier-run-b47d1d | Polyfork catalog "Crash Barrier Run" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/crash-barrier-run-b47d1d | GLB as-is |
| MODEL pf/czech-hedgehog-d77ae5 | Polyfork catalog "Czech Hedgehog" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/czech-hedgehog-d77ae5 | GLB as-is |
| MODEL pf/dead-tree-6795fa | Polyfork catalog "Dead Tree" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/dead-tree-6795fa | GLB as-is |
| MODEL pf/delivery-truck-a9537e | Polyfork catalog "Delivery Truck" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/delivery-truck-a9537e | GLB as-is |
| MODEL pf/department-store-ffbd58 | Polyfork catalog "Department Store" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/department-store-ffbd58 | GLB as-is |
| MODEL pf/depot-fuel-tank-55a00e | Polyfork catalog "Depot Fuel Tank" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/depot-fuel-tank-55a00e | GLB as-is |
| MODEL pf/detached-garage-38a178 | Polyfork catalog "Detached Garage" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/detached-garage-38a178 | GLB as-is |
| MODEL pf/diner-sign-ab5f0a | Polyfork catalog "Diner-sign" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/diner-sign-ab5f0a | GLB as-is |
| MODEL pf/dining-chair-530532 | Polyfork catalog "Dining Chair" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/dining-chair-530532 | GLB as-is |
| MODEL pf/dome-tent-9ee59d | Polyfork catalog "Dome Tent" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/dome-tent-9ee59d | GLB as-is |
| MODEL pf/dorm-wardrobe-b10546 | Polyfork catalog "Dorm Wardrobe" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/dorm-wardrobe-b10546 | GLB as-is |
| MODEL pf/fallen-log-1685fb | Polyfork catalog "Fallen Log" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/fallen-log-1685fb | GLB as-is |
| MODEL pf/family-crossover-suv-42027f | Polyfork catalog "Family Crossover SUV" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/family-crossover-suv-42027f | GLB as-is |
| MODEL pf/farm-gate-8ab320 | Polyfork catalog "Farm Gate" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/farm-gate-8ab320 | GLB as-is |
| MODEL pf/feed-sack-c84641 | Polyfork catalog "Feed Sack" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/feed-sack-c84641 | GLB as-is |
| MODEL pf/fern-plant-1559b8 | Polyfork catalog "Fern Plant" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/fern-plant-1559b8 | GLB as-is |
| MODEL pf/field-barricade-a646b9 | Polyfork catalog "Field Barricade" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/field-barricade-a646b9 | GLB as-is |
| MODEL pf/field-grave-marker-15380b | Polyfork catalog "Field Grave Marker" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/field-grave-marker-15380b | GLB as-is |
| MODEL pf/field-hospital-marquee-8cf79b | Polyfork catalog "Field Hospital Marquee" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/field-hospital-marquee-8cf79b | GLB as-is |
| MODEL pf/field-radio-set-b6f3fd, item/field-radio-set-b6f3fd | Polyfork catalog "Field Radio Set" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/field-radio-set-b6f3fd | GLB as-is (item pickup model) |
| MODEL pf/field-rock-5e37c6 | Polyfork catalog "Field rock" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/field-rock-5e37c6 | GLB as-is |
| MODEL pf/filing-cabinet-f8a251 | Polyfork catalog "Filing Cabinet" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/filing-cabinet-f8a251 | GLB as-is |
| MODEL pf/fire-hydrant-b68b17 | Polyfork catalog "Fire Hydrant" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/fire-hydrant-b68b17 | GLB as-is |
| MODEL pf/fire-lookout-tower-714fa1 | Polyfork catalog "Fire Lookout Tower" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/fire-lookout-tower-714fa1 | GLB as-is |
| MODEL pf/firewood-stack-810f49, item/firewood-stack-810f49 | Polyfork catalog "Firewood Stack" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/firewood-stack-810f49 | GLB as-is (item pickup model) |
| MODEL pf/flagpole-7b7806 | Polyfork catalog "Flagpole" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/flagpole-7b7806 | GLB as-is |
| MODEL pf/flower-planter-500ed2 | Polyfork catalog "Flower Planter" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/flower-planter-500ed2 | GLB as-is |
| MODEL pf/folding-camp-chair-2fc7d1 | Polyfork catalog "Folding Camp Chair" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/folding-camp-chair-2fc7d1 | GLB as-is |
| MODEL pf/forest-outhouse-e968d1 | Polyfork catalog "Forest Outhouse" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/forest-outhouse-e968d1 | GLB as-is |
| MODEL pf/fridge-freezer-fb9b5a | Polyfork catalog "Fridge Freezer" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/fridge-freezer-fb9b5a | GLB as-is |
| MODEL pf/fuel-depot-e57cdc | Polyfork catalog "Fuel Depot" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/fuel-depot-e57cdc | GLB as-is |
| MODEL pf/fuel-drum-d65fa4 | Polyfork catalog "Fuel Drum" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/fuel-drum-d65fa4 | GLB as-is |
| MODEL pf/fuel-jerrycan-6f1d85, item/fuel-jerrycan-6f1d85 | Polyfork catalog "Fuel Jerrycan" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/fuel-jerrycan-6f1d85 | GLB as-is (item pickup model) |
| MODEL pf/gabled-farmhouse-c7534f | Polyfork catalog "Gabled Farmhouse" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/gabled-farmhouse-c7534f | GLB as-is |
| MODEL pf/garbage-truck-a7ffbf | Polyfork catalog "Garbage Truck" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/garbage-truck-a7ffbf | GLB as-is |
| MODEL pf/gas-pump-5014a8 | Polyfork catalog "Gas-pump" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/gas-pump-5014a8 | GLB as-is |
| MODEL pf/glass-door-drinks-fridge-21f077 | Polyfork catalog "Glass-Door Drinks Fridge" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/glass-door-drinks-fridge-21f077 | GLB as-is |
| MODEL pf/globe-gas-pump-b8e80d | Polyfork catalog "Globe Gas Pump" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/globe-gas-pump-b8e80d | GLB as-is |
| MODEL pf/grain-silo-58ca67 | Polyfork catalog "Grain Silo" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/grain-silo-58ca67 | GLB as-is |
| MODEL pf/grave-cross-95b3e9 | Polyfork catalog "Grave Cross" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/grave-cross-95b3e9 | GLB as-is |
| MODEL pf/greenhouse-53ab6d | Polyfork catalog "Greenhouse" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/greenhouse-53ab6d | GLB as-is |
| MODEL pf/ground-power-unit-326361 | Polyfork catalog "Ground Power Unit" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/ground-power-unit-326361 | GLB as-is |
| MODEL pf/guardrail-section-68c3c4 | Polyfork catalog "Guardrail Section" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/guardrail-section-68c3c4 | GLB as-is |
| MODEL pf/hammock-on-posts-7d5c47 | Polyfork catalog "Hammock on Posts" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/hammock-on-posts-7d5c47 | GLB as-is |
| MODEL pf/hay-bale-079e8c | Polyfork catalog "Hay Bale" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/hay-bale-079e8c | GLB as-is |
| MODEL pf/haystack-77b0dd | Polyfork catalog "Haystack" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/haystack-77b0dd | GLB as-is |
| MODEL pf/hearth-log-bench-c3c5ec | Polyfork catalog "Hearth Log Bench" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/hearth-log-bench-c3c5ec | GLB as-is |
| MODEL pf/heavy-timber-picnic-table-1ac060 | Polyfork catalog "Heavy Timber Picnic Table" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/heavy-timber-picnic-table-1ac060 | GLB as-is |
| MODEL pf/helipad-marking-decal-e697dd | Polyfork catalog "Helipad Marking Decal" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/helipad-marking-decal-e697dd | GLB as-is |
| MODEL pf/hollow-log-329fd7 | Polyfork catalog "Hollow Log" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/hollow-log-329fd7 | GLB as-is |
| MODEL pf/kit-bag-7d617f, item/kit-bag-7d617f | Polyfork catalog "Kit Bag" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/kit-bag-7d617f | GLB as-is (item pickup model) |
| MODEL pf/lake-dock-run-f5380e | Polyfork catalog "Lake Dock Run" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/lake-dock-run-f5380e | GLB as-is |
| MODEL pf/lake-kayak-930d0b | Polyfork catalog "Lake Kayak" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/lake-kayak-930d0b | GLB as-is |
| MODEL pf/lake-rowing-skiff-4916e7 | Polyfork catalog "Lake Rowing Skiff" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/lake-rowing-skiff-4916e7 | GLB as-is |
| MODEL pf/large-boulder-a29b99 | Polyfork catalog "Large Boulder" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/large-boulder-a29b99 | GLB as-is |
| MODEL pf/life-jacket-post-15c73a | Polyfork catalog "Life Jacket Post" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/life-jacket-post-15c73a | GLB as-is |
| MODEL pf/lily-pad-cluster-457382 | Polyfork catalog "Lily Pad Cluster" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/lily-pad-cluster-457382 | GLB as-is |
| MODEL pf/log-cabin-4fac3b | Polyfork catalog "Log Cabin" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/log-cabin-4fac3b | GLB as-is |
| MODEL pf/log-store-25e0b5 | Polyfork catalog "Log Store" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/log-store-25e0b5 | GLB as-is |
| MODEL pf/lookout-watchtower-f1a5ce | Polyfork catalog "Lookout Watchtower" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/lookout-watchtower-f1a5ce | GLB as-is |
| MODEL pf/loot-crate-23dd3b | Polyfork catalog "Loot Crate" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/loot-crate-23dd3b | GLB as-is |
| MODEL pf/mailbox-8e36e8 | Polyfork catalog "Mailbox" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/mailbox-8e36e8 | GLB as-is |
| MODEL pf/marigold-pickup-f4b6f9 | Polyfork catalog "Marigold Pickup" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/marigold-pickup-f4b6f9 | GLB as-is |
| MODEL pf/material-pallet-6af263 | Polyfork catalog "Material Pallet" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/material-pallet-6af263 | GLB as-is |
| MODEL pf/medicine-cabinet-a9f13d | Polyfork catalog "Medicine Cabinet" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/medicine-cabinet-a9f13d | GLB as-is |
| MODEL pf/medium-rock-e08405 | Polyfork catalog "Medium Rock" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/medium-rock-e08405 | GLB as-is |
| MODEL pf/medium-tank-65da6b | Polyfork catalog "Medium Tank" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/medium-tank-65da6b | GLB as-is |
| MODEL pf/mesh-site-fence-run-a798a0 | Polyfork catalog "Mesh Site Fence Run" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/mesh-site-fence-run-a798a0 | GLB as-is |
| MODEL pf/metal-trash-can-f57043 | Polyfork catalog "Metal Trash Can" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/metal-trash-can-f57043 | GLB as-is |
| MODEL pf/military-cargo-truck-652f66 | Polyfork catalog "Military Cargo Truck" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/military-cargo-truck-652f66 | GLB as-is |
| MODEL pf/minefield-warning-sign-296d9e | Polyfork catalog "Minefield Warning Sign" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/minefield-warning-sign-296d9e | GLB as-is |
| MODEL pf/motel-sign-21033b | Polyfork catalog "Motel-sign" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/motel-sign-21033b | GLB as-is |
| MODEL pf/newspaper-box-3f2c0e | Polyfork catalog "Newspaper Box" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/newspaper-box-3f2c0e | GLB as-is |
| MODEL pf/newsstand-6dfd65 | Polyfork catalog "Newsstand" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/newsstand-6dfd65 | GLB as-is |
| MODEL pf/nissen-hut-dafb56 | Polyfork catalog "Nissen Hut" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/nissen-hut-dafb56 | GLB as-is |
| MODEL pf/oak-tree-50ee7c | Polyfork catalog "Oak Tree" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/oak-tree-50ee7c | GLB as-is |
| MODEL pf/oil-drum-386c30 | Polyfork catalog "Oil-drum" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/oil-drum-386c30 | GLB as-is |
| MODEL pf/one-room-schoolhouse-107ec9 | Polyfork catalog "One-Room Schoolhouse" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/one-room-schoolhouse-107ec9 | GLB as-is |
| MODEL pf/one-storey-shop-row-83c958 | Polyfork catalog "One-Storey Shop Row" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/one-storey-shop-row-83c958 | GLB as-is |
| MODEL pf/orchard-apple-tree-b21f85 | Polyfork catalog "Orchard Apple Tree" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/orchard-apple-tree-b21f85 | GLB as-is |
| MODEL pf/park-bench-dc8b62 | Polyfork catalog "Park Bench" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/park-bench-dc8b62 | GLB as-is |
| MODEL pf/pay-phone-booth-b8a1db | Polyfork catalog "Pay Phone Booth" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/pay-phone-booth-b8a1db | GLB as-is |
| MODEL pf/picket-fence-run-9310c1 | Polyfork catalog "Picket Fence Run" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/picket-fence-run-9310c1 | GLB as-is |
| MODEL pf/police-barricade-0bbf37 | Polyfork catalog "Police Barricade" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/police-barricade-0bbf37 | GLB as-is |
| MODEL pf/police-cruiser-a2d25e | Polyfork catalog "Police Cruiser" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/police-cruiser-a2d25e | GLB as-is |
| MODEL pf/pop-top-camper-van-62a322 | Polyfork catalog "Pop-Top Camper Van" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/pop-top-camper-van-62a322 | GLB as-is |
| MODEL pf/porch-log-cabin-d2f3ef | Polyfork catalog "Porch Log Cabin" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/porch-log-cabin-d2f3ef | GLB as-is |
| MODEL pf/portable-toilet-a3f1a2 | Polyfork catalog "Portable Toilet" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/portable-toilet-a3f1a2 | GLB as-is |
| MODEL pf/propped-fishing-rod-072978 | Polyfork catalog "Propped Fishing Rod" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/propped-fishing-rod-072978 | GLB as-is |
| MODEL pf/pump-island-canopy-c3aa62 | Polyfork catalog "Pump Island Canopy" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/pump-island-canopy-c3aa62 | GLB as-is |
| MODEL pf/pumpkin-crop-7de137 | Polyfork catalog "Pumpkin Crop" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/pumpkin-crop-7de137 | GLB as-is |
| MODEL pf/railway-telegraph-pole-run-bb9354 | Polyfork catalog "Railway Telegraph Pole Run" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/railway-telegraph-pole-run-bb9354 | GLB as-is |
| MODEL pf/ranger-station-ef6407 | Polyfork catalog "Ranger Station" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/ranger-station-ef6407 | GLB as-is |
| MODEL pf/red-barn-d41683 | Polyfork catalog "Red Barn" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/red-barn-d41683 | GLB as-is |
| MODEL pf/riding-lawn-tractor-09e93c | Polyfork catalog "Riding Lawn Tractor" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/riding-lawn-tractor-09e93c | GLB as-is |
| MODEL pf/roadside-billboard-c3c053 | Polyfork catalog "Roadside Billboard" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/roadside-billboard-c3c053 | GLB as-is |
| MODEL pf/roadside-capilla-shrine-c63056 | Polyfork catalog "Roadside Capilla Shrine" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/roadside-capilla-shrine-c63056 | GLB as-is |
| MODEL pf/roadside-farm-stand-e218ca | Polyfork catalog "Roadside Farm Stand" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/roadside-farm-stand-e218ca | GLB as-is |
| MODEL pf/rock-outcrop-158ac3 | Polyfork catalog "Rock Outcrop" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/rock-outcrop-158ac3 | GLB as-is |
| MODEL pf/rolled-plate-silo-42304a | Polyfork catalog "Rolled plate silo" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/rolled-plate-silo-42304a | GLB as-is |
| MODEL pf/route-shield-sign-462947 | Polyfork catalog "Route Shield Sign" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/route-shield-sign-462947 | GLB as-is |
| MODEL pf/rv-travel-trailer-bd53d7 | Polyfork catalog "RV Travel Trailer" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/rv-travel-trailer-bd53d7 | GLB as-is |
| MODEL pf/salvage-crate-3a7e1d | Polyfork catalog "Salvage crate" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/salvage-crate-3a7e1d | GLB as-is |
| MODEL pf/sandbag-wall-section-7075ee | Polyfork catalog "Sandbag Wall Section" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/sandbag-wall-section-7075ee | GLB as-is |
| MODEL pf/scarecrow-334079 | Polyfork catalog "Scarecrow" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/scarecrow-334079 | GLB as-is |
| MODEL pf/scout-jeep-c02efe | Polyfork catalog "Scout Jeep" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/scout-jeep-c02efe | GLB as-is |
| MODEL pf/scrap-built-aeroplane-65ac95 | Polyfork catalog "Scrap-built aeroplane" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/scrap-built-aeroplane-65ac95 | GLB as-is |
| MODEL pf/security-gatehouse-fd00c8 | Polyfork catalog "Security Gatehouse" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/security-gatehouse-fd00c8 | GLB as-is |
| MODEL pf/self-registration-post-e4636f | Polyfork catalog "Self-Registration Post" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/self-registration-post-e4636f | GLB as-is |
| MODEL pf/sideline-medical-tent-ce1649 | Polyfork catalog "Sideline Medical Tent" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/sideline-medical-tent-ce1649 | GLB as-is |
| MODEL pf/single-storey-ranch-house-3880ea | Polyfork catalog "Single-Storey Ranch House" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/single-storey-ranch-house-3880ea | GLB as-is |
| MODEL pf/site-cabin-e9ee10 | Polyfork catalog "Site Cabin" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/site-cabin-e9ee10 | GLB as-is |
| MODEL pf/site-generator-298792 | Polyfork catalog "Site Generator" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/site-generator-298792 | GLB as-is |
| MODEL pf/site-lighting-tower-674c45 | Polyfork catalog "Site Lighting Tower" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/site-lighting-tower-674c45 | GLB as-is |
| MODEL pf/skated-jersey-barrier-7f0a04 | Polyfork catalog "Skated Jersey Barrier" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/skated-jersey-barrier-7f0a04 | GLB as-is |
| MODEL pf/sleeping-bag-730d7d | Polyfork catalog "Sleeping Bag" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/sleeping-bag-730d7d | GLB as-is |
| MODEL pf/soda-vending-machine-4a5347 | Polyfork catalog "Soda Vending Machine" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/soda-vending-machine-4a5347 | GLB as-is |
| MODEL pf/sofa-9c0e7e | Polyfork catalog "Sofa" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/sofa-9c0e7e | GLB as-is |
| MODEL pf/soldiers-tent-4bd5b9 | Polyfork catalog "Soldiers' Tent" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/soldiers-tent-4bd5b9 | GLB as-is |
| MODEL pf/speed-limit-sign-1c55a2 | Polyfork catalog "Speed Limit Sign" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/speed-limit-sign-1c55a2 | GLB as-is |
| MODEL pf/splay-leg-lookout-tower-6fae7e | Polyfork catalog "Splay-Leg Lookout Tower" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/splay-leg-lookout-tower-6fae7e | GLB as-is |
| MODEL pf/split-level-house-40fe1a | Polyfork catalog "Split-Level House" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/split-level-house-40fe1a | GLB as-is |
| MODEL pf/split-log-bench-289780 | Polyfork catalog "Split-Log Bench" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/split-log-bench-289780 | GLB as-is |
| MODEL pf/split-rail-fence-run-87da39 | Polyfork catalog "Split-Rail Fence Run" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/split-rail-fence-run-87da39 | GLB as-is |
| MODEL pf/station-lamp-post-7d14dd | Polyfork catalog "Station Lamp Post" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/station-lamp-post-7d14dd | GLB as-is |
| MODEL pf/station-wagon-70s-11d67b | Polyfork catalog "Station-wagon-70s" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/station-wagon-70s-11d67b | GLB as-is |
| MODEL pf/stone-cairn-a9bf48 | Polyfork catalog "Stone Cairn" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/stone-cairn-a9bf48 | GLB as-is |
| MODEL pf/stone-fire-pit-4136b0 | Polyfork catalog "Stone Fire Pit" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/stone-fire-pit-4136b0 | GLB as-is |
| MODEL pf/stone-ring-campfire-8a0c6f | Polyfork catalog "Stone-Ring Campfire" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/stone-ring-campfire-8a0c6f | GLB as-is |
| MODEL pf/stone-well-2b4717 | Polyfork catalog "Stone Well" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/stone-well-2b4717 | GLB as-is |
| MODEL pf/streamline-diner-car-de9777 | Polyfork catalog "Streamline Diner Car" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/streamline-diner-car-de9777 | GLB as-is |
| MODEL pf/street-lamp-136745 | Polyfork catalog "Street Lamp" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/street-lamp-136745 | GLB as-is |
| MODEL pf/street-tree-0d33f3 | Polyfork catalog "Street Tree" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/street-tree-0d33f3 | GLB as-is |
| MODEL pf/suburban-pickup-truck-d15ea2 | Polyfork catalog "Suburban Pickup Truck" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/suburban-pickup-truck-d15ea2 | GLB as-is |
| MODEL pf/summit-cross-181eba | Polyfork catalog "Summit Cross" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/summit-cross-181eba | GLB as-is |
| MODEL pf/sunflower-80ce15 | Polyfork catalog "Sunflower" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/sunflower-80ce15 | GLB as-is |
| MODEL pf/swim-raft-6aefb5 | Polyfork catalog "Swim Raft" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/swim-raft-6aefb5 | GLB as-is |
| MODEL pf/tall-pine-tree-ab4108 | Polyfork catalog "Tall Pine Tree" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/tall-pine-tree-ab4108 | GLB as-is |
| MODEL pf/tank-wagon-d860fa | Polyfork catalog "Tank Wagon" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/tank-wagon-d860fa | GLB as-is |
| MODEL pf/team-minibus-f14295 | Polyfork catalog "Team Minibus" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/team-minibus-f14295 | GLB as-is |
| MODEL pf/teardrop-trailer-580e25 | Polyfork catalog "Teardrop Trailer" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/teardrop-trailer-580e25 | GLB as-is |
| MODEL pf/telegraph-and-post-office-71d3ff | Polyfork catalog "Telegraph and Post Office" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/telegraph-and-post-office-71d3ff | GLB as-is |
| MODEL pf/telegraph-pole-line-95e382 | Polyfork catalog "Telegraph Pole Line" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/telegraph-pole-line-95e382 | GLB as-is |
| MODEL pf/timber-utility-pole-a93693 | Polyfork catalog "Timber Utility Pole" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/timber-utility-pole-a93693 | GLB as-is |
| MODEL pf/timber-wash-house-c7e7d5 | Polyfork catalog "Timber Wash House" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/timber-wash-house-c7e7d5 | GLB as-is |
| MODEL pf/tire-ccf0eb | Polyfork catalog "Tire" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/tire-ccf0eb | GLB as-is |
| MODEL pf/tow-truck-7d04f8 | Polyfork catalog "Tow Truck" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/tow-truck-7d04f8 | GLB as-is |
| MODEL pf/traffic-cone-247748 | Polyfork catalog "Traffic Cone" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/traffic-cone-247748 | GLB as-is |
| MODEL pf/trailhead-sign-aa29e1 | Polyfork catalog "Trailhead Sign" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/trailhead-sign-aa29e1 | GLB as-is |
| MODEL pf/tree-stump-00f3bf | Polyfork catalog "Tree Stump" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/tree-stump-00f3bf | GLB as-is |
| MODEL pf/two-burner-camp-stove-3e83f5 | Polyfork catalog "Two-Burner Camp Stove" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/two-burner-camp-stove-3e83f5 | GLB as-is |
| MODEL pf/two-storey-family-house-c63c4a | Polyfork catalog "Two-Storey Family House" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/two-storey-family-house-c63c4a | GLB as-is |
| MODEL pf/tyre-stack-ad4692 | Polyfork catalog "Tyre Stack" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/tyre-stack-ad4692 | GLB as-is |
| MODEL pf/vending-machine-471c29 | Polyfork catalog "Vending Machine" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/vending-machine-471c29 | GLB as-is |
| MODEL pf/water-bowser-f6768c | Polyfork catalog "Water Bowser" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/water-bowser-f6768c | GLB as-is |
| MODEL pf/water-trough-318ee1 | Polyfork catalog "Water Trough" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/water-trough-318ee1 | GLB as-is |
| MODEL pf/wheat-crop-7e08e6 | Polyfork catalog "Wheat Crop" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/wheat-crop-7e08e6 | GLB as-is |
| MODEL pf/wheelbarrow-0f8406 | Polyfork catalog "Wheelbarrow" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/wheelbarrow-0f8406 | GLB as-is |
| MODEL pf/windpump-tower-1633a9 | Polyfork catalog "Windpump Tower" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/windpump-tower-1633a9 | GLB as-is |
| MODEL pf/wooden-crate-b9c96a | Polyfork catalog "Wooden Crate" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/wooden-crate-b9c96a | GLB as-is |
| MODEL pf/yellow-school-bus-0fd3b6 | Polyfork catalog "Yellow School Bus" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/yellow-school-bus-0fd3b6 | GLB as-is |
| MODEL pf/young-pine-0d7695 | Polyfork catalog "Young Pine" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/young-pine-0d7695 | GLB as-is |
| MODEL item/adventurer-s-backpack-b1365c | Polyfork catalog "Adventurer's Backpack" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/adventurer-s-backpack-b1365c | GLB as-is (item pickup model) |
| MODEL item/apple-b15012 | Polyfork catalog "Apple" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/apple-b15012 | GLB as-is (item pickup model) |
| MODEL item/axe-b545d6 | Polyfork catalog "Axe" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/axe-b545d6 | GLB as-is (item pickup model) |
| MODEL item/banded-cash-bundle-7da278 | Polyfork catalog "Banded Cash Bundle" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/banded-cash-bundle-7da278 | GLB as-is (item pickup model) |
| MODEL item/bottle-ca0f79 | Polyfork catalog "Bottle" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/bottle-ca0f79 | GLB as-is (item pickup model) |
| MODEL item/bread-loaf-0e0ab5 | Polyfork catalog "Bread Loaf" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/bread-loaf-0e0ab5 | GLB as-is (item pickup model) |
| MODEL item/chocolate-bar-284f07 | Polyfork catalog "Chocolate Bar" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/chocolate-bar-284f07 | GLB as-is (item pickup model) |
| MODEL item/compass-d16dde | Polyfork catalog "Compass" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/compass-d16dde | GLB as-is (item pickup model) |
| MODEL item/decorative-wire-coil-50561a | Polyfork catalog "Decorative Wire Coil" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/decorative-wire-coil-50561a | GLB as-is (item pickup model) |
| MODEL item/energy-drink-can-c47bcf | Polyfork catalog "Energy Drink Can" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/energy-drink-can-c47bcf | GLB as-is (item pickup model) |
| MODEL item/first-aid-bag-8a7f09 | Polyfork catalog "First Aid Bag" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/first-aid-bag-8a7f09 | GLB as-is (item pickup model) |
| MODEL item/headphones-d3e940 | Polyfork catalog "Headphones" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/headphones-d3e940 | GLB as-is (item pickup model) |
| MODEL item/lab-notebook-e60f7a | Polyfork catalog "Lab Notebook" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/lab-notebook-e60f7a | GLB as-is (item pickup model) |
| MODEL item/leather-belt-satchel-5bb107 | Polyfork catalog "Leather Belt Satchel" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/leather-belt-satchel-5bb107 | GLB as-is (item pickup model) |
| MODEL item/pitch-torch-79d752 | Polyfork catalog "Pitch Torch" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/pitch-torch-79d752 | GLB as-is (item pickup model) |
| MODEL item/rolled-pitch-tarpaulin-c8a93f | Polyfork catalog "Rolled Pitch Tarpaulin" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/rolled-pitch-tarpaulin-c8a93f | GLB as-is (item pickup model) |
| MODEL item/rope-coil-776dcc | Polyfork catalog "Rope Coil" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/rope-coil-776dcc | GLB as-is (item pickup model) |
| MODEL item/skate-helmet-cf1e6e | Polyfork catalog "Skate Helmet" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/skate-helmet-cf1e6e | GLB as-is (item pickup model) |
| MODEL item/spear-e9824e | Polyfork catalog "Spear" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/spear-e9824e | GLB as-is (item pickup model) |
| MODEL item/steel-helmet-f5aa7d | Polyfork catalog "Steel Helmet" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/steel-helmet-f5aa7d | GLB as-is (item pickup model) |
| MODEL item/tool-case-d92909 | Polyfork catalog "Tool Case" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/tool-case-d92909 | GLB as-is (item pickup model) |
| MODEL item/weapon-scope-6b43b2 | Polyfork catalog "Weapon Scope" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/weapon-scope-6b43b2 | GLB as-is (item pickup model) |
| MODEL item/wrench-390c5f | Polyfork catalog "Wrench" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/wrench-390c5f | GLB as-is (item pickup model) |

### Models built on a Polyfork base

| asset id | source | author | licence | url | notes |
|---|---|---|---|---|---|
| MODEL chr_hero_pf | Polyfork catalog "Student with Backpack" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/student-with-backpack-65d2b4 | modified: see CREDITS.md row |
| MODEL chr_npc_eli | Polyfork catalog "Male Villager" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/villager-40255c | modified: see CREDITS.md row |
| MODEL chr_npc_hollis | Polyfork catalog "Farmer" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/farmer-304a43 | modified: see CREDITS.md row |
| MODEL chr_npc_trader | Polyfork catalog "Merchant" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/merchant-6f606b | modified: see CREDITS.md row |
| MODEL chr_npc_wren | Polyfork catalog "Forest Ranger" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/forest-ranger-6906b0 | modified: see CREDITS.md row |
| MODEL zmb_pf_farmer_a | Polyfork catalog "Farmer" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/farmer-304a43 | modified: see CREDITS.md row |
| MODEL zmb_pf_ghoul_a | Polyfork catalog "Shambling Ghoul" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/shambling-ghoul-256f2f | modified: see CREDITS.md row |
| MODEL zmb_pf_ground_a | Polyfork catalog "Groundworker" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/groundworker-083f5c | modified: see CREDITS.md row |
| MODEL zmb_pf_police_a | Polyfork catalog "Police Officer" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/police-officer-1cc379 | modified: see CREDITS.md row |
| MODEL zmb_pf_scientist_a | Polyfork catalog "Senior Scientist" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/senior-scientist-631736 | modified: see CREDITS.md row |
| MODEL zmb_pf_soldier_a | Polyfork catalog "Infantry Rifleman" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/infantry-rifleman-c1c0a5 | modified: see CREDITS.md row |
| MODEL zmb_pf_teen_a | Polyfork catalog "Teen Zombie" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/teen-zombie-b5bb27 | modified: see CREDITS.md row |
| MODEL zmb_pf_worker_a | Polyfork catalog "Construction Worker" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/construction-worker-c1ad8c | modified: see CREDITS.md row |
| MODEL zmb_pfz_brute_a | Polyfork catalog "Groundworker" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/groundworker-083f5c | modified: see CREDITS.md row |
| MODEL zmb_pfz_crawler_a | Polyfork catalog "Scuba Diver" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/scuba-diver-bdd1c8 | modified: see CREDITS.md row |
| MODEL zmb_pfz_farmer_a | Polyfork catalog "Farmer" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/farmer-304a43 | modified: see CREDITS.md row |
| MODEL zmb_pfz_firefighter_a | Polyfork catalog "Firefighter" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/firefighter-b13b36 | modified: see CREDITS.md row |
| MODEL zmb_pfz_hiker_a | Polyfork catalog "Hiker" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/hiker-3d1a41 | modified: see CREDITS.md row |
| MODEL zmb_pfz_hoodie_a | Polyfork catalog "Student in a Hoodie" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/student-in-a-hoodie-7c8223 | modified: see CREDITS.md row |
| MODEL zmb_pfz_nurse_a | Polyfork catalog "Ward Nurse" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/ward-nurse-84b61d | modified: see CREDITS.md row |
| MODEL zmb_pfz_patient_a | Polyfork catalog "Patient in Gown" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/patient-in-gown-fdab75 | modified: see CREDITS.md row |
| MODEL zmb_pfz_police_a | Polyfork catalog "Police Officer" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/police-officer-1cc379 | modified: see CREDITS.md row |
| MODEL zmb_pfz_resident_a | Polyfork catalog "Suburban Resident" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/suburban-resident-a9db9c | modified: see CREDITS.md row |
| MODEL zmb_pfz_runner_a | Polyfork catalog "Surveyor" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/surveyor-82e5c7 | modified: see CREDITS.md row |
| MODEL zmb_pfz_screamer_a | Polyfork catalog "Lake Angler" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/lake-angler-1c4740 | modified: see CREDITS.md row |
| MODEL zmb_pfz_soldier_a | Polyfork catalog "Infantry Rifleman" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/infantry-rifleman-c1c0a5 | modified: see CREDITS.md row |
| MODEL zmb_pfz_trucker_a | Polyfork catalog "Trucker" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/trucker-9266a8 | modified: see CREDITS.md row |
| MODEL zmb_pfz_waitress_a | Polyfork catalog "Diner Waitress" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/diner-waitress-60f6a1 | modified: see CREDITS.md row |
| MODEL zmb_pfz_worker_a | Polyfork catalog "Construction Worker" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/construction-worker-c1ad8c | modified: see CREDITS.md row |
| MODEL veh_pickup_pf | Polyfork catalog "Pickup Truck" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/pickup-truck-a34bf2 | modified: rotated to the game's front axis, wheels re-pivoted (tools/audit/pf_vehicle.mjs) |
| MODEL wpn_shotgun_a | Polyfork catalog "Scattergun" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/scattergun-66b775 | modified: turned to -Z, grip at origin, recoloured (tools/audit/build_guns.mjs) |
| MODEL wpn_bolt_a | Polyfork catalog "Bolt Action Rifle" | Polyfork (polyfork.dev) | CC BY 4.0 | https://polyfork.dev/asset/bolt-action-rifle-2f1793 | modified: turned to -Z, scaled 92 %, grip at origin (tools/audit/build_guns.mjs) |
| MODEL pickup shapes (code) | Original low-poly pickup models built in code: `src/ui/inventory/pickupShapes.ts` (tools, melee, grenade, flares, ammo boxes, materials, clothing by cut, backpacks by build; red dot and suppressor reuse `attachParts.ts`) | Project Valley (own work) | Own work, no third-party asset | n/a | E4 round 2, 2026-11-21 |
