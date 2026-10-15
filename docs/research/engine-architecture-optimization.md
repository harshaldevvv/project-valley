# Engine research: architecture and optimization for a browser open world (Oct 2026)

Stack under study: three.js r186 with WebGPU and TSL, Rapier, and recast-navigation-js. Target: 60 fps on a mid laptop with a 4 GB GPU.

Two labels appear throughout:
- **[unverified]** means a single or secondary source.
- Budgets are engineering targets to be validated with the perf harness.

The derived rules live in `docs/design/principles.md` §Engine.

## 1. Architecture

**Fixed timestep (Glenn Fiedler)**
- Clamp the frame time to 0.25 s.
- Run the accumulator loop with a fixed `dt`.
- Keep the previous and current state, then render with interpolation: lerp positions, slerp rotations.
- This is required for stable physics, replays and future netcode.
- Rapier and recast-navigation both recommend fixed stepping.

**ECS benchmarks**
- The only multi-library suite found is bytro/ecs-benchmark, which is old and ran on Node 17.
- Structure-of-arrays (SoA) libraries beat object-based ones by 3–20× on iteration:

  | Library | packed (op/s) | frag_iter (op/s) |
  |---|---|---|
  | bitECS | 335k | 431k |
  | miniplex | 109k | 20k |

- Object ECS wins on add/remove churn.
- Koota was not benchmarked.
- At 100–300 zombies, ECS speed is not the bottleneck. The real costs are:
  - rendering object count
  - physics queries
  - pathfinding
  - garbage collection (GC)
- So choose SoA typed arrays for snapshot, worker transfer and netcode friendliness.

**Data-oriented JS**
- Preallocate typed arrays indexed by entity id.
- Use module-level scratch vectors.
- Pool everything: projectiles, decals, particles, audio voices, zombies.
- No closures, `forEach`, `Map` iteration or string keys in hot loops.
- The PlayCanvas guidelines say the same.

**Patterns from Robert Nystrom's *Game Programming Patterns***
- Game Loop and Update Method
- Component
- Event Queue: drained once per tick; never call it from inside physics callbacks
- Service Locator: a `ctx` object
- Spatial Partition
- Dirty Flag: `matrixAutoUpdate=false` on statics
- Object Pool
- Data Locality
- Double Buffer

**Data-driven content**
- Schema-validated JSON or TS tables.
- Numeric ids at runtime.
- Versioned tables, with item ids stored in saves.

**Determinism**
- Rapier JS is cross-platform deterministic if:
  - initial conditions, insertion order, version and inputs match
  - `Math.sin`/`cos` and similar transcendental results are kept out of physics
- Use a seeded PRNG only.

## 2. Rendering

**Key finding: WebGPURenderer has a high per-object CPU cost**

Forum benchmark on r183: 4,000 meshes on an RTX 4090 laptop.

| Renderer | CPU time per frame | First frame |
|---|---|---|
| WebGLRenderer | 4.5 ms | 32 ms |
| WebGPURenderer | 9.7 ms | 167 ms |
| WebGPURenderer, WebGL fallback | 10.3 ms | 344 ms |

