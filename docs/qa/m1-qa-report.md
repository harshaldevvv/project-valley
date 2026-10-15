# M1 "the Yard": QA report

Date: 2026-10-16. Build: `main` @ d0a48f9, dev server http://localhost:5188, headed Chrome (Playwright `channel: 'chrome'`), 1280×720, WebGPU, 144 Hz panel. FanKick was running for the whole session.
Scripts: `artifacts/qa/*.mjs`. Screenshots (508): `artifacts/qa/shots/`. Contact sheets: `artifacts/qa/shots/sheet_*.png`. Perf JSON: `artifacts/qa/perf-a.json`, `perf-b.json`, `tour-perf.json`. Console log: `artifacts/qa/console.log`.

## Summary

**Verdict: M1 is playable end to end and mostly stable. It is not done yet.** Every station works in the browser. Across about 15 sessions the console showed **0 errors**; the only warning was Chrome's `powerPreference` notice. Away from zombies the frame rate holds at 144 fps, with p50 6.95 ms and roughly 30–90 draw calls. What keeps it short of done: a group of mechanics bugs that break the intended loops (finisher, run-over, entering the house, build keys), a first-person view with no arms, a camera that ends up inside the player's head, and a zombie crowd that is neither instanced nor safely within budget.

There are no P0 crashes or blockers. There are 13 P1 bugs and 24 P2 bugs.

