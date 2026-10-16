# M1 "the Yard": QA report 3 (re-test after fix round 3)

Date: 2026-10-16. Build: `main` @ 9298e93 (fix round 3: world 5b1a096, gameplay 3e11f8e, engine/menu a9745e0, FP arms 58e52be, systems 3df0786, repair 74df271/9298e93). Dev server http://localhost:5188, headed Chrome through Playwright (`channel: 'chrome'`), 1280×720, WebGPU, 144 Hz panel. Only one Chrome window was open at a time.

Scripts are in `artifacts/qa3/`:
- `journey.mjs`, `track.mjs` and `menu.mjs`: these use real input.
- `qa3.mjs`, `repair.mjs`, `vm.mjs`, `icons.mjs`, `yard-r3.mjs`, `perf.mjs` and `drive-perf.mjs`: copies of the mech/systems/yard/qa2 scripts, redirected to `artifacts/qa3/`.
- `misc.mjs`.

Shots (210) are in `artifacts/qa3/shots/`. Raw results are in `artifacts/qa3/journey.json`, `track.json`, `perf-a.json` and `perf-b.json`.

**Real input** means pointer lock plus mouse-look through `page.mouse.move`, calibrated at 0.0022 rad/px, which matches `look.sensitivity`. It also means WASD/Shift/E/Tab/R/V/B/X/F/H/Esc keys, and LMB/RMB through `page.mouse.down/up`. F1 panel buttons and menu buttons were clicked as DOM elements.

Two kinds of help were used:
- For shooting, the script asks the game for the yaw/pitch that points at a target (`__gp.aimAt`, then the look is restored) and then turns there with the mouse.
- Debug-only steps are marked "(debug)" below.

**Heat:** FanKick ran throughout, with the CPU at 67–86 °C during runs. There were spikes to 99–100 °C at 07:02:51 and 07:15:02, both as a browser was closing. Perf pass (a) ran at 72–78 °C. One driving sample was taken at 82–94 °C and is reported separately as heat-affected.

## Summary and verdict

**Fix round 3 landed:**
- **17 of the 23 tracked ids are fixed:** QA-018, 023, 031, 036, 038, 039, 040, 042, 043, 044, 045, 046, 047, 048, 049, 050, 053.
- **4 are partly fixed:** QA-006/041 (rifle stock and ADS handguard), QA-034 (corpse poses), QA-052 (pen interior still dark from above), QA-054 (Esc-close still needs a click).
- **None is still broken.**
- **QA-051:** working as designed (the reload completes before you enter the car).

The repair kit works end to end, and so do zombies attacking an occupied car. The console showed 0 errors and 0 page errors across 12 sessions. Every perf case is inside every §13 budget on a cool machine.

The real-input playthrough found what scripted checks can't:
- **The zombie pen can't be used as a player.** The gate has no interaction. The chain-link fence stops every bullet (12 of 12 shots hit `metal`). Zombies spawned with F1 "Spawn 5" stay inside.
- **The pickup rolls onto its side** after the ramp at the NE bend with ordinary full-lock keyboard steering. It then lies there at 0 km/h with no hint that R flips it.
- **One renderer crash** ("Target crashed") happened 10 minutes into the first long session. It coincided with a 99 °C CPU spike and was not reproduced.

**Is M1 "done" per GAME_PLAN §M1? Not yet.** All seven stations exist and play, along with the in-world menu, F1 and the house. Four things are missing:
1. **Pen station not usable (P1).** The pen has to be fightable without debug spawns elsewhere.
2. **Loot station incomplete (P1).** It has no lockpick and no body to search; the plan's loot station lists "crates/cabinets/body to search, lockpick".
3. **Car rollover (P1).** The pickup must not roll over with ordinary keyboard steering.
4. **Animation stand has no TP/FP toggle on the stand (P2).** It has slow-mo (the speed slider), but no TP/FP toggle of its own; the global T works.

Fix the three P1s and M1 can be called done. Everything else is polish.

## Status table

