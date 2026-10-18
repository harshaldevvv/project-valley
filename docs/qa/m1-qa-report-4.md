# M1 "the Yard": QA report 4 (M1 sign-off, after fix round 4)

Date: 2026-10-16. Build: `main` @ 8d7a13c (fix round 4: world f9029d5, gameplay a32744c, systems 8d7a13c). Dev server http://localhost:5188, headed Chrome through Playwright (`channel: 'chrome'`), 1280×720, WebGPU, 144 Hz panel. Only one Chrome window was open at a time, and each script closed it before the next one started.

Scripts are in `artifacts/qa4/`:
- `journey4.mjs`: the real-input player journey. It was run in four parts (runs A to D), and each part's shots carry that letter as a prefix:
  - A: loot crate, lockpick, survivor body.
  - B: range, pen fight, corpse search.
  - C: track and repair.
  - D: night walk and pause.
- `explore4.mjs`: exploratory edge cases. Setups use debug; the actions under test use real keys.
- `mech-qa4.mjs`, `lockpick.mjs`, `reach.mjs` and `yard-r4.mjs`: copies of the round-4 owner scripts, redirected to `artifacts/qa4/`.
- `vm.mjs`, `perf.mjs` and `lib2.mjs`: copied from qa3.
- `adapter.mjs`: reports the WebGPU adapter and power state.

Shots (121) are in `artifacts/qa4/shots/`. Raw results:
- `journey4-*.json` and `explore4*.json`
- `perf-a.json` and `perf-b.json`
- `mech-qa4.out`, `lockpick.out`, `reach.out` and `yard-r4.out`

**Real input** means the same as in report 3: pointer lock plus mouse-look through `page.mouse.move`, calibrated at 0.0022 rad/px, and WASD, Shift, E, Tab, R, V, F1 and Esc on the keyboard, with LMB and RMB through `page.mouse.down/up`. Two kinds of help were used:
- **Aiming:** the game is asked which yaw and pitch point at a target, and the script then turns there with the mouse.
- **Lockpick:** the script moves the real mouse over the lock face and holds D or LMB. It finds the sweet spot the way a player would, from the cylinder rotation drawn on screen (the SVG transform). It never reads the hidden sweet-spot value.

Steps that use debug are marked "(debug)".

**Heat:** FanKick ran throughout.
- Part 1 (07:40–07:54) ran at 70–85 °C, with one spike to 95 °C at 07:48:41, at the start of a run.
- The session then restarted.
- Part 2 (10:46–10:57) ran at 66–76 °C. Both perf passes ran at 74–76 °C.
- There were no crashes and no "Target crashed" errors.

## Summary and verdict

**Fix round 4 landed.** Of the 19 open ids from report 3:
- **13 are fixed:** QA-052, 055, 056, 058, 059, 060, 061, 062, 063, 065, 066, 068, 069.
- **4 are partly fixed:** QA-034 (one corpse still lies legs-up), QA-041 (FP rifle wood unchanged), QA-064 (TP ADS shoulder still takes about 25 % of the screen) and QA-067 (view and weapons fixed; clip name on the sign not checked).
- **QA-054** works as designed (a Chrome rule).
- **QA-057** was not reproduced (0 crashes).

The console showed 0 errors and 0 page errors across 13 sessions.

**What a player can now do with real input:**
- Open the pen gate with E and fight 5 zombies through it with the rifle: 31 of 33 shots hit.
- Shove and finish the last zombie with the knife.
- Search a zombie corpse.
- Pick the locked cabinet: one pick broke, then the lock opened at 120°.
- Search the dead survivor.
- Drive 3 laps over the ramp with A and D held to full lock: minUp 0.98, never tipped.
- Get out with E, repair the car, walk the yard at night, and pause and resume.

**New this pass:** 2 P2 and 5 P3 bugs. Nothing is P0 or P1.
- The worst one is QA-070: a zombie body lying beside the car's hood takes over the "Repair car" prompt.

**Perf:** frame time is roughly one vsync step slower than in report 3. The CPU side is unchanged and tiny: sim ≤ 0.61 ms, AI ≤ 1.31 ms, render submit ≤ 3.34 ms. `adapter.mjs` shows that WebGPU ran on the **AMD integrated GPU** (`amd / gcn-5`) after the session restart. The RTX was not in use, so these frame times are not comparable with report 3 (QA-075).

