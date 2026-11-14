# Overnight visual overhaul, 2026-11-13

> **Owner verdict after testing (2026-11-13):** the AI-generated characters were worse than the originals (hands, rigging, first/third person). They are reverted (commit `80c8605`). Policy from now: local 3D generation only for simple props (plain walls, blocks, basic environment); characters, vehicles and other complex models come from code/Blender scripts or open-source models (the owner's "Polyfolk Catalog" repo, 3,000+ models, location still to be given). Items 12-14 and 22 below that describe the AI characters are historical.

Branch `overnight/visual-overhaul-2026-11-13` (not pushed, not merged). Audit: `docs/audit/2026-11-13-audit.md`.
Screenshots: `docs/audit/screenshots/before/` and `.../after/` (contact sheets `before_sheet.png`, `after_sheet.png`) (same camera spots, `tools/audit/shots.mjs`). Contact sheet of the before set: `before_sheet.png`.

## What changed
1. **Post look** (`src/engine/post.ts`): bloom on HDR highlights, contrast and saturation, warm-highlight / cool-shadow split tone, vignette, film grain, red edge pulse on `playerDamaged`. Tunables live in `post.look`; `post.settings.look` turns it off.
2. **Surface detail** (`src/engine/palette.ts`): four z-image-turbo textures (grass, dirt, concrete, grime) sampled in world space at two scales as luminance-only multipliers on the shared palette material. Ground, walls, pads and props all gain texture while keeping the palette hues. Walls darken at the foot (fake contact AO). Zero new draw calls.
3. **Sky** (`src/engine/sky.ts`): drifting fractal-noise cloud layer, lit on the sun side, dims stars at night.
4. **Clutter** (`src/world/yard/clutter.ts`): about 20k wind-swayed grass tufts on grass patches (shrink with distance) and 90 rocks.
5. **Sixteen AI props** (`src/world/yard/genProps.ts`, models in `public/assets/models/gen/`): wrecked sedan, burned van, tent, campfire, sandbags, barrels, crates, generator, pallets, dumpster, tire pile, sofa, two shipping containers, a watchtower, dead trees and 12 overgrown bushes, placed as a survivor camp, a junk corner and wall dressing, each solid one with a rotated box collider. Pipeline: z-image-turbo picture, Hunyuan3D-2.1 textured mesh, Blender decimate / fit / 512 px textures (`tools/audit/fit_glb.py`). 3-6k triangles and about 0.4 MB each.
6. **Ambient occlusion** (`post.ts`): half-res GTAO from the depth buffer. Whole look chain (AO, bloom, grade) measured at 1.18 ms GPU vs 1.02 ms with it off on the 4090 (`tools/audit/gpums.mjs`).
7. **Zombies** (`crowd.ts`): bind-pose grime, dirt toward the feet and dried blood from the AI grime texture. World-space detail is on static geometry only (a first version made zombies render white and swim; caught in review and fixed).
8. **Zombie hit flash:** a white emissive pulse on every bullet or melee hit (new per-instance flash channel in the crowd renderer).
9. **Held gear and survivor:** weapons get object-space scratches and glossier dark metal; the survivor gets bind-pose cloth wear, boot mud and dust.
10. **Ambient motes** (`motes.ts`): dust and pollen by day, fireflies at night, one instanced draw computed in the vertex shader. Night ambient lifted slightly.
11. **Wall decals** (`wallDecals.ts`): eleven AI-generated spray-paint, stencil and chalk pieces on the perimeter wall (white becomes transparent in the shader).
12. **Distant buildings** on the hills outside the walls (barn, two ruined houses, gas station, church, water tower, silo; AI-generated, no colliders) so the horizon has landmarks.
13. **Flashlight (L)** (`engine/flashlight.ts`): warm spotlight along the view, always present so no shader recompiles; dimmer by day. The item existed but did nothing before.
14. **AI hill trees** (`aiTrees.ts`): pines and birches within 150 m of the walls are instanced AI models (1.4-1.6k tris) instead of cone trees; farther ones stay in the cheap kit. An autumn variant is shipped but unused (it decimates to a dark blob).
15. **Loading screen key art** (z-image-turbo): the survivor facing the wall and the horde on the hill; boot screen now prefetches the AI models with real progress and loads them in parallel.
16. **Death screen:** display type, slow letter-spacing fade-in, desaturated veil.
17. **Pass 3 small items:** per-def head hit ball so headshots land on the shorter AI bodies (checked by shooting at 1.38 m and 1.55 m), footstep dust on jog/sprint and dust on landings, sun shafts (half-res godrays, about 0.2 ms, subtle), natural skin tone and cloth wear on the first-person arms.
18. **Graphics settings:** Settings menu now has Cinematic look, Ambient occlusion and Sun shafts toggles; passes that are off are left out of the render graph, so they cost nothing (about 0.15-0.2 ms each on the 4090).
19. **Ruined cabin with a walk-in interior** (`cabin.ts`, west lawn at -72,-36): door, windows, half-collapsed roof, fallen beams, table, shelf, plus the AI sofa, crates and barrels inside; all with colliders.
20. **Bug fix:** swapping away from the knife mid-swing used to throw `reading 'active'` every sim step (seen once on a cold start); the swing now aborts. **FP rifle stock** fixed via `fpArms.hipOffset` (the rig offset), the stock now leaves the frame.
21. **Audio:** stable-audio3-sfx made melee swings (the game had no file for them), flesh impacts, a headshot crack and a body fall, mixed into the existing hit sounds. ACE-Step made an explore and a combat score, loop-crossfaded; they are opt-in with `?music=ai` because I could not listen to them. **Please listen and decide.**
22. **New characters, rigged and animated (the biggest change):** the player survivor and eight new zombie variants (civilian, hazmat, soldier, nurse, worker, police, hoodie, suit) are AI-generated and skinned to the game's *existing* rig: z-image-turbo A-pose picture, Hunyuan3D-2.1 textured mesh, then `tools/audit/retarget_char.py` in Blender (fit to the rig, skin weights copied from the original mesh by nearest surface, LOD0/1/2, collision box). The survivor keeps all 40 clips and the backpack node; zombies borrow the shambler clips and render through the GPU crowd renderer with their own baked textures (crowd and model loaders now keep a mesh's own texture). Spawn mix favours the new zombies. 30 zombies still hold 60 fps.
23. **Inventory:** display type, amber edge, soft entrance, hover feedback.
24. **HUD** (`src/ui/hud/hud.ts`): same type and accent as the menus, glass backing for bars and ammo, bevelled bars.

