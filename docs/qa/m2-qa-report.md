# M2 "Survival core" QA report (QA pass 5, before the user's playtest)

Date: 2026-10-16. Build: `main` @ ff712cf. Dev server: http://localhost:5188 (restarted by the lead at about 13:46). Test setup:
- Headed Chrome through Playwright (`channel: 'chrome'`), 1280×720, WebGPU.
- One window at a time, closed after each script.

**Thermal rules.** Every script imports `artifacts/qa5/gate.mjs`. The gate:
- starts a run only when FanKick's last line shows the CPU below 85 °C;
- forces a 60 s cool-down between Chrome runs;
- logs each run to `artifacts/qa5/thermal.log`.

**Heat during the pass:**
- **First block, 13:09–13:41:** stalled. Another session's Remotion and ffmpeg render held the CPU at 98–103 °C with no QA Chrome open. The dev server then went down.
- **Second block, 13:47–14:30:** 22 runs, each started at 52–84 °C. No crashes and no "Target crashed" errors. The console showed 0 page errors in every run.

**Scripts** (all in `artifacts/qa5/`; shots in `artifacts/qa5/shots/`, raw results in `j5-*.json`):
- `journey5.mjs <stage>` is the real-input journey. It uses pointer-lock mouse-look calibrated at 0.0022 rad/px, WASD/Shift/C/E/Tab/R/F/F5/F9/Esc, the hotbar keys 5–7, LMB/RMB, and double-clicks and drags in the inventory. Setup steps that use debug are commented `(debug)` in the script.
  - Its anim stage has a sampler that records bone data every rendered frame (about 144 fps):
    - **Foot slide:** the horizontal speed of a foot while it is planted (within 3.5 cm of its lowest height).
    - **Pops:** the largest rotation of any of 17 bones from one frame to the next. A pop is a frame over 18° that is also more than 3× the local median.
    - **Body turn:** the body yaw rate.
- These are copies of earlier scripts, with output redirected to `artifacts/qa5/`:
  - `journey4.mjs` (M1 regression);
  - `sys-build-shots.mjs`;
  - `perf.mjs`, set to 20 zombies per the lead;
  - `adapter.mjs`.
- `wall.mjs`, `gate-probe.mjs` and `melee2.mjs` are short probes written for bugs found during this pass.

## Summary and verdict

**Is M2 done per GAME_PLAN §M2? Yes, functionally.** Every M2 line works end to end:
- hunger, thirst and stamina;
- meds, eating and drinking;
- death and the body box (death bag);
- versioned saves with backups;
- day and night;
- settings and difficulty sliders.

The one gap is that **the day counter isn't visible anywhere except F1** (QA-086).

**Is it ready for the user's playtest? Yes, but fix 3 things first.** All three are small, and the user will hit them in the first few minutes:
- **QA-083 (P1):** eating, drinking and bandaging play with the gun still in hand. The character drinks from the rifle.
- **QA-082 (P1):** the player can walk up the range berm and over the north wall, out of the yard.
- **QA-084 (P2):** turning in place drops the rifle to a one-handed dangle and snaps the body at the end. This touches the user's points 1 and 2 directly: they will orbit the camera while standing.

**The user's 6 points:**

| # | Point | Result |
|---|---|---|
| 1 | The character doesn't rotate with the camera | **PASS** |
| 2 | The gun is tucked unless shooting | **PASS**, with a defect (QA-084) |
| 3 | Walking and zombie animation look natural | **PARTIAL** |
| 4 | The door is correct | **PASS** |
| 5 | Headshots do more damage | **PASS** |
| 6 | Survival and healing work | **PASS** |

**New bugs this pass:** 0 P0, 2 P1, 5 P2 (QA-070 reopened among them), 7 P3.

## The user's 6 points

### 1. The character no longer rotates with the camera: PASS

Real mouse orbit while standing, 30° steps, game camera (`sheet_o_orbit.png`, `j5-orient.json`). The body yaw stays put until the camera is 90° off, then a turn-in-place clip brings it round:

```
cam -30 body 0 | -60 body 0 | -90 body 0 (turn) | -120 body -90 | -150 body -90 | -180 body -90 (turn) | ... back: -60 body -88 | 0 body -88 (turn)
```

- **Moving faces the movement direction.**
  - Strafe left with A: body +90° from the camera.
  - Strafe right with D: −90°.
  - Back with S: 180°, so the body runs toward the camera.