**Top 10 issues**
1. QA-001: the camera collapses into the player's head near walls and the car. The inside of the head mesh then fills the screen.
2. QA-002: in build mode, the number keys select a piece and also switch weapons.
3. QA-003: you cannot walk into the prebuilt house. The 0.5 m foundation lip blocks the open door.
4. QA-004: the car passes through zombies at 50+ km/h without hurting them, and a zombie ends up standing on the roof.
5. QA-007: shove does not stagger, so the shove → finisher chain never triggers.
6. QA-006: the first-person view has no arms (the `chr_arms_fp` asset exists but isn't used), and the rifle and knife sit oversized and diagonal.
7. QA-009: 20 zombies cost 72–91 draws, measured p50 ran from 7 to 21 ms across runs, and AI reached 2.7 ms against a 2 ms budget. The crowd is not instanced (principles §13).
8. QA-005: zombies attack while the horde is set to "passive".
9. QA-008: zombie damage is very high. Five zombies took 90 HP in about 2 s, and 20 zombies killed the player in 5.3 s.
10. QA-010: death clips sink the character into the animation-stand pedestal until they vanish.

---

## Bugs

Each entry gives **id · area (owner)**, then steps → expected / actual, then evidence. Screenshot paths are relative to `artifacts/qa/shots/`.

### P0: broken
None found.

### P1: wrong

**QA-001 · Camera collapses into the player's head (src/gameplay/camera)**
- **Steps:** stand with your back about 2.3 m from a wall, e.g. `__gp.teleport(0,-97.5,π)` at the north wall or `(-35,-21.8,π)` at the loot depot wall. Or walk up to the car's driver door.
- **Expected:** the camera arm shortens to a safe minimum, and the body/head is hidden or faded when the camera is that close.
- **Actual:** the camera position equals the player position (`camPos == pos`, y 1.64). What you see is the inside of the head mesh: a brown capsule and two black boxes floating at the top of the screen. It happens every time near walls and at the car door.
- **Evidence:** `mv_camcol_wall_n.png`, `mv_camcol_loot_backwall.png`, `car_door_prompt.png` (sheet: `sheet_camcol.png`).

**QA-002 · Build-mode number keys also switch weapons (src/ui/build, src/gameplay/weapons)**
- **Steps:** press B, then 1/2/3/4 to choose Foundation/Wall/Doorway/Door.
- **Expected:** the digits only pick a build piece while build mode is active.
- **Actual:** the weapon HUD changes to "2 · SECONDARY", "3 · SIDEARM", "4 · MELEE", "1 · PRIMARY". You end up holding whatever slot matches the piece number.
- **Evidence:** `sheet_bld1.png` and `sheet_bld2.png` (bottom-right HUD in `bld_found_ghost`, `bld_doorway_ghost`, `bld_door_ghost`, `bld_offpad_ghost`).

**QA-003 · The prebuilt house can't be entered through its door (src/world/yard/house.ts, src/gameplay/player)**
- **Steps:** stand at (-43.4, 28.5) facing the east door, hold E (the prompt changes to "Close door", so the door opens), then press W.
- **Expected:** you walk inside.
- **Actual:** you stop at x = -44.68 on the 0.5 m foundation step, with no step-up or ramp. You can only get in by jumping or teleporting.
- **Evidence:** `door2_before.png`, `door2_after_hold.png`, `door2_inside.png`.

**QA-004 · The car doesn't run over zombies, and a zombie rides on the roof (src/gameplay/vehicles, src/gameplay/zombies)**
- **Steps:** spawn a zombie on the north straight at (40, 31), enter the car and drive into it at about 52 km/h.
- **Expected:** a kill or heavy damage plus knock-back, per GAME_PLAN M1 "run over a zombie".
- **Actual:** the zombie's HP stays at 150. It ends up standing on the cab roof (zombie y 1.53), stays there after the car stops, and attacks the player after you exit.
- **Evidence:** `car_zombie_0..3.png`, `car_lap_end.png`, `car_exit.png` (`sheet_car1.png`, `sheet_car2.png`).

**QA-005 · "Passive" zombies still attack (src/gameplay/zombies)**
- **Steps:** set `horde.passive = true` (F1 → Zombies → passive), spawn one zombie next to the player and hit it with the knife.
- **Expected:** no attacks while passive.
- **Actual:** the zombie enters `windup` and the player's HP drops. The red vignette and a halved health bar are visible during the melee test. After it was hit by the car, the zombie also attacked from the roof.
- **Evidence:** `sheet_mel.png` (HP bar drops across frames), `car_exit.png`.

**QA-006 · First-person viewmodel: no arms, oversized and diagonal weapons (src/gameplay/weapons, assets/chr_arms_fp)**
- **Steps:** press T with the rifle, pistol or knife held.
- **Expected:** FP arms holding the weapon in a natural low-right hip pose (art bible: FP weapons are 3–6k tris).
- **Actual:** there are no hands or arms. The rifle floats diagonally across the lower right, and its stock is a huge olive slab. The knife floats blade-up with a large box behind it. The `chr_arms_fp` asset (768 tris) is in the manifest but never shown. ADS looks fine.
- **Evidence:** `hand_fp_rifle.png`, `hand_fp_knife.png`, `gun_fp_hip.png`, `mv_fp.png` (`sheet_hands.png`, `sheet_guns4.png`).

**QA-007 · Shove doesn't stagger, so finishers never trigger (src/gameplay/melee, src/gameplay/zombies)**
- **Steps:** knife equipped, zombie 1.4 m away. Press V, then about 350 ms later press LMB.
- **Expected:** principles §5 says a 1.0 s stagger and a 1.5 m push, then a 0.8 s invulnerable finisher.
- **Actual:** straight after the shove the zombie's mode is `move`, not stagger. The LMB swing that follows is an ordinary swing: the zombie survives at HP 73 in `recover`. The shove also pushes it about 2 m away, out of knife reach.
- **Evidence:** `mel_shove_0..4.png`, `mel_finisher_0..7.png` (`sheet_mel.png`). Script output: `afterShove "A:move:73"`, `afterFinisher "A:recover:73"`.

**QA-008 · Zombie damage and pressure are far above §6 (src/content/data/zombies.ts, src/gameplay/zombies)**
- **Steps:** walk into the pen with 5 aggressive zombies. Separately, stand at the pen with 20.
- **Expected:** at most 3 attackers, with 0.5–0.7 s windups, so a crowd of 3 can be survived with good shove timing.
- **Actual:** 5 zombies took HP from 100 to 10 in about 2 s. 20 zombies killed the player in 5.3 s from spawn. With `attackDamage` 15, this means roughly 6 hits landed in 2 s, which suggests the attack-token cap or the windup isn't applied.
- **Evidence:** `z5_engage_*.png`, `death_*.png` (`sheet_z5.png`, `sheet_z20.png`).

**QA-009 · The zombie crowd is not instanced and its cost is unstable (src/gameplay/zombies, src/engine)**
- **Steps:** spawn 20 in the pen and stand at (40, -6).
- **Expected:** principles §13 calls for one InstancedMesh per archetype, AI ≤ 2 ms and p95 ≤ 16.6 ms.
- **Actual:** draws rise from about 30 to 72–91, so each zombie is its own skinned mesh. Over three runs: p50 was 6.99 / 13.65 / 20.7 ms and p95 was 14.0 / 14.1 / 34.9 ms. `anim` was 1.7–3.0 ms, `render` 4.4–13.5 ms and `ai` 0.5–2.7 ms (over its 2 ms budget in run 3c). With only 20 zombies this won't scale to the planned hordes.
- **Evidence:** Perf table below. Overlay visible in `z20_close.png`.

**QA-010 · Death clips sink through the animation-stand pedestal (src/gameplay/animstand)**
- **Steps:** at the animation stand, play `death`, then `z_death`.
- **Expected:** the body ends up lying on top of the pedestal.
- **Actual:** the survivor falls backwards and disappears below the pedestal top (an empty stand by frame 3). The zombie sinks waist-deep into the pedestal.
- **Evidence:** `stand_death_3.png`, `stand_z_death_1.png`, `stand_z_death_3.png` (`sheet_stand1.png`, `sheet_stand2.png`).

**QA-011 · Recoil doesn't auto-recover (src/gameplay/weapons)**
- **Steps:** rifle on auto, aim at the 25 m dummy, hold LMB for 1 s, release and wait 1.2 s.
- **Expected:** principles §3 says about 90% recovered within 250 ms.
- **Actual:** the player's pitch rose 1.3° and is still +1.3° 1.2 s later. A 30-round hold-down walks the shots into the sky (last shot "miss" at 606 m).
- **Evidence:** `pl_after_spray.png`. Script output: `recoilPitchDeg 1.3`, `recoilAfterRecover 1.3`.

**QA-012 · Death camera ends up inside the zombie crowd (src/gameplay/camera)**
- **Steps:** die to 20 zombies.
- **Actual:** "YOU DIED" is shown from inside the zombies' bodies. Torsos fill the screen and the camera clips through them.
- **Expected:** a pulled-back or raised death camera.
- **Evidence:** `death_1.png` (`sheet_z20.png`).

**QA-013 · Quick E taps are lost on interactables (src/gameplay/interact/interact.ts)**
- **Steps:** tap E faster than one 60 Hz tick (`keyboard.press`) on the house door.
- **Expected:** the door toggles.
- **Actual:** nothing happens. A 150 ms hold works. `Interact.step` reads `controls.down('interact')` rather than a latched press, so a down/up pair between two ticks is dropped. Car entry with F uses `pressed()` and works with the same tap.
- **Evidence:** script `3g-retest.mjs`: `afterTap "Open door"`, `afterHold "Close door"`.

### P2: polish

| id | area (owner) | steps → actual (expected) | evidence |
|---|---|---|---|
| QA-014 | src/ui/menu | Esc to pause doesn't call `exitPointerLock()`. While the lock is held, clicking Resume does nothing (mode stays `paused`). Release the lock on pause. | `dbg-resume.mjs` output; `menu_resumed.png` |
| QA-015 | src/ui/debug | With F1 open, Esc neither closes the panel nor pauses, and `input.blocked` stays true until F1 is pressed again. Esc should close the panel. | `ovl_debug_esc.png` |
| QA-016 | src/engine/perf.ts | The F3 perf overlay is on by default in play. It covers the top-left of every frame and the help overlay. It should be off by default. | any `tour_*.png` |
| QA-017 | src/ui/hud, src/ui/menu | After Quit to title (and during the station-jump fade), the HUD (health, stamina, weapon, range readout) and the perf overlay stay visible behind the title menu. | `menu_quit_0.png`, `menu_station_jump_0.png` |
| QA-018 | src/ui/hud, src/content/text/controls.ts | In the help overlay, "Mouse wheel" runs into "Select piece". The overlay sits under the perf overlay. H is bound to both Help and Horn. | `ovl_help.png` |
| QA-019 | src/ui/build/buildMode.ts | The build bar shows the raw id `wood_gable`, because `T.names` has no gable entry. | `sheet_bld1.png` |
| QA-020 | src/ui/hud | Toasts stack and repeat: "Empty — press R" ×3; "Something is already there" and "Needs support" together. They should dedupe or replace. | `gun_reload_tac_1.png`, `bld_walls.png` |
| QA-021 | src/ui/inventory/screen.ts | Shift-click split on Planks 20 says "No room" even though the Small Backpack has free 1×2 space. `splitInPlace` only searches the source grid. | `inv_split.png` |
| QA-022 | src/gameplay/interact, src/ui/inventory/pickups.ts | An item dropped at the crate can't be picked up with E: the crate's prompt ("Open Wooden Crate") always wins. It only shows up again in the inventory's Ground panel. | `world_dropped_item.png`, `inv_stored.png` |
| QA-023 | src/ui/inventory | Taking the guns from the rack makes the whole inventory layout jump left by about 140 px. Item tiles are flat colour blocks with roughly 8 px labels and no icons, hard to read at 1080p and below. | `gun_rack_open.png` vs `gun_rack_taken.png` |
| QA-024 | src/ui/menu | At 900×560 the menu's "Quit to title" overlaps the TIP line, and the Settings panel cuts off the subtitle ("…one"). | `menu_pause_settings_small.png` |
| QA-025 | src/engine (debug) + src/gameplay/index.ts | F1 → Teleport has near-duplicate entries in mixed case: "ZOMBIE PEN" / "Zombie pen (outside)" and "ANIMATION STAND" / "Animation stand". | `ovl_debug.png` |
| QA-026 | src/ui/hud | The "RANGE READOUT" panel shows everywhere in the yard, not only at the range. Its grey-on-dark text has low contrast. | `ovl_help.png`, `hand_tp_rifle.png` |
| QA-027 | src/gameplay/vehicles | The car-door prompt shows the E key glyph next to the text "Drive [F]". It should show one key. | `car_door_prompt.png` |
| QA-028 | src/world/yard/stations/loot.ts | The stacked crate is placed at y 0.6 on a crate 0.8 m tall, so it sits 0.2 m inside the lower one. It also can't be targeted on its own (the prompt stays on the lower crate). | `tour_loot_crates_close.png` |
| QA-029 | src/world/yard/stations/range.ts / assets/prop_weapon_rack_a | The weapon rack looks empty (no guns on it) even though it holds an AK and a pistol. The world doesn't show what you can take. | `tour_range_rack_close.png` |
| QA-030 | src/world/yard/signs.ts | Station sign subtitles (e.g. under "LIVE FIRE RANGE") are unreadable even from 3 m. | `tour_sign_range.png` |
| QA-031 | src/world/yard/ground.ts | The trees inside the wall have canopies at head height (1.4–1.7 m) with nearly black undersides. The camera passes through them because only the trunk has a collider. | `tour_under_tree_nw.png` |
| QA-032 | src/engine/timeofday.ts | Dawn and dusk give a flat tinted sky with no gradient or sun glow. At night (20.5 h and 23 h) the yard is close to black and has no light sources: the anim-stand lamp posts are unlit and there's no flashlight. | `sheet_tod_build.png`, `sheet_tod_range.png`, `sheet_tod_over.png` |
| QA-033 | assets/zmb_shambler_a | All 20 zombies are identical (same blue shirt, jeans and red wound). The crowd reads as clones. | `z20_close.png` |
| QA-034 | src/gameplay/zombies | Corpses splay their arms out wide and interpenetrate in a pile. | `z20_corpses.png` |
| QA-035 | src/world/yard/stations/pen.ts or assets/env_fence_chainlink_a | The pen corner post next to (52, -27) renders flat black while the other posts are grey (looks like bad normals or a backface). | `tour_pen_c.png` |
| QA-036 | src/gameplay/vehicles | On a hard corner the car wedges against the tyre stacks at the NE turn. The waypoint bot sat stuck for 55 s at 0 km/h with W held. Tyre stacks are immovable static colliders. Minor, but it can strand a new player. | `car_lap_end.png` |
| QA-037 | docs vs src/content/data/build.ts | The art bible says "base-building grid 1.5 m", but `BUILD.grid` is 3. One of the two needs updating. | — |

---

## Perf

Conditions: headed Chrome, 144 Hz vsync (6.94 / 13.9 / 20.8 ms are vsync steps), overlay hidden. Each case is 4 s after a 1 s settle. Two clean passes, (a) and (b), plus the zombie script run (3c). Budgets are from principles §13: p95 ≤ 16.6, p99 ≤ 25, draws ≤ 400, sim ≤ 3, ai ≤ 2, physics ≤ 2.5, render submit ≤ 5, ui ≤ 1.

| Scenario | p50 a / b | p95 a / b | p99 a / b | hitches | draws | tris | sim | ai | phys | anim | render | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Spawn idle | 6.95 / 6.95 | 7.18 / 7.24 | 13.9 / 13.9 | 0 | 46 | 203k | 0.7–0.8 | 0.01 | 0.35 | 0.4 | 3.3–4.2 | OK |
| Loot | 6.94 / 6.95 | 7.17 / 7.14 | 7.6 / 7.3 | 0 | 34 | 160k | 0.4 | 0.01 | 0.2 | 0.3 | 2.7–2.8 | OK |
| Range | 6.94 / 6.95 | 7.2 / 7.14 | 7.5 / 7.4 | 0 | 43 | 184k | 0.5 | 0.01 | 0.3 | 0.35 | 3.0–3.2 | OK |
| Pen (empty) | 6.95 / 6.94 | 7.2 / 7.14 | 7.5 / 7.5 | 0 | 29 | 211k | 0.6–0.7 | 0.01 | 0.3 | 0.4 | 3.2–3.5 | OK |
| Build pad | 6.94 / 6.94 | 7.19 / 7.18 | 7.5 / 7.4 | 0 | 55 | 173k | 0.5–0.6 | 0.01 | 0.3 | 0.4 | 3.5–4.0 | OK |
| Anim stand | 6.95 / 6.95 | 7.2 / 7.3 | 13.6 / 13.9 | 0 | 46 | 179k | 0.5–0.8 | 0.01 | 0.3 | 0.4–0.5 | 3.3–5.0 | OK (render at budget) |
| Track | 6.93 / 6.95 | 7.22 / 7.18 | 7.6 / 7.4 | 0 | 38 | 177k | 0.5 | 0.01 | 0.3 | 0.4 | 3.1–3.5 | OK |
| Inventory open | 6.94 / 6.95 | 7.26 / 7.21 | 13.9 / 13.9 | 0 | 46 | 203k | 0.5 | 0.01 | 0.25 | 0.4 | 3.4 | OK (ui 0.03) |
| Build mode | 6.94 / 6.95 | 7.26 / 13.8 | 13.9 / 14.0 | 0 | 54 | 172k | 0.3–0.4 | 0.01 | 0.3 | 0.4–0.5 | 3.3–4.1 | OK (build 0.3–0.5) |
| Driving (lap run 3f, 40–75 km/h) | 6.99 | 14.0 | 21.0 | 7* | 35 | — | 0.47 | 0.03 | 0.54 | 0.7 | 5.3 | OK; *hitches overlap screenshot bursts |
| 20 zombies engaged | 6.99 / 13.65 / 20.7 (3c) | 14.0 / 14.1 / 34.9 | 14.4 / 20.9 / 41.7 | 0–2 | 72–77 | 264–271k | 0.6–1.5 | 0.95–2.7 | 0.3–1.4 | 1.8–3.0 | 4.4–13.5 | **Over budget in 3c** (p95, ai, render): QA-009 |
| 20 zombies fighting (rifle) | 7.08 / 7.11 / 20.7 | 14.1 / 14.0 / 34.8 | 20.8 / 15.7 / 49.0 | 0–5 | 81–91 | 279k | 0.5–1.2 | 0.2–0.6 | 0.3 | 1.7 | 5.9–8.0 | Borderline, render over 5 |
| 30 s sprint traversal | 6.97 / 6.95 | 13.9 / 7.4 | 14.1 / 14.0 | 2 / 2 | — | — | — | — | — | — | — | 2 hitches > 50 ms (gate wants 0) |

Notes:
- Draw calls and triangles are far inside budget everywhere (≤ 91 draws, ≤ 280k tris).
- **`render` CPU is 3–5 ms with only 30–55 draws.** The overlay routinely reports "render … OVER 5" (e.g. 5.4–7.6 ms in tour shots). At about 3 µs/object this should be under 1 ms. The timer probably includes FXAA/post or GPU waits; engine-builder should split it out.
- The traversal pass had **2 hitches > 50 ms in both runs**. The §13 perf gate requires 0 over a 3-minute traversal.
- JS heap stayed at 65–120 MB.
- Per-station free-camera draws and tris: `artifacts/qa/tour-perf.json` (26–87 draws).

## Visual critique (art bible)

- **Theme consistency:** generally coherent stylized low-poly with one palette. Props (crates, cabinets, duffel, targets, bench, rack, tyres, cones, jersey barriers), the pickup, survivor and zombie all read as one set. Chamfers on man-made props are good (crates, cabinets).
- **Scale vs the 1.8 m player:** correct for the door (2.1 m), cabinets (1.8 m), bench (0.9 m), pickup (about 5.3 m) and fence. The house storey is about 3 m. No scale errors found.
- **Emptiness:** the yard is a 200 m green field with small islands. The loot pad, build pad and range have large blank concrete or dirt areas (`tour_high_top.png`, `tour_loot_a.png`). It doesn't yet look "abandoned in a hurry": there is no clutter, moss, rust decals, wear or graffiti. The art bible's decal atlas isn't used.
- **Floating, sunk or clipping:** the stacked crate interpenetrates (QA-028). Death poses sink into the pedestal (QA-010). Corpses interpenetrate (QA-034). A zombie stands on the car roof (QA-004). The car's origin rests at y -0.07 (wheels look right).
- **Z-fighting and flicker:** none seen on pads, road paint or lane lines in 60+ views. The track lines and the "START" box are clean.
- **Shadows:** stable, with no acne. The shadow box follows the camera; there is no visible cascade seam at eye height. Tree canopies inside the walls have almost black undersides (QA-031).
- **LOD:** no visible popping or holes during the 30 s traversal or the tour. Distant trees are merged and cheap, which is fine.
- **Lighting:** at noon it's flat but clean. Dawn and dusk have no sky gradient or sun disc, and the night is unreadable with no lights (QA-032). Per the art bible, "lighting does the heavy lifting", and that isn't happening yet.
- **Weirdly different:** the FP viewmodels (QA-006) are the most off-model thing in the build. Most lamp posts at the anim stand lean 5–10°, which reads like an error rather than decay; if it's deliberate, make it more pronounced on one or two posts. Wall pilasters on the perimeter lean at a few posts as well (`tour_hz_n.png`).
- **Text legibility:** the menu, tooltips and build bar are crisp. Sign subtitles (QA-030), inventory tile labels (QA-023), the HUD ammo sub-label ("RIFLE · AUTO · 100%") and the range readout (QA-026) are too small or low-contrast.
- **UI overlap:** the perf overlay overlaps the help overlay, the inventory heading and the debug panel area (QA-016). The HUD stays on under the title (QA-017). Menu overlap at small viewports (QA-024).

## What works well

- The title menu lives in the world with a smooth fly-over. Play blends into the player camera in about 1.6 s, and quitting to title blends back. The Settings sliders and toggles look polished (`menu_title_settings.png`).
- Movement feels good. Jog is about 3.1 m/s and sprint about 5.6 m/s, stamina drains and regenerates, crouch works, and vaulting the shooting bench while running works (`sheet_vault.png`). Shoulder swap and the TP/FP toggle are instant. You can't tunnel through walls or the gate.
- Guns: the weapon rack takes a ctrl-click quick-move that auto-equips into the right slots. An empty gun shows "Empty — press R". Tactical and empty reloads work. Semi/auto toggles. **Plates and dummies register hits at 5, 25 and 80 m for both rifle and pistol, with distance falloff** (rifle 40 → 30.6, pistol 32 → 20.8). Hit sparks and the range readout update.
- Zombies chase, attack and die cleanly to gunfire. Spawning 1/5/20 works. Death → "YOU DIED" → respawn at the spawn point with full HP works.
- Loot: searching with a hold of E works with a progress ring. Times are 2.6 s for crates, 3.5 s for cabinets and 2.1 s for the duffel, and reopening is instant. Items have readable tooltips with flavour text. Dropping to the ground panel and storing into a crate work. The context menu works.
- Build: removing a house wall refunds 50%, the wall can be placed back, a foundation, wall, doorway and door can be placed, off-pad placement is refused with a clear reason, and the green/red ghosts are clear. The door toggles with a held E.
- The car: entering and exiting with F, the chase camera, acceleration to 75 km/h, the horn, the trunk store/take ("PICKUP TRUCK BED"), and flip reset (R while driving, or the debug action) all work on a clean car.
- Stability: 0 console errors and 0 page errors across all sessions. Perf at every station is pinned at 144 fps.