## Incident
Removing my temporary comparison worktree (it linked `node_modules` by junction) deleted part of the real `node_modules` (`.bin` was gone). Restored with `npm ci` from the lockfile; tests and build pass. Nothing in the repo was affected.

## Tested
- `npm test`: 49 pass. `npm run build`: passes.
- Played in Chrome (WebGPU, RTX 4090) with Playwright through 19 camera spots, inventory, pause, debug panel, day and night. Console: only the two known warnings, no errors.
- WebGL2 fallback (`?webgl`) boots and renders with the full look chain, no errors. Death and respawn, flashlight, combat and sprint were played in the browser.
- Not tested: the production build in a browser, a high-refresh or laptop GPU.

## Frame rate (`tools/audit/perf.mjs`, 4 s per scene, 1280×720)
This monitor is 60 Hz and vsync-capped, so p50 is 16.67 ms before and after in all six scenes, 0 hitches, p99 under 17.1 ms. That proves no regression at 60 fps; it does not show the remaining headroom. Cost went up in triangles, not draw calls.

| Scene | Draws before / after | Triangles before / after |
|---|---|---|
| Spawn | 73 / 98 | 239k / 782k |
| Range | 67 / 91 | 220k / 757k |
| Build pad | 75 / 98 | 201k / 732k |
| Track | 60 / 83 | 251k / 786k |
| 30 zombies | 70 / 94 | 327k / 865k |
| Night | 68 / 92 | 215k / 753k |

