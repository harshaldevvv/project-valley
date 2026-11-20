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
- [ ] A10 Check hands and joints in first, second and third person on every clip (memory rule), screenshots in `docs/audit/screenshots/wip/`.

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

## D. World / demo map
- [ ] D1 Bigger demo area beyond the yard, same theme (Polyfork buildings, vehicles, props).
- [ ] D2 More points of interest: gas station, farm, police checkpoint, camp, houses with interiors.
- [ ] D3 Set dressing density pass, collision on every solid prop.
- [ ] D4 Performance check after each world pass (draw calls, tris, frame time).

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