- The suspected cause is per-object UBO and bind-group handling (issue #30560) **[unverified diagnosis]**.
- **Object count is the main render budget, not triangle count.**

**r186 facts**
- `renderAsync` is deprecated; use `render()`.
- `init()` must run before rendering; `setAnimationLoop` calls it.
- The WebGL2 fallback lacks indirect draws and storage textures.
- No `ShaderMaterial`, `onBeforeCompile` or `EffectComposer`. Use TSL and `RenderPipeline` instead.
- `PCFSoftShadowMap` was removed.
- WebGPU needs HTTPS or localhost.
- WebGPU support is about 87% globally.

**Batching and culling**
- `InstancedMesh` and `BatchedMesh` (indirect offset since r182).
- three.js culls per object only. Per-instance culling needs one of:
  - InstancedMesh2, which has a BVH
  - our own chunk compaction
- LOD chain: full mesh → meshoptimizer simplification → octahedral impostor.
- A forum showcase drew 200k trees on a 3072² terrain this way.
- There is no occlusion culling. Use:
  - interiors as separate cells
  - per-category distance culling
  - fog

**Crowds**
- `SkinnedMesh` costs one draw plus one skeleton update per character, so it bottlenecks at a few dozen.
- Option 1: bake bone matrices to a texture and use `InstancedMesh`. InstancedMesh2 supports skinning, and a demo ran 3,000 instances with animation fps that drops with distance.
- Option 2: VAT (vertex animation textures). Cheapest at runtime, but memory grows with vertex count.

**Textures**
- KTX2/Basis cuts VRAM 4–8×.
  - ETC1S for bulk albedo.
  - UASTC for normals and hero assets.
- Bruno Simon's WebGPU portfolio uses a **palette texture sampled by UV**, which is what `gltf-transform palette` automates.

**Shader warm-up**
- Pipelines compile lazily, which causes hitches.
- Fix: `compileAsync` plus a hidden "material zoo" holding every material × vertex layout (instanced, skinned, batched).
- Every distinct node graph is a separate pipeline, so keep few materials.

**Shadows and post-processing**
- Each cascaded shadow map (CSM) cascade re-renders the casters, so cost is objects × cascades.
- Post-processing is fill-rate bound.
- Use dynamic resolution for the main pass.

## 3. Streaming

**Grid cells**
- Each cell owns:
  - a terrain tile
  - instance lists
  - colliders
  - navmesh tiles
  - spawn and loot tables
- Rings:
  - active: simulated and rendered
  - visible: rendered, with impostors
  - prefetch: data only
- Use hysteresis on unload.

**Loading**
- Fetch and decode in workers; KTX2 and meshopt decoding already run as WASM in workers.
- Transfer the ArrayBuffers.
- GPU upload is the main-thread cost, so spread it across frames.

**Floating point**
- float32 spacing at 2–4 km is about 0.24 mm.
- A 4×4 km map centred on the origin has a maximum radius of 2.83 km, which is fine.
- WebGLRenderer computes modelView in float64 on the CPU.
- Whether the WebGPU TSL path does the same is unknown, so run a corner jitter probe.

**Terrain**
- CDLOD (Strugar 2010): a quadtree with an instanced grid patch, height sampled in the vertex shader, and vertex morphing so there are no seams.
- A 4 km map at 1 m resolution is a 4096² heightmap (32 MB at R16).
- Rapier heightfield colliders per active cell.

**Navmesh**
- Use `generateTiledNavMesh`, baked **offline** per cell and exported as `Uint8Array`.
- Runtime generation of a large static world is too slow.
- TileCache obstacles handle barricades and base pieces.
- Dynamic rebuilds run in a worker.

## 4. Physics and AI

**Rapier**
- `-compat` embeds the WASM; call `await RAPIER.init()`.
- Running it in a worker saves 1–4 ms on the main thread.
- SharedArrayBuffer needs these headers:
  - `COOP: same-origin`
  - `COEP: require-corp` (or `credentialless`)
  - These break third-party CDNs, so self-host everything.
- The character controller and hitscan need synchronous queries. So keep **Rapier on the main thread first** and move it to a worker only when profiling says so.

**Physics hygiene**
- Capsule, ball or cuboid shapes for anything dynamic.
- Trimesh only for static geometry; heightfield for terrain.
- Sleeping bodies cost about nothing.
- Use collision groups.
- Use character controller filters to skip self, sensors and projectiles.

**Zombies**
- No dynamic bodies. Movement comes from the Detour crowd plus a ground snap.
- Kinematic capsules only within about 30 m.
- Pooled ragdolls, at most 4.

**AI LOD**
- Update rate scales with distance.
- Far zombies use an abstract cell-graph simulation.
- Stagger updates by id modulo N.
- A spatial hash with 4–8 m cells is rebuilt every tick; O(n) at n = 300 is trivial.

## 5. Tooling

**Asset pipeline: explicit gltf-transform steps**
1. inspect
2. dedup, prune, weld
3. simplify (LODs)
4. instance
5. flatten, join
6. palette
7. resize
8. etc1s / uastc
9. meshopt (better than Draco for animated assets)

Runtime loaders: `KTX2Loader` and `MeshoptDecoder`.

**Bundle**
- Dynamic `import()` for Rapier, Recast and debug tools.
- Never import WebGLRenderer alongside `three/webgpu`: it adds about 90 KB gzip.

**Storage**
- **OPFS** with `createSyncAccessHandle` in a worker (Baseline since 2023) for saves and the world-delta journal.
- IndexedDB for metadata.
- A service worker with the Cache API for hashed assets.
- Call `navigator.storage.persist()`.
- Offer save export and import, because clearing site data wipes saves.

**Profiling**
- Chrome Performance panel.
- `renderer.info`.
- Spector.js on WebGL.
- stats-gl is **incompatible with WebGPU from r181**. Use the three.js **Inspector** or `WebGPUTimestampQueryPool` instead.

**Perf CI**
- Playwright in headed Chrome on the real GPU, running scripted camera paths.
- Read p50/p95/p99 frame time, draw calls, heap and hitches.
- Headless or SwiftShader numbers are meaningless.

## 6. Networking readiness

**Gambetta's principles**
- Authoritative server.
- Client prediction with reconciliation.
- Entity interpolation of remote entities in the past.
- Lag compensation (rewinding hitboxes).

**Fiedler snapshot interpolation**
- Buffer about 3× the send interval: about 350 ms at 10 Hz, 150 ms at 30 Hz.
- Unreliable transport.
- Send velocity for Hermite interpolation.
- Delta compression and quantization.

**Transport**
- WebTransport has been Baseline since Safari 26.4 (Mar 2026). It is client–server only.
- WebRTC data channels are the peer-to-peer option.
- For 2–4 player co-op: a listen server first, a dedicated server running the same sim code later.

**What to do in single player now**
- Keep the sim free of three.js and DOM imports.
- Route all intent through `applyInput(playerId, cmd, tick)`.
- Use stable entity ids.
- Fixed tick, seeded RNG, ordered iteration.
- Store state as SoA so it can be serialized.
- Events are data.

## 7. Case studies

**Krunker**
- Low-poly with few materials.
- A disciplined approach to resources.
- About a 10 Hz server tick **[unverified]**.
- PointerLock mouse-skip bug (#27040): test `unadjustedMovement`.

**Venge.io / PlayCanvas guidelines**
- Few draw calls.
- Preallocate.
- Avoid shader compile hitches.
- Downsize textures.

**Bruno Simon 2025/26 (WebGPU + TSL, MIT source)**
- Instancing everywhere.
- About 78k grass blades merged into one geometry that loops around the camera.
- Foliage as camera-facing planes.
- A palette texture.
- Mobile preset with no blur or depth of field and lower shadow resolution.

**Open-world demos**
- Dreamfall (r185, streaming heightfield plus impostor forest).
- SeedThree (tree LOD chain).
- threejs-worldgen (4-LOD grass).

**Cautionary case**
- A survival dev hit **6.5 fps** with naive bush instancing and no per-instance culling or LOD.

## Spikes to run first (M0)
1. Object-count benchmark: WebGPU vs WebGL backends at 500, 1,000 and 2,000 objects on this laptop.
2. bitECS vs Koota with our real archetypes.
3. Jitter probe at a corner of the map, on both backends.

## Reading list
1. Glenn Fiedler, *Fix Your Timestep!* and *Snapshot Interpolation*.
2. Gabriel Gambetta, *Fast-Paced Multiplayer* I–IV.
3. Robert Nystrom, *Game Programming Patterns*.
4. Filip Strugar, *CDLOD*.
5. *GPU Gems 3*, ch. 2, "Animated Crowd Rendering".
6. recast-navigation-js README.
7. Rapier JS guides: determinism and character controller.
8. utsubo, *WebGPU + Three.js Migration Guide 2026*.
9. three.js forum threads #91904, #86072 and #89928.
10. Bruno Simon portfolio case study and source.
11. gltf-transform CLI docs.
12. web.dev, *COOP/COEP*.
13. MDN, *OPFS*.

## Sources
gafferongames.com (fix_your_timestep, snapshot_interpolation) · gabrielgambetta.com · gameprogrammingpatterns.com · github.com/bytro/ecs-benchmark · github.com/NateTheGreatt/bitECS · github.com/pmndrs/koota · discourse.threejs.org threads 91904, 86072, 89928, 41958, 87944, 20917 · utsubo.com/blog/webgpu-threejs-migration-guide · utsubo.com/blog/frontier-web-apis-2026-production-ready · tympanus.net codrops BatchedMesh 2024 · dev.to InstancedSkinnedMesh · developer.nvidia.com GPU Gems 3 ch2 · blog.unity.com animation instancing · gltf-transform.dev/cli · github.com/isaac-mason/recast-navigation-js · rapier.rs docs (getting started, determinism, character controller) · web.dev/articles/coop-coep · MDN OPFS · github.com/fstrugar/CDLOD · github.com/RenaudRohlinger/stats-gl · threejs.org WebGPUTimestampQueryPool · awwwards.com Bruno's portfolio case study · github.com/ryanfitzpatrickio/threejs-playground · github.com/SkyeShark/SeedThree · github.com/AskAlice/threejs-worldgen · github.com/mrdoob/three.js/issues/27040 · developer.playcanvas.com optimization guidelines