All under the 1.5M triangle and 400 draw-call budgets. Raw: `docs/audit/perf-before.json`, `perf-after.json`.

24. **Weather** (`engine/weather.ts`): rain showers on a deterministic per-day schedule (about one day in three, 2-5 game hours), eased in and out over about 12 s: shader-driven streaks (one instanced draw), tighter fog, softer grade and exposure, a stable-audio3-sfx rain loop, more wind, fewer birds. F1 > Weather has Rain on / off / Follow schedule. AI trees now sway in the wind.

25. **Damage direction indicator:** the existing wedge is now larger and brighter with a glow (checked with an attacker to the right).

26. **Asset compression** (`tools/audit/compress.mjs`): AI GLB textures to WebP (512 px, 768 px for buildings) and meshopt geometry; detail textures, decals and key art to WebP. 27.2 MB -> 9.4 MB. Measured on the dev server at 50 Mbit/s with no cache: 57.0 MB transferred and 15.2 s to ready before, 39.6 MB and 12.2 s after (dev server is unminified, so the production gain is the same 18 MB). Originals kept in `assets/gen/orig` (git-ignored). Decal pools raised to 160 bullet / 96 blood with a 75 s life (they were 64 / 32, 30 s).

27. **Crows** (`birds.ts`): nine flapping silhouettes circling over the yard by day, fading out at night; one instanced draw, motion in the vertex shader. Zombie deaths play at varied speeds.
28. **Decision, not done:** I did not remodel the first-person rifle. It is already a scripted AK (`assets/source/wpn/wpn_rifle_a/build.py`, with the separate `MAG` node and sockets the reload clips need); the stock problem was the rig offset (fixed in pass 4), not the mesh. A better-looking hand remodel would be a large Blender job with unclear return.

29. **Three enterable interiors with loot** (`cabin.ts`): the cabin now has a food cupboard and a tool crate; a corner shop with a fuel canopy and pumps (66,-62; counter, shelves, food and medical cabinets, a crate) and a farmhouse room (-70,62; table, stove, bed, wardrobe, cupboard, duffel). All searchable through the normal container system (loot tables by type) and solid.
30. **Reactions:** heavy gun kills blow the corpse back off its feet (short ballistic hop), heavy non-lethal hits shove the zombie a step back, headshots still drop instantly. Reload and draw now have view kicks (magazine seat, bolt slam, weapon settle).

31. **UI micro-interactions:** low-health heartbeat (below 35 %, lub-dub speeding up as health falls, synth sound) with the vignette pulsing in time, toast entrance animation, menu button press, inventory drag glow and tilt.
32. **Wind gusts** (`engine/wind.ts`): one shared gust value drives the tree sway and the wind loop volume, so a gust is seen and heard together.
33. Re-audit written into the audit doc, with a re-ranked weak list (night look first).

34. **Night look:** brighter cool moonlight and ambient, lighter fog tint, a flickering camp-fire point light (`fires.ts`).
35. **AI trees fixed and extended:** the pine and birch instances were rendering at about a quarter size (meshopt keeps the real size in a node scale; instancing the raw geometry lost it). They now bake the transform into float positions and are full size. The trees inside the walls are AI pines and birches too, replacing the dark cone kit.
36. **Worn ground** (`worn.ts`): trampled dirt patches along every spawn-to-station path, at the interior doors and round the fire; one instanced draw.
37. **Characters:** the oversized AI heads are shrunk about the neck joint (weights from the head bone) in `retarget_char.py` (`HEAD_SCALE`, default 0.84); all nine models re-skinned and recompressed. I did not repaint face textures (no UV-aware painting path tried).
38. **Camera kicks and inventory drag, checked:** a recorded reload measured fov kick 0.25 and punch 0.17 degrees (too faint to feel), so the kicks are about 1.6x stronger now (0.4 / 0.29). The inventory drag shows the lifted item glowing and tilted (screenshot `56_drag.png`).

