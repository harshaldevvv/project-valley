# Game plan — browser open-world zombie survival — **Project Valley**

A classic open-world zombie survival game that runs in the browser: loot, a grid inventory, deep gunplay, base building, infestations, traders and vehicles. It fixes the things the reference game players complain about.

Reference research:
- `docs/research/the reference game-gameplay-systems.md` covers every system, with numbers.
- `docs/research/the reference game-world-art-tech.md` covers the map, art, tech and browser feasibility.
- `docs/research/raw/` holds all 163 the reference game patch notes and a sample of 200 reviews.

Engineering and design rules: `docs/design/principles.md`. Art rules and budgets: `docs/design/art-bible.md`.

---

## 1. Engine decision: three.js (WebGPU) over Unity

**Decision: build it on the web stack (three.js r186 + TypeScript), not Unity.**

| | three.js / WebGPU (chosen) | Unity → WebGL export |
|---|---|---|
| Browser load size | ~5–15 MB to start, then the world streams in | ~20–60 MB+ before the first frame, with slow WASM startup |
| Browser performance | Native WebGPU with WebGL2 fallback; we control every byte | Unity's WebGL target is a port: memory caps, weak mobile support, WebGPU still experimental |
| How well Claude can build it | Everything is text and code. I can write it, run it in the browser pane, screenshot it, profile it and fix it in a loop | Scenes and prefabs are edited mostly through the Unity editor GUI. I can write C#, but I can't drive the editor well, so you'd do the clicking |
| Iteration speed | Hot reload in under a second | Domain reload and rebuild for every WebGL test (minutes) |
| Your laptop (4 GB VRAM, runs hot) | Light: a dev server plus a browser | The Unity editor is heavy and WebGL builds peg the CPU |
| What Unity gives that we lose | — | Ready-made editor, animation tooling, terrain tools and asset store. We replace these with Blender, our own debug tools and CC0 packs |
| Later Steam/desktop release | Wrap the same build in Electron/Tauri | Native |

Change to Unity only if the target moves from "plays in a browser" to "Steam/console first".

---

## 2. Pillars

1. **Every trip out is a story.** Dense, distinct places, emergent fights, scarce loot that matters.
2. **Guns and melee feel great.** Feedback on every action. Readable, fair zombies.
3. **Your base matters.** It gets attacked, so building it means something.
4. **Long-term progress you can see.** Tiered regions, keycards, crafting tiers and meaningful perks. No "geared in 5 hours".
5. **Instant to play.** Open a link and play, at 60 fps on a mid laptop. Saves never break.

## 3. How we beat the reference game (its top complaints → our answer)