- **RMB snaps to the camera:** from 167° off, the body is 2° off after 350 ms.
- **Head look works** (`o_headlook.png`).
- **Defect:** see point 2 and QA-084 for what the rifle does during the turn.

### 2. The gun is tucked unless shooting: PASS, with a defect

- **Rifle:** two-handed low-ready, muzzle down across the body. Checked from the side, back, 3/4 and front.
- **Pistol:** at the side, one hand.
- Shots: `c_rifle_low_*.png`, `c_pistol_low_*.png`, `sheet_c_rifle_walk.png`.
- **RMB raise:** `raiseT` goes 0.37 → 0.93 → 1 within about 6 ticks. On release it is back to 0 in about 16 ticks.
- **Hip fire, one LMB tap:**
  - Rifle: rises to 1 by 200 ms and is lowered by 670 ms.
  - Pistol: holds about 700 ms and is lowered by 1.15 s.
  - Rifle tap-fire may visibly bob (QA-089, P3).
- **Defect, QA-084:** during every turn in place the rifle drops to one hand, hanging muzzle-down by the right leg, with the left hand free. Seen in `sheet_o_tip.png` and `x_beacon.png`, and in the start of `sheet_a_use_bandage.png`. The user orbits the camera while standing all the time, so they will see this often.

### 3. Walking and zombie animation are smooth and natural: PARTIAL

- **Jog: natural.**
  - Planted-foot slide median is 0.08–0.13 m/s at a body speed of 3.47 m/s.
  - No visible pops, a clean heel strike, and the rifle sits naturally (`sheet_a_jog_side.png`).
- **Crouch and aimed strafe: good.** Strafe slide is 0.26–0.35 m/s.
- **Weaker areas:**
  - The aimed back-pedal skates (QA-087).
  - Sprint feet slide 0.35–0.64 m/s.
  - Turn in place pops (QA-084).
  - The use clips hold the gun (QA-083).
- **Zombies: good variety and believable from the front and side.** Each zombie has its own phase, a mix of arm-forward poses, a bent walk and a limp (`sheet_a_zombies.png`, `a_zombies_front_*.png`). One run of 10 chasers drew only 4 of the 11 walk gaits, 6 of them `z_walk_c` (QA-093).
- Full critique below.

### 4. The door is correct: PASS

- The house door fills its frame when closed.
- Opened with a real E press, it swings inward on the left-hand hinge, and no part of it sticks out through the wall (`d_ext_closed.png`, `d_ext_open.png`, `sys-b5-door-open.png`). It closes again with E.
- The prompt appears within about 1.9 m.
- My scripted walk-through didn't happen because the first E was pressed from 3 m. That was a script issue, not a game issue.

### 5. Headshots do more damage: PASS

Real ADS plus LMB at 10 m (`j5-head.json`, `sheet_h_*`):

| Weapon and zone | Damage | Result |
|---|---|---|
| Rifle, head | 168 | **8× the body shot (21)**. One-shots shamblers and workers: skull marker, gore pop, instant drop (`sheet_h_Digit1_head_worker.png`). |
| Rifle, head, soldier (helmet ×0.6) | 101 | Two headshots needed, as designed (QA-077). |
| Pistol, head | 122 | One-shots a shambler with the skull marker. Soldier takes 73. |

- 2 of 8 shots registered `world`. Both were the first shot right after a weapon switch, with the crosshair not yet on target, so this was script timing, not a hit-detection bug.

### 6. Survival and healing work: PASS

See the M2 section below. Everything was played with real input: hotbar keys and inventory double-clicks.

## M2 end to end