**Is M1 "done" per GAME_PLAN §M1? YES.** All seven stations exist and can be played with real input:
- **Loot:** crates, cabinets, a body to search, and a lockpick.
- **Range:** 5/25/80 m targets, pistol and rifle, a readout, and recoil.
- **Pen:** spawn 1/5/20 zombies; the gate opens and bullets pass the chain-link.
- **Build pad:** the prebuilt house can be taken apart and rebuilt.
- **Animation stand:** every clip, slow-mo, and the global T for TP/FP.
- **Inventory and UI.**
- **Vehicle track:** one data-driven car.

The in-world menu, Esc pause, the F1 debug menu, the drop/store/loot flows and the house all work. A perf report is attached.

**What remains, in priority order:**
1. **Re-measure perf on the RTX (QA-075).** This is a record step, not a blocker: there are 0 hitches and every CPU system is well inside budget.
2. **The P2 polish items:** QA-070, 071, 041, 034, 064, 078.

None of these blocks a player from testing any M1 system.

## Status table

| id | title | status | evidence |
|---|---|---|---|
| QA-034 | Corpse poses | **partly fixed** | Most corpses now lie flat, with a natural sprawl (`C_j09_hood_prompt.png`, `B_j14_corpse_prompt.png`). One red worker corpse in the pen fight still lies on its back with both legs straight up (`B_j14_corpse_prompt.png`, centre right). |
| QA-041 | FP rifle stock and ADS handguard | **still open** (not in round 4) | At hip, the tan stock slab still runs into the bottom-right corner (`vm_rifle_idle.png`). In ADS, the tan handguard and olive sleeve still cover the lower ~40 % of the screen around the sight (`vm_rifle_ads.png`). |
| QA-052 | Pen unlit at night | **fixed** | The pen interior is lit at eye level (`D_j04_night_pen.png`). From above, six light pools cover the floor; only the gaps between them are dark (`r4_pen_top_night.png`). |
| QA-054 | F1 → Esc doesn't relock | **by design** | Chrome needs a click to relock. The capture hint is now at the top of the screen and no longer covers prompts (QA-060). F1 → F1 relocks. |
| QA-055 | Pen can't be engaged | **fixed** | **Real input:** "Open gate" → E → "Close gate". 5 F1-spawned zombies left the pen through the gate; 31 of 33 rifle shots hit zombies (2 hit concrete or dirt). **Scripted:** 6 of 6 shots through the chain-link hit `zombie` (`mech-qa4.out`). **Shots:** `B_j07_pen_gate_prompt.png`, `B_j08_pen_gate_open.png`, `B_j09_pen_rifle_fight.png`, `qa055_pen.png`. |
| QA-056 | Pickup rolls after the ramp | **fixed** | **Real input:** 3 full laps over the ramp with A or D held to full lock (bang-bang): 57–58 km/h, airborne over the ramp every lap, minUp 0.98, 0 tipped samples (`C_j03..05_lap*_ramp.png`, `journey4-track.json`). **Scripted:** 5 ramp runs at 67–104 km/h, steering held after x 63, minUp 0.98 every time (`mech-qa4.out`). **Hint and assist:** a car put on its side shows "CAR 100% · F/E get out · R flip"; it is upright again within 1 s, and a zombie at 1.5 m still reaches it (0.63 m to the body; `explore4.json` flip, `X_flip_tipped_hud.png`). See the note below the table. |
| QA-057 | Renderer crash | **not reproduced** (watch) | 13 sessions, 0 crashes. The 95 °C spike at 07:48 caused no crash. |
| QA-058 | No lockpick or body at loot | **fixed** | "Pick lock (lockpick ×3)" → minigame. The pick broke once ("The pick snapped", 3 → 2). The lock opened at 120° and the Locked Cabinet panel opened (pistol, 2 × 7.62 magazines, rounds). The prompt then reads "Open Locked Cabinet" (`A_j06..A_j10`). "Search Dead Survivor" is a 3 s hold and gives mag_pistol_a, ammo_9mm, canned_beans and bandage (`A_j11..A_j13`). "Search Body" on a zombie corpse is a 2 s hold and opens the panel (`B_j14`, `B_j15`). Corpses stay 120 s, capped at 12, and clearing them removes their bodies (`mech-qa4.out`). |
| QA-059 | E doesn't exit the car | **fixed** | E exits the car (`eExits: true`). The HUD reads "CAR 100% · F/E get out". |
| QA-060 | Capture hint covers prompts | **fixed** | "CLICK TO CAPTURE MOUSE" now sits at the top centre (`qa064_tp_ads.png`). |
| QA-061 | Crate prompt needs near-contact | **fixed** | The crate, metal cabinet and duffel all prompt at 1.5, 1.9, 2.3 and 2.7 m (`reach.out`). |
| QA-062 | Build blocker unnamed | **fixed** | "Remove the Gable above first" (`lp-7-blocker.png`). |
| QA-063 | Respawn pitch and weapon | **fixed** | After respawn: pitch 0, weapon rifle_a (`qa063_respawn.png`). |
| QA-064 | TP ADS shoulder covers screen | **partly fixed** | The crosshair and target area are clear. The shoulder and backpack still fill about the left 25 % of the screen (`qa064_tp_ads.png`, `B_j09_pen_rifle_fight.png`). |
| QA-065 | Miss readout shows a distance | **fixed** | "last shot miss · hit — · damage 0.0". The readout takes about 1–1.5 s to switch to it (see QA-073). |
| QA-066 | "‖ 3" ammo has no unit | **fixed** | "27+1 3 mags" in play; "∞ mags" in the sandbox (`B_j09`, `qa064_tp_ads.png`). |
| QA-067 | Animation stand view and empty hands | **partly fixed** | The approach view is clear: no lamp in front of the stand (`r4_anim_view.png`). The survivor holds the AK in reload_rifle (`qa067_reload_rifle.png`). The clip name on the sign was not checked. |
| QA-068 | Track straights unlit | **fixed** | Lamps along the asphalt light the straights (`r4_track_drive_night.png`, `D_j03_night_track.png`). |
| QA-069 | Inventory header jumps | **fixed** | The header sits at y 39.8 px for the crate, locked cabinet, rack and zombie body. |

