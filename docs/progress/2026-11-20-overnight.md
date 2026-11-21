# Overnight 2026-11-20: tracking list

Branch `overnight/2026-11-20` (from `overnight/visual-overhaul-2026-11-13`). Owner asked: character first (model, animations, gun and knife hold, first-person hands), then gun audio, smooth controls, then a bigger demo map with many more models, items and things to do. One visual theme: the low-poly Polyfork style the world already uses.

Status: `[ ]` open, `[~]` in progress, `[x]` done, `[-]` dropped (reason given).

## A. Character (top priority)
- [x] A1 Find the "3,000 model library": it is the Polyfork catalog (3,446 CC BY 4.0 GLBs, 204 rigged characters, Mixamo skeleton). Index cached at `D:/AI3D/polyfork/catalog.json`.
- [x] A2 Pick a low-poly hero close to the poster survivor (dark jacket, backpack, gloves) from Polyfork; contact sheet `D:/AI3D/polyfork/sheet.png`.
- [x] A3 Rig bridge: Polyfork skeleton renamed to our bone names + sockets (hand_R/L, head, back), our survivor clips retargeted onto it (`tools/audit/retarget_pf.py` approach).
- [x] A4 Hero in game as default player; old survivor kept behind a flag.
- [~] A5 Animations (stride scale 0.96 for the hero's legs: planted-foot slip at jog 0.6 -> 0.48 m/s, `tools/audit/footslide.mjs`; original survivor 0.23): compare our clips vs Polyfork native Idle/Walk/Run; pick the better per clip; fix foot sliding, arm swing, transitions.
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

## B. Controls and feel
- [x] B1 Stop-start while walking on flat ground (velocity was zeroed by any blocked tick; now wall-slide only). `tools/audit/walkdiag.mjs`: speed dips 29 -> 0.
- [~] B2 Smoothness: sprint verified steady 5.8 m/s with stamina drain (`tools/audit/sprintdiag.mjs`); turn-in-place and camera lag not yet tuned.
- [x] B3 Stall check (corrected: the first version of `tools/audit/stalldiag.mjs` never moved the player, so its 0 meant nothing). Real causes found later: heightfield cell edges stopped the player for one tick every few metres; fixed with FIX_INTERNAL_EDGES + a floor-only retry (route stall ticks ~200 -> 9 in `outskirtswalk.mjs`). The fixed `stalldiag.mjs` walks ~11 m per direction with real key presses: 1 stop, at a real wall.

## C. Weapons and audio
- [x] C1 Silent gunshots sometimes: own shots play as 2D (not HRTF at the muzzle), weapon sounds preloaded before play starts, layered shot (body + tail + mech).
- [x] C2 Better CC0 gun sounds (pistol, rifle, shotgun, reloads, dry fire, casings), logged in credits.
- [x] C3 Knife and melee whoosh/impact sounds.
- [~] C4 More guns from Polyfork (shotgun "scattergun", bolt-action rifle, pistol) wired with stats.

## Z. Zombies
- [x] Z1 Zombified Polyfork set `pfz` (12 civilians: corpse skin, faded clothes, blood, held props removed; `tools/audit/build_pfz.sh`) is the default; `?chars=orig` keeps the old ones.
- [x] Z2 Visual audit of every pfz type and the 4 archetypes (`tools/audit/zaudit.mjs <tag> [types]`: side-on ground-level film of walk-in, attack and death, plus a feet close-up; sheets `zc_<type>_sheet.png`). Plain pfz walkers: feet planted, no T-pose or pop, falls land flat. Fixed: the crawler (and any walker whose legs gave out) rose onto its knees for every attack, stagger and death, because those played the standing `z_attack` / `z_stagger` / `z_death`; now a fast `z_crawl_b` lunge, a slowed crawl, and a death that freezes the crawl prone along its heading (`crawlClips` in `content/data/zombies.ts`). `za_crawler_sheet.png` before, `zb_crawler_sheet.png` after.

## D. World / demo map
- [ ] D1 Bigger demo area beyond the yard, same theme (Polyfork buildings, vehicles, props).
- [ ] D2 More points of interest: gas station, farm, police checkpoint, camp, houses with interiors.
- [x] D3 Set dressing density pass, collision on every solid prop. Roadside round 2 (`src/content/data/outskirts_fill.ts`): 4 roadblocks with a centre gap (main road, Mill Road, farm road sandbags, crash road), 16 abandoned cars total (was 3; kept out of junction mouths, big vehicles never on the lane), power lines on the farm, diner, crash and Mill roads, guardrails, signs, mailboxes, bins and dumpsters, 26 dead trees and 8 stumps (trunk colliders), 8 lootable coolers (new `cooler` container, food table) and extra car trunks. Only models already in the repo, so no new credits.
- [x] D4 Performance check after each world pass (draw calls, tris, frame time). Roadside pass: table below; p95 16.9 ms at every walk stop.

## E. Items, loot, survival
- [ ] E1 More backpacks (sizes), vests, helmets, clothing as items with stats.
- [ ] E2 More consumables (food, drink, meds), tools, crafting materials.
- [ ] E3 Loot tables per POI theme; containers placed in the new areas.
- [ ] E4 Pick-up models for every new item (Polyfork props where they exist).

## F. QA
- [ ] F1 `npm test` and `tsc` green after each pass (laptop via lap.mjs).
- [ ] F2 Headless play check: boot, walk, shoot, melee, loot, no console errors.
- [ ] F3 Credits for every new third-party file.

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