| Check | Result | Evidence |
|---|---|---|
| Needs drain, ×10 (F1 button) | PASS | Measured hunger −11.6 and thirst −17.4 per real minute; expected −11.1 and −16.7. |
| Drink and eat (hotbar 7, then 6) | PASS | 88/82 → 100/99 (`n_drinking.png`, `n_eating.png`). |
| Empty needs | PASS | "Starving" and "Dehydrated" chips; stamina regen ×0.85; 3 HP lost in 25 s; never instant death. |
| Bitten until bleeding (a debug-spawned zombie, real knife) | PASS | The first bite caused bleeding (90 HP, `b_bitten.png`). Bleeding takes 9.1 HP over 4 s. |
| Bandage (hotbar 5) | PASS | The bleed is cured, HP back to 100, bandages 3 → 2. The use bar shows. |
| Heavy bleeding, then medkit (inventory double-click) | PASS | 8.7 HP lost over 3 s; the medkit cures it and HP returns to 100. |
| Fracture (debug +) | PASS | Move ×0.8, sprint blocked (Shift held: speed 2.58 m/s, not sprinting); limp visible (`sheet_f_limp.png`). |
| Splint (double-click) | PASS | Fracture cured; sprinting works again at 5.75 m/s. |
| Infection (debug +) | PASS | Stage 1, and +1 in-game day gives stage 2. At stage 4: move ×0.85, stamina ×0.55, sway ×1.5. |
| Antibiotics at stage 4 | PASS, as designed | Not cured (cap is stage 2). But the pill is used up and the toast says ✓ (QA-085). |
| Antiviral at stage 4; antibiotics at stage 1 | PASS | Both cure. |
| Death to 6 zombies (real), Survivor penalty | PASS | Pack and held weapon go into the bag. The secure pouch is kept. |
| Bag marker after respawn | PASS | "Your bag 22 m" plus a 40 m light beacon (`x_beacon.png`). |
| Recover the bag | PASS | "Recover your bag" prompt, then Take all: the pack is worn again; the bag and marker disappear. |
| F5, reload the page, F9 (real keys) | PASS | Every field restored, the clock only advanced (`19.53 → 19.55`): position, HP 64, car position and HP 420, 3 corpses, 22 build pieces, needs 63/79, infection stage 3, fracture, day 3, equipment, inventory. |
| Export / import of `.zsave` | PASS | The download saved and imported into manual-3; the load succeeded. |
| Corrupted save fallback | PASS | Newest generation torn: F9 loads the previous one (thirst 80 as expected) and toasts "Loaded the previous copy." All generations torn: F9 fails gracefully and the state is unchanged. |
| Difficulty presets, live from the pause menu Difficulty page | PASS | Story 0.5/0.5/0.5, no infection, keep-all on death. Hardcore 1.5/1.5/1.25, hardcore death. Moving a slider switches the preset to "custom". Resume works. |
| Clock | PASS | Daytime runs 0.50 in-game hours per real minute: a 28 min day plus a 12 min night, per principles. |
| Day counter | **FAIL (QA-086)** | Fast-forward fires `newDay` (day 2), but the HUD shows no day or time. It only appears in F1 > Time. |
| Night lamps | PASS | 5 lamp lights on at 23:00, 1 at noon (`t_night_lamps.png`, from outside the wall; see QA-082). |

Not verified:
- **Damage interrupting a use.** `player.hurt()` from the console doesn't cancel the bandage, which is right for bleed ticks. A real zombie hit during a use was not tried.

## Content

| Check | Result |
|---|---|
| Backpacks | **PASS for 6 of 7**, worn by double-clicking them on the ground: small, school, hiking, military, ALICE, large hiking. The laboratory pack's tile was below the scroll, so the double-click missed: not verified. The ALICE pack shows 3 grids (6×6 main plus two 2×4 side pockets). |
| ALICE side pockets accept items | **Not verified.** The pocket grids sit below the visible scroll area, so the drag missed them. The grids exist (`eq:backpack:1`, `:2`). |
| Vest pouches take magazines only (real drags) | **PASS.** Rifle mag and pistol mag are accepted. Bandage, beans and loose 9 mm are refused with a red ghost. The admin pouch is a normal grid. Empty mag pouches show a hatch pattern (`v_vest_after.png`). |
| Themed loot, rolled 3× each | **PASS.** Loot matches the theme every time; the junk share stays small. Real E-hold on the yard crate, cabinet and duffel. See the table below. |
| Icons | **PASS.** All 44 of the 62 items that fit one grid render an icon, with no missing or broken images. The other 18 (bags and clothing) show icons in the equipment and ground panels. |
| Crowbar and hammer melee | **PASS.** Both kill a shambler at 1.0–1.8 m: hammer 120→90→0, crowbar 120→85→0 (`melee2.mjs`). A real-mouse crowbar run missed 12 swings at a wandering zombie 1.6 m away facing away; the follow-up probe shows the reach is fine. |
| Dropped item models | **PASS**, with QA-088. Rifle, can, bottle, box, soft bag and backpack models all appear, each with a pick-up prompt. Dropping the worn pack with right-click > Drop works. All backpacks render the same dark olive, so the tint doesn't read. |