| id | title | status | evidence |
|---|---|---|---|
| QA-006 / QA-041 | FP arms off-model | **partly fixed** | Fixed: pistol and knife hands now read as two hands with fingers, the knife guard hand has a forearm, and the near-wall sleeve is normal (`vm_pistol_idle.png`, `vm_knife_idle.png`, `sheet_vm_pistol_reload.png`). Still open: (d) at rifle hip the AK stock is a tan slab running to the bottom-right corner (`vm_rifle_idle.png`); (e) in ADS the black receiver wedge is gone, but the tan handguard and olive sleeve now cover the lower ~35 % of the screen around the sight (`vm_rifle_ads.png`, `qa041_ads.png`). |
| QA-018 | Help overlay | **fixed** | 13 px text, no overlap, smallest HUD text 11 px (`m_help.png`). |
| QA-023 | Inventory tiles | **fixed** | Blender icons in the grid, slots, hotbar, ground and tooltip; a rotated AK icon; min font 11 px (`icons-1-icons.png`, `icons-3-tooltip-rifle.png`, `j05_loot_opened.png`). |
| QA-031 | Canopies at head height | **fixed** | The canopy underside is well above a 1.7 m eye (`r3_tree_under.png`; one tree checked). |
| QA-034 | Corpse poses | **partly fixed** | No T-pose arms any more. Corpses now kneel hunched forward, or lie with the legs pointing straight up (`qa034_corpses.png`, `t_repairing.png`). |
| QA-036 | Car wedges on tyre stacks | **fixed** | The start straight is clear. `drive-perf` reaches 81 km/h; a full keyboard lap needed 0 reverses and spent 0 % off the asphalt (`track.json`). |
| QA-038 | Resume ignored within ~1 s | **fixed** | 3 of 3 Esc → Resume clicks at 300 ms gave `playing`. Also Settings → Resume. Within Chrome's cooldown, the "click to capture" hint asks for one click (`menu.mjs`, `m_resume_fast.png`). |
| QA-039 | Flip reset stands car on its tail | **fixed** | Reset beside the corner stack gives an upright car: up.y 1.00 at (31, 41) (`qa039_reset.png`). |
| QA-040 | Start straight runs into a stack | **fixed** | The NW run-off is clear (`r3_nw_bend.png`). Straight-line W gives 71–81 km/h with no stop (perf `driving`). |
| QA-042 | Car surface = wood | **fixed** | `lastShot.target = 'vehicle'`, car HP 1000 → 990, sparks (`sheet_qa042_car`). |
| QA-043 | Near targets block far ones | **fixed** | Real-input ADS: plate 25 m and dummy 25 m are hit at 25.5 m; both 80 m targets are hit in run 1 (`j09_range_plate25.png`, `journey.json`). |
| QA-044 | Hexagonal blood pools | **fixed** | Small, round, soft-edged pools (`qa044_pools_corpses.png`, `t_repairing.png`). |
| QA-045 | Square smoke cards | **fixed** | No smoke cards in a 6-frame ADS or hip burst (`sheet_qa045_adsfire.png`, `sheet_qa045_hipfire.png`). |
| QA-046 | Build mode survives death | **fixed** | `afterDeathBuild: build false, bar hidden` (`icons.mjs`). |
| QA-047 | Inventory open over death | **fixed** | `afterDeathInv: open false, blocked false`. |
| QA-048 | Native Gore `<select>` | **fixed** | Segmented FULL / REDUCED / OFF control, 0 `<select>`s (`m_settings.png`). |
| QA-049 | "Empty — press R" lingers | **fixed** | The toast clears as R starts the reload. |
| QA-050 | Zombies can't hurt a driver | **fixed** | Four zombies take the car 1000 → 490 in 16 s; the engine dies and you are dragged out (HP 70). In the real-input run: 100 → 64 % in 22 s with `CAR 64%` on the HUD (`t_car_damaged.png`). |
| QA-051 | Reload cancelled by entering car | **fixed** | Mag 29 after entering mid-reload. |
| QA-052 | Pen unlit at night | **partly fixed** | Lamps now sit at the corners and the fence line, and the pen reads at eye level (`j64_night_pen.png`). From above, the pen floor is still black (`r3_pen_top_night.png`). |
| QA-053 | Gable ghost floats 4 m up | **fixed** | The ghost sits on the pad, y 0.67 (`qa053_gable_ghost.png`). |
| QA-054 | F1 → Esc doesn't relock | **partly fixed** | Closing with F1 relocks (`f1closeF1.lock: true`). Closing with Esc still leaves the mouse free until a click (a Chrome rule). The capture hint covers it, but see QA-060. |
| — | Repair kit + hood repair | **works** | Without a kit: "Repair car: needs a repair kit". F1 → Items → "+ Repair kit" gives "Repair car (repair kit)" with a hold ring. After 4 s: 100 %, kit consumed (`t_hood_no_kit.png`, `t_repairing.png`, `t_repaired.png`). A kit also dropped from a loot crate (`j05_loot_opened.png`). |

