# Overnight 2026-11-20: tracking list

Branch `overnight/2026-11-20` (from `overnight/visual-overhaul-2026-11-13`). Owner asked: character first (model, animations, gun and knife hold, first-person hands), then gun audio, smooth controls, then a bigger demo map with many more models, items and things to do. One visual theme: the low-poly Polyfork style the world already uses.

Status: `[ ]` open, `[~]` in progress, `[x]` done, `[-]` dropped (reason given).

## A. Character (top priority)
- [x] A1 Find the "3,000 model library": it is the Polyfork catalog (3,446 CC BY 4.0 GLBs, 204 rigged characters, Mixamo skeleton). Index cached at `D:/AI3D/polyfork/catalog.json`.
- [~] A2 Pick a low-poly hero close to the poster survivor (dark jacket, backpack, gloves) from Polyfork; contact sheet `D:/AI3D/polyfork/sheet.png`.
- [ ] A3 Rig bridge: Polyfork skeleton renamed to our bone names + sockets (hand_R/L, head, back), our survivor clips retargeted onto it (`tools/audit/retarget_pf.py` approach).
- [ ] A4 Hero in game as default player; old survivor kept behind a flag.
- [ ] A5 Animations: compare our clips vs Polyfork native Idle/Walk/Run; pick the better per clip; fix foot sliding, arm swing, transitions.
- [ ] A6 Rifle and pistol hold (third person): both hands on the gun, no wrist bends, aim offset works.
- [ ] A7 Knife hold: blade forward from a natural wrist angle (TP and FP).
- [ ] A8 First person: no seeing inside the hand/arm (near plane, arm placement, back faces), sleeves match the hero.
- [ ] A9 Backpack, helmets and gear on the new hero (Polyfork backpacks/helmets attach to sockets).
- [ ] A10 Check hands and joints in first, second and third person on every clip (memory rule), screenshots in `docs/audit/screenshots/wip/`.

## B. Controls and feel
- [x] B1 Stop-start while walking on flat ground (velocity was zeroed by any blocked tick; now wall-slide only). `tools/audit/walkdiag.mjs`: speed dips 29 -> 0.
- [ ] B2 Sprint/stop/turn smoothness pass (accel curves, turn-in-place, camera lag).
- [ ] B3 Wall-slide along long walls loses speed at corners: check.

## C. Weapons and audio
- [ ] C1 Silent gunshots sometimes: own shots play as 2D (not HRTF at the muzzle), weapon sounds preloaded before play starts, layered shot (body + tail + mech).
- [ ] C2 Better CC0 gun sounds (pistol, rifle, shotgun, reloads, dry fire, casings), logged in credits.
- [ ] C3 Knife and melee whoosh/impact sounds.
- [ ] C4 More guns from Polyfork (shotgun "scattergun", bolt-action rifle, pistol) wired with stats.

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
- 05:10 Movement stop-start fixed and committed (6e48af9).