Loot rolled from each themed container, 3 times each:

| Container | What rolled |
|---|---|
| Crate (tool box) | Planks, scrap, hammer, nails, duct tape, flashlight. |
| Cabinet (medical) | Painkillers, medkit, water, IFAK, bandage, energy bar. |
| Duffel (wardrobe) | Cash, rag, cloth, cargo pants. |
| Military crate (rolled via the debug path) | Pistol, 9 mm, 7.62, MRE, ammo tin, rifle mag. |
| Food cupboard | Beans, soup, tuna, water. |
| Car trunk | Water, duct tape, energy drinks, wrench. |
| Soldier body | Rifle mag, bandage, cash. |

## M1 regression

| Station | Result |
|---|---|
| Lockpick | PASS. One pick broke on purpose; found by sweeping (15:0 … 90:72 105:90); opened with picks 3 → 2. |
| Range | PASS. Rack open and Take all; 6/6 targets hit at 5, 25 and 80 m (plate and dummy); miss readout and ammo HUD shown. |
| Pen | PASS, 26/26 rifle hits through the chain-link. The pen gate prompt now needs about 1.9 m: the old 2.9 m journey spot gets no prompt (`gate-probe.mjs`). That is intended (aim-ranked, shorter interact); the script needed updating. |
| Corpse | PASS. "Search Soldier Body", 2 s hold, opened. |
| Car | PASS. 3 laps in 11–13 s each, minUp 0.95–0.98, 6–9 ramp-air samples, never tipped; the car took zombie damage; E exits. |
| Car repair | **FAIL. QA-070 reopened.** A zombie body under the player's feet at the hood shows "Search Body" while the crosshair is on the hood, so the repair never starts (`T_j09_hood_prompt.png`). |
| Build | PASS. Remove a wall (refund 3 planks / 4 nails), replace it (6/8 charged); the door opens on its hinge (`sys-b3`, `-b4`, `-b5`). |

## Bugs

