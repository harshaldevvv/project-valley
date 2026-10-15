# Asset credits and licences

Every third-party asset or base mesh used in the game is listed here.

| asset id | source | author | licence | url | notes |
|---|---|---|---|---|---|
| AUDIO kenney/footstep_*, impact* (hit_body, hit_head, kill_confirm, impact_*, target_ping, jump_land, melee_hit, build_place/remove, reload_mag_in) | Kenney "Impact Sounds" 1.0 | Kenney (kenney.nl) | CC0 | https://kenney.nl/assets/impact-sounds | copied as-is (.ogg) by tools/audio/import_cc0.py |
| AUDIO kenney/click_*, open_001, close_001, error_004, tick_001, confirmation_001 (ui_*, hit_marker, build_invalid) | Kenney "Interface Sounds" | Kenney (kenney.nl) | CC0 | https://kenney.nl/assets/interface-sounds | as-is |
| AUDIO kenney/metalClick, metalLatch, drawKnife*, creak*, cloth*, handleSmallLeather*, beltHandle*, dropLeather, clothBelt* (dry_fire, reload_mag_out, bolt_rack, crate_open, search_rustle, item_pickup, inventory_move) | Kenney "RPG Audio" | Kenney (kenney.nl) | CC0 | https://kenney.nl/assets/rpg-audio | as-is |
| AUDIO gun/pistol_22, gun/rifle_magnum (pistol_shot, rifle_shot) | "Gunshots" (22 Pistol, 22 Magnum) | kurt (OpenGameArt) | CC0 | https://opengameart.org/content/gunshots | mono 32 kHz, first shot only, trimmed + normalised (import_cc0.py) |
| AUDIO gun/pistol_cz, gun/rifle_sks, gun/rifle_mosin, gun/shotgun (pistol_shot, rifle_shot, shotgun_shot) | "Gunshot Sounds" (cz, sks, mosin, shotty) | tabasco (OpenGameArt) | CC0 | https://opengameart.org/content/gunshot-sounds | mono 32 kHz, trimmed + normalised |
| AUDIO zombie/z01–z24 (zombie_groan/alert/attack/hurt/death) | "Zombies Sound Pack" | artisticdude (OpenGameArt) | CC0 | https://opengameart.org/content/zombies-sound-pack | 24-bit -> 16-bit mono 22 kHz; split into ids by length, not yet by ear |
| AUDIO zombie/undead-1..4 (zombie_groan) | "Undead Moans" | AntumDeluge (OpenGameArt) | CC0 | https://opengameart.org/content/undead-moans | as-is |
| AUDIO zombie/darsycho__zombie-moans_0 (zombie_groan) | "Zombie moans" | darsycho (OpenGameArt) | CC0 | https://opengameart.org/content/zombie-moans | as-is |
| AUDIO car/Car_Engine_Loop, Car_Engine_Start_Up, Car_Horn, Car_Door_* (car_engine_loop, car_start, car_horn, car_door) | "Car Sound Effects Pack (Low Quality)" | ggbotnet (OpenGameArt) | CC0 | https://opengameart.org/content/car-sound-effects-pack-low-quality | as-is |
| AUDIO melee_swing | procedural (Web Audio synth placeholder in src/engine/audio.ts) | engine-builder | n/a | — | replace with a CC0 whoosh when found |
| wpn_pistol_a, wpn_mag_pistol_a (reference only) | Beretta 92 / M9 published dimensions (217 mm long, 125 mm barrel) | Wikipedia | CC BY-SA text, dimensions only; nothing shipped | https://en.wikipedia.org/wiki/Beretta_92 | modelled from scratch in bpy; no images downloaded |
| wpn_rifle_a, wpn_mag_rifle_a (reference only) | AKM published dimensions (880 mm long, 415 mm barrel) | Wikipedia | CC BY-SA text, dimensions only; nothing shipped | https://en.wikipedia.org/wiki/AKM | modelled from scratch in bpy; no images downloaded |
| veh_pickup_a (reference only) | 1999-2006 Chevrolet Silverado regular-cab dimensions | Wikipedia | CC BY-SA text, dimensions only; nothing shipped | https://en.wikipedia.org/wiki/Chevrolet_Silverado | modelled from scratch in bpy; no images downloaded |
| env_*, prop_* (M1), kit_wood_* | original | asset-builder (bpy build scripts) | project-owned | - | no third-party meshes or images |