| the reference game complaint | Our design |
|---|---|
| No raids, so building feels pointless | **Horde nights**: horde night every 5 in-game days, plus noise and heat (light, generators, gunfire) drawing roaming hordes to your base. Structure tiers: wood → scrap → concrete → reinforced. Zombies path to and break the weakest point |
| Geared in 5–10 h, legendaries too easy, money snowball | Tiered regions (T1 → T5) with item level by region, rarer legendaries, a pity counter, real sinks (repairs, ammo crafting cost, trader cash limits, upkeep) |
| Cheesable AI | Zombies climb vehicles and low walls, react to sniping (search toward the sound), make readable noise, never spawn in view. Human AI uses line-of-sight and cover |
| Boring skill tree | Learn-by-doing skills plus **perks that change how you play** (silent takedowns, field surgery, scavenger's eye, mechanic) |
| Repetitive POIs with interchangeable loot | Each POI has a loot theme, a story and a landmark. Regional resources. Hand-placed unique stashes |
| No real quests | Faction traders with reputation, quest chains that send you to places, radio-driven dynamic events |
| Save corruption and lost items | Versioned, atomic saves with 3 rolling backups and a migration test suite |
| Slow updates, no multiplayer | Architecture keeps simulation separate from rendering, so co-op (milestone 10) is a project, not a rewrite |
| Asset-flip look | Our own palette-atlas art made in Blender and an art bible. Lighting and weather carry the mood |

## 4. Feature scope

The full parity list is the research doc. Below is the target per area. ★ = beyond the reference game.

- **Player:**
  - Third person with a first-person toggle.
  - Walk/sprint/crouch, jump, vault/climb, dodge roll, lean, swim.
  - ★ Prone. ★ Body awareness in first person.
- **Survival:**
  - Health, hunger, thirst, stamina, radiation.
  - Bleed, heavy bleed, fracture, infection, burning.
  - ★ Light fatigue. ★ Temperature (winter, wet).
  - Medical items as in the reference game, with short use animations.
- **Inventory:**
  - Tetris grid, equipment slots (head, face, eyes, ears, torso, armor, legs, gloves, feet, backpack), nested containers.
  - Vicinity panel, quick-move, split, inspect.
  - No weight; a ★ soft encumbrance slider instead.
- **Weapons:**
  - 8 calibers.
  - Pistols, SMGs, ARs, shotguns, DMRs/snipers, LMGs, launchers, crossbow.
  - Separate magazines, attachments (sights, muzzle, grips, mags, lights).
  - Durability and malfunctions, rolled stats and 5 rarity tiers, fire modes, ADS, hold breath.
  - ★ Projectile ballistics for long guns (hitscan under ~50 m).
  - Ammo crafting.
- **Melee:** light and heavy attacks, shove, stomp, backstab. ★ Directional stagger. ★ Limb damage.
- **Zombies:**
  - Shambler, runner, crawler, armored, radiated, acidic, screamer, grenadier, hounds, bosses.
  - Stackable archetypes, sight and hearing senses.
  - ★ AI pacing director (build-up / peak / relax). ★ Horde migrations.
- **Humans and animals:**
  - Bandits and a PMC faction with camps, checkpoints and convoys; neutral scavengers.
  - Deer, rabbit, wolf, bear.
- **Loot:**
  - Typed containers, search timers, lockpicking minigame, tools (crowbar, bolt cutters).
  - Keycards, safes, hidden caches, airdrops, bosses.
  - Refill timers.
- **Crafting and building:**
  - 4 benches, ~40 materials, harvesting.
  - Modular snap building plus freeform props, traps and turrets.
  - Generators and power, rain well, ★ farming, fishing, hunting.
- **World events:**
  - Infestations (primary/secondary/random), heli crashes, convoys, airdrops, horde beacon.
  - Blood moon / horde nights ★, radio events.
- **Economy:** cash and credits, faction traders ★ with reputation, daily restock, trader cash limits.
- **Progression:** level 1–40, passive skills that level by use, ★ perk tree, skill books and magazines.
- **Vehicles:**
  - About 8 types to start (golf cart, sedan, pickup, SUV, van, truck, humvee, buggy).
  - Fuel, repair, trunk grid, ramming, push, tow, radio.
- **Time and weather:** day/night (default 40 min: 28 day / 12 night), rain, storm, fog, snow, radiation weather, seasons.
- **Settings:**
  - Difficulty presets plus every slider editable mid-game.
  - Keybinds, FOV, graphics quality tiers, ★ controller support.
- **Saves:** slots, autosave, quick save, body-box on death, permadeath option.

## 5. The map — "the Valley" (our own)

- **Size:**
  - Milestone 3 ships a **2 × 2 km** slice: the starter town, its outskirts and one military site.
  - The full game targets **4 × 4 km** (16 km²), streamed in 128 m chunks.
  - the reference game's map is estimated at about 64–100 km², but most of it is empty forest. We go **denser instead of bigger**, aiming for around the same POI count (about 120) in a quarter of the area.
- **Regions and tiers (T1 → T5):**
  - Starter town and farms (T1).
  - River suburbs and the mall (T2).
  - Industrial port and the prison (T3).
  - Military valley and airfield (T4).
  - Radiated quarantine zone, the lab and the bunker network (T5).
- **Biomes:** temperate forest, pine highlands, meadow farmland, river swamp, coast, plus a radiated deadzone. Seasons drive the snow.
- **Landmarks** visible from anywhere help navigation: dam, radio mast, observatory dome, crashed cargo plane, smokestacks.
- POI briefs live in `docs/design/world/`. Each one gets a brief before any building starts.

## 6. Tech architecture

- **Stack:**
  - Vite + TypeScript (strict).
  - three.js r186 `WebGPURenderer` with WebGL2 fallback; TSL shaders.
  - Rapier physics (`@dimforge/rapier3d-compat`), recast-navigation-js (navmesh tiles plus crowd, in a worker).
  - three-mesh-bvh, gltf-transform (meshopt and KTX2).
  - IndexedDB saves, vitest, Playwright (bot playtests and perf runs).
  - UI in plain DOM/CSS over the canvas.
- **Simulation:** fixed 60 Hz sim step with interpolated rendering. Simulation state is plain data, so it can be serialized for saves and later co-op.
- **Zombie LOD:**

| Distance | How the zombie runs |
|---|---|
| Near | Full skinned mesh, ragdoll on death |
| Mid | Instanced VAT (vertex animation texture), crowd-simulated |
| Far | Abstract only: a count per chunk, moved on a coarse grid |

- **Code layout and owners:**

```
src/engine/      engine-builder       loop, renderer, streaming, physics, nav, audio, input, assets, storage, debug
src/gameplay/    mechanics-builder    player, camera, weapons, melee, damage, AI, director, vehicles, interactions
src/systems/     systems-builder      inventory, items, loot, crafting, building, economy, progression, survival, saves
src/world/       environment-builder  terrain, biomes, foliage, roads, POI placement, weather, time of day
src/ui/          systems + mechanics  HUD, menus, inventory/trader/crafting screens
src/content/data/  systems-builder    all tunable numbers (items, weapons, loot tables, recipes, skills, difficulty)
src/content/text/  narrative-designer all player-facing text
content/world/   environment-builder  heightmaps, biome masks, POI layouts
assets/source/   asset-builder        Blender build scripts + .blend
public/assets/   asset-builder        optimized GLB, textures, audio
tools/           engine + asset       Blender helpers, asset optimize, manifests
```

## 7. Assets

- **Our own models:** built from code in Blender by the asset-builder agent (bpy build script per asset, LODs, colliders, palette atlas). Validated by the `blender-image-to-3d` skill's gates.
- **CC0 starting points:** Quaternius (Zombie Apocalypse Kit, guns, nature, modular street), Kenney (survival, city, cars), Poly Haven. Each is restyled to our palette and logged in `docs/pipeline/asset-credits.md`.
- **Characters and animation:**
  - CC0 rigged humanoid bases (Quaternius, 20 animations each), retargeted.
  - Mixamo animations are an option (free for games, but they need an Adobe login, which you'd do yourself).
  - Zombie variants are made by swapping heads, clothes and gore pieces on a shared rig.
- **Optional AI generation:**
  - Tripo (3D), Gemini (concept images) and ElevenLabs (audio) through the installed skills, once you add API keys. These are paid services.
  - Without keys: procedural models and CC0 audio (Sonniss GDC bundles, freesound CC0).
- **Synty POLYGON:** not used unless Synty confirms in writing that web builds are allowed. Their EULA is silent on extractable browser assets.

## 8. Team and workflow

The lead is the main Claude session. It owns the plan, the interfaces between agents, integration, and final verification in the browser.

| Agent | Owns | Main skills |
|---|---|---|
| `engine-builder` | renderer, loop, streaming, physics, nav, perf | three-best-practices, threejs-debug-profiler, threejs-qa-release |
| `systems-builder` | inventory, loot, crafting, economy, progression, saves | threejs-game-ui-designer |
| `mechanics-builder` | movement, camera, guns, melee, feel, AI, vehicles | threejs-gameplay-systems |
| `environment-builder` | map, terrain, biomes, POIs, lighting, weather | threejs-aaa-graphics-builder |
| `asset-builder` | Blender models, LODs, colliders, GLB export | blender-image-to-3d, threejs-3d-generator |
| `narrative-designer` | lore, quests, notes, radio, item text | — |

**Handoffs:**
- **3D assets:** environment-builder (or any agent) adds a row to `docs/pipeline/asset-requests.md` → asset-builder builds it and marks it done with the GLB path and preview → environment-builder swaps out the placeholder box.
- **Story beats:** narrative-designer writes POI story briefs → environment-builder dresses the scene → asset-builder supplies the props.
- **Data contracts:** systems-builder owns `src/content/data/types.ts`. mechanics-builder reads weapon and item stats from it.
- **Engine APIs:** engine-builder publishes small documented APIs. Other agents call them; they don't patch engine internals.
- **No file conflicts:** two agents never edit the same folder in parallel. Parallel work is split by folder, as in the table above.

## 9. Milestones

Each milestone ends playable in the browser, with a perf report and a short demo recording.

| # | Milestone | Done when |
|---|---|---|
| M0 | **Foundation** | Vite+TS+three r186 WebGPU scaffold, fixed-step loop, Rapier, input, debug/perf overlay, asset pipeline (Blender → GLB → optimize), palette atlas, CI checks (`build`, `test`), git repo |
| M1 | **Test Sandbox: "the Yard"** (user-requested) | One tiny walled yard (~150×150 m) where every mechanic can be tested instantly, before any big world exists. Stations: **loot** (crates/cabinets/body to search, lockpick), **shooting range** (targets at 5/25/80 m, pistol + rifle, hit feedback, recoil readout), **zombie pen** (spawn 1/5/20 shamblers, senses debug view), **build pad** (snap-building walls/floors/doors, place/remove), **animation stand** (character with every clip, slow-mo, TP/FP toggle), **inventory & UI** (grid, equipment, containers, hotbar), **vehicle track** (one car, data-driven so more cars are just new data rows). Also: a **prebuilt wooden house** (from build-kit pieces) on the build pad that can be taken apart and rebuilt; drop/store/loot item flows; a **main menu inside the same world** (cinematic camera over the Yard, Play starts instantly, Esc = pause menu). Debug menu (F1): teleport to station, spawn item, god mode, time of day, live-tune any number from `src/content/data`. Every later system lands here first for the user to try |
| M2 | **Survival core** | Hunger/thirst/stamina/meds, eating and drinking, death and body box, versioned saves with backups, day/night, settings and difficulty sliders |
| M3 | **The open world (2×2 km)** | Streamed terrain and biomes, foliage, roads, starter town plus outskirts plus a military camp, weather, navmesh tiles, 150+ zombies at 60 fps |
| M4 | **Gun depth** | 15+ weapons, magazines, attachments, rolled stats and rarity, durability and malfunction, ballistics, melee set, throwables, hit feedback polish |
| M5 | **Crafting and base building** | Benches, recipes, harvesting, modular snap building, doors/traps/turrets, generators, storage |
| M6 | **Threats and events** | Horde nights and base raids, infestations, zombie archetypes, bosses, airdrops, heli crashes, AI pacing director |
| M7 | **People** | Safe zone, traders and economy, factions and reputation, quests v1, bandits, human AI with cover, lore notes and radio |
| M8 | **Vehicles** | 4–8 vehicles with fuel, repair, storage, ramming, towing |
| M9 | **Progression and full map (4×4 km)** | Levels, skills, perks, books, T1–T5 regions, keycards and bunkers, ~120 POIs, polish, onboarding |
| M10 | **Co-op (2–4 players)** | Authoritative host, snapshot interpolation, shared world |

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Hundreds of animated zombies in the browser | VAT instancing, crowd in a worker, distance LOD. Proved in M1/M3 with a perf test before adding content |
| Asset volume (hundreds of models) | Modular kits (walls, windows, roofs), variants by palette swap, a build script per asset, CC0 bases |
| Character animation quality | CC0 rigged sets plus retargeting. Mixamo and Tripo as an upgrade path |
| Laptop heat during Blender bakes and long builds | Light preview renders, small bakes, batched heavy jobs, keep FanKick running |
| Scope creep | Milestones are vertical. Nothing from a later milestone starts before the current one is playable |
| Browser memory limits | Streaming budgets in the art bible, perf test in CI |

## 11. Open decisions for you

1. ~~Game name~~ — decided: **Project Valley**.
2. **API keys** for Tripo / Gemini / ElevenLabs. They're optional and paid, but they speed up hero assets and audio.
3. ~~Synty~~ — decided: no paid asset packs; custom + CC0 only.
4. **Git:** this folder isn't a git repo yet. M0 will run `git init`. Say if you want a GitHub remote.