Totals:
- **13 fixed:** QA-052, 055, 056, 058, 059, 060, 061, 062, 063, 065, 066, 068, 069.
- **4 partly fixed:** QA-034, 041, 064, 067.
- **QA-054:** by design.
- **QA-057:** not reproduced.

**Note on the `mech-qa4` "auto-flip" FAIL:** this was an artefact of the test. The car placed on its side had already righted itself through the anti-roll torque before the 20-tick check, so `tipped` read false and `up` read 1.00. The explore4 run (driver inside) shows the R flip hint while the car is tipped, then upright at 1.0 s.

## New bugs

### P0
None.

### P1
None.

### P2

| id | area (owner) | steps → actual (expected) | evidence |
|---|---|---|---|
| QA-070 | interact priority: `src/gameplay/interact/interact.ts` (mechanics-builder) + body radius in `src/systems/index.ts` (systems-builder) | **Steps:** let zombies attack the car, F1 "Kill all", get out with E, walk to the hood and look at it. **Actual:** two corpses lie beside the hood, and the prompt is "Search Body". Holding E for 5 s opened a body instead of repairing; the car stayed at 55 % and the kit was not used (real-input run C). With a single corpse 1.2 m to the side and the crosshair on the hood, the repair wins. **Expected:** the interactable under the crosshair wins over a nearby body, or bodies get a lower priority than vehicle actions. | `C_j09_hood_prompt.png`, `C_j10_repairing.png`, `journey4-track.json`, `X_repair_corpse_steals_prompt.png` |
| QA-071 | lockpick: `src/ui/lockpick/lockpick.ts`, `src/systems/index.ts` (systems-builder) | **Steps:** open the lock, and a zombie walks up and attacks. **Actual:** the minigame stays open while HP drops 100 → 70 in 5 s. The panel dims the HUD and gives no hit feedback, so the player only finds out from the dimmed health bar. **Expected:** taking damage closes the minigame (as death already does), or at least flashes red and shakes. | `X_lock_under_attack.png`, `explore4.json` lockdmg |
| QA-075 | engine/renderer (engine-builder); user setting | **Actual:** after the session restart WebGPU picked the AMD iGPU (`amd / gcn-5`, charging, 100 %), even with `powerPreference: 'high-performance'`. Frame times are a vsync step slower than in report 3 (see the perf table), while CPU work is unchanged. **Expected:** (a) the user sets Chrome to "High performance" in Windows Settings → Display → Graphics, then perf is re-measured; (b) the engine shows the adapter in F3 and warns once when it is an integrated GPU. | `adapter.mjs` output, `perf-a.json`, `perf-b.json` |
| QA-078 | animation stand (mechanics-builder) | Carried over from report 3, with no id there: the stand has no TP/FP toggle of its own. The global T works. Low priority; the GAME_PLAN definition is met by T. | report 3 |

