# Overnight 2026-11-20: tracking list

Branch `overnight/2026-11-20` (from `overnight/visual-overhaul-2026-11-13`). Owner asked: character first (model, animations, gun and knife hold, first-person hands), then gun audio, smooth controls, then a bigger demo map with many more models, items and things to do. One visual theme: the low-poly Polyfork style the world already uses.

Status: `[ ]` open, `[~]` in progress, `[x]` done, `[-]` dropped (reason given).

## A. Character (top priority)
- [x] A1 Find the "3,000 model library": it is the Polyfork catalog (3,446 CC BY 4.0 GLBs, 204 rigged characters, Mixamo skeleton). Index cached at `D:/AI3D/polyfork/catalog.json`.
- [x] A2 Pick a low-poly hero close to the poster survivor (dark jacket, backpack, gloves) from Polyfork; contact sheet `D:/AI3D/polyfork/sheet.png`.
- [x] A3 Rig bridge: Polyfork skeleton renamed to our bone names + sockets (hand_R/L, head, back), our survivor clips retargeted onto it (`tools/audit/retarget_pf.py` approach).
- [x] A4 Hero in game as default player; old survivor kept behind a flag.
- [~] A5 Animations (stride scale 0.96 for the hero's legs: planted-foot slip at jog 0.6 -> 0.48 m/s, `tools/audit/footslide.mjs`; original survivor 0.23): compare our clips vs Polyfork native Idle/Walk/Run; pick the better per clip; fix foot sliding, arm swing, transitions. Jog arm swing (2026-11-21): free arms (no carry pose / upper one-shot; knife counts as free) get a procedural shoulder swing in `bodyPost.armSwing`, driven by the opposite thigh's fore-aft angle (phase-locked to any clip / timeScale), elbow flexes with it, faded in 1.2-3 m/s and out 4.2-5.4 m/s so pf_run owns sprint (`animPost.armSwing*`). Hand travel at jog 0.16 -> 0.41 m (footratio.mjs now prints `arm`), sprint 0.69 unchanged; foot lock untouched (footratio jog slip 0.06/0.02 both ways, footslide jog 0.24/0.23 off vs 0.26/0.23 on). Strips: docs/audit/screenshots/wip/armswing_{jog,jogback,sprint,sprintback}_strip.png (top before, bottom after; animshots.mjs gained jogback/sprintback).
  - Foot locking (two-bone IK pins planted feet), aimed diagonals by orientation warping, hero crouch stride 0.85 (730b014): planted slip jog 0.45/0.19 -> 0.06/0.03 m/s, sprint 0.39/0.28 -> 0.13/0.07, crouch 0.49/0.27 -> 0.19/0.25, aimed diagonal 0.96/0.70 -> 0.13/0.02 (`tools/audit/footratio.mjs`). Hit/land while moving: procedural flinch + pelvis dip (no frozen legs). TP knife swing: torso twist + arm arc, 70/100 ms hero hit pause (1576dfa, `feelshots.mjs`). Native clip compare (`tools/audit/clipmeasure.mjs`, hero skeleton): pf_idle ≈ ours (kept), pf_walk 0.86 m/s too slow for our 1.6 walk (kept ours), pf_run 5.56 m/s with 0.7 m arm swing replaces the over-sped survivor jog as the hero's sprint (phase-aligned): sprint slip 0.13/0.07 -> 0.02/0.05 m/s, `anim_sprint_sheet.png`. Still open: jog arm swing (0.15 m) is weak; a procedural swing or better jog clip.
- [x] A6 Rifle and pistol hold (third person): both hands on the gun, no wrist bends, aim offset works.
- [x] A7 Knife hold: blade forward from a natural wrist angle (TP and FP).
- [x] A8 First person: no seeing inside the hand/arm (near plane, arm placement, back faces), sleeves match the hero.
- [x] A9 Backpack, helmets and gear on the new hero (Polyfork backpacks/helmets attach to sockets).
- [x] A10 Hands and joints, all 9 held types (unarmed, knife, pistol, rifle, shotgun, revolver, SMG, hunting rifle, throwable) x idle/walk/sprint/crouch/aim/reload/melee/fire, in over-the-shoulder, side and first person (`tools/audit/handaudit.mjs`, contact sheets `ha2_*_sheet.png`). Fixed:
  - FP long guns: the left hand wrapped the far side of the handguard where the gun hid it, and the hip offset slid the rig forward so the left forearm ended in view as a cut-off tube. Now the hand rolls under the handguard (`fpArms.supportRoll` 0.6), the elbow is pulled down (`supportElbowDown` 2) and the rifle hip rig sits lower (`hipOffset.rifle` y -0.13 -> -0.24); both fade out in ADS. `a10_before/after_fp_rifle_idle.png`, `_fp_rifle_ads.png`.
  - FP shotgun had no left hand at all (since 2bf15d6): the per-gun support offset went through `transformDirection`, which normalises, so its 1 cm became a 1 m drop (the pump slide too). Now metres. `a10_before/after_fp_shotgun_idle.png`, `a10_after_fp_shotgun_pump.png`.
  - Landing: a standing hop played the full-body land clip (24 cm squat, deeper than a 2.5 m drop's 14.5 cm); now the clip needs a 6.5 m/s fall (`animPost.landClipMinFall`), hops get the procedural dip (`landDipPerMps` 0.02, ~2.7 cm). FP camera dip snapped 6 cm in one frame; now eased down 70 ms / up 250 ms (`cameraFeel.landDip*`). `tools/audit/landseq.mjs`, `a10_before/after_land_hop_side.png`, `_land_drop_fp.png`. Melee hit pause left to the player-feel session.
  - NPCs (`tools/audit/npcclose.mjs`): Hollis straddled the farmhouse porch slab edge, feet sunk in it -> moved in front of the porch; Wren faced into the ranger station (player had to stand under its porch behind a post), then behind a sandbag wall -> open yard facing the track. `a10_before/after_hollis_feet.png`, `_wren_player.png`.
  - Open (not bugs): throwables have no throw-ready arm pose or in-hand model while aiming; TP rifle aim holds the left hand at the magazine well, not the handguard; FP shotgun ADS hides the left hand under the pump.
- [x] A12 Visual audit pass 2 (commit 55bb038): NPC talk pose, ground items, HUD at 1280x720 / 1920x1080.
  - Odell and Eli (`npcclose.mjs`, `npctalk.mjs`, `npcclips.mjs`): grounded, idles fine, but talking left them facing their spot and idling. NPCs now turn to face you and loop `pf_idle` (hand at the chest) while you talk, then turn back (`NPC_FEEL.talkClip/talkTurn/talkBlend`).
  - Ground items (`groundItems.mjs`, one of each of 41 ground models beside the hero): scales read right. Drops used the player's feet height, so a drop while airborne floated (1.0 m) or off a porch edge; now snapped to the surface under them (`INVENTORY.dropSnapUp/Down`).
  - HUD (`hudaudit.mjs`): no text overflow. The first-time hint (bottom centre) sat over dialogue choices and build cards -> hidden with its timer held while any screen or the build bar is open. The build bar covered HEALTH at 1280x720 -> lifted above the vitals below 1640 px.
  - Still open: throwable throw-ready pose + in-hand model (N), TP rifle aim left hand at the mag well, FP shotgun ADS left hand under the pump.
- [x] A13 Hands pass 3 (`handaudit.mjs a13pre|a13b`, `tools/audit/datatry.mjs` for live data variants): the three A10/A12 open items.
  - Throwables: holding N now puts the gun away (and blocks firing), cocks the hero's right hand back above the shoulder with the selected throwable in it and points the left arm at the target (two-bone IK, `throwPose.tp`, shared `animstand/ik.ts`). FP: the arms take the knife-idle grip with the throwable in the right fist, rig rolled up at the right edge (`throwPose.fp`); the release plays `fp_knife_light`. The first 3 arc dots are hidden so the item in the hand shows (`throwTuning.previewSkip`). `a13pre_throw_sheet.png` -> `a13b_throw_sheet.png`.
  - TP rifle aim: the clips grip the AK's mag well and the hero's arm (0.48 m) can't reach the handguard socket (0.70 m from the shoulder). Now the left clavicle swings forward 24 deg and the wrist takes the farthest reachable point along the barrel from the gun's `SOCKET_support` (`animPost.tpSupport*`): the hand sits under the handguard just ahead of the magazine. Shotguns get the hand on the pump too. `a13pre_rifle_a_sheet.png` -> `a13b_rifle_a_sheet.png`.
  - FP shotgun ADS: the left hand rolls under and out beside the pump while aiming (`fpArms.supportRollAds/supportAds`). `a13pre_shotgun_a_sheet.png` -> `a13b_shotgun_a_sheet.png`, `wristtry_1_ads.png`.
  - Seen, not mine: `src/engine/crowd.ts` (uncommitted, another session) fails tsc (`setBend` missing) and the pfz farmer crowd pipeline exceeds 8 vertex buffers in WebGPU.

## B. Controls and feel
- [x] B1 Stop-start while walking on flat ground (velocity was zeroed by any blocked tick; now wall-slide only). `tools/audit/walkdiag.mjs`: speed dips 29 -> 0.
- [~] B2 Smoothness: sprint verified steady 5.8 m/s with stamina drain (`tools/audit/sprintdiag.mjs`); turn-in-place and camera lag not yet tuned.
  - Turn-in-place now turns the hero (Mixamo 'Hips' lookup was missing); body yaw accel-limited: turn-onset jump 8.9 -> 1.6 deg/frame² (jog 180 flick), 12.8 -> 1.7 (sprint 90) (730b014, `tools/audit/turnprobe.mjs`). TP camera (`tools/audit/camprobe.mjs`): follow is rigid (0 lag); jog jitter max 6.0 -> 0.7 cm/frame² (3 cm curb / seam-lift steps now smoothed in height, 50 ms, 12 cm cap); a post crossing the view snapped the camera 66 cm in one frame -> eased via a wider anticipation cast (largest step 21 cm, jerk 70.7 -> 20.6 cm/frame²).
- [x] B3 Stall check (corrected: the first version of `tools/audit/stalldiag.mjs` never moved the player, so its 0 meant nothing). Real causes found later: heightfield cell edges stopped the player for one tick every few metres; fixed with FIX_INTERNAL_EDGES + a floor-only retry (route stall ticks ~200 -> 9 in `outskirtswalk.mjs`). The fixed `stalldiag.mjs` walks ~11 m per direction with real key presses: 1 stop, at a real wall.

## C. Weapons and audio
- [x] C1 Silent gunshots sometimes: own shots play as 2D (not HRTF at the muzzle), weapon sounds preloaded before play starts, layered shot (body + tail + mech).
- [x] C2 Better CC0 gun sounds (pistol, rifle, shotgun, reloads, dry fire, casings), logged in credits.
- [x] C3 Knife and melee whoosh/impact sounds.
- [x] C4 More guns from Polyfork wired with stats: pump shotgun `shotgun_a`, hunting rifle `bolt_a`, .357 `revolver_a`, SMG `smg_a` (items_guns, loot_guns, range rack, per-gun hands, attachments and extended mags; `attachcheck.mjs` passes).
- [x] C5 Gun polish, all six guns (`tools/audit/gunpolish.mjs ads|reload|audio`): ADS sight on the eye line per optic, FP reload hand and magazine paths, recoil feel, per-gun reload sounds. Details in the Log.

## Z. Zombies
- [x] Z1 Zombified Polyfork set `pfz` (12 civilians: corpse skin, faded clothes, blood, held props removed; `tools/audit/build_pfz.sh`) is the default; `?chars=orig` keeps the old ones.
- [x] Z2 Visual audit of every pfz type and the 4 archetypes (`tools/audit/zaudit.mjs <tag> [types]`: side-on ground-level film of walk-in, attack and death, plus a feet close-up; sheets `zc_<type>_sheet.png`). Plain pfz walkers: feet planted, no T-pose or pop, falls land flat. Fixed: the crawler (and any walker whose legs gave out) rose onto its knees for every attack, stagger and death, because those played the standing `z_attack` / `z_stagger` / `z_death`; now a fast `z_crawl_b` lunge, a slowed crawl, and a death that freezes the crawl prone along its heading (`crawlClips` in `content/data/zombies.ts`). `za_crawler_sheet.png` before, `zb_crawler_sheet.png` after.

- [x] Z3 Combat feel and effects (`tools/audit/zfx.mjs <tag> react,death,shoot,knife,hurt`: stops the game's loop and drives it at a fixed 60 Hz, so every frame strip has exact times; strips `docs/audit/screenshots/wip/zb_*` before, `zc_*` after). Fixed (297a76c, da69ad1):
  - Hit flinch by location: the crowd shader bends everything above a pivot along the shot, feet planted (`hitReact` in content/data/zombies.ts). Head hits snap the neck, body hits bend at the hips and off-centre hits twist the torso, leg hits buckle the knees toward the shooter. Was a whole-body roll wobble that did not read (`zb_react_*` vs `zc_react_*`).
  - The white hit flash covered the whole body for ~70 ms on every hit; now it sits on the hit height (head, torso or legs).
  - Death falls: a gun kill that throws the body off its feet played the knee-drop in mid-air and was still kneeling at 2 s; now down by ~0.6 s (`deathFall.flungSpeed` 2.4). Plain kills 0.95-1.4x speed. Head kills, crawler deaths unchanged (already fine).
  - Melee on the world: each surface's burst and sound (was always the wood knock); blades spark on metal / concrete / chainlink (`meleeWorldFx` in fx.ts).
  - Heavy hits on the player (15+ damage) muffle the world through an 800 Hz low-pass for 0.3 s (principles Â§4; `hurtMuffle` in sounds.ts).
  - Checked and fine: stagger on heavy / shotgun hits (damage ladder), headshot drop, blood bursts and floor decals, casings (land 1.3-2.3 m to the side, rest on the ground), FP muzzle flash (2 frames) and tracers, hurt vignette + directional wedge.
  - Open: in third person the muzzle flash is hidden behind the hero's torso (the gun sits on the body's centre line, the camera over the right shoulder); a camera framing call for the player-feel session. Third-person fire waits ~0.1 s for the barrel to rise (by design, `raiseT`).

## D. World / demo map
- [x] D1 Bigger demo area beyond the yard, same theme (Polyfork buildings, vehicles, props). 2026-11-21: the plateau now holds the yard, checkpoint, fuel stop, Maple Street, school, farm, Camp Harlan, Dunmore, diner, camp, crash site, ranger ridge and (new) Loon Lake Campground in the south-west corner, all Polyfork low-poly.
- [x] D2 More points of interest: gas station, farm, police checkpoint, camp, houses with interiors. 2026-11-21: Loon Lake Campground (`src/content/data/outskirts_lake.ts`, tier 2): dirt track on from the crash road, car park, enterable camp office (store shelves, tackle locker, desk) and two rental cabins, three old cabins, wash house, a lake (LAKE in data/nature.ts, terrain dip + water, reeds) with a step-on dock, canoe rack, skiff, swim raft, three tent pitches; new containers bear_locker / tackle_locker / camp_store_shelf with their own loot tables; 6 zombie zones (16); sign and text. 22 Polyfork models credited. Fill is rolled without the lake and drops what lands in it, so the tuned roadside layout elsewhere is unchanged. Walk `outskirtswalk.mjs lake` (and all): ok, 0 stuck. Draws before -> after: lake_road 122->134, lake_gate 117->129, lake_shore 105->114, lake_pitches 332->345, lake_office_in 323->330, lake_cabin_in 102->109, crash 152->155, school 154->162, maple 245->251, camp/diner/spawn unchanged within noise.
- [x] D3 Set dressing density pass, collision on every solid prop. Roadside round 2 (`src/content/data/outskirts_fill.ts`): 4 roadblocks with a centre gap (main road, Mill Road, farm road sandbags, crash road), 16 abandoned cars total (was 3; kept out of junction mouths, big vehicles never on the lane), power lines on the farm, diner, crash and Mill roads, guardrails, signs, mailboxes, bins and dumpsters, 26 dead trees and 8 stumps (trunk colliders), 8 lootable coolers (new `cooler` container, food table) and extra car trunks. Only models already in the repo, so no new credits.
- [x] D4 Performance check after each world pass (draw calls, tris, frame time). Roadside pass: table below; p95 16.9 ms at every walk stop.

## E. Items, loot, survival
- [x] E1 More backpacks (sizes), vests, helmets, clothing as items with stats. (Checked 2026-11-21: 15 backpacks, 52 clothing items incl. vests and helmets with warmth / armour / pockets, from the items round; covered by systems/content.test.ts and gear.test.ts.)
- [x] E2 More consumables (food, drink, meds), tools, crafting materials. (Checked: 23 food, 7 drink, 16 medical, 19 tools, 14 materials.)
- [x] E3 Loot tables per POI theme; containers placed in the new areas. (Checked: themed tables >= 60 % on theme and every container's roll fits its grid, content.test.ts; roadside coolers and POI containers in the outskirts.)
- [x] E4 Pick-up models for every new item (Polyfork props where they exist). New `content/data/pickups.test.ts`: every item resolves to a built model or an own file, and kind generics stay under half. Round 1: 13 new Polyfork pickups (wrench, cash bundle, rolled tarp, rope coil, wire coil, notebook for the 5 notes, headphones for earmuffs, firewood stack for the campfire kit, pitch torch, spear, weapon scope, ammo crate, bottle for the bottle and molotov) plus repo models for the medkit, fuel can and repair kit: 121 -> 101 of 208 items on a kind generic. Left on generics: clothing (folded-cloth bag, tinted), backpacks (tinted generic pack), ammo boxes and materials (small box); no Polyfork match for bats, machete, grenade, flare, binoculars, lockpick, tape, multitool. Render check `tools/audit/pickupshots.mjs` (first person, rows of 8, `pickups_1..3.png`): every new pickup loads at a sensible size and orientation, no placeholder boxes, no console errors. Round 2: code-built low-poly pickups for every item left on a kind generic (`ui/inventory/pickupShapes.ts`, own work, `PICKUP_MODELS.shapes`): bats, nail bat, machete, frag grenade, flares, binoculars, lockpick case, duct tape, multitool, bolt cutters, can opener, lighter, whistle, sewing kit, flashlight, cooking pot, hot-meal bowls, bandage roll, sterile pack, splint, auto-injectors, energy bar, jerky bag; red dot and suppressor reuse `attachParts.ts`; six distinct ammo boxes (9 mm small and 50-box, 7.62 stripper clips, 12 ga with shells, .308 long olive, .357 small black); nails, scrap, circuit board, powder tin, pipe, plank stack; clothing by cut (jacket, hoodie, shirt, puffer, pants, soft/hi-viz/armour vest, chest rig, boots/sneakers/tall boots, gloves, cap, beanie, bucket, cowboy, hard hat, moto helmet, gas mask, glasses/shades/goggles, surgical mask, bandana, balaclava) and 11 backpacks by build (small, kids, school, hydration, hiking, large hiking with bedroll and frame, military, ALICE, assault, lab), all tinted by iconSwatch; canned peaches/chili and tablets onto the can/bottle. 101 -> 0 of 208 items on a kind generic; test also checks every shape builds at a sane size. Shapes sit 1.2 cm up (thin parts sank into the drawn ground). Render check `NEAR=1 tools/audit/pickupshots.mjs` (new zoomed mode) and the normal rows: all 82 load, read at a glance, no console errors.

## F. QA
- [x] F1 `npm test` and `tsc` green after each pass (laptop via lap.mjs). 2026-11-21 after Z3: tsc clean, vitest 181/181 (laptop offline, run here).
- [x] F2 Headless play check: boot, walk, shoot, melee, loot, no console errors. 2026-11-21: `playtest.mjs` (loot the cabin crate, rifle wave of 14: 13 kills, no god mode, hp 100, 0 errors), `playthrough.mjs` (3 quests, save / reload / load round trip, horde, pause card, settings: ALL OK, 0 console errors; a first run died when another session's edit made Vite reload the page mid-test), melee in `zfx.mjs knife`, walking in `outskirtswalk.mjs`.
- [x] F3 Credits for every new third-party file. 2026-11-21 `tools/audit/creditscheck.mjs`: every committed third-party / AI file is credited; the 22 files it misses are all untracked Polyfork models another session is adding (lake dock, kayak, rowing skiff, camper van, log cabin, wash house, campfire ring, ...); their commit needs CREDITS.md + asset-credits.md rows (rerun the check before committing).

## Log
- Round 3+4 (agents): M4 guns (pump shotgun, hunting rifle, .357 revolver, SMG; second range rack; per-gun left-hand IK); throwables (frag, molotov, bottle lure, flare; N aim/throw, M cycle); attachments (red dot, 4x scope, suppressor, extended mags); crafting (26 recipes, G), campfires, warmth stat, shelter, vehicle fuel + jerrycans + pumps, flashlight batteries; quests v1 (10-quest chain, tracker, journal J, notes); NPCs (trader Odell, Eli, Hollis, Wren; dialogue, trade); zombie archetypes (runner, crawler, brute, screamer), day/night pacing, horde night every 3rd day; outskirts (9 POIs, signs, doors, filler, streamed zombies) and the town of Dunmore (pharmacy, hardware, police with armory, grocery, motel, church).
- Lead: walking stutter on terrain fixed (heightfield internal edges + floor-only retry), pointer-lock dev switch (content/data/input.ts), scope look sensitivity, zombified Polyfork set default.
- 07:xx API errors killed all three agents mid-task; resumed with their uncommitted work. Dev server restarted (port 5188 kept in watchdog-keep.txt).
- 05:20 Hero chosen: Polyfork "Student with Backpack" (closest to the poster survivor: backpack, dark trousers), 4.5k tris. `tools/audit/retarget_pf_hero.py` retargets our 42 survivor clips (arm directions from child joints, 180 deg turn baked into the rest pose). Mixamo bone aliases fixed body post (aim offset, foot IK, lean) and the upper-body layer, which silently did nothing on Mixamo rigs before (also true for the old `?hero=1`).
- 05:50 Hero outfit: 44 Polyfork parts (`chr_hero_pf_parts.glb`) shown by worn items (`src/content/data/heroParts.ts`, `src/gameplay/outfit/pfOutfit.ts`). FP arm colours follow coat and gloves.
- Agents: audio/FP (own shots 2D, priority voices, CC0 Free Firearm Sound Library shots + tails, reloads, knife sounds; FP arms double-sided; knife wrist re-posed), items (~113 new items, icons, themed loot), world (in progress).
- 05:10 Movement stop-start fixed and committed (6e48af9).
- Attachments: extended magazines for the pump shotgun (8-shell tube) and hunting rifle (10-round box), with loot and icons; none for the .357 (a cylinder holds six). New `tools/audit/attachcheck.mjs` mounts every gun's attachments and mags through the real inventory menu and drag, checks ADS zoom, suppressor noise, capacity, FP/TP parts and save/reload: all pass. Fixed: shotgun and hunting rifle sight sockets (and the rifle muzzle) floated 4-7 cm above the gun, so optics and the suppressor hung in the air.
- Roadside set dressing (D3/D4). Everything merges into the existing 60 m fill chunks (one draw each, distance culled), so draws rose 0 to 6 per view. Renderer draws from `tools/audit/drawbreak.mjs` (new views rb_main, rb_mill, rb_farm, rb_crash, verge_farm, verge_diner):

  | view | before | after | | view | before | after |
  |---|---|---|---|---|---|---|
  | spawn | 272 | 272 | | mill_road | 322 | 325 |
  | gate | 258 | 264 | | main_street | 200 | 201 |
  | fuel | 274 | 277 | | outpost_road | 306 | 307 |
  | maple | 223 | 228 | | memorial | 185 | 190 |
  | farm | 187 | 191 | | bus | 156 | 160 |
  | camp | 162 | 165 | | rb_main | 171 | 175 |
  | crash | 140 | 142 | | rb_mill | 342 | 345 |
  | diner | 188 | 190 | | rb_farm | 190 | 195 |
  | road_south | 209 | 213 | | rb_crash | 172 | 174 |
  | verge_farm | 211 | 213 | | verge_diner | 199 | 204 |

  Walk (`tools/audit/outskirtswalk.mjs all`): every route reaches its goal, roadblock gaps passable, both new cooler prompts show, no console errors; p95 16.9 ms and 0.8 to 1.6 M tris at the five zombie stops. The camp-track route now steps round the camp's own cooler (it sat on the straight line). Open, not from this pass: 985 stall ticks just inside the grocery door (-88, 140.6).
- Grocery door stall (985 ticks at -88, 140.6): not reproducible in 4 runs (town and all). The spot is the face of the closed door leaf, so in that run the door never opened: the walk pressed E without aiming, and the E target is picked by aim (a car trunk sits 2.4 m from the grocery door). The walk now aims through each door, retries E until "Close door" and prints DOOR DID NOT OPEN otherwise; hardware store added. Town leg 1 stall tick, outpost 0. New `tools/audit/buildingdoors.mjs [ids]` walks in and out of every full-height opening of every enterable building (ROUNDS=n): all front doors pass; blocked: grocery back door (vending machine), hardware shopfront opening (new pallet), fuel shop shopfront (box), pharmacy back door once. Those sit in data files the POI collision session is editing, so they were handed to it. The church is a solid landmark, not enterable.

- Gun polish (C5), `tools/audit/gunpolish.mjs` (headless, one gun at a time, survives Vite reloads; screenshots `docs/audit/screenshots/wip/gp_ads_<gun>_<optic>.png`, `gp_reload_<gun>_<fp|tpr|tpl>.png`):
  - ADS: every long gun's ADS clip held the barrel 1.27 deg nose-down, and the red dot sat 4 mm above the eye line (`rise` 0.02, lens at 0.024). New first-person ADS lock (`Weapons.adsLock`): after the arm clips pose the rig, the pivot turns the barrel onto the view axis and moves the sight point (iron SOCKET_sight, or the optic's aim point `rise` above it) onto the eye line, blended by the ADS weight, faded out under reload clips. Bolt rifle irons sit 12 mm over the receiver line (its bolt shroud blocked the centre), shotgun 3 mm so the bead clears (`fpArms.ironLift`). All 15 gun x optic cases: 0.0 mm off the eye line, 0 deg barrel error (was up to 7.7 mm and 1.27 deg).
  - FP reloads: the clips insert at the AK / pistol mag well, which sits inside the shotgun receiver and misses the SMG well by 4 cm. The left hand now follows each gun's own load point while it is at the well (`fpArms.reloadRef/reloadPoint`, its SOCKET_mag or the shotgun loading port, bolt magazine well, revolver cylinder). The shotgun, bolt rifle and revolver had nothing in the hand: they now carry their magazine item model (shell carrier, stripper clip, speedloader; `fpArms.heldMag`). The charging-handle reach left the sleeve's cut end (the arms mesh stops at the elbow) in view; a reload dip pitches the rig down just enough to keep the elbow below the frame (0 to 2 frames of ~100 to 200 in view). TP reloads checked from both sides: no hand through a gun.
  - Recoil: the FP kick was the same 3 cm / 0.04 rad for every gun (weaponFeel.kickBack only reached the old no-arms viewmodel); now per gun (shotgun 6 cm, bolt 7 cm, pitch scaled and capped at 0.09 rad), with slower returns for the heavy guns (`kickReturnS` 0.15 / 0.17 / 0.11 s, principles' 80 ms elsewhere); TP kick per gun too. Semi-only guns always rolled their minimum `recoilPitch` (the shot index resets between their shots); they now roll the whole range (test in feel.test.ts).
  - Audio: AudioBufferSourceNode.start hooked and every buffer mapped back to its file. Every gun's shot, tail and cycle play from real files, no synth fallbacks. Reloads drew from mixed pools (the AK could play the pistol mag-in); each gun now has its own out / in / chamber sounds (`weaponFeel.reloadSounds`; shotgun chambers with the pump, bolt with the bolt cycle). Existing files only, no new credits. `attachcheck.mjs` still all ok.
  - Open: the FP left forearm covers about a quarter of the view on the rifle and bolt-rifle ADS clips; the reload clips are shared per class (the pump shotgun and revolver still play the magazine choreography, now at their own load points).
- Zombie AI feel (2026-11-21), `tools/audit/zai.mjs` (headless, fixed 60 Hz; strips `docs/audit/screenshots/wip/zai_before_*` / `zai_after_*`): whisker steering round walls and props (6 m wall: stuck 6.2 s, never reached -> reached in 10 s, 0 s stuck; two crates: both stuck -> both through); doors: zombies head for the doorway and bash a shut door open (4 blows, `doorBash`), then come in; engaged zombies spread round the player (arc covered at 10 s 88 -> 198 deg, at 14 s 188 -> 276 deg); gunshots: staggered head-turn, then a run to the sound when close; flashlight at night is seen from 2.2x further and the beam on a zombie alerts it (crouched player, lamp on: both test zombies detected in < 2 s, lamp off: none); brute bull charge (roar telegraph 0.95 s, locked line, wall = 2.2 s stun, `charge` on the brute row); screamer/brute roar lean; swings spaced by landing time (0.67 s apart instead of 3 inside 0.9 s), recover jitter, off-view swings wind up 1.4x longer, the facing locks for the last 40 % of a windup so a late sidestep dodges. Numbers in `src/content/data/zombies.ts` (`steer`, `doorBash`, `senses`, `horde`).

## Nature pass on the outskirts plateau (2026-11-21)

- **Tree variety:** plateau trees now pick a species by zone (content/data/nature.ts TREE_MIX): the edge belt is mostly pines with Polyfork pine stands, the clumps broadleaf (oak, birch, street tree, orchard apple, some pines). New PF keys tree_apple, tree_pine_stand, tree_street (yard/pfModels.ts); spots carry `sp` and aiTrees.ts honours it. The three plateau-only species use one instanced cell each (one draw wherever you look). Pine stands get a wider trunk collider. Hill trees outside the plateau are unchanged.
- **Rocks, logs, undergrowth:** world/outskirts/nature.ts places 44 rock/log cluster centres in the belt and clumps, then field rocks, medium rocks, large boulders, rock outcrops, fallen and hollow logs, stumps and ferns, clear of roads, POI clear zones, footprints and trunks. Boulders, outcrops and logs always get a box collider; rocks and stumps only when wider than 1.1 / 0.7 m. Everything merges into one mesh per 160 m square named outskirts_nature_* (at most 4 draws, distance-culled, no shadow pass): one instanced mesh per model across the plateau sat in every frustum, even indoors, and cost +10 to +17 draws per view.
- **Grass:** meadow patches (MEADOW noise) stretch the plateau tufts up to 1.9x (no extra draws); bushes 140 -> 190.
- **Pond** at (30, 190), open ground east of the main road: the terrain dips 0.85 m in a 9.5 m bowl (yard/ground.ts pondDip, render mesh and heightfield alike), a water disc at -0.1 m (culled past 140 m, cull.ts `pond_`), cattail reeds round the west/south banks (north-east left open to walk down), lily pads, shore rocks. No colliders: walk round it or wade in.
- New Polyfork models (CC BY 4.0, CREDITS.md + asset-credits.md): Cattail Reed, Fern Plant, Lily Pad Cluster, Medium Rock.
- New drawbreak views nat_pond, nat_pond_low, nat_forest_w (nat_belt_w / nat_belt_nw kept for the before/after, they look at the school side).
- Gotcha: cull.ts measures the geometry's own bounding sphere, so a mesh placed with `mesh.position` gets culled by its local origin. Bake the position into the geometry.

Draw calls (renderer draws, `drawbreak.mjs`, all views; before = before this pass, other sessions were also editing outskirts data and weapons in between, so +-2 is noise). Over 350 before already: diner_spot, houseA_front, door_in, rb_mill. Nature adds +0 to +6 on most views, +9 at outpost_road, +12 at nat_pond.

  | view | before | after | | view | before | after |
  |---|---|---|---|---|---|---|
  | diner_spot | 384 | 390 | | houseA_front | 359 | 362 |
  | door_in | 355 | 360 | | rb_mill | 351 | 353 |
  | diner_office | 344 | 350 | | houseA_in | 342 | 343 |
  | mill_road | 328 | 331 | | outpost_road | 310 | 319 |
  | pharmacy_in | 303 | 306 | | shed_in | 301 | 304 |
  | shelf_front | 293 | 298 | | odell | 289 | 296 |
  | gatehouse | 289 | 289 | | police_in | 284 | 284 |
  | fuel | 277 | 283 | | armory_in | 280 | 280 |
  | spawn | 272 | 279 | | checkpoint | 270 | 274 |
  | yard_camp | 270 | 273 | | sign_checkpoint | 269 | 271 |
  | gate | 264 | 271 | | pumps | 268 | 270 |
  | shop_front | 250 | 256 | | shop_in | 246 | 250 |
  | air_town | 243 | 249 | | workshop_in | 238 | 242 |
  | sign_maple | 238 | 241 | | maple | 228 | 234 |
  | yard_junk | 225 | 230 | | verge_farm | 227 | 229 |
  | barracks_in | 224 | 224 | | garage | 217 | 223 |
  | road_south | 219 | 222 | | nat_pond | 198 | 210 |
  | grocery_in | 205 | 208 | | verge_diner | 204 | 206 |
  | main_street | 204 | 206 | | nat_pond_low | - | 204 |
  | motel_in | 198 | 204 | | shelf_back | 196 | 199 |
  | houseB_front | 189 | 196 | | rb_farm | 195 | 193 |
  | memorial | 191 | 193 | | dept_store | 190 | 193 |
  | diner | 190 | 190 | | farm | 191 | 189 |
  | rb_main | 186 | 188 | | outpost_armory_in | 184 | 184 |
  | houseB_in | 182 | 184 | | outpost_air | 180 | 183 |
  | rb_crash | 174 | 177 | | farmhouse_in | 176 | 176 |
  | camp | 165 | 167 | | bus | 163 | 165 |
  | stand | 153 | 156 | | church | 152 | 154 |
  | school | 150 | 152 | | outpost_gate | 146 | 146 |
  | crash | 142 | 144 | | nat_belt_w | 133 | 142 |
  | ranger_spot | 137 | 138 | | motor_pool | 130 | 133 |
  | school_spot | 129 | 131 | | nat_forest_w | - | 126 |
  | wren | 119 | 120 | | ranger | 120 | 120 |
  | nat_belt_nw | 107 | 112 | |  |  |  |

Walk (`outskirtswalk.mjs all`): first run had two STUCK legs (main road east from the school, crash road back) with no collider of this pass within 14 m of either spot; a rerun of `walk` had every leg ok, 0 errors. tsc clean, vitest 177/177.
- Correction to the grocery line above: the stalls `buildingdoors.mjs` blamed on the hardware pallet and a later grocery front-door stall were zombies (collision group 8) standing in the doorway, which also fits the original 985. The walk legs and `buildingdoors.mjs` now run with no zombies (the POI spawner is switched off and zones emptied; the zombie leg turns it back on). Full walk: every leg ok, 0 to 2 stall ticks each. buildingdoors after db338a0: all ok except the shop_gas back door (counter, intended), the workshop garage opening (parked hatchback, intended), and the police back door, which opens 0.65 m from the department store's back wall.
- Interior night lighting (`node tools/audit/interiorlight.mjs <tag>`: every `*_in` view at 13:00, 23:00 flashlight off, 23:00 flashlight on, mean luma / near-black / blown per shot, contact sheet `wip/il_<tag>_sheet.png`; before/after sheets `il_before_sheet.png`, `il_after_sheet.png`). No room was pitch black with the light off (night means 46-116 of 255; shed darkest at 46, still readable), so GAIN and the model lifts stay as they are. The flashlight was the problem: its spot started 2.8 m ahead of the camera and kept full intensity, so a wall 3-6 m away in every room became a white disc (6-15% of the frame blown), and with a wall closer than 2.8 m (first person, police armory) the light sat behind the wall and lit nothing. Now five rays per frame (axis + four inside the cone; static, buildings, terrain, cars, zombies) keep the light in front of the first surface and cap intensity at 16 * s^1.5 by the nearest hit (about what a wall 10 m out got before), eased; the visible haze cone keeps its old start. Flash shots now 0-4% blown, warm readable pool. Views: `hardware_in`, `motel_in2` (a room under the roof break), `armory_in` moved into the armory looking along it (it faced a cabinet 1 m away); `poiperf.mjs` takes `TOD=23` and `FLASH=1`. `buildingdoors.mjs` 36/36 ok, tsc clean, vitest 182/182. Seen, not mine: `lake_cabin_in` walls near-black at night (22%) under a bright ceiling.

### QA sweep after the PC crash (2026-11-21)

| Check | Result | Console errors / warnings | Fixes |
|---|---|---|---|
| `tsc --noEmit` | pass | - | - |
| `vitest run` | pass (181/181) | - | gear.test pickup size cap 1.2 -> 2 m (the spear pickup is 1.5 m long by design) |
| playthrough.mjs | pass (ALL OK) | none | - |
| outskirtswalk.mjs all | pass | 12x `AttributeNode: Vertex attribute "uv" not found` (warning), WebGPU powerPreference note | - |
| buildingdoors.mjs | pass, 33 openings (first run: boot hung) | first run: `Vertex buffer count (9) exceeds the maximum (8)` on the pfz_farmer crowd pipeline, boot stuck at "Compiling shaders 94%" | crowd bug reported to the zombie combat session, fixed in 297a76c. Audit: gas shop back door and workshop garage opening reached 1.6 / 1.1 m inside, then the counter / parked hatchback; now pass when the body is >= 0.9 m past the wall |
| doorwalk.mjs (yard) | pass | none | was out of date: yard doors are hinged and start closed. Now opens the door first (search radius 5 m, the farm door is 4.0 m away) and exits 1 on failure |
| attachcheck.mjs | pass (ALL OK, 6 guns, save/load) | none (2 retries after dev-server reloads from other sessions' edits) | - |
| zaudit.mjs | pass, 16 types, shots look right | none | the live `dy=-1.5` it prints is a probe artifact (the ground ray hits a collider at head height); zombies stand on the ground in the shots |
| pickupshots.mjs | pass | none | - |
| stalldiag.mjs | pass (2 brief stall ticks near spawn) | none | - |
| bootcheck.mjs | pass | same uv warning + powerPreference note only | - |
| F3 credits | pass: `tools/audit/creditscheck.mjs`, 474 files, 0 misses | - | asset-credits.md had no rows for Polyfork files or Polyfork-based models; rows added (e435031) |

Open: the uv warning (a TSL material reads `uv()` on a mesh without UVs; harmless); zaudit ground probe; B2 turn-in-place and camera lag; C5 FP left forearm in rifle ADS (other sessions own these).
- Outdoor look pass, day/night and weather (`node tools/audit/interiorlight.mjs <tag> --outdoor`: yard, Dunmore, Camp Harlan, Loon Lake at dawn 06:12 / noon / dusk 19:12 / midnight in clear, rain and fog, sheet `wip/ol_<tag>_sheet.png`, plus a mean-luma curve every half hour per place; sheets `ol_before_sheet.png`, `ol_after_sheet.png`, interiors `il_ol_check2_sheet.png`). Found: midnight was brighter than dusk (yard 90 vs 86, towns 63-70) and read as an overcast day; a hard step at 05:30-06:00 (up to +54 luma per half hour) and 19:00-19:30; the weather system grabbed `scene.fog` at install, before the yard replaced it, so rain never pulled the fog in; no fog weather existed. Now: night is blue moonlight at ~40 % of the old light (midnight towns 42-44, yard 73 under the lamps, 14-21 % near-black, ground and silhouettes readable without the flashlight) and the grade desaturates 30 % at night; extra dawn (05:48) and dusk (19:09) keys, sun intensity still ~0 at the 05:30 / 19:30 moon-sun flip, max half-hour step 25-37; fog range read live each frame; new `weather.fog` (morning mist on ~1 day in 4, 04:00 to 08:30-10:00, debug Weather > Fog on/off) pulls the fog to ~120 m, greys it and hazes the sky dome (stars/clouds fade into it, no banding seen); rain streaks 40 % wider and stronger by day, dimmed with the light at night. Indoors at night the hemisphere fill eases back up x2.3 while the shelter check says under a roof, so rooms keep the night level tuned in the interior pass (houseA 80, police 89, motel 111; doorway views outside the footprint stay dark). tsc clean, vitest 182/182.

### Draw budget and walk determinism (2026-11-21)

- **Draws:** the views over 350 were paying for the yard from 150-300 m away. New `engine/farcull.ts` hides small unique objects beyond a distance from the camera (checked 4x a second; numbers in `content/data/yard.ts` FAR_CULL): yard station props from `Kit.one`/`Kit.model` (cabinets, crates, range targets and racks, the survivor body) and the yard wall decals beyond 120 m (the 80 m range targets stay in from the firing line), parked vehicles beyond 140 m (the Polyfork pickup is 7 meshes, 14 draws with shadows). NPC draw distance 140 -> 80 m (`data/npc.ts`; each NPC is 7-10 skinned meshes). Hinged doors (`yard/doors.ts`, all 21 in the world) are one vertex-coloured mesh instead of leaf + iron straps: 1 draw per door instead of 2.
- Renderer draws, `drawbreak.mjs`, all 75 views (before = the table above, or today's measure for the five that were over): every view now <= 283 (armory_in); the five over-budget views 390/360/353/343/345 -> 262/266/264/254/234.

  | view | before | after | | view | before | after |
  |---|---|---|---|---|---|---|
  | diner_spot | 390 | 262 | | houseA_front | 360 | 266 |
  | door_in | 353 | 264 | | diner_office | 345 | 234 |
  | lake_pitches | 345 | 245 | | houseA_in | 343 | 252 |
  | rb_mill | 343 | 254 | | mill_road | 331 | 265 |
  | lake_office_in | 330 | 239 | | outpost_road | 319 | 235 |
  | pharmacy_in | 306 | 242 | | shed_in | 304 | 229 |
  | shelf_front | 298 | 221 | | odell | 296 | 248 |
  | gatehouse | 289 | 245 | | police_in | 284 | 209 |
  | fuel | 283 | 233 | | armory_in | 280 | 283 |
  | spawn | 279 | 246 | | checkpoint | 274 | 237 |
  | yard_camp | 273 | 244 | | gate | 271 | 235 |
  | sign_checkpoint | 271 | 234 | | pumps | 270 | 239 |
  | shop_front | 256 | 227 | | shop_in | 250 | 220 |
  | air_town | 249 | 213 | | workshop_in | 242 | 214 |
  | sign_maple | 241 | 212 | | hardware_in | - | 239 |
  | maple | 234 | 206 | | yard_junk | 230 | 207 |
  | verge_farm | 229 | 192 | | barracks_in | 224 | 169 |
  | garage | 223 | 214 | | road_south | 222 | 198 |
  | nat_pond | 210 | 178 | | grocery_in | 208 | 184 |
  | main_street | 206 | 195 | | verge_diner | 206 | 135 |
  | motel_in | 204 | 184 | | nat_pond_low | 204 | 171 |
  | shelf_back | 199 | 160 | | houseB_front | 196 | 153 |
  | memorial | 193 | 171 | | dept_store | 193 | 151 |
  | rb_farm | 193 | 158 | | diner | 190 | 137 |
  | farm | 189 | 134 | | rb_main | 188 | 132 |
  | houseB_in | 184 | 142 | | outpost_armory_in | 184 | 142 |
  | outpost_air | 183 | 161 | | rb_crash | 177 | 151 |
  | farmhouse_in | 176 | 138 | | motel_in2 | - | 172 |
  | camp | 167 | 99 | | bus | 165 | 125 |
  | stand | 156 | 136 | | church | 154 | 115 |
  | school | 152 | 133 | | outpost_gate | 146 | 120 |
  | crash | 144 | 123 | | nat_belt_w | 142 | 129 |
  | ranger_spot | 138 | 122 | | lake_road | 134 | 135 |
  | motor_pool | 133 | 111 | | school_spot | 131 | 130 |
  | lake_gate | 129 | 131 | | nat_forest_w | 126 | 115 |
  | ranger | 120 | 116 | | wren | 120 | 97 |
  | lake_shore | 114 | 102 | | nat_belt_nw | 112 | 101 |
  | lake_cabin_in | 109 | 94 | |  |  |  |

- **Walk determinism (`outskirtswalk.mjs`):** the walk legs already stopped the POI streamer, but a spawn already loading when it was stopped (`poiBusy`, an async model load) could still land after the clear. A horde night's step was never stopped either, and after a dev-server reload the zombies came back. Now both spawn paths are stopped, any spawn in flight is awaited before the clear, and the clear runs again after a reload and before every leg. A STUCK leg prints a diagnosis: what the player is pressed against (collision group, body type, position), zombies within 8 m, p95.
- Real block found by the stall log: the camp trailhead sign (`outskirts.ts`) stood inside the 4.5 m camp track, 1 m off its centreline (the repeat group-1 stall at (12, 258.5)). Moved it to the south verge (12, 256.8): camp legs now have 0 stall ticks.
- Results: `outskirtswalk.mjs all` 3 runs in a row, every leg ok (22/22), 0 STUCK, 0 door failures, 0 errors. After the sign move `walk` passes with 0 stall ticks on every road leg. `buildingdoors.mjs` 36 doors, 0 bad. `doorwalk.mjs` ALL OK. tsc clean, vitest 182/182.

## UI polish: inventory, crafting, map (2026-11-21)

- **Audit:** `tools/audit/uishots.mjs [before|after] [port]`. One headless browser, own dev server (`npx vite --port 5195`), realistic loadout (worn military rucksack and jacket, guns with mags, mixed stacks, worn weapons at 42 %, tracked Maple quest, 8 found places). It shoots inventory, tooltip, equipped tooltip, drag, crafting, a missing recipe, keyboard nav and the map at 1280x720 and 1920x1080, checks text overflow and fit, and writes contact sheets `docs/audit/screenshots/wip/ui_{before,after}_sheet_{1280,1920}.png`.
- **Map screen (new, K):** there was no map. `src/ui/map/` draws the Yard, roads and tracks, buildings, fields and water from the world data. It shows found places as tier-coloured dots with labels placed so they never overlap, the tracked quest's diamond, and the player arrow turning with your facing. Side panel: the tracked quest and its distance, a card for the selected place (risk, distance, hook), "n of 16 found" with distances, and a legend. Arrow keys walk the list. Places mark themselves when you come within their radius + 35 m (toast once). Saved as the `map` slice. Added to the controls list (`fixedKeys.map`, keys.test).
- **Crafting:** the disabled Craft button now says why underneath ("Missing: Cooking Pot · Lit campfire nearby"); before, that was only in a hover title. Category tabs fit one row and show how many recipes are ready. Recipes with no rendered icon show a swatch with the item's initial instead of an empty hole. The "Needs" header no longer crowds the big icon. The equipped-gear warning is styled. Keyboard: ↑/↓ recipe, Q/E or ←/→ category, Enter crafts. Kbd hint bar like the inventory. Larger at 1080p.
- **Inventory:** fixed a real bug. The rucksack's main grid was squeezed by flexbox under its items, so the side pockets overlapped the last column and wrapped out of the panel. Grids no longer shrink, and pockets stack while their cells fit the main grid's height. Worn gear shows a condition bar (green/amber/red) and a "Condition 42%" tooltip row. Cells grow to 72 px at 1080p (they were capped at 64, so the screen looked small). Tooltip text is bigger at 1080p, and the drag ghost lifts slightly.
- Not done: weight (the game has no weight stat; the grid is the limit), controller navigation (no gamepad input in the game yet).
- tsc clean, vitest 183/183 (laptop). Audit: 0 page errors, no clipped text, every screen fits at both sizes.

## Drive feel: handling, camera, audio, zombie hits (2026-11-21)

- **Audit:** `tools/audit/drivefeel.mjs [before|after]` (one headless 960x540 browser, own dev server on 5191, no pointer lock). Autopilot runs inside the sim step over 7 scenarios on a flat test pad it builds 300 m above the yard (plus real outskirts terrain for off-road), logging speed, yaw rate, slip, pitch/roll, body lean, chassis bounce, engine rate, skid volume and chase-camera offset/FOV/trauma. Numbers in `docs/audit/screenshots/wip/drive_metrics_{before,after}.json`, frame strips `drive_<scenario>_{before,after}.png`.
- **Found:** constant engine force (0-60 km/h in 2.8 s, no gear feel, engine pitch a straight ramp); no weight transfer at all (0.2 deg nose dive, 0.15 deg roll: the low centre of mass from QA-056 kills it); brakes 1.17 g; a 40 km/h wall hit did nothing (0 damage, no sound, no shake); landings silent; no skid sound; camera locked rigidly behind (1.3 m side swing in a 90 deg turn) and FOV set without smoothing; zombie hits barely slowed the car, corpses flew 0.4 m and flat, and zombies were driven straight through under 14 km/h.
- **Fixed (tunables in `data/vehicles.ts`):** 4-gear box with per-gear force, 0.16 s upshift torque cut and downshift hysteresis (gear hunting up hills); engine pitch follows rpm through each gear; front-biased brakes (62, 60 % front); faster steering return; tyre scrub; cosmetic body lean spring (pitch/roll per g on a pivot under the wheels' parent, wheels stay planted); crash detection from speed lost in 0.12 s (sound by severity, hp over 12 km/h, trauma, head lurch, body pitch); landing thump; skid loop from sideways slide, hard braking, handbrake and launch wheelspin; chase cam heading lag 0.22 s, speed pull-back, look-ahead, smoothed FOV with an acceleration kick; zombie hits: shove below 14 km/h, higher launch, 10 % speed loss, bumper thunk, trauma + FOV kick, and thrown corpses do one flip over their air time (`zombies.ts`).
- **Before -> after:** 0-60 2.77 -> 3.83 s; body squat 0 -> 2.2 deg, brake dive 0.2 -> 3.5 deg, turn roll 0.15 -> 5.4 deg; braking 1.17 -> 0.94 g (11.4 -> 14.4 m); camera side swing in the turn 1.3 -> 3.1 m; wall at 40 km/h: 0 -> 177 hp damage, trauma 0 -> 0.53, `car_crash`; ramp landing trauma 0 -> 0.32 + `car_land`; zombie at 40 km/h: car dips to 36 km/h, corpse 0.4 -> 0.85 m high, 6 -> 9 m thrown, flips; skid peaks 0.27 (turn) / 0.32 (brake).
- **Audio:** `car/tyre_skid_loop.ogg` is own procedural work (`tools/audio/gen_car_skid.sh`, ffmpeg FM squeal + noise); crash/landing reuse Kenney CC0 impacts. Credited.
- Not done: skid marks on the ground, tyre smoke, gamepad rumble.
- tsc clean; vitest 21/22 files pass (laptop): the one failure is another session's untracked, in-progress `src/systems/saveCompat.test.ts` (quest assertion), not this work.

## Graphics quality presets for weaker machines (Low / Medium / High + Auto)

- **Presets:** `src/content/data/quality.ts` holds every number. Levers: render scale, shadows on/off, shadow map size (2048 / 1536 / 1024) and box (±40 / 30 / 22 m), zombie shadow distance, AO, sun shafts, bloom, view distance (fog + camera far plane x1 / 0.8 / 0.6; sky dome scales to fit), grass and bush density (instances shuffled, so thinning is even), grass fade distance, far-cull scale on `FAR_CULL` and `NPC_FEEL.drawDistance`, street-lamp point lights (4 / 2 / 1). Applied by `src/engine/quality.ts`.
- **Auto:** default for new players. Measures frame time while playing (skips 5 s after start and after each change, which hold shader compiles); after 30 s of samples, if p95 > 18 ms it steps down one preset, saves it, shows a toast, and measures again. Steps only down. Off under automation (`navigator.webdriver`) so audits keep fixed settings; `?autoquality` forces it on, `?noautoquality` off.
- **Settings:** new "Graphics quality" row (Auto / Low / Medium / High) above render scale, with a line saying what Auto picked. Picking a preset writes its render scale, shadows and effects into the toggles below (still adjustable one by one); picking Auto again re-measures from High. Existing players keep their saved toggles (`quality: 'auto'`, `autoQuality: 'high'`).
- **Measured** with `node tools/audit/gpuprofile.mjs <high|medium|low> [scale]` (new): one headless 960x540 page, a warm-up pass over the views, then 6 s of rAF frame times per view; `THROTTLE=1` for unthrottled; GPU ms from timestamp queries. `QUALITY=low node tools/audit/drawbreak.mjs <view>` now applies a preset too.

CPU throttled x4 (Chrome CDP), frame time p50 / p95 ms, draws, render-thread CPU ms (`render` timer). PC load from `resource-guard --status` at the time (no Unity build ran during these; other sessions' browser jobs did).

| view | High (before) p50 / p95 | draws | render CPU | Low (scale 0.7) p50 / p95 | draws | render CPU | load (high / low) |
|---|---|---|---|---|---|---|---|
| diner_spot | 50.0 / 83.3 | 259 | 49.4 | 50.0 / 233 (one hitch) | 199 | 28.4 | CPU 38-47 % / 84 % |
| main_street | 50.0 / 83.3 | 189 | - | 33.3 / 50.0 | 84 | 20.5 | CPU 51 % / 60 % |
| dept_store | 66.7 / 83.4 | 149 | 21.9 | 66.6 / 66.7 | 78 | 16.5 | CPU 42 % / 54 % |
| outpost_gate | 33.3 / 66.7 | 119 | - | 33.3 / 33.4 | 51 | 14.9 | CPU 54 % / 68 % |
| lake_shore | 16.7 / 33.5 | 94 | - | 33.3 / 33.4 | 48 | 15.4 | CPU 39 % / 82 % |

Medium (x4, PC at 98-100 % CPU from another job, so noisy): diner 50 / 83 (239 draws), main_street 33 / 67 (156), dept_store 50 / 100 (138), outpost_gate 67 / 83 (110), lake_shore 17 / 50 (89).

Unthrottled (x1): every view holds 16.7 ms (vsync) on all presets. Render-thread CPU high -> low: diner 5.7 -> 3.7, main_street 4.1 -> 2.3, dept_store 4.6 -> 2.2, outpost_gate 4.3 -> 2.1, lake_shore 3.2 -> 1.6 ms. GPU ms (timestamps, rough: medium readings jumped about) high -> low: diner 3.18 -> 0.23, main_street 4.27 -> 0.14, dept_store 3.34 -> 0.95, outpost_gate 3.84 -> 0.85, lake_shore 1.69 -> 0.11.

- **What this shows:** Low halves draws and render-thread CPU and cuts post to ~0 (bloom's mip chain was ~8 ms of CPU at x4). It does **not** reach 60 fps at CPU x4: game simulation alone (sim + physics + AI + anim) is 10-30 ms there, and the PC was shared with other jobs. CPU throttling stands in for a slow CPU, not a slow GPU (it does not slow the GPU process), so render scale, AO and shafts show only in the GPU ms column. The remaining draws in town are map-wide instanced dress meshes (one draw each, cannot be far-culled per object).
- **Not done:** 60 fps at x4 needs simulation work (zombie AI / physics cost, outside this task); render scale 0.6 not measured separately (it only changes GPU cost, invisible under CPU throttling); stepping up again when there is headroom; a "very low" preset.

## Quests and saves QA (quest chain played end to end, save compatibility suite)

- **Quest chain audit:** `node tools/audit/questchain.mjs` (one headless browser, no mouse lock; `URL=` for the server). Plays all 10 quests in data order through game actions: teleport to the place, loot from the container the item is in (or pick it up off the ground), timed item use and note reading, crafting jobs, the E-key `onInteract` of pumps / campfire / car filler cap, the NPC dialogue (choices clicked), kills through the normal death path. Logs every step; flags missing text, items not reachable, objectives that never tick, rewards not granted. Ends with a quick save, page reload and load, comparing pack, quest states, notes, tracker, a moved car and its fuel, time of day and weather, plus a mid-quest save (Maple Street step 2). Result: **all quests playable, round trip OK**.
- **Bugs fixed:**
  - Farm quest dead end: the last step "eat the hot soup" was refused with "You're not hungry" when needs were full. Items an active quest asks you to use are now never blocked (`installSurvival.ts` use validator).
  - A note read before its "read" objective came up never counted (re-read needed; if dropped, stuck: notes are placed once). "read" objectives now also tick from notes already read (`quests.ts`).
  - Quest rewards that do not fit in the pack drop at your feet silently. The starting pack is nearly full, so the `listen` jerrycan (2x3) and others always landed on the ground. The reward toast now says "no room, left at your feet".
  - Saves: one section that throws no longer aborts the whole load half-way (it is skipped, the rest loads, toast "Part of this save could not be read"). A save made before a slice existed now resets that slice to a new game (`SaveSection.fresh`, used by quests and worldtools) instead of keeping the session's progress. Old loadout / survival data missing fields (`v`, `pickups`, `hotbar`, `statuses`) load with defaults.
- **Save compatibility suite:** `src/systems/saveCompat.test.ts`. Saves mid-quest with a full pack (overflow on the ground), worn kevlar and boots, a rifle with scope and suppressor, a moved and turned car, car fuel, day 3 14:45 (weather follows from the time), loads into a fresh session and compares. Fixtures in older formats: M2 (c621105: loadout v1, survival v1 with 'cold', clock v1, no quests), Round 3 (da7dce9: worldtools v1), format 1, an older quest chain (removed quest, out-of-range steps, broken order), a broken section, a newer-format save (refused).
- tsc clean, vitest 23 files / 194 tests pass (run on this PC: the laptop was unreachable over ssh).
- **For other owners:** the starting kit (10 planks, 20 nails, 3 lockpicks...) leaves no room for quest rewards; worth a look in `STARTING_KIT` or a bigger first backpack. The new `map` section and the gameplay `npc` / `horde` sections could use `fresh()` too, so loading an old save does not keep this session's map reveal, NPC flags or horde schedule.