Totals: **17 fixed**, plus QA-051 working as designed. **4 partly fixed:** QA-006/041, 034, 052, 054. **0 still broken.**

## New bugs

### P0
None.

### P1

**QA-055 · The zombie pen can't be engaged by a player (src/world/yard/stations/pen.ts; collider group: src/gameplay/weapons)**
- **Steps:**
  1. Walk to the pen gate (25, -16.5).
  2. F1 → Zombies → Spawn 5.
  3. Wait, then shoot at them.
- **Actual:**
  - The gate shows no prompt.
  - After 6 s all 5 zombies are still inside (`outside: 0`).
  - 12 of 12 rifle shots through the chain-link hit `metal`, so no zombie took damage (`j15_pen_gate.png`, `j17_pen_after6s.png`, `j18_pen_shoot_fence.png`).
  - The only way to fight was to spawn zombies outside the pen with a script (debug).
- **Expected:** at least one of:
  - an openable gate (E);
  - bullets passing through the chain-link (give the fence a collider group that the bullet ray ignores);
  - F1 "Spawn" placing zombies outside the gate.

**QA-056 · Pickup rolls onto its side after the ramp with keyboard steering, and the HUD gives no way out (src/content/data/vehicles.ts, src/gameplay/vehicles; HUD hint in src/ui/hud)**
- **Steps:** drive a lap clockwise, take the ramp on the north straight at about 45 km/h, then hold A or D through the NE bend. Keyboard steering is all or nothing.
- **Actual:** the car rolls over at 21 km/h at about (78, 30) and lies on its side at 0 km/h with W held (`j30_lap_8.png`, `j31_lap_9.png`; run 1 of `journey.mjs`).
  - There is no "R: flip" hint; R works, but nothing says so.
  - Zombies around the car on its side don't damage it, and the HUD stays at `CAR 100%` (`j49_car_attacked.png`, run 1).
  - With pulsed (proportional) steering it did not roll over (`track.mjs`, minUp 0.98).
- **Expected:**
  - The pickup doesn't roll at under about 50 km/h on flat asphalt: lower the centre of mass or add anti-roll.
  - When the car is upside down, show "Hold R to flip".

**QA-057 · Renderer crash, once (engine; watch)**
- `page.screenshot: Target crashed` came about 10 minutes into the first full-journey session, at the night-walk stage.
- The CPU spiked to 99 °C at 07:02:51, at the moment of the crash.
- It was not reproduced in a 7-minute rerun. The JS heap there was 75–126 MB, with no growth trend (`journey.json` `heap`).
- Heat is the likely cause (see CLAUDE.md). Keep an eye on it: if it happens again on a cool machine, capture `chrome://gpu` and a crash dump.

**QA-058 · M1 scope gaps at the loot station (src/systems; mechanics for lockpick)**
GAME_PLAN §M1 lists "crates/cabinets/body to search, lockpick". There is no lockpick interaction and no searchable body anywhere in `src/` (grep `lockpick`: 0 hits).

### P2

