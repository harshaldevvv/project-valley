# M1 "the Yard": QA report 2 (re-test after fix round 2)

Date: 2026-10-16. Build: `main` @ 62de1d1 (fix round 2: engine 2ad8b72, gameplay 6597022, systems 42f9737, assets 4c717b8, world 1ea5a73/450111b, settings 62de1d1). Dev server http://localhost:5188, headed Chrome via Playwright (`channel: 'chrome'`), 1280×720, WebGPU, 144 Hz panel.
Scripts: `artifacts/qa2/*.mjs` (adapted from `artifacts/qa/`, `artifacts/mech/qafix.mjs`, `artifacts/systems/qa-fix.mjs`, `artifacts/pause-test.mjs`, `artifacts/crowd-test.mjs`). Screenshots (467 + contact sheets): `artifacts/qa2/shots/`. Raw results: `artifacts/qa2/old.json`, `new.json`, `explore.json`, `perf-a.json`, `perf-b.json`.
Heat: FanKick was running throughout. The functional runs started with the CPU at 85–100 °C because of other load on the machine. Perf was measured at 77–82 °C (06:10–06:14), after the CPU had cooled below 90 °C. One early 20-zombie sample taken at about 100 °C (p50 13 ms) was dropped as heat-affected.

## Summary

**Verdict: fix round 2 landed. 31 of the 37 old issues are fixed, 5 are partly fixed (QA-006, 018, 023, 034, 036), 1 is unverified (QA-031) and none is still broken outright.** The two blockers from round 1 are both gone. The crowd is now rendered as a crowd: 30 aggressive zombies cost about 65 draws, p95 7.05 ms and AI 0.8–0.9 ms, against 72–91 draws and an unstable p95 for 20 before. You can walk into the house over the new steps. Ramming kills zombies. Shove leads into a working finisher. Recoil recovers 91 % within 250 ms. The camera squeezes into first person near walls instead of entering the head. Passive zombies stay passive, and five zombies now need 8.2 s to kill a standing player instead of about 2 s. The sky, night lamps, zombie variants, effects per surface, gore and reduce-flashing settings, Take all, Sort and compare all work. Every perf case is pinned at 144 fps (p50 6.95 ms, 0 hitches, including a 30 s sprint traversal). Across all runs the console showed **0 errors and 0 page errors**.

There are no P0s. This pass found **3 new P1s and 14 new P2s**. The most important:
1. **QA-038:** clicking Resume within about 1 s of pausing does nothing, so the menu stays up (3 of 3 repros). Waiting about 1 s first works.
2. **QA-039:** a flip reset next to an obstacle stands the pickup on its tail, and it stays that way (seen twice).
3. **QA-040:** the start straight runs straight into a tyre stack and lamp post at the first bend. The car wedges there at 0 km/h with W held (seen in 5 runs). Reversing frees it. This is the rest of QA-036.
4. **QA-006 (partly fixed):** the first-person arms are in, but the pistol and knife hands look crumpled. While holding the knife, the left hand floats with no forearm. Near walls, the rifle's left sleeve fills about a quarter of the screen.

## Old-issue status table

Shots are in `artifacts/qa2/shots/`.