**Frame rate, before and after pass 7** (`tools/audit/perf.mjs`, vsync-capped 60 Hz so p50 is 16.67 ms in every scene, 0 hitches, p99 under 17 ms both times):

| Scene | Draws before / after | Triangles before / after |
|---|---|---|
| Spawn | 131 / 133 | 725k / 766k |
| Range | 122 / 124 | 689k / 731k |
| Build pad | 139 / 141 | 724k / 766k |
| Track | 114 / 116 | 694k / 735k |
| 30 zombies | 141 / 140 | 836k / 872k |
| Night | 116 / 118 | 588k / 629k |

GPU time per frame on the 4090 with every effect on: about 1.5 ms (`gpums2.mjs`, noisy by about 0.3 ms between runs).

39. **Character faces:** finding: the faces were already in the AI textures (eyes, mouth, wounds visible in a flat front render, `tools/audit/render_front.py`); they looked blank because I had cut character textures to 512 px. They now keep 1024 px (about +0.3 MB each), and the faces read in game. No repaint with Qwen-Image-Edit was needed; no extra GPU job ran for this.
40. **Night:** a cool shadowless rim light opposite the moon (edges on figures and props), and a visible flashlight beam (an additive cone, one draw) that reads as fog in the light.
41. **Path edges** softened with a gravel scatter on both sides of every path (`worn.ts`).
42. **FP arms smoothing: tried, not shipped.** `tools/audit/smooth_arms.py` subdivides the skinned arms in Blender, but with the palette-swatch UVs the subdivided faces produce a camo pattern on the sleeve; the original arms are unchanged and the script is kept as a tool.
43. **Regression sweep** (all scripts in `tools/audit/`, run after the last change, zero console errors): reload and weapon swap, melee swap mid-swing, rain, interiors and loot (opened a shop cupboard through the real container UI), headshot zones (noisy, see notes), death flings (corpses land flat), inventory drag, settings, WebGL2 fallback, night, low health, combat, sprint dust, crows.

Frame rate after pass 8 (vsync-capped; p50 16.67 ms in all six scenes, 0 hitches): draws 118-144, triangles 632k-880k. GPU about 1.65 ms with everything on (about 1.3 ms with the look chain off), 4090.

44. **Headshots, deterministic** (`tools/audit/headtest2.mjs`, synchronous rays on every variant, two directions, heights 1.0-1.7 m): the body capsule was shadowing the lower head ball, so head shots at 1.3-1.4 m returned body. Capsule hits within the head's height band now count as head. Result: AI variants return head for 1.3-1.5 m and body for 1.2 m and below, 100 % in this test; the old shambler, worker, civilian_f and soldier models return head from about 1.5 m. Heads above about 1.55 m miss (hair/hat tips only).
45. **Night fill:** lighter cool hemisphere and ground tint; ground and walls now read a dark blue-green away from lamps.
46. **Character detail overlay:** fabric/skin micro detail and grime from the grime texture, in UV space, on the survivor and all AI zombies (`characterDetail` in `palette.ts`).
47. **FP arms smoothing: second try also failed** (re-assigning flat swatch UVs per child face still leaves the checkered sleeve, my child-face ordering assumption is wrong). Shipped arms unchanged. A bake-to-texture approach would be the real fix.
48. **Scripted playtest** (`tools/audit/playtest.mjs`, no god mode): a 14-zombie wave killed with 0 damage taken and no errors, then dusk. It is an aimbot, so it only proves nothing breaks and that the wave is too easy for a perfect shooter; it cannot tell what feels bad to a human. **Please play it.** I made no feel changes from it.