| id | area (owner) | steps → actual (expected) | evidence |
|---|---|---|---|
| QA-059 | src/gameplay/vehicles (vehicles.ts:332) | E enters the car (the prompt says "[E] Drive"), but E does nothing inside; only F exits. The car HUD shows no exit hint. (Expected: E also exits, or the HUD shows "F Exit".) | `track.json` `eExits: false` |
| QA-060 | src/ui/hud + engine lock hint | "CLICK TO CAPTURE MOUSE" sits on top of the interaction prompt at the same screen position, so "Repair car (repair kit)" is half hidden whenever the mouse isn't captured, for example after Esc-closing F1 or an inventory. (Expected: move the hint up, or hide the prompt.) | `zoom_repair_hold_2.png` |
| QA-061 | src/systems containers (radius) / src/gameplay/interact | The crate prompt only appears within 1.5–1.7 m of the crate centre: the radius is measured from the chest (y + 1.2) to the crate base. At 1.9 m, standing right in front of it, there's no prompt. (Expected: measure to the container's top or centre, or use a radius of about 2.5.) | `j03_loot_prompt.png`; `promptAtDist 1.47 / 1.73` |
| QA-062 | src/ui/build/buildMode.ts | X on a house wall says "Remove what rests on it first" without naming or highlighting the blocker. The blocker was the gable above it; after removing the gable, the wall comes off. (Expected: tint the blocking piece and name it, e.g. "Remove the Gable above first".) | `j24_build_mode.png` → `j26_wall_removed.png` |
| QA-063 | src/gameplay/player (respawn) | After respawn the camera keeps the death-cam pitch (-0.65, looking at the ground), and the held weapon is reset to the knife even though the rifle was in Primary. | `j22_respawn.png`, `journey.json pen.afterRespawn` |
| QA-064 | src/gameplay/camera | Third-person ADS at the bench: the shoulder, arm and backpack fill the left ~35 % of the screen. | `j09_range_plate25.png` |
| QA-065 | range readout (src/gameplay/weapons or range UI) | A miss into the sky reads "last shot 606.5 m · — / miss". (Expected: "miss" with no distance.) | `qa044_pools_corpses.png` |
| QA-066 | src/ui/hud | The ammo reads "26+1 ‖ 3". The "3" is spare magazines but has no unit, and the sandbox shows "∞" in the same place. (Expected: "3 mags", or a mag icon.) | `j09`, `j14` |
| QA-067 | src/world/yard/stations/anim.ts, src/gameplay/animstand | A lamp post stands in the line of sight on the south approach to the stand. The survivor plays reload/fire clips with empty hands. The stand sign doesn't show the clip name. | `j58_anim_reload_rifle.png` |
| QA-068 | src/world/yard/poles.ts / track | No lamps along the track asphalt: at night the straights are unlit (only corner lamps away from the road). | `j66_night_track.png` |
| QA-069 | src/ui/inventory | The panel's vertical position shifts by about 10 px between the crate view and the rack view (header at y 76 vs 66). | `j05_loot_opened.png` vs `j08_rack_took_all.png` |

## Player-journey friction list

The order below is the order a new player meets each problem.

1. **Title → Play:** smooth; the fly-over blends into the player, and the pointer locks on Play (`j01`, `j02`).
2. **Loot crate:** the player has to almost touch the crate before "Pry open Wooden Crate" appears (QA-061). The hold ring and the opened crate panel are clear, and the icons read well (`j04`, `j05`).
3. **Inventory:** clear. One thing makes it confusing: you start with Planks 10 and Nails 20 in the jacket, and nothing says why (sandbox seed).
4. **Weapon rack:**
   - "Open Weapon Rack" → Take all puts the AK and pistol straight into the weapon slots, and spare magazines into the backpack. Good (`j08`).
   - The range sign tells you the keys (1–4, RMB, R, X). Good.
5. **Range:**
   - All 6 targets were hit with ADS (5, 25 and 80 m); the readout confirms hit, zone and damage.
   - The reload bar under the crosshair reads well (`j14`).
   - The TP ADS shoulder blocks part of the view (QA-064).
   - "‖ 3" is unclear (QA-066).
6. **Pen: the biggest friction.**
   - The sign says KEEP GATE SHUT and the gate can't be opened.
   - Zombies spawned from F1 stay inside, and bullets don't pass the fence (QA-055).
   - A new player can't fight here at all.