| ID | Pri | Owner (folder) | Bug, repro, evidence |
|---|---|---|---|
| QA-082 | **P1** | environment (`src/world/yard/stations/range.ts`, `walls.ts`) | **The player can leave the yard over the north wall.** The range backstop berm slopes up to the wall. Sprint north at x = 8 from z = −94: y climbs 0.74 → 2.63 and the player ends up outside at z = −109 (`wall.mjs`, `wall_8.png`, `t_night_lamps.png`). At x = 40 and x = −60 the wall holds. Fix: a collider or a cap on the berm, or a taller wall behind it. |
| QA-083 | **P1** | mechanics (`src/gameplay/animstand/locomotion.ts`, `src/gameplay/weapons/weapons.ts`) | **Item-use clips play with the gun in hand.** The drink clip raises the rifle to the mouth, muzzle up (`sheet_a_use_drink.png`). Bandaging and eating keep the rifle pose and show no bandage or food (`sheet_a_use_bandage.png`, `sheet_a_use_eat.png`). Fix: holster or hide the held weapon for the use (as on a switch), and ideally attach the item model to the hand. |
| QA-084 | P2 | mechanics (`src/gameplay/player/facing.ts`, `animstand/locomotion.ts`) | **Turn in place loses the carry pose and snaps.** For the length of each `turn_left_90`/`turn_right_90` the rifle hangs one-handed, muzzle down by the leg (`sheet_o_tip.png`). When the clip ends, the body yaw jumps 90° in one frame. The sampler measured 90° in one frame, bones up to 76.6° per frame, and 4 pops in 266 frames. Fix: keep the upper-body carry layer active during the turn, and cross-fade the yaw hand-off. |
| QA-070 | P2 (reopened) | gameplay (`src/gameplay/interact/interact.ts`) and systems (body reach) | **A corpse at the player's feet takes over the "Repair car" prompt** even with the crosshair on the hood (`T_j09_hood_prompt.png`; repair 52 % → 52 %, kit not used). Fix: weight the aim ranking above the 1.4 m body reach, or ignore bodies behind or under the player. |
| QA-085 | P2 | systems (`src/systems/loadout.ts`, `installSurvival.ts`) | **Medical items are used up with no effect and still show a ✓ toast.** Antibiotics at infection stage 3–4; a bandage with no bleed at full HP. Fix: refuse with a reason ("Too far gone for antibiotics", "Not bleeding"), or at least toast "no effect". |
| QA-086 | P2 | UI (`src/ui/hud/survivalHud.ts`, `src/ui/menu/menu.ts`) | **No day counter or clock for the player.** `game.time.day` and `newDay` work, but the time only shows in F1 > Time. The M2 brief asks for a "day counter". Add "Day N · HH:MM" to the HUD (by the needs bars) or the pause menu, and toast "Day N" on `newDay`. |
| QA-087 | P2 | mechanics and asset (`src/content/data/anim.ts`, `tools/blender` retarget) | **The aimed back-pedal skates.** Planted-foot slide median is 0.67 / 1.27 m/s (left / right) at a body speed of 1.69 m/s, and the torso leans back about 15° (`sheet_a_aimback_side.png`). Sprint slides 0.35 / 0.64 m/s. Jog (0.08–0.13) shows the speed matching works, so the back-pedal clip's `speed` metadata or its foot locking is off. |
| QA-088 | P3 | systems and asset (`src/ui/inventory/pickups.ts`, `PICKUP_MODELS.tintKinds`) | **Dropped backpacks all look the same dark olive.** The school bag should read blue and the lab pack cream (`dr_models.png`). The tint isn't applied, or it multiplies an already dark texture. |
| QA-089 | P3 | mechanics (`src/content/data/player.ts`) | **The rifle drops quickly after hip fire.** After one LMB tap the rifle is down again in about 0.5 s (pistol about 1.1 s), so slow tap-fire bobs the rifle. Consider a 1–1.5 s hold after the last shot. |
| QA-090 | P3 | systems (`src/content/data/survival.ts`, `WOUNDS.bleeding.seconds`) | **Light bleeding stops on its own in 5–10 s.** In this run the bite's bleed ended before the fight did, which makes bandages close to pointless for light bleeds. This is a design tuning question (research note). |
| QA-091 | P3 | UI (`src/ui/hud/survivalHud.ts`) | **The needs bars are tiny and unlabelled.** An empty bar is dark on dark and almost invisible (`n_hud_empty.png`); the status chips carry the information. |
| QA-092 | P3 | narrative and text (`src/content/text/ui.ts`, `build.ts`) | **Stale and awkward text.** The menu tag still says "M1 · THE YARD". The salvage toast reads "Salvaged: 3 Wood Planks, 4 Box of Nails" (should be "4 Nails"). |
| QA-093 | P3 | mechanics (`src/gameplay/zombies`) | **Low gait variety in one spawn batch.** 10 chasers used 4 of the 11 walk gaits (6× `z_walk_c`). Use a shuffle bag instead of uniform random. |
| QA-075 | P3 (still open) | engine | **WebGPU runs on the AMD iGPU.** The adapter is `amd / gcn-5`, and FanKick logged "GPU asleep" for the whole perf run. See Perf. |
| QA-081 | P3 (fixed in QA scripts) | `artifacts/qa5` | Under Playwright, `?play` doesn't get pointer lock; go through the title menu's Play button. |
| QA-080 | P2 (environment) | lead | The dev server died mid-session (about 13:41). Heavy jobs from other repos (a Remotion render and ffmpeg) kept the CPU at 103 °C with no QA load. |

## Animation critique

Per-frame data from `journey5.mjs anim` (`j5-anim.json`), checked against multi-frame captures from the side, back, 3/4 and front.

| Motion | Body speed (m/s) | Planted-foot slide, median L / R (m/s) | Bone change per frame, median / max (°) | Pops | Verdict |
|---|---|---|---|---|---|
| Idle | 0 | 0 / 0 | 0 / 3.6 | 0 | Calm. The idle variants breathe. |
| Jog (forward blend) | 3.47 | 0.13 / 0.08 | 2.5 / 21 | 1 | Natural. Good arm swing, the rifle stays put. |
| Sprint | 5.40 | 0.35 / 0.64 | 4.2 / 29 | 1 | Slight skating at foot plant; acceptable at speed. |
| Crouch walk | 1.50 | 0.04 / 0.04 | 1.7 / 5.7 | 0 | Clean. |
| Aim walk forward | 2.07 | 0.34 / 0.27 | 2.2 / 18 | 1 | OK. |
| Aim strafe right | 2.09 | 0.26 / 0.35 | 2.1 / 8.6 | 0 | Good. Legs cross believably. |
| **Aim back-pedal** | 1.69 | **0.67 / 1.27** | 1.4 / 6.3 | 0 | **Skates**, and leans back about 15° (QA-087). |
| Fracture limp | 2.59 | 0.25 / 0.28 | 2.1 / 37 | 2 | The limp reads clearly. One pop when the fracture starts mid-stride. |
| Start, sprint, stop, reverse | – | 0.6 / 0.46 | 2.0 / 21.7 | 2 | Spring blends are smooth. The stop and reverse step is the roughest moment, but there are no big pops. |
| **Turn in place** (camera flick of 150°) | 0 | 0.48 / 0.07 | 1.2 / **76.6** | **4** | **Body yaw jumps 90° in one frame** at the clip end, and the rifle dangles during the turn (QA-084). |