| id | title | status | evidence and notes |
|---|---|---|---|
| QA-001 | Camera collapses into the head | **fixed** | At the north wall and the loot wall, `rig.collapsed` is true and the body is hidden, so you get a clean first-person view (`qa001_wall_n.png`, `qa001_loot_wall.png`). At the car door the camera doesn't collapse and the body stays visible (`qa001_car_door.png`). Through the house doorway the camera squeezes to first person and back out (`sheet_house_steps.png`). |
| QA-002 | Build digits switch weapons | **fixed** | Weapon slot is 0 → 0 after B followed by 2/3/4/8 (`qa002_019_buildbar.png`). |
| QA-003 | House can't be entered | **fixed** | You walk in over the steps: y rises 0.02 → 0.16 → 0.30 → 0.52 and the player ends at x -48.6 (`sheet_house_steps.png`, `qa003_inside.png`). Walking back out works (x -41.0). |
| QA-004 | Car doesn't run zombies over; zombie on the roof | **fixed** | At 59 km/h one zombie died and the second, off-line, was unhurt. In a second run at 53 km/h all 4 died. Corpses land at y 0.02 and nobody rides the roof (`sheet_qa004_ram.png`, `sheet_car_ram.png`). The roof throw-off itself is **untested**: a zombie spawned on the roof snaps to the ground. |
| QA-005 | Passive zombies attack | **fixed** | HP stayed at 100 through 4 knife hits (`qa005_passive.png`). |
| QA-006 | First-person view has no arms | **partly fixed** | Arms load (`vm.ready`, 8 meshes). Hip, ADS, fire, reload with the magazine in the left hand, draw/holster, knife light/heavy and shove clips all play (`sheet_fp_rifle_reload.png`, `sheet_fp_rifle_fire.png`, `sheet_fpmix.png`; `ex_fpknife_*` shows the trail). Still off: see QA-041. |
| QA-007 | Shove → finisher | **fixed** | After shove the zombie is in `stagger`, V starts `finisher`, and the zombie dies (`sheet_qa007_shove.png`, `sheet_qa007_fin.png`). |
| QA-008 | Zombie damage too high | **fixed** | Five zombies against a player standing still: at most 1 attacker at a time, about 10 HP/s, dead after 8.2 s of sim time (before: about 2 s) (`qa008_engaged.png`). |
| QA-009 | Crowd not instanced, cost unstable | **fixed** | With 30 zombies: 65 draws engaged and 77–96 while fighting, ai 0.8–0.93 ms, crowd 0.03 ms, anim 0.3–0.47 ms, p95 7.05 ms engaged and 13.9 ms while fighting. See the perf table. |
| QA-010 | Death clips sink into the pedestal | **fixed** | Root y 0.40; the survivor and the zombie lie on the pedestal top (`qa010_death.png`, `qa010_z_death.png`). |
| QA-011 | Recoil doesn't recover | **fixed** | Climb 1.16°, 0.10° left after 250 ms (91 %), 0.00° after 1.25 s. |
| QA-012 | Death camera inside the crowd | **fixed** | The camera rises over the body and looks down, with "YOU DIED" clear of the crowd (`sheet_qa012b_death.png`). The first run in `old.json` didn't count: the zombies' hit i-frames blocked `damage(999)`. |
| QA-013 | Quick E taps lost | **fixed** | Taps went Open → Close → Open → Close. |
| QA-014 | Resume doesn't work while the pointer is locked | **fixed, new edge case** | After Esc the lock is released and Resume re-locks. The new timing problem is filed as QA-038. |
| QA-015 | F1 + Esc | **fixed** | Esc closes the panel and unblocks input. The pointer isn't re-locked, so you have to click once (minor). |
| QA-016 | F3 overlay on by default | **fixed** | `#perf` is hidden by default. |
| QA-017 | HUD visible under the title | **fixed** | The HUD is `hidden/none` at the title and after Quit to title (`menu_quit_0.png`). |
| QA-018 | Help overlay overlap; H bound twice | **partly fixed** | "Mouse wheel / Select piece" no longer overlap, and the perf overlay is off. H is still Help and Horn, but help is gated off in the car, so the conflict is harmless. The help text is still very small (`qa018_help.png`, `ex_view_help.png`). |
| QA-019 | `wood_gable` raw id | **fixed** | The build bar shows "Gable" and every piece has its cost. |
| QA-020 | Toasts stack | **fixed** | 4 dry fires give one toast, "Empty — press R". Leftover: the toast stays up during the reload (`sheet_fp_rifle_reload.png`, frames 0–4). |
| QA-021 | Split says "No room" | **fixed** | Shift-click on Planks 10 gives 5 in the jacket and 5 in the backpack (`inv-1-split.png`). |
| QA-022 | Dropped item next to the crate can't be picked up | **fixed** | The prompt reads "Pick up Bandage (2)", and E picks it up (`inv-5-drop-by-crate.png`). |
| QA-023 | Inventory jumps; tiles unreadable | **partly fixed** | The layout no longer jumps after Take all (`inv-2-rack.png` vs `inv-3-took-all.png`). The tiles are still flat colour blocks with about 8 px labels and no icons. |
| QA-024 | Small-viewport menu overlap | **fixed** | At 900×560 there's no overlap, and Settings scrolls (`menu_small_pause.png`, `menu_small_settings.png`). |
| QA-025 | Duplicate teleport names | **fixed** | 6 unique station names (`qa025_debug.png`). |
| QA-026 | Range readout everywhere | **fixed** | Hidden at the loot pad. |
| QA-027 | Car prompt shows E with "[F]" | **fixed** | The prompt reads "[E] Drive", and both E and F enter the car (`qa027_car_prompt.png`). |
| QA-028 | Stacked crate sinks in | **fixed** | The crate is now 0.6 m tall and the top one sits at y 0.6, flush (`qa028_stacked.png`). |
| QA-029 | Rack looks empty | **fixed** | The AK and pistol are visible from the front at 2 m and 7 m (`rack_front_close.png`, `rack_front_far.png`, `qa030_sign.png`). |
| QA-030 | Sign subtitles unreadable | **fixed** | The "LIVE FIRE RANGE" sub-lines read at about 8 m (`qa030_sign.png`). |
| QA-031 | Tree canopies at head height | **can't judge (likely fixed)** | `ground.ts` lifts the inner trees' canopies by 1.5 m. The trees are placed at random and I didn't capture one from underneath. |
| QA-032 | Flat dawn/dusk; black night with no lights | **fixed** | Sky gradient, sun disc, moon and stars. Lamps are lit at the anim stand, range, build pad and loot pad: 6 lights, 5 on (`sheet_tod.png`, `ex_night_*.png`). The pen has no lamp (see visual critique). |
| QA-033 | Zombie clones | **fixed** | A group of 20 had 8 shamblers, 6 workers, 3 soldiers and 3 civilian_f (`qa033_variants.png`). |
| QA-034 | Corpses splay their arms and pile up | **partly fixed** | Less piling, but the arms still splay out T-pose wide (`qa034_corpses.png`, `probe_goreoff_after.png`). |
| QA-035 | Black pen post | **fixed** | The posts are uniformly grey (`qa035_pen_post.png`). |
| QA-036 | Car wedges on tyre stacks | **partly fixed** | Reversing frees the car now (-25 km/h). But the start straight still runs into a stack and lamp post, see QA-040. |
| QA-037 | Art bible grid 1.5 vs 3 m | **fixed** | The art bible now says 3 m cells. |