7. **Fight (zombies spawned outside, debug):**
   - Shove → stagger → V finisher works (`shove→stagger,stagger,move`, `fin→dead`).
   - The knife hits with a red hit-marker (`j19`, `j20`).
   - 3 zombies took the player to 50 HP. Dying to 5 adjacent zombies took 4.8 s from 50 HP.
   - "YOU DIED" with a red vignette is clear, and respawn comes after 3 s.
   - You respawn at the spawn point looking at the ground, holding the knife (QA-063).
8. **Build pad:**
   - B shows the bar with costs and key hints (good).
   - X on the wall refuses with an unexplained message (QA-062).
   - After removing the gable, the wall comes off and "Salvaged: 3 Wood Planks, 4 Box of Nails" shows.
   - Wall (2) + LMB rebuilds it (pieces 21 → 19 → 20).
   - The gable has to be rebuilt separately, and nothing tells you that.
9. **Track:**
   - "[E] Drive" is clear.
   - A full lap including the ramp took 17 s at about 40 km/h, with the car airborne over the ramp (max y 1.22).
   - With full-lock keyboard steering, the car rolled over after the ramp (QA-056).
   - E doesn't get you out (QA-059).
10. **Zombies vs car:** clear HUD `CAR 64%` and zombies beating on the panels (`t_car_damaged.png`). Damage smoke didn't show yet at 64 %.
11. **Repair:**
    - At the hood without a kit, "Repair car: needs a repair kit" is clear.
    - F1 → Items → "+ Repair kit", then hold E for 4 s → 100 %.
    - The "Car repaired" toast is small and sits at the top centre.
    - A kit can also drop from crates (good).
12. **Animation stand:** 5 clips played from F1 → Animation (walk, run, reload_rifle, death, z_attack).
    - The F1 Animation group is a long wall of 34 buttons with no grouping.
    - A lamp post blocks the view on approach (QA-067).
13. **Night:**
    - The lamps at the stand, range, loot and build pad look good. The pen reads at eye level.
    - The track straights are dark (QA-068).
    - The walk route bumped into the build-pad edge once (17 stuck-jumps across the session; mostly the range wall and pad kerbs).
14. **Pause / resume:**
    - Esc pauses; Resume works at once.
    - The mouse needs one click, and the hint says so.
    - Quit to title works.

## Visual critique (day and night, against the art bible)

The art bible asks for:
- stylized low-poly with grounded proportions;
- faded, rusty, overgrown, Pacific Northwest after the collapse;
- lighting doing the heavy lifting;
- signal colours reserved for gameplay meaning (hazard orange = interactables and loot).