**What reads well:**
- Locomotion speed matching on the forward set: jog and crouch feet stick.
- Spring-blended transitions.
- Head look.
- Lean.
- The low-ready poses from all four angles.

**What to fix before the playtest, in order:**
1. QA-083: the use clips holding the rifle. It looks like a bug immediately.
2. QA-084: the dangle and snap on turn in place.
3. QA-087: the back-pedal skate.

**Zombies:**
- Per-instance phase offsets and gait mix work; a crowd doesn't march in step.
- Variety in one batch is low (QA-093).
- Chasers run fairly upright and human-like; the `z_run_b` lurch reads more zombie-like than `z_run`.
- I could not measure foot slide on the crowd, which is instanced. By eye, from the front and side, there is no obvious skating at chase speed.

**Not seen:** arms clipping through the body or the backpack, in any view.

## Perf

- **Setup:** `perf.mjs` with 20 zombies per the lead (not 30). FanKick read 52–80 °C during the run, CPU load 4–19 %, and **"GPU asleep" in every status line**.
- **Adapter:** `navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })` returns `amd / gcn-5`, the integrated GPU, not the RTX. On AC power, battery at 93 %.
- **Frame time is pinned to vsync:** a 144 Hz panel gives 6.95 ms.

| Case | p50 / p95 / p99 (ms) | Draw calls | Triangles | sim / ai / anim / render (ms) |
|---|---|---|---|---|
| Idle, spawn | 6.95 / 6.99 / 7.01 | 73 | 239 k | 0.55 / 0.01 / 0.42 / 2.16 |
| Idle, build pad | 6.95 / 7.00 / 7.02 | 75 | 201 k | 0.40 / 0 / 0.48 / 2.12 |
| 20 zombies engaged | 6.95 / 6.97 / 6.99 | 70 | 310 k | 0.31 / 0.60 / 0.33 / 2.28 |
| 20 zombies, rifle fight (17 kills) | 6.95 / **13.82** / 13.89 | 63 | 294 k | 0.43 / 0.16 / 0.43 / 2.19 |
| Driving at 71 km/h | 6.95 / 6.97 / 6.99 | 71 | 228 k | 0.35 / 0.01 / 0.40 / 2.06 |
| Night, anim stand | 6.95 / 6.99 / 7.00 | 63 | 213 k | 0.50 / 0.01 / 0.53 / 2.14 |
| Night plus 20 zombies | 6.95 / 6.97 / 6.99 | 73 | 312 k | 0.29 / 0.57 / 0.36 / 1.97 |
| 30 s sprint traversal | 6.95 / 6.97 / 7.02 | – | – | 0 hitches; heap 113 MB |

- **CPU cost is tiny and inside budget:** sim and AI ≤ 1.0 ms, render submit ≤ 2.4 ms (budget 4 + 4 ms).
- **The fight case drops to 72 Hz for about 5 % of frames:** p95 is one vsync step. That fits the GPU fill load of gore and muzzle VFX on the iGPU.
- **Heap:** 83 → 166 MB over the session, falling back to 113 MB. No leak trend.
- **QA-075 still stands:** these numbers are for the iGPU. The RTX was never used (FanKick: GPU asleep).

## Not done or limited

- **Not verified, because the tiles or grids sat below the inventory scroll:** the laboratory pack equip and drags into the ALICE side pockets.
- **Fracture and infection were started from F1, not rolled from bites.** Their chances are 8 % and 15 % per hit, and repeated bites would have cost heat and time. Bleeding did come from a real bite.
- **The hold-to-interrupt on a real zombie hit during a use** was not run.