49. **Polyfork catalog replaces the AI 3D props, buildings and trees** (owner's call, 2026-11-13). Source: https://polyfork.dev (index repo `lucas-martinic/polyfork-catalog`, 3,293 free hand-built low-poly GLBs, CC BY 4.0 option used and credited per model in `CREDITS.md`). 24 models in `public/assets/models/pf/` (3.0 MB total): tent, generator, sandbags, drums, sedan, dumpster, pallet, dead tree, delivery truck, container, lookout tower, tyres, ammo crate, campfire, sofa, bush, barn, farmhouse, fuel depot, church, water tower, silo, pines, birch, oak. `pfModels.ts` rescales each to a target height; `genProps.ts` places them with the same colliders; `aiTrees.ts` (name kept) instances the trees with wind sway. Deleted: the old Hunyuan props and AI zombie GLBs. 12 more Polyfork models were inspected: characters (zombie, ghoul, police, worker), a pickup truck and a rifle load and look right in the engine.
    **Not done yet, needs a decision (see the end of the final message):** Polyfork characters are rigged on a Mixamo-named skeleton with only Idle, Walk and Run (plus any one of 44 CC0 clips); this game's rig and 40 clips use different bone names, so using them as the player or zombies means retargeting our clips onto their skeleton.

50. **Drivable truck is the Polyfork pickup** (`tools/audit/pf_vehicle.mjs` converts it: front toward -Z, wheels as pivoted `WHEEL_*` empties, driver/door/trunk sockets, vertex colours kept). Verified in the browser: enters, drives to 108 km/h, steers, suspension settles, first-person view works. The original procedural truck file is still in the repo for rollback (`vehicles.ts`).
51. **One art style:** Polyfork props, buildings and trees now use a shared world-detail material (same grass/dirt/concrete/grime detail as the palette world, 12 % desaturated, lifted blacks) so flat hand-made models and the textured ground read together.
52. **Set dressing** (`dress.ts`, instanced per model, 20 Polyfork types): abandoned cars, a police checkpoint with barricades, jersey barriers, cones and barbed wire outside the south gate, a bus shelter, utility poles, hay bales and firewood at the farmhouse, a board fence, a grave row, rubble, trolleys. Solid pieces have rotated box colliders. Draw calls now 160-195 per scene (budget 400); the 30-zombie scene showed one hitch in a 4 s window (vsync-capped test, not reproduced elsewhere).

53. **Gate and checkpoint check:** a walk test (`tools/audit/gatewalk.mjs`) from five lanes reaches the gate line (z 99.3-99.5); the gate itself is closed by design and a 12 m blocker rings the wall, so the player never leaves the yard. I moved the new bus shelter and a bin off the gate approach.
54. **Hitch found and fixed** (`tools/audit/hitch.mjs`): the 30-zombie scene's stall (110-150 ms plus 28 MB heap) happened at spawn, not in combat: each zombie variant's GPU crowd (clip bake, buffers) was built on first spawn. `Zombies.warmCrowds()` now builds them all during boot. Two follow-up runs: zero frames over 25 ms across spawn, a 60-shot fight and 8 s after.

55. **Polyfork rifle and pistol on the first-person rig: not done, on purpose.** The Polyfork rifle has a separate magazine node, but it is a sci-fi weapon (scope, cyan glow panels, bayonet, bipod) that clashes with the grounded art bible, and the pistol is tiny and would only trade a working procedural model plus reload clips for a different look. Logged, not wired; revisit if a grounded rifle is found in the catalog (a bolt-action rifle and a scattergun exist) and the reload sockets are rebuilt.
56. **Re-audit** written into the audit doc. Measurement note: this PC now measures 17.5 ms p50 in every scene with and without the crowd warm-up (earlier runs 16.67 ms), so that is the machine's display or GPU load changing, not the code.

57. **Frame time 16.67 -> 17.5 ms explained** (`tools/audit/vsync.mjs`): an empty Chrome page with no game measures 17.5 ms p50 per requestAnimationFrame now (it was 16.67 ms earlier in the session), the display reports 60 Hz and the GPU is idle, so Chrome's present cadence on this machine changed (about 57 Hz). It is the same with the crowd warm-up on or off. Not a code change; a different window state or refresh pacing. Compare runs only against a same-hour vsync probe.
58. **Pickup through the gate:** `tools/audit/drivegate.mjs` drives the truck north from three lanes; it reaches z 97.3 (the closed gate and wall stop it, by design). The checkpoint outside is decoration the player cannot reach.
59. **Lawn variety:** four tint-patch layers (dry straw, dark clover, bare soil, fresh green; four draws), kept off platforms and station footprints, plus 40 Polyfork bushes.
60. **Night fill, second pass:** stronger moonlight and a cool blue ground tint; shapes read away from lamps. Before/after: `docs/audit/screenshots/after/40_night_before_fill2.png` and `40_night_after_fill2.png`.
61. **Interiors furnished** (Polyfork, instanced): beds, bedside tables, wardrobe, bookcase, chairs, small table, fridge, rugs, cartons, shop shelves, drinks fridge, filing cabinet, floor lamps, plus a warm point light per interior (brighter at night). `tools/audit/doorwalk.mjs` confirms the cabin, shop (shopfront lane) and farm doors are walkable.

62. **Three zombie sets you can test, switched with a URL flag** (owner request: "set up the library models and generate locally, we will test both"):
    - `?chars=orig` (default): the original procedural four.
    - `?chars=ai`: the 8 local-AI zombies (restored; image model -> Hunyuan3D -> skinned to our rig).
    - `?chars=pf`: 8 Polyfork catalog characters (teen, ghoul, police, construction worker, farmer, scientist, soldier, groundworker) wearing **our own 23 zombie clips**, retargeted in Blender by `tools/audit/retarget_pf.py`. The rigs differ (ours A-pose and facing -Z, theirs T-pose and Mixamo-named, facing +Z): spine/legs/neck use world-space rotation deltas turned 180 degrees, the arm chain is aimed by absolute bone direction (a first version using deltas left the arms splayed). They render through the GPU crowd renderer with their vertex colours.
    - Verified for `pf`: spawn, walking/hunched gaits, deaths, hit flash, 60-shot fight, head hit zone (head from 1.3 to 1.5 m, 100 % in `headtest2`), no console errors, 30 zombies hold 16.67 ms with 205 draws and no hitches. `ai` and `orig` re-checked too.
    - Not done: the *player* character is still the original procedural survivor; swapping it needs a retarget of the 40 survivor clips (aim, reload, melee) and is a separate decision. First-person arms untouched.

63. **Audio mix balance** (measured, not by ear): integrated loudness of every shipped sound (`ffmpeg ebur128`) against its table volume. Outliers: the car horn was about 13 dB hotter than anything else (effective -6.6 LUFS), car start -10, shotgun 8 dB over the rifle, bolt rack and dry-fire click near-inaudible (-37 / -32). Volumes in `content/data/sounds.ts` changed: horn 0.9 to 0.35, start 0.8 to 0.5, engine 0.6 to 0.45, shotgun 1.0 to 0.62, bolt 0.7 to 1.6, dry fire 0.6 to 1.0. Short gunshots read low in integrated LUFS by nature, so treat the gun-vs-ambient balance as unverified until someone listens.

64. **Loot feedback:** pickup toasts now read `+ Item ×n` with a green edge, and a full pack shows `✕ No room` in red (`systems/index.ts`, `hud.ts`); verified with a screenshot (`85_toasts.png`) and a container-open run. Not done: item icons in toasts, rarity colours.

65. **Polyfork firearms, decided against:** viewed the rifle, pistol and scattergun side-on: all three are sci-fi (cyan glow panels, scopes, purple trim). The bolt-action rifle lies along X and is the only grounded one; using it would turn the auto rifle into a bolt action, a gameplay change, so it is not wired. The existing AK keeps its separate magazine node for the reload clips.
66. **Fresh re-audit** (screenshots in `docs/audit/screenshots/after/`, section appended to the audit doc).

67. **Trodden tracks** (`tracks.ts`): nine continuous dirt ribbons (one merged mesh, one draw, wandering edges faded with grime-texture noise, cut where they would cross a platform) linking the spawn to the south gate (the main road), and the stations, cabin, shop and farm to each other. Screenshot `67_main_road.png`.
68. **Item icons: not regenerated, on purpose.** All 62 items already have a Blender-rendered inventory icon (`public/assets/icons`), so a second image-model set would replace working art with an unverified style. Instead: pickup toasts now carry the item icon, and rarity colours (art bible: uncommon green, rare blue, epic purple, legendary gold) show as a coloured edge in the inventory (`data-rarity`) and on toasts. Only 18 items have a rarity in the data, so most stay plain; the demo screenshot `86_inv_rarity_demo.png` forces four rarities by hand since the starting kit is all common.

69. **FP arms smoothing, third try: not shipped.** `tools/audit/smooth_arms2.py` bakes palette colours into vertex colours before subdividing (no UVs), with a matching vertex-colour material in the engine. The sleeve still came out speckled with light spots (so the cause is likely the palette-swatch geometry itself, e.g. per-face gradient swatches, not UV interpolation). Original arms restored. A real fix needs the arms rebuilt in `assets/source/chr/chr_arms_fp/build.py` with smooth geometry and one swatch per part.

70. **FP arms rebuilt smooth and shipped** (`assets/source/chr/chr_arms_fp/build.py`, run headless in Blender 4.5): the source already used one swatch per part, so the earlier checker came from subdividing the exported mesh, not from the palette. Fix at the source: sleeve 10 -> 18 sides, palm 8 -> 14, fingers and thumb 6 -> 10 (1212 -> 2108 triangles). Same bones, sockets and 20+ clips. Build change: weapon GLBs are read from decoded copies (`assets/gen/wpn_dec`, since 4.5 cannot read meshopt). Checked in the browser (`87_fp_arms_smooth.png`): knife idle and swing, pistol, pistol reload and rifle reload with the magazine in the left hand, rifle fire, no errors. Rollback: `git checkout 70652d4 -- public/assets/models/chr/chr_arms_fp.glb`.

71. **Melee and weapon swaps checked against a horde with the new arms** (`tools/audit/meleefight.mjs`): knife light/heavy/shove plus finishers killed 2, rifle killed 8 after rapid swaps, no errors.
72. **Openable doors** (`doors.ts`): the cabin door, the shop's side door and the farmhouse door are now hinged plank leaves with a kinematic collider that follows the swing, an instant Open/Close prompt on E, a creak (`door_creak`) and a 3 rad/s swing outward. They start closed. Test `tools/audit/doors.mjs`: each door prompts, blocks while closed and lets the player in once opened (`88_door_open.png`). Found and fixed on the way: my own crate prop stood right behind the cabin door and blocked the doorway. Known rough edge: opening a door while standing very close sweeps the leaf into the player and nudges them sideways. The shop's wide shopfront gap stays open.

73. **Survivor rebuilt smoother from its own script** (`assets/source/chr/chr_survivor_a/build.py`, headless Blender 4.5, about 90 s, mocap files present): torso, hips, arms and legs get 14-16 segments instead of 8-10 (1650 -> 2266 LOD0 triangles); the same rig, backpack node, sockets and all 40 clips (the animation JSON came out byte-identical). Checked in the browser: anim stand, sprinting third person, combat, reload, no errors (`89_survivor_smooth.png`). The change is modest (rounder limbs and torso); clothing detail and a better palette were not attempted. Rollback: `git checkout 70652d4 -- public/assets/models/chr/chr_survivor_a.glb`.
74. **Hands:** not done beyond the arm rebuild (palm 14 and finger 10 segments); no knuckle or fingertip detail pass.

75. **Door nudge fixed:** a swinging leaf no longer collides (collider off while it moves, back on when it rests, and held off if the player is standing where the leaf would land, so closing never traps anyone). `tools/audit/doornudge.mjs`: pressing E at 0.3 m from the cabin door leaves the player in place; walking in works; closing it with the player in the doorway lets them walk through.

76. **Survivor palette pass (small):** darker boots (`wood_dark`) and a belt band added in the build script (2326 triangles, rig and clips unchanged). The belt is mostly hidden by the jacket hem, so the visible change is the boots; the jacket and jeans colours were left as they are, and no pouch was added. Front/back screenshot: `89_survivor_front_back.png`. Track ribbons also got a softer edge (they looked hard-edged next to the survivor).
77. **Hands detail pass:** skipped as not cheap (it needs new finger geometry and rest-pose rework in the 875-line arms script).

## Cost of all this
- Download size grew by about 12 MB of public assets after compression (it was about 30 MB); KTX2 textures would shrink GPU memory further.
- Triangles in view went from about 240k to 600-750k; draw calls from about 70 to 110-130; GPU time per frame with everything (trees, buildings, AO, bloom) is 1.46 ms vs 1.30 ms with the look chain off, on the 4090 (gpums.mjs); the chain itself is about 0.16 ms on the 4090 (about 10x that on a 3050 Ti laptop is the guess; measure there).

## What's left, ranked
1. **Night:** rim light and flashlight beam done; ground and walls still fall to blue-black far from lamps.
2. **Characters:** vector-style textures (heads shrunk, faces readable at 1024 px); smoother arms need UVs that survive subdivision; survivor clothing variants need more 3D (licence-gated, or TRELLIS2 with 20 GB free RAM).
3. Ground: worn patches done; terrain splat blending at path edges still hard-edged in places.
5. **First-person weapon and arm meshes:** blocky; a hand remodel that keeps the `MAG` node and sockets.
6. **Test on the laptop GPU** (toggles for look, AO and shafts exist in Settings); KTX2 for GPU memory.
7. Music: listen to `?music=ai` and decide.

## Needs the owner
- **Licence:** Hunyuan3D-2.1 (Tencent community licence) excludes the EU, UK and South Korea. The 8 props are in `public/assets/models/gen/`. If the game ships there, regenerate them with TRELLIS2 (MIT), which needs about 20 GB of free RAM for its mesh stage (the hub guard stopped it at 2.3 GB free on this PC), or delete them.
- **Design:** the survivor camp and junk corner are in the open lawn east and west of spawn. Move or remove them if they clash with the yard's intent as a clean test sandbox.
- **Docs:** `CLAUDE.md` says Blender 5.2.2 is installed; only Blender 4.5 is at `C:\Program Files\Blender Foundation\Blender 4.5`.
- Raw AI pictures are in `assets/gen/` (git-excluded locally, not in the branch).

## 2026-11-14 main character
- Poster hero -> front/side/back/T-pose views -> Hunyuan3D-2.1 textured mesh -> Blender fit (1.80 m, 16k tris) -> Mixamo-named rig, custom weights -> 42 survivor clips retargeted (`tools/audit/rebuild_hero.sh` redoes all of it).
- Viewer: `/viewer.html?model=chr_hero_a` (all clips, held items, camera presets). Headless screenshots: `node tools/audit/viewer.mjs`.
- Face: clean reference face projected onto the texture (`tools/audit/bake_face.py`); eyes and brows now read. Geometry is still low-poly. Small specks remain on hand tips. Outfit system not started.