### P3

| id | area (owner) | steps → actual (expected) | evidence |
|---|---|---|---|
| QA-072 | `src/gameplay/interact/interact.ts` (mechanics-builder) | Interactables have no line-of-sight check (code read). In the test, a corpse in front of the loot depot wall was not offered through the wall, because the cabinets were nearer. A body lying next to a thin wall could still be searched from the other side. **Expected:** a short ray from the camera to the interact point. | `explore4-repair-gate-wall.json` wall |
| QA-073 | range readout (mechanics-builder) | After a miss into the sky, the readout keeps showing the previous hit ("81.1 m target/body") for 0.5–1.5 s before it switches to "miss". In the real-input run it still showed the old hit at 300 ms. **Expected:** "miss" as soon as the ray resolves. | `B_j06_range_miss.png`, `explore4.json` missReadout |
| QA-074 | `src/ui/debug` (engine-builder) | F1 opens the debug panel on top of the lockpick screen, and both stay active. Debug only. | `X_lock_f1.png` |
| QA-076 | `src/gameplay/vehicles/vehicles.ts` (mechanics-builder; text: narrative-designer) | Player-facing strings are hard-coded in gameplay code: "Repair car (repair kit)", "Repair car: needs a repair kit", "Drive", "Needs a repair kit" and "Car repaired". This breaks the CLAUDE.md rule that player text lives in `src/content/text/`. | vehicles.ts:172–186 |
| QA-077 | balance: `src/content/data` zombies/weapons (mechanics-builder) | In the pen, 5 zombies through the gate took the player from 100 to 30 HP, even with 31 of 33 rifle hits. Zombies have 135–190 HP against 20 per rifle body hit, so that is 7–10 hits each. That is fine for a test pen, but tough for a first fight. Worth a balance pass before M2. | `journey4-range-pen-corpse.json` pen |