| # | shot | critique |
|---|---|---|
| 1 | `j01_title.png` | Strong. Big readable title, live fly-over and a good tip line. The yard below reads as a tidy test facility, not a "post-collapse valley": no rust, moss or debris (expected for a sandbox, but off-mood). |
| 2 | `j02_spawn.png` | Grounded proportions are correct (1.8 m survivor vs the lamp posts). The ground is flat clean green, and the paths are uniform grey: no wear or decals. |
| 3 | `j04_loot_holding.png` | The crate model has chamfers and metal corners, on palette. The hold ring and the key cap read well. The lockers are a nice faded green. The concrete wall has no grime. |
| 4 | `j05_loot_opened.png` | The inventory is now premium: icons, gold section headers, a dark glass panel. The repair kit's red icon competes with rarity and danger colours; fine. |
| 5 | `icons-3-tooltip-rifle.png` | Tooltip typography is clean. The tooltip covers the item being hovered: offset it to the right. |
| 6 | `j08_rack_took_all.png` | Clear weapon slots with icons. The empty rack panel is a large dead area. |
| 7 | `j09_range_plate25.png` | ADS in TP: the shoulder and backpack dominate the left third (QA-064). The targets read well at 25 m. |
| 8 | `vm_rifle_idle.png` | Hands and fingers are now convincing. The stock slab in the bottom-right is still the most off-model element in first person (QA-041d). |
| 9 | `vm_rifle_ads.png` | The sight picture is usable. The tan handguard is a flat untextured wedge that covers too much of the screen; give it a cut-out or lower it (QA-041e). |
| 10 | `vm_pistol_idle.png` | A big improvement: a two-hand grip with fingers. The slide points up-left of the crosshair; it could be canted toward the centre. |
| 11 | `vm_knife_idle.png` | The guard hand now has a forearm. Both hands read as "boxy mittens" next to the finer rifle hands; acceptable for the style. |
| 12 | `j18_pen_shoot_fence.png` | The chain-link, the DANGER sign and the red barrels sell the pen. The zombie variants stand out against the mud. |
| 13 | `j20_finisher.png` | The hit-marker and blood flecks read. The zombie silhouettes are good (worker vest, soldier). The grass is a single flat green, without tufts. |
| 14 | `j21_death.png` | The red vignette and "YOU DIED" are clean. The body lies arms-up (crumpled, not T-pose). |
| 15 | `j26_wall_removed.png` | The build kit looks handmade: the plank courses and dark frame match the house. The salvage toast is clear. The green foundation ghost is a loud flat slab. |
| 16 | `t_ramp.png` | The plywood ramp reads. The hazard strip is tiny. The asphalt and kerbs are clean. The pickup is the best-looking prop (faded blue, rust spots). |
| 17 | `t_car_damaged.png` | Zombies crowd the car and the HUD shows `CAR 64%`. At 64 % the car shows no damage: no smoke and no visible dents. |
| 18 | `t_repairing.png` | The prompt and ring are good. The corpses' legs point straight up (QA-034): the most immersion-breaking still in the set. |
| 19 | `j61_night_anim.png` | The art bible's "lighting does the heavy lifting" lands here: light cones, a pool on the stand, a starfield. The one weak point is a lamp pole in the foreground (QA-067). |
| 20 | `j64_night_pen.png` / `r3_pen_top_night.png` | At eye level the fence is lit and the zombies would read. From above the interior is a black square (QA-052). |
| + | `j66_night_track.png`, `j65_night_build.png` | Track straights are unlit (QA-068). The house is only lit at one corner; a porch light would make it a landmark. |

Patterns:
- **Lighting:** the night is the strongest part of the look.
- **Off-model elements:** the FP rifle wood (stock and handguard) and the corpse poses remain the most visibly off-model.
- **Mood:** the yard is still clean, with no rust, moss, decals or litter. That's acceptable for a test sandbox, but nothing yet demonstrates the art bible's "faded, reclaimed" mood.
- **Signal colours:** hazard orange is used for the cones and the UI accent, not only interactables. That's minor in the yard, but worth tightening before M2.

## Perf table

Conditions:
- Headed Chrome, 144 Hz vsync: 6.94, 13.9 and 20.8 ms are vsync steps.
- Overlay hidden; 4 s per case after a 1 s settle.
- Pass (a) ran at 72–78 °C.
- Pass (b) ran with the CPU climbing to 82–94 °C.
- `drive-perf` was run twice: hot at about 90 °C, then cool at 77 °C.

Budgets (principles §13): p95 ≤ 16.6, p99 ≤ 25, draws ≤ 400, sim ≤ 3, ai ≤ 2, physics ≤ 2.5, render submit ≤ 5, ui ≤ 1. All times are in ms.

