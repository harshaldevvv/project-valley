# Art bible

The contract every asset and scene follows. Budgets are first estimates, refined once the engine research and the first perf test land.

## Look
- **Stylized low-poly, grounded proportions.** Realistic human scale and silhouettes (not chunky cartoon), flat-shaded faces, chamfered edges on anything man-made, detail through shape rather than texture.
- **Setting:** a post-collapse river valley in the Pacific Northwest, about 5 years after the outbreak. Seasons run late summer → autumn → winter.
- **Mood:** faded paint, rust, moss and overgrowth reclaiming everything, abandoned in a hurry.
- **The lighting does the heavy lifting.** Time of day, fog, sun shafts, wet surfaces, dark nights and flashlights are what make low-poly look premium.
- **Not an asset flip.** Every asset is built for this game in one palette. CC0 bases are reshaped and repainted, never dropped in as-is.

## Palette atlas
- One shared **256×256 palette texture** made of 16×16 swatches, 256 colours. Each swatch is a soft vertical gradient (lighter top, darker bottom) for cheap built-in shading.
- Every face is UV-mapped into a swatch, so most assets use **one material**, which keeps batching and instancing cheap.
- An optional second **512×512 detail atlas** holds decals: signs, posters, labels, graffiti, blood.
- Palette groups:
  - **Nature:** bark, leaves (4 seasons), grass, moss, rock, dirt, sand, snow.
  - **Built:** concrete, brick, wood siding, roofing, asphalt, road paint, rust metal, painted metal (faded red/blue/green/yellow/white).
  - **Cloth and skin:** fabric (denim, olive drab, khaki, black, faded colours), 6 skin tones, zombie skin (grey-green, bruised).
  - **Signal colours** (reserved for gameplay meaning only):

| Colour | Meaning |
|---|---|
| Hazard orange | Interactables and loot highlight |
| Radiation green | Radiation |
| Infestation crimson | Infestations |
| Military olive + stencil white | Military areas |
| Rarity colours | Common white, Uncommon green, Rare blue, Epic purple, Legendary gold; Damaged is a grey condition tag |

- **Material roughness:** 0.85 by default. Metal 0.45. Wet surfaces lower roughness through a weather shader, not a texture.

## Scale (1 unit = 1 m)
- Player height: 1.80 m.
- Door: 0.9 × 2.1 m.
- Storey height: 3.0 m.
- Wall thickness: 0.2 m.
- Stairs: 0.18 m rise, 0.28 m run.
- Window sill: 0.9 m.
- Road lane: 3.5 m.
- Vehicles follow real dimensions. For example, a pickup is about 5.3 × 2.0 × 1.9 m.
- Modular building grid: 1.0 m. Base-building grid: 1.5 m. Pieces snap.

## Triangle budgets (LOD0, then LOD1 / LOD2 targets)

| Category | LOD0 | LOD1 | LOD2 |
|---|---|---|---|
| Small prop (can, bottle, tool) | 50–300 | — | — |
| Medium prop (crate, chair, bin) | 200–1,200 | 50% | 15% |
| Large prop (car wreck, dumpster) | 1,000–4,000 | 40% | 10% |
| Weapon, first-person view | 3,000–6,000 | — | — |
| Weapon, world / third-person | 800–2,000 | 40% | — |
| Drivable vehicle | 4,000–10,000 | 40% | 10% |
| House (exterior + interior) | 4,000–12,000 | 30% | impostor |
| Large POI building | 10,000–30,000 | 30% | impostor |
| Player character | 5,000–8,000 | 50% | 20% |
| Zombie (instanced, VAT) | 2,000–4,000 | 50% | 20% |
| Tree | 600–2,000 | 30% | billboard |

Every asset gets a collider:
- **Box** for simple props.
- **Convex hull** for rocks and wrecks.
- **Compound boxes** for buildings, with doorways left open.

## Frame budget (60 fps = 16.6 ms) — authoritative numbers are in principles.md §13
- **Draw calls:** at most 400 (hard cap 600), shadow passes included.
- **Triangles:** at most 1.5 M visible, 500 k in shadow passes.
- **GPU memory:** at most 1.5 GB total (textures ≤ 900 MB KTX2, geometry ≤ 300 MB).
- **Simulation (CPU main thread):** at most 4 ms. This covers gameplay, AI decisions and physics step.
- **Render submission (CPU):** at most 4 ms.
- **Crowd and pathfinding:** run in a worker.

## Naming and files
- **Asset id:** `category_name_variant`, for example `prop_crate_wood_a`, `bld_house_suburban_02`, `veh_pickup_rust`, `wpn_ak74`, `zmb_shambler_male_a`.
- **Source:** `assets/source/<category>/<id>/build.py` plus a `.blend` file.
- **Output:** `public/assets/models/<category>/<id>.glb`.
- **Preview:** `assets/previews/<id>.png`.
- **Inside a GLB:**
  - The root node is named after the asset id.
  - LODs are named `<id>_LOD0/1/2`.
  - Colliders are named `<id>_COL_*`, carry no material, and are hidden.
  - Sockets are empties named `SOCKET_<name>`, for example `SOCKET_muzzle`, `SOCKET_hand_r`, `SOCKET_scope`.
- **Origin:** at the base centre, except weapons, which use the grip.
- **Axes:** +Y up. Front faces −Z, the glTF convention.
