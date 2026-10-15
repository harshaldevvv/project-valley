# M0 spike results (2026-10-16)

**Machine:** ASUS G513QE (Ryzen + RTX 3050 Ti 4 GB laptop), Chrome stable, headed window, 1280×720, vsync off.

**Runners:**
- Rendering spikes: `node tools/perf/run-spikes.mjs`, which writes `artifacts/spikes.json`.
- ECS spike: `npm run bench:ecs`.

**GPU caveats:**
- Chrome hides adapter details, so we can't confirm whether WebGPU ran on the RTX or the integrated Radeon.
- Chrome ignores `powerPreference` on Windows (crbug 369219127).
- Players on hybrid laptops may need to set Chrome to "High performance" in Windows Graphics settings. Show this hint in our settings menu.

## Spike 1: CPU cost per rendered object

Setup: N separate meshes, 200 shared geometries, 1 material, all visible.

| Objects | WebGLRenderer | WebGPURenderer (WebGPU) | WebGPURenderer (WebGL2 fallback) |
|---|---|---|---|
| 500 | 1.11 ms (2.2 µs/obj) | 1.20 ms (2.4 µs/obj) | 2.05 ms (4.1 µs/obj) |
| 1000 | 2.38 ms (2.4 µs/obj) | 4.04 ms (4.0 µs/obj) | 3.81 ms (3.8 µs/obj) |
| 2000 | 4.93 ms (2.5 µs/obj) | 7.05 ms (3.5 µs/obj) | 8.88 ms (4.4 µs/obj) |

**First frame:** WebGL 46–240 ms, WebGPU 94–144 ms, WebGL2 fallback 260–360 ms.

**Findings:**
- WebGPURenderer costs **about 1.4–1.7× more CPU per object** than WebGLRenderer. The forum report predicted about 2×.
- The cost stays under 5 µs per object, the threshold we set in principles §13.
- At our cap of 400 draws, that's **about 1.6 ms**, well inside the 5 ms render budget.

**Decision:** keep WebGPURenderer with the WebGL2 fallback. Enforce the draw-call cap of 400 (hard cap 600) and instance everything repeated. Don't fall back to WebGLRenderer.

## Spike 2: bitECS vs Koota

Setup: 5,000 props, 300 zombies, 20 entities created and destroyed per tick (Node 24 / V8).

| Library | µs per sim tick |
|---|---|
| **bitECS** (our SoA typed arrays) | **56** |
| Koota, `useStores` (SoA fast path) | 105 |
| Koota, `updateEach` (ergonomic) | 219 |

**Decision: bitECS.** It's about 2× faster than Koota's fast path, and its stores are typed arrays we own. Those serialize directly for saves, workers and future co-op. Even the slowest option uses under 8% of the 3 ms sim budget, so the ECS will never be the bottleneck.

## Spike 3: float32 jitter far from the origin

Setup: the same camera-relative scene rendered 16 times, with the camera and object both nudged by k × 0.37 mm. We count pixels (out of 65,536) that differ from frame 0.

| Distance from origin | Max differing pixels | Notes |
|---|---|---|
| 0 | 0 | |
| 500 m | 1 | |
| **2.83 km (corner of a 4×4 km map)** | **5 (0.008%)** | Single edge pixels only. Invisible in motion |
| 5.66 km (corner of an 8×8 km map) | 10 | |
| 14 km | 43 | Starts to matter |

Results are **identical on the WebGPU and WebGL2 backends**. WebGPU's TSL path is as precise as WebGL's here.

**Decision:** no floating origin for a 4×4 km map centred on (0, 0, 0), as planned. Revisit if the map grows past about 8 km.

## Found while running the game (not a planned spike)

- **MSAA (`antialias: true`) crashes the WebGPU device on this laptop** when shadows are on. Chrome reported "A valid external Instance reference no longer exists" and, in the in-app pane, `DXGI_ERROR_DEVICE_HUNG`. With MSAA off the game runs cleanly.
  - **Decision:** no MSAA. Use an FXAA/SMAA pass, which is already in principles §13.
  - Also added: a recovery overlay when the device is lost, and a guard against 0-size canvases.
- **gltf-transform `prune()` strips UVs** when the GLB has no texture. Our GLBs have none, because the palette material is attached at runtime. The pipeline now uses `prune({ keepAttributes: true })`.
- **Auto-decimated LODs punch holes in kit-of-parts assets** (thin planks disappear). Such assets now get hand-made LODs via `m.lod(1)` / `m.lod(2)` in the Blender builder.
- **The in-app browser pane can't measure performance.** When hidden it doesn't run animation frames. Use the Playwright scripts (headed Chrome).

## M0 test yard baseline

Measured with `node tools/perf/smoke.mjs`, while walking and sprinting.

| Metric | Value | Budget |
|---|---|---|
| p50 frame | 6.9 ms (144 fps, display-capped) | |
| p99 frame | 7.0 ms | |
| Hitches | 0 | |
| Draw calls | 20 | |
| Triangles | 9.5k | |
| Sim | 0.11 ms | 3 ms |
| Physics | 0.06–0.09 ms | 2.5 ms |
| Render CPU | 0.75 ms | 5 ms |
| JS heap | 55 MB | |
