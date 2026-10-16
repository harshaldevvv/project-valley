# Character and zombie animation: mocap, retargeting, runtime

Research date: 2026-10-16. Scope: make the survivor and zombie animation look natural on our 24-joint contract rig
(`tools/blender/vrig.py`, A-pose rest, +Y forward, 30 fps), in three.js r186 WebGPU, under the zero-cost rule.

**Where we are now.** Every clip is a sine-gait function (`vrig.gait`, `zclips.py`). Smooth, but every cycle is identical,
the weight transfer is missing, and the arms are hand-tuned. The player plays clips through `AnimationController`
(`src/gameplay/animstand/character.ts`), which crossfades a base clip and adds additive upper-body clips. Body yaw comes
from `src/gameplay/player/facing.ts`: aim turns the body to the camera, movement turns it to the velocity, and a
turn-in-place starts past 100°. Zombies render through `src/engine/crowd.ts`. That renderer bakes bone matrices into a
texture, gives each instance one clip, a time and a timeScale, plus a crossfade source clip B with fade weight `wB` and a
whole-body tilt.

The single biggest gain is to **replace the sine gaits with retargeted motion capture**. The runtime layers in §3 then
fix the rest: feet on the ground, speed match, orientation and carry poses.

---

## 1. Free motion-capture sources (licence checked)

