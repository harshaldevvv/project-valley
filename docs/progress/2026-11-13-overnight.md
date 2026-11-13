# Overnight visual overhaul, 2026-11-13

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

## Cost of all this
- Download size grew by about 30 MB of public assets (props and buildings 12 MB, characters 11 MB, textures 4.7 MB, audio 2.2 MB). Not yet meshopt/KTX2 compressed; do that before shipping (`gltf-transform optimize`).
- Triangles in view went from about 240k to 600-750k; draw calls from about 70 to 110-130; GPU time per frame with everything (trees, buildings, AO, bloom) is 1.46 ms vs 1.30 ms with the look chain off, on the 4090 (gpums.mjs); the chain itself is about 0.16 ms on the 4090 (about 10x that on a 3050 Ti laptop is the guess; measure there).

## What's left, ranked
1. **First-person weapon and arm meshes** are still blocky (the rifle is a box kit with a separate magazine and sockets that the reload clips drive). Needs a hand remodel in Blender that keeps the `MAG` node and sockets; AI generation gives one fused mesh. Blocked on the licence answer for Hunyuan; TRELLIS2 needs about 20 GB free RAM.
2. **Character polish:** the AI bodies have big heads and flat vector-style textures; the survivor has one look (clothing variants need more 3D generation); the original shambler/worker/soldier could be replaced the same way.
3. **Game feel not done yet:** weapon sway and swap polish, zombie death/ragdoll variety, surface gore decals, rain or fog weather, crows and wind in foliage as visible life, a directional damage indicator in the HUD.
4. **Compress the new assets** (30 MB of GLB, PNG and OGG; `gltf-transform optimize`, KTX2 textures) and test on the laptop GPU.
5. **Retexture the palette-only kit** (house, range, signs) with the same detail pipeline plus wear decals; AI posters and signs; title menu art behind the fly-over.
6. Music: listen to `?music=ai` and decide.

## Needs the owner
- **Licence:** Hunyuan3D-2.1 (Tencent community licence) excludes the EU, UK and South Korea. The 8 props are in `public/assets/models/gen/`. If the game ships there, regenerate them with TRELLIS2 (MIT), which needs about 20 GB of free RAM for its mesh stage (the hub guard stopped it at 2.3 GB free on this PC), or delete them.
- **Design:** the survivor camp and junk corner are in the open lawn east and west of spawn. Move or remove them if they clash with the yard's intent as a clean test sandbox.
- **Docs:** `CLAUDE.md` says Blender 5.2.2 is installed; only Blender 4.5 is at `C:\Program Files\Blender Foundation\Blender 4.5`.
- Raw AI pictures are in `assets/gen/` (git-excluded locally, not in the branch).