Totals: **31 fixed** (minor notes on QA-004, 014, 015 and 020), **5 partly fixed** (QA-006, 018, 023, 034, 036), **1 unverified** (QA-031), **0 still broken**.

---

## New bugs

### P0
None.

### P1

**QA-038 · Resume is ignored if it is clicked within about 1 s of pausing (src/ui/menu/menu.ts)**
- **Steps:** while playing with the pointer locked, press Esc, then click RESUME about 0.5 s later. Also: Esc → Settings → click Resume.
- **Expected:** the game resumes.
- **Actual:** `engine.menu.mode` stays `paused` and the pointer is not locked. A second click a moment later can also fail. It works if you wait about 1 s (`m3_resumeFromControls: playing`).
- **Likely cause:** Chrome refuses `requestPointerLock()` for about 1 s after the user leaves pointer lock with Esc, and `play()` isn't robust to that rejection. Catch the rejection and either stay in `playing` and lock on the next canvas click, or retry.
- **Evidence:** `ex_resume_with_settings.png`; `probe.mjs` output `m2_resumePlain: paused`; `menu.mjs` (the gore pass ran with the pause menu still up, `menu_gore_off_hit.png`).

**QA-039 · Flip reset next to an obstacle stands the pickup on its tail (src/gameplay/vehicles)**
- **Steps:** drive off the start straight into the tyre stack and lamp post at the first bend (about 31, 40), exit, then trigger a flip reset (`vehicles.flipReset`, or R in the car) while the car is still touching them.
- **Expected:** the car is placed upright on clear ground.
- **Actual:** the car ends up vertical, nose up at y 2.5. W does nothing (0 km/h) and the car stays that way.
- **Evidence:** `ex_exit_speed_0.png`, `ex_car_roof_exit.png`, `ex_resume_with_settings.png` (background); `explore.json` `exitAtSpeed.after.car = [27.3, 2.5, 29.1]`.