| Scenario | p50 a/b | p95 a/b | p99 a/b | hitches | draws | tris | sim | ai | phys | r.scene | render | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Idle, spawn | 6.95 / 6.95 | 7.11 / 7.14 | 13.91 / 13.91 | 0 | 68 | 235k | 0.55–0.59 | 0.01 | 0.22–0.25 | 2.49–3.41 | 2.84–3.86 | OK |
| Idle, range | 6.95 / 6.95 | 7.00 / 7.02 | 7.13 / 7.09 | 0 | 63 | 216k | 0.30–0.31 | 0 | 0.13–0.15 | 1.64–1.74 | 1.88–2.03 | OK |
| Idle, build pad | 6.95 / 6.95 | 6.98 / 7.01 | 7.05 / 7.11 | 0 | 66 | 197k | 0.33–0.38 | 0 | 0.18–0.20 | 1.76–1.82 | 2.07–2.13 | OK |
| 30 zombies engaged | 6.95 / 6.95 | 13.85 / 13.82 | 13.94 / 13.90 | 0 | 67 | 335k | 0.34–0.39 | **0.76–0.94** | 0.20–0.23 | 1.93–2.39 | 2.20–2.70 | OK (p95 one vsync step) |
| 30 zombies, rifle fight | 6.95 / 6.96 | 13.88 / 13.91 | 13.94 / 20.76 | 0 | 64–75 | 346–349k | 0.39–0.53 | 0.62–0.63 | 0.21 | 1.71–2.43 | 1.98–2.75 | OK |
| Driving (perf.mjs, 71 km/h) | 6.95 / 6.94 | 6.99 / 7.03 | 7.15 / 7.07 | 0 | 63 | 220k | 0.22–0.37 | 0 | 0.28–0.31 | 2.00–2.08 | 2.28–2.40 | OK |
| Driving, start straight 81 km/h (cool, 2 runs) | 6.95 / 6.95 | 7.05 / 7.05 | 7.16 / 7.14 | 0 | 60 | 229k | 0.33–0.40 | 0.01 | 0.27–0.32 | 1.91–2.28 | **2.18–2.57** | OK |
| Driving, start straight (hot, ~90 °C) | 7.09 / 7.07 | 14.10 / 13.99 | 14.56 / 14.22 | 0 | 60 | 229k | 0.61–0.81 | 0.01 | 0.67–0.69 | 4.95–5.49 | **5.67–6.24** | heat-affected: over the 5 ms submit budget only when hot |
| Night, anim stand | 6.95 / 6.95 | 6.97 / 7.05 | 7.08 / 7.09 | 0 | 53 | 205k | 0.27–0.47 | 0 | 0.13–0.28 | 1.43–2.30 | 1.67–2.66 | OK |
| Night, build pad | 6.95 / 6.95 | 6.97 / 7.01 | 7.01 / 7.05 | 0 | 63 | 199k | 0.21–0.36 | 0 | 0.17–0.19 | 1.55–2.22 | 1.79–2.54 | OK |
| Night + 30 zombies | 6.95 / 6.95 | 7.01 / 7.04 | 7.10 / 13.85 | 0 | 68–69 | 325k | 0.28–0.31 | 0.77–0.81 | 0.19–0.20 | 1.67–2.26 | 1.87–2.51 | OK |
| 30 s sprint traversal | 6.95 / **13.73** | 6.97 / 14.23 | 7.03 / 20.93 | 0 / 0 | — | — | — | — | — | — | — | (a) OK; (b) dropped to 72 fps at the end of a hot pass, so throttling (CPU 94 %) |

Against §13:
- **Every case on a cool machine is inside every budget.**
  - p95 is at most one vsync step (13.9 ms), and p99 is at most 20.8 ms.
  - Draws are ≤ 75 (budget 400), and triangles ≤ 349k (budget 1.5 M).
  - AI peaks at 0.94 ms (budget 2), sim at 0.59 (budget 3), physics at 0.32 (budget 2.5) and UI at 0.05 (budget 1).
  - There were 0 hitches over 50 ms in all 22 cases plus 4 drive runs.
  - The heap was 77–149 MB.
- **Driving at speed is no longer close to the render budget.** Report 2 measured 3.9–4.6 ms; now 2.2–2.6 ms when cool. The only over-budget numbers (5.7–6.2 ms) came at about 90 °C and went away after a cool-down. That points to heat, not content.
- **Thermal sensitivity is the real perf risk on this laptop.** A pass that starts at 72 °C ends throttled after about 4 minutes (traversal p50 13.7 ms), and the one renderer crash (QA-057) coincided with a 99 °C spike. Keep long QA and perf runs short, and check FanKick first.
- **Not measured:** GPU ms (no `?gputime` pass), and a long soak beyond 10 minutes.