| Source | Licence (quoted) | Commercial game? | Format |
|---|---|---|---|
| **100STYLE** (Mason, Starke, Komura, 2022) | "This work is licensed under a Creative Commons Attribution 4.0 International License." The site adds: "For creative or commercial work please credit in an appropriate way." | **Yes**, with attribution and a note that it was modified | BVH, 60 fps, Xsens 28-bone, 1.5 GB zip on Zenodo |
| **CMU Graphics Lab** | "This dataset of motions is free for all uses." FAQ: "You may include this data in commercially-sold products, but you may not resell this data directly, even in converted form." | **Yes**. Don't redistribute the raw files | ASF/AMC/C3D at 120 fps |
| **cgspeed CMU BVH** (Bruce Hahne) | "CMU places no restrictions on the use of the original dataset, and I (Bruce) place no additional restrictions on the use of this particular BVH conversion." | **Yes** (CMU's no-resale rule still applies) | BVH, 120 fps, T-pose added as frame 0, MotionBuilder joint names |
| **Quaternius Universal Animation Library 1 and 2** | "Free to use in personal, educational and commercial projects." (CC0) | **Yes**. Only the **Standard** tier is free (UAL1 has 45 clips, UAL2 about 43). Pro costs $9.99 and Source $14.99, so they're out under our rule | FBX, glTF, OBJ, on Quaternius' own humanoid rig (keyframed, not mocap) |
| **Mixamo** (Adobe) | Adobe community FAQ: "free, with no licensing or royalty fees, for unlimited commercial or non commercial use"; "the only thing you can't do is distribute the raw character and animation files"; it can't be used for "training machine-learning models". | **Yes, with conditions**: needs an Adobe ID, which the user must create (an agent must not), and the raw FBX can never go in a public repo. The FAQ dates from 2022, when Mixamo was a "technology preview", so re-check the current Adobe terms before shipping | FBX |
| **Truebones** | Per the terms page (2019, as seen through search): royalty free "for any and all purposes even commercial"; "Re-Distribution or ReSale … in .FBX, .BVH … strictly prohibited"; credit requested. I couldn't open the full terms page directly | Probably yes. **Low priority**: the free drops are mostly animals or random batches, and the terms are unclear | FBX, BVH |
| **KIT Whole-Body Human Motion Database** | No licence on the site, only "© 2020 Copyright: KIT - H²T" and a request to cite. The MMM tools are GPL | **No**, not without written permission | C3D, MMM XML |
| **LAFAN1** (Ubisoft La Forge) | "Creative Commons Attribution-NonCommercial-NoDerivatives 4.0" — "for NonCommercial purposes only" | **No.** It is non-commercial, and retargeting it counts as a derivative | BVH, 30 fps |
| **Bandai Namco Research Motiondataset 1 and 2** | README: "CC BY-NC 4.0" for both datasets (MIT only for the Blender viewer script) | **No** (non-commercial) | BVH |
| **OpenGameArt** | No CC0 mocap zombie walk found. OGA's own guide calls CMU "the best CC0 source", which is loose wording: CMU isn't CC0, though it is permissive | No usable file found | — |

### Clip coverage (what actually exists)

**100STYLE.** Each of its 100 styles comes with forward walk (FW), forward run (FR), backward walk (BW), backward run
(BR), sidestep walk (SW), sidestep run (SR), idle (ID) and transitions (TR). The styles that matter for us:
- `Neutral` gives a full 8-direction walk/run set for the survivor.
- `Zombie`, `DragLeftLeg`, `DragRightLeg`, `LimpLeft`, `LimpRight`, `Drunk`, `Old`, `BentForward`, `Stiff`, `Depressed`
  and `Heavyset` give zombie gait variety.
- `Crouched`, `OnToesCrouched` and `InTheDark` give crouch walk and careful walk.
- `Swat` and `ShieldedLeft`/`ShieldedRight` may give a guarded upper body. I haven't seen these clips, so check them before relying on them.
- `Rushed` and `StartStop` give starts and stops.

No weapons, no melee, no deaths.

**CMU.** Trial numbers come from the site's search index:
- **Zombie and injured:** 104_41 ZombieWalk, 104_42 ZombieWalk8, 104_43 ZombieWalkRightAngleTurns, 104_03 Frankenstein
  walk, 104_13 StumbleWalk, 120_22 Zombie, 20_08/21_08 zombie march, and 105_09 (also listed as 91_09) DrunkWalk.
  Also 105_16 Limp, 105_24 HurtLegWalk, 105_26 HurtStomachWalk, 77_19–24 "limping, hurt right leg" and
  77_33 "creeping with limp".
- **Locomotion:** subject 69 (walks; trials 13–19 "turn in place", 39–42 walk backward plus turn), and 143/141 (run,
  run to stop). Subject 139 covers sneaking, wounded and looking around, with 139_05 "Pulling a Gun". Subject 77 covers
  careful and creeping walks.
- **Falls, crawl, gun:** 90_16 "fall on face", 111_03 crawling, 79_96 / 80_03 "shooting a gun".
- No rifle low-ready walk, no reload.

**Quaternius UAL Standard.** The pages list 8-direction locomotion, jog, sprint, crawl, death, "combat and gun", and
(UAL2) "zombie locomotion". I couldn't get a clip-by-clip list. Download it and list the clip names before planning
around it. This is our only CC0 source for **rifle/pistol idles, reload, melee, death**.

**Mixamo** has the most complete gun set by far: rifle and pistol locomotion, aim, reload, zombie walk/attack/death.
It's the fallback for weapon clips if UAL Standard falls short.

### Clip needs and best free source

| Clip | Source (first choice → fallback) |
|---|---|
| walk / run / sprint | 100STYLE Neutral FW/FR → CMU 69/143 |
| crouch walk | 100STYLE Crouched FW |
| strafe / back | 100STYLE Neutral SW, SR, BW, BR (mirror SW for the other side) |
| turn in place | CMU 69_13–19 → procedural (see §3) |
| idle variants | 100STYLE Neutral/Old/Depressed ID |
| rifle low-ready walk / aim walk | **No clean free mocap.** Use the Neutral walk legs + an authored upper-body pose + hand IK (§3) → UAL Standard / Mixamo |
| pistol walk | Same layering approach |
| reload, melee | UAL Standard → Mixamo → keep our code-authored ones |
| zombie shamble | 100STYLE Zombie FW, CMU 104_41/42, 120_22 |
| limp | 100STYLE LimpLeft/LimpRight/DragLeftLeg/DragRightLeg, CMU 105_16/24 |
| crawl | CMU 111_03 → our `z_crawl` |
| lunge attack | Not in the free sets. Keep code-authored, or use Mixamo zombie attack |
| stagger | CMU 104_13 StumbleWalk, 105_59 360 smallStumble |
| death | CMU 90_16 fall on face → UAL Standard death → our `z_death` |

### Rules / plan for our game
1. **Primary source: 100STYLE (CC BY 4.0).** Secondary: CMU through cgspeed BVH. Tertiary: Quaternius UAL Standard (CC0).
   Mixamo only if a weapon clip can't be built any other way, and only after the user has downloaded it themselves.
2. Do not use LAFAN1, Bandai Namco or KIT. This includes the orangeduck Motion-Matching demo data, which is LAFAN1.
3. Raw source files go in `assets/mocap/` and that folder is **git-ignored** (add it next to `assets/refs/`). CMU,
   Mixamo and Truebones all forbid redistributing raw files, so only our retargeted GLB clips are committed.
4. Credits (`docs/pipeline/asset-credits.md`), for every clip:
   - 100STYLE: "100STYLE dataset, I. Mason, S. Starke, T. Komura, CC BY 4.0, retargeted and edited".
   - CMU: "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding
     from NSF EIA-0196217."
5. First download (about 1.5 GB, user approval needed): the 100STYLE `100STYLE.zip`. Only these styles are needed:
   Neutral, Crouched, Zombie, LimpLeft, LimpRight, DragLeftLeg, DragRightLeg, Drunk, Old, BentForward, Stiff, Heavyset.

---

## 2. Retargeting in Blender 5.2, headless

**Tools.**
- **BVH import is built in.** `io_anim_bvh` stayed a bundled core add-on when 4.2 moved most add-ons to the Extensions
  platform. Call it with `bpy.ops.import_anim.bvh(filepath=..., global_scale=..., use_fps_scale=True,
  rotate_mode='NATIVE', axis_forward='-Z', axis_up='Y')`.
- **There is no built-in retargeter** in Blender 5.x. The native method is Copy Rotation constraints followed by a bake.
- **"Retarget" (KBS-DEV) on extensions.blender.org** is a GPL-3.0 fork of Expy Kit for Blender 5 and later. It has
  mapping presets, "Apply As Rest Pose", "Transfer Root Motion" and a constraint bake. GPL on a tool doesn't affect the
  data it outputs, but its operators are built for the UI. It's fine for inspecting a clip by hand; don't build the
  pipeline on it.
- **Rokoko Studio Live for Blender**: its retargeting is "not a paid feature", but the add-on is aimed at Rokoko's own
  streaming. Its licence badge is inconsistent (MIT vs LGPL-3.0) and it targets 2.80+ with no headless API. Skip it.
- **Auto-Rig Pro** is paid. Excluded.
- **Blender 5.0 API break.** `action.fcurves` is gone; channels now live under
  `action.layers[0].strips[0].channelbag(slot)`. `vrig.clip()` uses `keyframe_insert`, so it isn't affected. Any new
  script must not touch `action.fcurves`.

**Approach: our own `tools/blender/retarget.py`** (about 200 lines), reusing `vrig`'s rig, bake and export:

1. **Import.** Load the BVH into an empty scene with `global_scale` chosen so the source hip height matches ours
   (vrig hips are at about 0.95 m; measure the BVH's rest hips). Pass `use_fps_scale=True` so 60/120 fps land on a
   30 fps timeline.
2. **Bone map.** A dict per source, kept in `tools/blender/mocap_maps.py`.
   - Our 24 joints ← source: hips←Hips, spine←Spine (CMU LowerBack), chest←Spine1/Spine2, neck←Neck,
     head←Head, shoulder_X←XShoulder, upper_arm←XArm, forearm←XForeArm, hand←XHand, thigh←XUpLeg, shin←XLeg,
     foot←XFoot, toe←XToeBase.
   - Extra source joints are skipped: CMU LHipJoint, Neck1 and fingers, and Xsens' second spine joint, whose rotation
     gets folded into chest.
3. **Rest-pose-independent rotation transfer.** This handles our A-pose against the source T-pose (cgspeed puts a
   T-pose on frame 0; Xsens and 100STYLE have their own rest). For every frame and mapped bone, in world space:
   `Δ = Q_src_world(t) · Q_src_rest_world⁻¹` and `Q_tgt_world(t) = Δ · Q_tgt_rest_world`. Then convert to local with
   `Q_local = Q_parent_world(t)⁻¹ · Q_tgt_world(t)`, adjusted for the bone's rest. three.js `SkeletonUtils.retarget`
   uses the same world-delta idea. Two things make it correct:
   - Rest-pose differences cancel out because the transfer works on deltas.
   - The source rest has to be a true "same pose" reference. For cgspeed use frame 0. For 100STYLE, build a T-pose
     reference from its rest skeleton and put our rig into a matching T-pose before taking `Q_tgt_rest_world`: rotate
     upper_arm 45° up from the A-pose, then measure. This is the step that fixes the classic "arms stuck in the torso".
4. **Hips translation.** Copy the source hip motion scaled by leg-length ratio `s = our_leg / src_leg`, using
   thigh+shin length.
5. **Foot cleanup (foot skate).**
   - **Detect contacts:** a foot is planted when its ankle height is under 0.06 m and its horizontal speed is under
     0.25 m/s for at least 3 frames.
   - **Lock it:** during a contact, hold the ankle at its mean planted position.
   - **Re-solve the leg** with the analytic two-bone IK in `vrig._two_bone`, keeping the knee pole from the retargeted
     pose.
   - **Blend in and out** over 3 frames.
   - **Toe:** pin it during the heel-off phase with the same rule.
6. **Root motion → in-place loops.**
   - **Cut one cycle:** find two left-foot strike frames about one cycle apart, then choose the pair that minimises
     pose distance (sum of joint quaternion angle differences plus hip-height difference).
   - **Get the clip speed:** `v = Δhips_xy / T`.
   - **Remove the drift:** subtract `v·t` from the hips. Keep the lateral sway and vertical bob.
   - **Blend the loop seam:** crossfade the last 4 frames into the first so the vrig loop rule (last frame == first)
     holds.
   - **Normalise the phase:** rotate the cycle so the left heel-strike is at phase 0 in every locomotion clip. Blend
     spaces need this (§3).
   - **Record the speed:** store `v` in `src/content/data/anim.ts` as the clip's authored speed, e.g.
     `{ walk: { speed: 1.42, cycle: 1.07 } }`.
7. **Mirror.** Swap L and R and negate X to get the other sidestep, and limp variants from one side.
8. **Bake** through vrig's existing `Rig.clip()`-style loop: keyframe quaternions every frame at 30 fps, hips location only.
9. **Size.** Keep the vrig export flags (`export_force_sampling=True`, `export_optimize_animation_size=True`, which
   drops constant channels).
   - Rotation-only clips on 24 joints cost about 24 × 4 floats × 30 fps ≈ 11.5 KB/s, so 40 clips averaging 1.5 s come
     to about 0.7 MB.
   - If that grows, run `gltfpack -c` (meshoptimizer, MIT), which quantises and compresses animation tracks. Don't drop
     below 30 fps: the crowd baker samples at its own FPS anyway.
10. **Export** into the existing GLB (`chr_survivor_a`, `zmb_shambler_a`) with new names, keeping the old clip names as
    aliases until the code switches over.
11. **Verify** (project rule: visual checks). Render the vrig preview sheets plus a 4-angle contact-sheet per clip and
    check the following:
    - Max foot slide during a contact must stay under 2 cm/frame.
    - Feet must not go through z=0.
    - The loop seam's pose distance must stay under a threshold.
    Report all three.

### Rules / plan for our game
- One script, `tools/blender/retarget.py <bvh> <map> <clipname> [--loop] [--mirror] [--range a b]`, plus a batch file
  `assets/source/anim/clips.json` listing source file → clip name → range → flags. Run one Blender process per batch
  (thermal rule).
- Clip names: `loco_walk_f`, `loco_walk_b`, `loco_walk_l`, `loco_walk_r`, `loco_jog_f`…, `loco_crouch_f`, `idle_a`/`b`/`c`
  for the survivor; `z_walk_a` (100STYLE Zombie), `z_walk_b` (CMU 104_41), `z_limp_l`/`r`, `z_drag_l`/`r`, `z_drunk`,
  `z_old` for zombies.
- Every locomotion clip is in place, starts at the left heel-strike, and has its authored speed in `src/content/data/anim.ts`.

---

## 3. Runtime techniques in three.js

Ordered by value for effort. three.js r186 already ships `AnimationMixer`, additive clips
(`AnimationUtils.makeClipAdditive`), `SkeletonUtils.retargetClip`, `BVHLoader` and `CCDIKSolver`. For legs and arms
an analytic two-bone solver (law of cosines, about 40 lines) is better than CCD.

**3.1 Speed-matched locomotion blend space (1D, then 2D).**
- **1D blend:** nodes are idle 0, walk at its authored speed (about 1.4), jog 3.5, sprint 5.75 (`movement.*`). Weight
  the two neighbouring nodes linearly.
- **Phase sync:** all loco actions share one normalised phase φ, and each action's `time = φ · duration`. φ advances by
  `dt · Σ wᵢ / cycleᵢ`, so blended feet stay in step.
- **Speed match:** inside a node's band, `timeScale = actualSpeed / authoredSpeed`, clamped to 0.8–1.25. Outside that
  band the next node takes over. This alone removes most foot sliding.
- **2D blend (aim/strafe mode only):** 8 directions × walk/jog from 100STYLE Neutral FW/BW/SW. Use triangular
  (barycentric) weighting on the local velocity angle.
- **Back-diagonal pivot:** for back-diagonals, blend the B and S clips, and flip the hips to the forward set past ±100°
  of travel.

**3.2 Stride warping (cheap version).** When `timeScale` would leave 0.8–1.25 (for example a slowed zombie), scale each
planted foot's pelvis-relative horizontal offset by `speed / (authoredSpeed · timeScale)`, clamped to 0.85–1.2, and
re-solve with leg IK. Unreal's stride warp uses the same ratio (locomotion speed / root-motion speed).

**3.3 Foot IK and pelvis offset (player and skinned NPCs only).**
- **Ground hit:** raycast down 0.5 m from each ankle (Rapier, already a dependency) to get the ground height h.
- **Pelvis offset:** `min(h_L, h_R) − 0` (relative to the capsule's feet), clamped to −0.25…0 m and smoothed with a
  critically damped spring of halflife 0.06 s. Lower the hips by it.
- **Leg solve:** two-bone IK each ankle to `animatedAnkle + (h − pelvisOffset)`.
- **Foot alignment:** align the foot to the ground normal with `slerp` toward it, clamped to 25°.
- **Stairs:** the house steps are 0.167 m, under the 0.25 m pelvis clamp, so this works. Disable foot IK when airborne,
  vaulting or sprinting faster than 5 m/s.

**3.4 Inertialization (Bollo, GDC 2018) and dead blending (Holden).**
- **What it is:** instead of evaluating two clips during a crossfade, snapshot the per-bone offset (quaternion + angular
  velocity) from the old pose to the new one at the switch. Then decay that offset to zero with a critically damped
  spring and add it on top of the new clip.
- **Why:** the Gears 4 numbers showed the post-process is about 60% cheaper than blended transitions. Holden's
  "spring-roll-call" gives exact spring code; his "dead blending" extrapolates the old pose and cross-fades.
- **Our version:** a 100-line TS module storing 24 offsets, with halflife 0.08 s for upper body and 0.12 s for legs.
  Use it for one-shots (hit, fire, draw) and state changes (stand ↔ crouch). This stops the "pop and mush" of 0.2 s
  linear crossfades.

**3.5 Orientation: orient-to-movement vs orient-to-aim, and turn in place.**
- **The TPS convention:** in free roam the body faces the velocity, and the camera orbits freely. When the weapon is
  raised the body faces the camera and locomotion becomes the 2D strafe set.
- **`facing.ts` already does this.** Three refinements:
  - **(a) Turn-in-place via clips, not yaw sliding.** When standing and the camera is past the threshold, play
    `turn_l90`/`turn_r90` (CMU 69_13–19, or a procedural two-step version: rotate the hips with a spring and step each
    foot through IK). Drive body yaw from the clip's root rotation so the feet don't slide.
  - **(b) Lower the threshold to 70–90°** and let the upper body absorb the rest. Spine, chest and neck twist up to
    ±70° before the feet move.
  - **(c) Start/stop clips** (100STYLE StartStop) with distance matching are a later polish.

**3.6 Carry system (user request): low-ready rifle, low pistol, raise only to shoot.**
- **Layers:** legs and hips come from the locomotion blend. Spine-up comes from a carry pose (bone mask: spine,
  chest, neck, head, both arms). Aim offset and recoil are additive on top.
- **States and poses.** `rifle_low`: stock in the shoulder pocket, muzzle pitched down 35–40° and 15° across the body,
  both hands on. `pistol_low`: right arm extended about 20° forward of hanging, elbow 15–20° bent, muzzle down toward
  the ground about 1.5 m ahead, left arm free (it takes the locomotion arm swing). `rifle_aim` / `pistol_aim`: the
  current `aim_*`. Each pose is a single static pose authored in vrig (code poses are fine for static poses). The
  natural motion comes from the legs and spine underneath.
- **Raise logic:**
  - Fire input raises the weapon: rifle 0.15 s, pistol 0.10 s (ease-out).
  - The bullet goes on the first frame the muzzle is within 3° of the aim, or immediately with a spread penalty. The
    gunplay owner decides which.
  - Stay raised 0.8 s after the last shot or while ADS is held, then lower over 0.3 s.
  - Sprinting forces a "rifle_sprint" pose: muzzle up across the chest.
- **Hand IK:** the left hand two-bone IK goes to a `grip_fore` socket on the rifle every frame, with the elbow pole
  down and out. The right hand is parented to the weapon. Clips then never have to match the weapon exactly; vrig
  already has grip-socket logic (`grip_rest`).
- **Arm swing while low-ready:** almost none. Add a small upper-body counter-rotation (chest yaw ±4° at gait frequency)
  so the torso still lives.

**3.7 Aim offsets.** Procedural first: split camera pitch and yaw relative to the body across spine 0.25, chest 0.45,
neck 0.3 (pitch), and spine 0.3, chest 0.4, neck 0.3 (yaw), clamped to ±70° yaw and ±60° pitch. The current code puts
all pitch on the arms; this replaces it. Upgrade only if poses break: a 3×3 grid (yaw −60/0/60 × pitch −60/0/60) of
additive poses per weapon, blended bilinearly.

**3.8 Procedural lean.**
- **Turns:** roll toward the turn = `clamp(0.035 · v · ω, ±12°)` (v in m/s, ω in rad/s), on hips 0.4 and spine 0.6.
- **Acceleration:** pitch = `clamp(0.012 · a, ±8°)` in radians per m/s², forward when accelerating, back when braking.
- **Smoothing:** springs with halflife 0.15 s.
- **Zombies:** the same formula on the crowd `tilt` channel, which already exists.

**3.9 Head look-at.** `headLookDeg: 70` exists. Split it neck 0.4 / head 0.6, with a pitch clamp of ±40° and a spring
halflife of 0.1 s. Look at the camera's aim point, or at the nearest threat within 8 m when not aiming. Zombies on the
skinned path look at the player; crowd zombies can't (no per-bone offsets).

**3.10 Hit reactions and physical animation.**
- **Partial (alive):** each spine, chest, neck and head bone carries a damped angular spring (stiffness k=120,
  damping ζ=0.5). A hit adds an angular impulse along the hit direction, giving an 8–15° kick that decays over about
  0.3 s. The result is added after the mixer. This covers 90% of the "physical" look for zero physics cost.
- **Death:** full Rapier ragdoll on the skinned path, with 11 bodies: hips, chest, head, and upper/lower arms and legs.
  Use about 4 pooled ragdolls, initialised from the current pose and bone velocities, then frozen to static once
  asleep.
- **Crowd zombies on death:** swap to a pooled skinned ragdoll if inside 25 m. Otherwise pick one of 3–4 directional
  baked death clips.
- **Precedent:** Techland says Dying Light 2 uses physics as "the first choice for many hits", falling back to authored
  reactions, with up to about 1,000 hit reactions per Biter. We get variety from springs instead.

**3.11 Motion matching (Clavet, 2016; Holden, Learned Motion Matching, 2020).**
- **Feasible in the browser at our scale.** Take about 10 minutes of 100STYLE Neutral + Crouched at 30 fps: about 18k
  frames × 27 features ≈ 2 MB of features, plus about 7 MB of poses. A brute-force search every 0.1 s is about 0.5 M
  multiply-adds, under 1 ms in JS. Matching features: feet positions and velocities, hip velocity, and future
  trajectory at 0.33, 0.66 and 1 s.
- **An open JS reference exists** (OrpanAp/Motion-Matching-Playground, three.js r128), but it has no OSI licence
  ("educational use, and portfolio presentation"), so read it but don't copy it.
- **Learned Motion Matching** isn't needed at this size. Its reference implementation (orangeduck/Motion-Matching) is
  MIT, but the data it ships is LAFAN1 (non-commercial).
- **Verdict:** defer to a polish milestone, player only. The blend space, foot IK, inertialization and orientation
  above give most of the gain at a fraction of the risk. Naughty Dog moved TLOU2's NPCs, infected included, to motion
  matching (GDC 2021), which shows where the ceiling is, not what a browser game needs first.

### Rules / plan for our game
- Order of work: blend space with phase sync and speed match (3.1); carry layers and hand IK (3.6); inertialization
  (3.4); foot IK and pelvis (3.3); aim distribution and lean (3.7, 3.8); turn-in-place clips (3.5); spring hit
  reactions (3.10); ragdoll (3.10). Motion matching last, if ever.
- Every number above goes into `src/content/data/anim.ts` and is live-tunable from the F1 menu.
- The simulation stays plain data: capsule speed, yaw, aim state. The animation layer only reads it. Root motion never
  drives the capsule, except for turn-in-place yaw and vault/melee lunges, as today.

---

## 4. Zombie motion

**What reads as "natural zombie":**
- Asymmetry: one dragging leg, one arm that doesn't swing.
- Wrong timing: an irregular stance duty per leg, which `ZWALK` already approximates with `duty_R`/`duty_L`.
- Heavy upper body with lag: the head and arms follow the hips 100–200 ms late.
- Lean toward the target.
- **No two neighbours in sync.** In crowds, synchronised phase is the biggest tell. Varying phase and playback speed
  per instance costs nothing.

Industry notes (as far as public sources go):
- TLOU2 animated infected systemically through motion matching, including legless crawling when legs are shot off
  (Michal Mach's NPC reel).
- Dying Light 2 enemies are mocapped with actors and stunt performers, with physics-first hit reactions.
- Days Gone's GDC 2018 "Freak-O-System" talk is about AI and spawning. The horde's identity is "sheer numbers", so
  variety came from scale and behaviour.

Nothing public describes per-instance animation tricks in detail, so the rules below come from what our crowd renderer
can do.

**What the crowd renderer (`crowd.ts`) can vary today:**

| Lever | Status | Use |
|---|---|---|
| Clip choice | Yes | Pick from 6–8 walk variants per instance at spawn |
| Start time | Yes, after a small API addition | `play(i, clip, { t0 })`: random t0 in [0, duration) |
| Playback rate | Yes (`timeScale`) | 0.85–1.15 per instance, **and** move speed = authored speed × timeScale so feet don't skate |
| Whole-body tilt | Yes (`crowdTilt`) | Lean toward the target 6–12° pitch, ±4° roll wobble at gait frequency, set CPU-side |
| Scale | Yes (`def.scale`) | ±5% per instance |
| Persistent 2-clip blend | **Small shader change**: allow a steady `wB` and advance `tB` with the same normalised phase | Blend `z_walk_a` with `z_limp_l` at weight 0–0.5 for continuous limp severity. Matrix lerp is fine between similar poses. Cost: 3 matrix fetches per influence instead of 2 (the same as a crossfade today) |
| Bone-masked layering | **New engine feature**: a per-bone 0/1 mask (24 floats, uniform) picks row A (legs and hips) or row B (spine and up) per bone | 6 gaits × 4 upper bodies (reach both, reach one, arms dangling, one arm limp) = 24 looks from 10 clips. Same cost as the persistent blend |
| Additive twitch / noise per bone | **Not feasible** (matrices are model-space, not local; additive needs local transforms) | Bake 2–3 "twitch" one-shots (head jerk, shoulder spasm), play one every 3–8 s at random while idle or walking, crossfade 0.1 s |
| Bone texture memory | — | 24 bones × 4 texels × 16 B ≈ 1.5 KB per frame. 30 clips × 45 frames ≈ 2 MB. Adding variants is cheap |

### Rules / plan for our game
1. **Walk variants:**
   - `z_walk_a`: 100STYLE Zombie FW
   - `z_walk_b`: CMU 104_41
   - `z_walk_c`: CMU 120_22
   - `z_limp_l` / `z_limp_r`: 100STYLE LimpLeft/LimpRight
   - `z_drag_l` / `z_drag_r`: 100STYLE DragLeftLeg/DragRightLeg
   - `z_drunk`: 100STYLE Drunk
   - `z_old`: 100STYLE Old

   Plus idles: 100STYLE Zombie ID, Depressed ID and Old ID. All of these get the zombie arm and head treatment
   additively in Blender: bake the upper body from `zclips` onto the mocap legs at retarget time until engine masking
   lands.
2. **At spawn:** clip by weighted random (common shamble 40%, limp/drag 30%, drunk/old 30%), t0 random, timeScale
   0.85–1.15, scale ±5%. Per-variant (worker, soldier, civilian_f) weight tables in `src/content/data/zombies.ts`.
3. **Chasing:** move speed comes from the clip's authored speed × timeScale. Lean toward the target with
   `tilt.x = clamp(0.06 · speed, 0, 0.2) rad`. Steer yaw with a spring (halflife 0.25 s) so turns are lazy.
4. **Variety budget:** no two zombies within 5 m share both clip and |Δt0| < 0.2 s. Re-roll at spawn if they do.
5. **Engine features**, in order: `t0` option, persistent blend weight, bone-masked layering.
6. **Lunge, attack, stagger and death** stay one-shots. Add 2 directional stagger variants and 3 death variants
   (CMU 90_16 plus the existing `z_death`, plus one more). The crawl keeps `z_crawl`, or uses CMU 111_03 if it retargets
   cleanly.

---

## 5. Claude Code skills and MCP servers for mocap

| Name | Licence | What it is | Verdict |
|---|---|---|---|
| **blender-mcp** (ahujasid) | MIT | MCP bridge so an LLM drives a live Blender. Tools include `execute_blender_code`. The socket has "no authentication or encryption". No mocap-specific features | Not needed: we run Blender headless from scripts. Avoid the open socket |
| **TerminalSkills `blender-motion-capture`** | Apache-2.0 | Skill with bpy snippets: BVH/FBX import, name-map retarget, keyframe decimation. Notes the Blender 5 `action.fcurves` break, and that copy-per-frame retargeting "assumes matching rest poses" | Useful as a reference only. Our world-delta method (§2) is more robust |
| **xbishi/mocap-skills** | MIT | Video → Blender skeletal animation by silhouette matching (`h3-to-blender-mocap`) plus an IoU overlay scorer. Needs Blender 5.1+ with BlenderMCP. 0 stars, 4 commits | Too immature. The scorer idea (overlay IoU) is worth borrowing for visual QA |

No skills.sh listing for mocap or retargeting was found. Directory listings such as MCP Market's "Blender Toolkit"
(Mixamo retarget) and "Blender Motion State Inspection" exist, but I couldn't verify their licences, so I'm not
recommending them.

### Rules / plan for our game
- Don't install any of these. Write `retarget.py` ourselves, in project style. Optionally borrow the overlay-IoU QA idea
  for clip checks.

---

## Recommended pipeline

1. **Sources.** 100STYLE (CC BY 4.0) for all locomotion and zombie gaits. CMU/cgspeed for zombie, turn, stumble and
   death extras. Quaternius UAL Standard (CC0) for weapon idles, reload and melee if its clip list covers them. Mixamo
   only as a user-downloaded last resort for weapon clips. Raw files stay in git-ignored `assets/mocap/`.
2. **Retarget** (`tools/blender/retarget.py`, headless, one batched run):
   1. Import the BVH, scaled to our hip height, resampled to 30 fps.
   2. Map bones.
   3. Transfer world-space delta rotation against matched T-pose references.
   4. Scale hip translation by leg ratio.
   5. Detect foot contacts, lock them, two-bone IK.
   6. Extract the loop and strip root motion to in-place.
   7. Shift the phase to the left heel-strike.
   8. Mirror where needed.
   9. Bake 30 fps quaternions.
   10. Export into the existing GLBs.
   11. Write authored speeds to `src/content/data/anim.ts`.
   12. Render preview sheets and the foot-slide report.
3. **Runtime**, in order:
   1. Phase-synced, speed-matched 1D blend.
   2. Carry layers (low-ready rifle, low pistol, raise-to-fire) with left-hand IK.
   3. Inertialization.
   4. Foot IK and pelvis offset.
   5. Distributed aim and head look, plus lean.
   6. 2D strafe blend in aim mode.
   7. Turn-in-place clips.
   8. Spring hit reactions.
   9. Ragdoll.
4. **Crowd:** spawn-time variety now; then `t0`, persistent blend and bone-masked layering in the engine.

## Implementation list by owner

**asset-builder (Blender)**
1. Add `assets/mocap/` to `.gitignore`. After user approval, download 100STYLE.zip (about 1.5 GB) and the cgspeed
   files for subjects 69, 77, 90, 104, 105, 111 and 120. Log the credits.
2. Write `tools/blender/retarget.py` and `tools/blender/mocap_maps.py` (100STYLE Xsens map, cgspeed map). Run a
   rest-pose test on one Neutral FW clip and check it from 4 angles.
3. Survivor clips: `loco_walk_f/b/l/r`, `loco_jog_f/b/l/r`, `loco_sprint` (100STYLE Neutral FR, sped up and checked),
   `loco_crouch_f/b/l/r`, `idle_a/b/c`, `turn_l90/r90`, plus speeds in `anim.ts`.
4. Static carry poses on the survivor: `pose_rifle_low`, `pose_pistol_low`, `pose_rifle_sprint`. Keep `aim_*`. Add a
   `grip_fore` socket on rifles.
5. Zombie clips: `z_walk_a/b/c`, `z_limp_l/r`, `z_drag_l/r`, `z_drunk`, `z_old`, `z_idle_b/c`, `z_twitch_a/b`,
   `z_stagger_l/r`, `z_death_b/c`, with `zclips` upper-body overlays baked in.
6. List UAL Standard's clip names and report the weapon/melee coverage to the lead.

**mechanics-builder (runtime)**
1. `LocoBlend`: phase sync, speed-matched timeScale, 1D now and 2D in aim mode, numbers in `src/content/data/anim.ts`.
2. Carry state machine plus upper-body mask, left-hand two-bone IK, raise/lower timings (0.15/0.10 s up, 0.8 s hold,
   0.3 s down).
3. An inertialization module replacing `crossFadeFrom` for one-shots and state changes.
4. Foot IK with Rapier raycasts, plus pelvis offset.
5. Aim distribution across spine/chest/neck, head look-at split, turn/accel lean springs.
6. `facing.ts`: threshold to 80°, turn-in-place driven by clips.
7. Spring hit reactions, then a pooled Rapier ragdoll for deaths within 25 m.
8. Zombie spawn variety (clip weights, t0, timeScale, scale), speed = authored × timeScale, lean-to-target tilt.

**engine-builder (crowd renderer)**
1. `play(i, clip, { t0 })` for phase offsets.
2. Persistent secondary clip with a steady weight and phase-locked `tB`.
3. Bone-masked layering: a per-bone mask uniform choosing row A or row B (legs vs upper body).
4. Hand off from crowd to a skinned instance for ragdoll deaths and close-up look-at, pooled.
5. Perf report: matrix fetches per vertex, and bone texture size after the new clips.

## Sources

- 100STYLE: https://www.ianxmason.com/100style/ — "licensed under a Creative Commons Attribution 4.0 International License"; Zenodo record https://zenodo.org/record/8127870 (CC BY 4.0); paper https://arxiv.org/abs/2201.04439
- CMU Graphics Lab Motion Capture Database: http://mocap.cs.cmu.edu/ and http://mocap.cs.cmu.edu/faqs.php — "free for all uses"; "You may include this data in commercially-sold products, but you may not resell this data directly, even in converted form."
- cgspeed CMU BVH (mirror): https://github.com/una-dinosauria/cmu-mocap and https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/READMEFIRST.txt — "no additional restrictions on the use of this particular BVH conversion"
- Quaternius UAL: https://quaternius.com/packs/universalanimationlibrary.html, https://quaternius.com/packs/universalanimationlibrary2.html, https://quaternius.itch.io/universal-animation-library — CC0, "Free to use in personal, educational and commercial projects"
- LAFAN1: https://github.com/ubisoft/ubisoft-laforge-animation-dataset (license.txt: CC BY-NC-ND 4.0)
- Bandai Namco Research Motiondataset: https://github.com/BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset (CC BY-NC 4.0)
- KIT Whole-Body Human Motion Database: https://motion-database.humanoids.kit.edu/ (no licence; "© 2020 Copyright: KIT - H²T")
- Mixamo licensing FAQ: https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/m-p/13234775 ; https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html (403 to fetch; summarised by search)
- Truebones: https://truebones.gumroad.com/l/vlvPq (terms; royalty-free, no raw redistribution, credit requested; full text not retrievable)
- OpenGameArt search: https://opengameart.org/node/39277
- Blender core add-ons (BVH bundled): https://devtalk.blender.org/t/changes-to-add-on-and-themes-bundling-4-2-onwards/34593
- Retarget add-on (GPL-3.0, Expy Kit fork): https://extensions.blender.org/add-ons/retarget/
- Rokoko Blender add-on: https://github.com/Rokoko/rokoko-studio-live-blender ; https://support.rokoko.com/hc/en-us/articles/4410463481489
- Bollo, Inertialization (GDC 2018): https://www.gdcvault.com/play/1025165/Inertialization ; SIGGRAPH 2017 Gears 4: https://history.siggraph.org/wp-content/uploads/2022/09/2017-Talks-Bollo_High-Performance-Animation-in-Gears-of-War-4.pdf
- Holden: https://theorangeduck.com/page/spring-roll-call ; https://theorangeduck.com/page/code-vs-data-driven-displacement ; Unreal Dead Blending docs https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/AnimNode_DeadBlending
- Learned Motion Matching code (MIT, LAFAN1 data): https://github.com/orangeduck/Motion-Matching
- Motion matching in JS: https://github.com/OrpanAp/Motion-Matching-Playground
- Clavet, Motion Matching (For Honor): https://www.gameanim.com/tag/motion-matching/
- Unreal pose warping (stride / orientation warping): https://dev.epicgames.com/documentation/en-us/unreal-engine/pose-warping-in-unreal-engine
- TLOU2 motion matching (GDC 2021): https://gdcvault.com/play/1027118/Motion-Matching-in-The-Last ; Mach NPC reel: https://michalmach.artstation.com/projects/VgdAA8
- Dying Light 2 animation interview: https://3dvf.com/en/redaction/dying-light-2-stay-human-our-interview-with-techland-about-the-gut-feeling-update-focused-on-combat-animations-and-physics/
- Days Gone Freak-O-System (GDC 2018): https://gdconf.com/news/study-ai-freak-o-system-sonys-days-gone-gdc-2018 ; https://blog.playstation.com/?p=210452
- blender-mcp: https://github.com/ahujasid/blender-mcp (MIT)
- TerminalSkills blender-motion-capture: https://terminalskills.io/skills/blender-motion-capture (Apache-2.0)
- xbishi/mocap-skills: https://github.com/xbishi/mocap-skills (MIT)