**QA-040 · The start straight leads straight into a tyre stack and lamp post, and the car wedges at 0 km/h (src/world/yard/stations/track.ts)**
- **Steps:** enter the car at spawn and hold W, without steering.
- **Expected:** a run-off area, or the obstacles set back from the line you're on.
- **Actual:** after about 3.5 s at 54–60 km/h the car runs off at the first bend into the stack, sign post and lamp post at about (31, 40) and stops dead. It stays at 0 km/h with W held (5 of 5 runs; the drive-perf runs report `kmh: 0` because of this). Reversing frees it, and steering avoids it. Not a hard lock any more, but a new player hits it on the first drive, and it feeds QA-039.
- **Evidence:** `probe_car_wedge.png`, `ex_carstall_stuck.png`, `sheet_car_ram.png`, `sheet_qa004_ram.png` (frames 9–14).

### P2

| id | area (owner) | steps → actual (expected) | evidence |
|---|---|---|---|
| QA-041 | assets/chr_arms_fp, src/content/data/weapons.ts (fpArms) | First-person arms: (a) the pistol grip and reload show a crumpled clump of finger boxes; (b) with the knife, the left hand floats with no forearm at the bottom left; (c) when collapsed near walls, the rifle's left sleeve is a huge olive log covering about 25 % of the screen; (d) the AK stock is a tan slab running to the bottom-right corner; (e) in ADS the rifle receiver is a big black wedge covering the lower centre of the screen. | `qa006_fp_pistol.png`, `qa006_fp_knife.png`, `qa001_wall_n.png`, `sheet_fpmix.png` (frames 1–2, 6–7) |
| QA-042 | src/gameplay/weapons/weapons.ts (surfaceOf) or vehicles collider groups | Shooting the pickup gives the surface `wood` (`lastShot.target`), so it gets wood chips and the wood sound (expected metal sparks). The car's collider apparently lacks the VEHICLE group bit and falls through to the build-piece default. | `vfx2.mjs` output `metal_car: wood`; `vfx2_metal_car_*.png` |
| QA-043 | src/world/yard/stations/range.ts | The 5 m plate and dummy block the 25 m and 80 m targets in the same lane column. With ADS on the 25 m plate, the shot hits the 5 m plate at 6.1 m, and the 25 m hinge never moves. Stagger the lanes or lower the near targets. | `ex_plate25_swing.png`; `explore.json` `plate25` |
| QA-044 | src/gameplay/fx/fx.ts | Blood pools are large flat hexagons, about 1.2 m across, with hard edges and one dark colour. They also appear on top of the bench edge. They read as a polygon, not a pool. | `vfx2_pool_full.png`, `ex_gore_full_pool.png`, `ex_view_range_line.png` |
| QA-045 | src/gameplay/fx/fx.ts | Muzzle smoke puffs render as flat, hard-edged grey squares (cards) that hang in front of the camera, especially in ADS. | `plate5_4.png`, `fp_rifle_ads.png`, `sheet_plate5.png` |
| QA-046 | src/ui/build/buildMode.ts | Build mode survives death. The build bar and ghost are drawn over "YOU DIED", and you respawn still in build mode with a red ghost (expected: build mode exits on death). | `ex_build_death.png`, `ex_build_after_respawn.png` |
| QA-047 | src/ui/inventory/screen.ts | Dying with the inventory open leaves it open over the death screen ("YOU DIED" is hidden behind it). It is still open after respawn, with input blocked (expected: close it on death). | `ex_die_inv_open.png`, `ex_die_inv_respawn.png` |
| QA-048 | src/ui/menu/menu.ts | The Gore setting is a native white `<select>` dropdown in the dark settings panel and doesn't match the toggles and sliders. | `menu_settings_changed.png` |
| QA-049 | src/ui/hud/hud.ts | "Empty — press R" stays up for about 1 s after R starts the reload. It should clear when the reload starts. | `sheet_fp_rifle_reload.png` frames 0–4 |
| QA-050 | src/gameplay/player/player.ts | `damage()` returns early while `inVehicle`, so zombies can't hurt a driver at all. A parked car is a perfect safe room. Decide whether this is intended (other genre games let zombies damage the car). | code read; `explore.json` `reloadIntoCar` |
| QA-051 | src/gameplay/vehicles + src/gameplay/weapons | Entering the car cancels a reload in progress, and the magazine stays at 2. That's fine, but there's no feedback, and after you exit you still hold a nearly empty gun. Consider finishing or keeping the reload. | `ex_reload_into_car.png`, `ex_reload_after_exit.png` |
| QA-052 | src/world/yard/stations/pen.ts / lamps | At night the zombie pen has no lamp, so the crowd is nearly invisible (navy silhouettes). It's the one station with no light. | `ex_night_pen.png` |
| QA-053 | src/ui/build/buildMode.ts | With Gable (8) selected and nothing to snap to, the red ghost floats about 4 m up in the air above the pad instead of sitting on the pointer ray. | `inv-6-build-bar.png`, `qa002_019_buildbar.png` |
| QA-054 | src/ui/debug | After F1 → Esc the panel closes, but the pointer isn't re-locked, so the next mouse move doesn't turn the camera until you click. | `menu.mjs` `f1esc.lock: false` |