**Checked and fine:**
- **Gate closing on a zombie** in the gateway: the leaf pushes it out of the gap (28.55 → 27.59) and closes fully. The zombie isn't trapped and doesn't clip (`X_gate_closed_on_zombie.png`).
- **Gate closing on the player** in the gateway: the player is pushed out to x 27.56.
- **Pausing mid-pick:** the first Esc closes the lock (it doesn't pause), and the second Esc pauses the game.
- **Car flipping beside zombies:** the 4 zombies around a tipped car stay alive and outside the car (1.8–4.2 m). None ends up inside or under it.
- **Corpse pushed into a wall:** it stays at its death position. The root isn't moved into the wall (`X_corpse_into_wall.png`).
- **First mouse move after locking:** no camera jump (−0.22 rad per 100 px, 3 of 3).

## Player-journey friction list

The order below is the order a new player meets each problem.

1. **Title → Play:** smooth.
2. **Loot crate:** the prompt now appears at a normal distance (it showed at 2.7 m). The hold ring works, and the panel is stable.
3. **Locked cabinet:**
   - "Pick lock (lockpick ×3)" is clear, and you start with 3 picks.
   - The minigame reads well: brass cylinder, pins, a pick that turns red under strain, and a key hint line (`A_j08_lock_straining.png`).
   - It took one broken pick and about eight probes to find the spot. That's the right amount of challenge for a "Simple lock".
   - On success, the cabinet panel opens straight away (`A_j10`).
   - Friction: while picking, the world keeps running and an attacking zombie gives no warning (QA-071).
4. **Survivor body:** found easily by the lockers. "Search Dead Survivor" and Take all work (`A_j11`–`A_j13`). The pose (arms up, sprawled) reads as dead.
5. **Rack and range:** as in pass 3. "3 mags" is clear now. A sky miss shows the previous hit for about a second (QA-073).
6. **Pen: the friction from pass 3 is gone.**
   - "Open gate" → the zombies walk out → the rifle works through the gate and the fence.
   - The last zombie: shove → stagger → V finisher kills it (`B_j11`, `B_j12`).
   - The fight is tough: 30 HP left (QA-077).
7. **Corpse search:** "Search Body", a 2 s hold, and the panel opens. Afterwards, close the gate with E.
8. **Track:**
   - 3 laps with held keys and no rollover; the car flies over the ramp every lap.
   - The HUD reads "CAR 100% · F/E get out".
   - E gets you out.
9. **Zombies vs car → repair:**
   - The car went 100 → 58 % in 15 s.
   - After "Kill all", the bodies lie at the hood and the hood prompt reads "Search Body" (QA-070).
   - From a clean spot, the full flow works: "needs a repair kit" → kit → 4 s hold → 100 %, kit used (`X_repair_clean_holding.png`).
10. **Night:** the track straights are lit and the pen is lit (`D_j03`–`D_j08`). The stand at night is the best shot in the build.
11. **Pause:** Esc → paused → Resume → playing, and the pointer relocks after one click.

## Visual critique (against the art bible)

| # | shot | critique |
|---|---|---|
| 1 | `A_j08_lock_straining.png` | The lockpick screen is on-style: a metal housing, a brass cylinder, and a red strain glow as the signal colour. Its typography matches the inventory. |
| 2 | `A_j10_lock_opened.png` | The cabinet loot panel reads cleanly. The rifle magazine icons and counts are clear. |
| 3 | `A_j11_body_prompt.png` | The dead survivor is a strong piece of environmental storytelling next to the green lockers. The body clips slightly into the slab; that's fine. |
| 4 | `B_j09_pen_rifle_fight.png` | The open gate swung inward, and the zombies walk out under the lamps: the pen finally reads as a place. The TP shoulder still takes about a quarter of the frame (QA-064). |
| 5 | `B_j14_corpse_prompt.png` | Most corpses sprawl naturally, with blood pools under them. One corpse still has its legs straight up (QA-034), the most immersion-breaking element left. |
| 6 | `C_j04_lap1_ramp.png` | The pickup in the air over the plywood ramp, with "CAR 100% · F/E GET OUT" in the corner. Clean. |
| 7 | `D_j04_night_pen.png` | The lit mud inside the chain-link, with the gate leaf in shadow, gives good night contrast. |
| 8 | `D_j08_night_anim.png` | Three light cones around the stand, and the lit plinth against the starfield. Excellent. |
| 9 | `vm_rifle_ads.png` | Unchanged since pass 3: the flat tan handguard wedge dominates the lower half (QA-041). |
| 10 | `r4_pen_top_night.png` | Six soft pools inside the pen. Between them the mud is still pure black, which is acceptable at night. |

Pattern: the new features (lockpick UI, gate, bodies, lamps) all match the art bible. The off-model elements left are the same two as last time: the FP rifle wood and one legs-up corpse pose. The yard is still "clean"; mood dressing (rust, moss, litter) belongs to M3.

## Perf table

**Conditions:**
- Headed Chrome at 144 Hz vsync: 6.94, 13.9 and 20.8 ms are vsync steps.
- Overlay hidden; 4 s per case after a 1 s settle.
- Both passes ran at 74–76 °C (cool).
- **The WebGPU adapter was the AMD integrated GPU** (see QA-075).

Budgets (principles §13): p95 ≤ 16.6, p99 ≤ 25, draws ≤ 400, sim ≤ 3, AI ≤ 2, physics ≤ 2.5, render submit ≤ 5, UI ≤ 1. All times are in ms.

| Scenario | p50 a/b | p95 a/b | p99 a/b | hitches | draws | tris | sim | ai | phys | r.scene | render | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Idle, spawn | 6.97 / 6.97 | 13.94 / 13.95 | 20.83 / 20.91 | 0 | 67 | 239k | 0.48–0.51 | 0.01 | 0.21 | 2.15–2.16 | 2.48–2.50 | OK (p95 one step slower than report 3) |
| Idle, range | 6.97 / 6.97 | 13.99 / 13.95 | 20.88 / 20.84 | 0 | 55–62 | 219k | 0.38 | 0 | 0.17–0.19 | 1.96–2.06 | 2.28–2.37 | OK |
| Idle, build pad | 6.97 / 6.97 | 13.94 / 13.93 | 20.81 / 20.78 | 0 | 61–68 | 201–208k | 0.36–0.37 | 0 | 0.19 | 2.14–2.23 | 2.45–2.54 | OK |
| 30 zombies engaged | 7.07 / 7.07 | **20.77 / 20.80** | 20.88 / 20.89 | 0 | 64–67 | 340–348k | 0.40 | 0.92–1.31 | 0.23–0.26 | 1.96–2.10 | 2.26–2.43 | **p95 over budget** (iGPU) |
| 30 zombies, rifle fight | **13.86 / 13.88** | **20.83 / 20.86** | 20.90 / **27.8** | 0 | 64–95 | 344–348k | 0.46–0.61 | 0.70–1.06 | 0.22–0.25 | 2.27–2.56 | 2.58–2.89 | **over budget** (iGPU), 72 fps |
| Driving (a: 71 km/h) | 6.97 / 7.01 | 13.98 / **20.81** | 20.83 / 20.89 | 0 | 67–73 | 224–228k | 0.35–0.48 | 0 | 0.25–0.27 | 2.12–2.95 | 2.43–3.34 | a OK; b over p95 (b's car didn't move: the script's F entry failed) |
| Night, anim stand | 6.97 / 6.95 | 13.96 / 13.89 | 20.84 / 20.83 | 0 | 56–75 | 212–227k | 0.33–0.42 | 0.01 | 0.19 | 2.00–2.29 | 2.29–2.59 | OK |
| Night, build pad | 6.96 / 6.95 | 13.95 / 13.85 | 20.85 / 13.94 | 0 | 67–75 | 203–227k | 0.27–0.34 | 0 | 0.18 | 2.17–2.36 | 2.48–2.70 | OK |
| Night + 30 zombies | **13.75** / 6.95 | **20.80** / 13.88 | 20.93 / 13.98 | 0 | 69–79 | 325k (a) | 0.27–0.34 | 0.57–0.99 | 0.22–0.24 | 2.41–2.44 | 2.72 | a over budget (iGPU); b's spawn didn't take (236k tris) |
| 30 s sprint traversal | 6.95 / 6.94 | 13.85 / 7.01 | 13.95 / 7.06 | 0 / 0 | — | — | — | — | — | — | — | OK |

**Against §13:**
- **CPU side: every budget passes with a wide margin.**
  - sim ≤ 0.61 (budget 3), AI ≤ 1.31 (budget 2), physics ≤ 0.27 (budget 2.5), UI ≤ 0.10 (budget 1).
  - Render submit ≤ 3.34 (budget 5). Draws ≤ 95 (budget 400), triangles ≤ 348k (budget 1.5 M).
  - 0 hitches over 50 ms in 20 cases. The heap was 75–143 MB.
  - The new systems cost almost nothing: pen-gate ≤ 0.01 ms, hotbar 0.01 ms. The fake light pools add no measurable submit time.
- **GPU-bound frame time is a vsync step slower than in report 3,** and the 30-zombie cases miss p95 ≤ 16.6. With CPU work unchanged, the cause is the integrated AMD adapter WebGPU used this session (QA-075), not the round-4 content.
- **Next step:** re-run `node artifacts/qa4/perf.mjs c` once Chrome is set to the RTX. If it still misses on the RTX, the light-pool decals over 30 zombies are the first suspect.
- **Not measured:** GPU ms (no `?gputime` pass) and a long soak.