Not bugs (checked): pausing mid-reload freezes the reload, and it completes after resume (`menu_pause_midreload.png`). Switching weapons mid-reload cancels it cleanly. Sprinting overrides ADS. You can't fire in the car. Tab opens the inventory in the car. The horn doesn't toggle help. The settings persist across a reload, and the Reduce flashing and Gore changes apply live. Gore off swaps the blood for brown dust and leaves no pool (`probe_goreoff_1.png`, `probe_goreoff_after.png`). Reduce flashing shrinks the muzzle flash to a small dim star (`sheet_vfx2_flash_rf0.png` vs `sheet_vfx2_flash_rf1.png`).

---

## Perf table

Conditions: headed Chrome, 144 Hz vsync (6.94, 13.9 and 20.8 ms are vsync steps), overlay hidden, CPU 77–82 °C with FanKick at 100 %. Each case is 4 s after a 1 s settle. There are two clean passes, (a) and (b) (`perf.mjs`), plus `drive-perf.mjs` for driving. Budgets are from principles §13: p95 ≤ 16.6, p99 ≤ 25, draws ≤ 400, sim ≤ 3, ai ≤ 2, physics ≤ 2.5, render submit ≤ 5, ui ≤ 1. All times are in ms.

| Scenario | p50 a/b | p95 a/b | p99 a/b | hitches | draws | tris | sim | ai | phys | anim | r.scene | r.post | render | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Idle, spawn | 6.95 / 6.95 | 7.05 / 7.06 | 7.13 / 7.19 | 0 | 67 | 231k | 0.38–0.47 | 0.01 | 0.15–0.17 | 0.26–0.29 | 1.92–2.29 | 0.26–0.34 | 2.18–2.63 | OK |
| Idle, range | 6.95 / 6.95 | 7.05 / 7.05 | 7.11 / 7.18 | 0 | 63 | 212k | 0.29–0.36 | 0 | 0.15–0.19 | 0.23–0.31 | 2.0–2.23 | 0.28–0.29 | 2.29–2.52 | OK |
| Idle, build pad | 6.95 / 6.95 | 7.04 / 7.03 | 7.13 / 7.15 | 0 | 69 | 194k | 0.33–0.45 | 0 | 0.16–0.21 | 0.26–0.31 | 2.05–2.33 | 0.30–0.31 | 2.35–2.65 | OK |
| 30 zombies engaged | 6.95 / 6.95 | 7.06 / 7.05 | 7.16 / 7.14 | 0 | 65 | 328k | 0.38–0.39 | **0.80–0.93** | 0.19–0.25 | 0.33–0.40 | 2.47–2.58 | 0.31–0.32 | 2.78–2.91 | OK (crowd 0.03–0.04) |
| 30 zombies, rifle fight | 6.95 / 6.95 | 13.91 / 13.85 | 14.07 / 14.10 | 0 | 77–96 | 343–346k | 0.49–0.58 | 0.62–0.68 | 0.22–0.23 | 0.35–0.47 | 2.37–2.51 | 0.28–0.32 | 2.66–2.83 | OK (p95 is one vsync step; fx 0.05–0.06) |
| Driving 0→60 km/h | 6.95 / 6.95 | 7.04 / 7.07 | 7.09 / 7.20 | 0 | 65 | 214k | 0.45–0.52 | 0.01 | 0.32–0.36 | 0.39–0.40 | **3.38–4.07** | 0.48–0.49 | **3.87–4.58** | OK, but render is close to budget at speed |
| Night with lamps, anim stand | 6.95 / 6.95 | 7.07 / 7.07 | 7.23 / 7.18 | 0 | 51 | 198k | 0.36–0.39 | 0 | 0.14–0.18 | 0.22–0.29 | 2.06–2.26 | 0.27–0.32 | 2.33–2.59 | OK |
| Night with lamps, build pad | 6.95 / 6.95 | 7.07 / 7.06 | 7.16 / 7.18 | 0 | 63 | 195k | 0.36–0.41 | 0.01 | 0.20–0.23 | 0.24–0.35 | 1.85–2.59 | 0.27–0.46 | 2.12–3.05 | OK |
| Night + 30 zombies | 6.95 / 6.95 | 7.04 / 7.07 | 7.17 / 7.19 | 0 | 67 | 310–324k | 0.33–0.35 | 0.79–0.85 | 0.22–0.25 | 0.30 | 2.19–2.41 | 0.24–0.26 | 2.44–2.67 | OK |
| 30 s sprint traversal | 6.95 / 6.95 | 7.05 / 7.03 | 7.12 / 7.11 | **0 / 0** | — | — | — | — | — | — | — | — | — | OK (was 2 hitches > 50 ms) |

Against §13:
- **Every case is inside every budget.** p95 never went above one vsync step (13.9 ms), and p99 is 14.1 ms at most. Draws are ≤ 96 (budget 400) and triangles ≤ 346k (budget 1.5 M). AI peaks at 0.93 ms (budget 2 ms). Heap was 70–150 MB.
- **QA-009 is resolved by measurement.** 30 zombies now cost fewer draws than 20 did in round 1 (65 vs 72–91), and AI is half of its old worst case.
- **The render split works.** `r.post` is a steady 0.25–0.5 ms, and `r.scene` is 1.9–2.6 ms. The old "render 3–5 ms with 30–55 draws" was mostly scene submit, and it has dropped about 1.3 ms. The exception is driving: `r.scene` rises to 3.4–4.1 ms with the same 65 draws, probably from shadow and frustum churn while the chase camera moves fast. Watch it as the world grows; it is the closest any number came to its budget (5 ms).
- The fight's p95 of 13.9 ms is a single vsync step, caused by fx/impact bursts and by Playwright screenshots in the same window. No hitches over 50 ms anywhere, including the traversal (the §13 gate wants 0, and it got 0).
- Not measured: GPU ms (no `?gputime` pass), compile hitches after load. No post-load stall was seen (the warm-up works: the first frame after Play is smooth in `menu_title` → `menu_pause`).

## Visual critique

- **Lighting:** the biggest improvement. Dawn and dusk have real gradients and a sun disc, there's a moon and stars, and the night is navy rather than black. Lamp pools on the anim stand and the pads read beautifully (`sheet_tod.png`). The art bible's "lighting does the heavy lifting" now holds at the stations. Gaps: the pen is unlit (QA-052). Noon is still flat. Dusk at 18.8 h looks almost the same as dawn (both pink); give dusk a warmer orange.
- **First-person view:** the rifle hip pose and the reload with the magazine in hand look right and read well. The pistol and knife hands, the knife's left hand and the oversized sleeve are the most off-model things in the build now (QA-041). The rifle's ADS sight picture is blocked by the receiver.
- **Effects:** impacts differ by surface (dirt clods, wood chips, sparks), and the tracers, casings and knife trail all read. Gore off and Reduce flashing are tasteful. Off-model: the hexagonal blood pools (QA-044) and the square smoke cards (QA-045). The casings rest for only about 3 s and are 1.5 cm, so they can't be seen on the ground in a still.
- **Zombies:** variants (worker vest, soldier, civilian) break up the clone look well at 5–30 m (`qa033_variants.png`, `ex_crowd_close.png`). Corpses still splay their arms (QA-034).
- **World:** the rack with its guns now explains itself from the walkway. The house steps sit well. The tyre stack and lamp post at the first bend are a car trap (QA-040). The yard is still empty, with no clutter, decals or wear (unchanged from round 1). Range targets in the same lane hide each other (QA-043).
- **UI:** clean HUD with no overlap, and the menu works at small sizes. The native Gore dropdown (QA-048), the inventory tiles with no icons (QA-023) and the tiny help overlay text (QA-018) are the weak spots.
- **Floating, sunk or clipping:** none new, apart from QA-039 (vertical car) and the gable ghost floating high (QA-053). No z-fighting seen in about 120 new views.

## What's now good

- **The core loops all work end to end:** shove into finisher, ramming zombies with the car, entering the house through the door, build keys that don't swap guns, and taps registering on interactables.
- **Combat feel:** recoil recovers like the spec (91 % in 250 ms). Zombie pressure is survivable (8 s for 5 zombies), and passive mode is truly passive. The death camera lifts out of the crowd with a clean "YOU DIED".
- **First person:** real arms with a magazine-in-hand reload, fire kick, draw and holster, knife swings with a trail, and shove. The camera squeezes to first person in doorways and near walls and comes back out smoothly.
- **Crowd tech:** 30 mixed-variant zombies at 65 draws, AI under 1 ms, 144 fps.
- **Sky and night:** the gradient sky, sun, moon, stars and working lamps turn the yard into a place.
- **Effects and settings:** impacts vary by surface, and there are tracers, casings, gore levels and reduce-flashing. The settings apply live and persist.
- **Systems:** Take all, Sort and hover-compare all work. Split goes into the backpack, and drops next to crates can be picked up. The inventory layout no longer jumps.
- **Menus:** the HUD is hidden in menus, F3 is off by default, Esc closes F1, and the small viewport works. Pausing mid-reload freezes it correctly.
- **Stability:** 0 console errors and 0 page errors across 11 sessions. 0 hitches in every perf case.
