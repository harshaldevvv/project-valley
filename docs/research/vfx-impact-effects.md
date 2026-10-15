# Weapon and impact VFX for a stylized low-poly browser shooter

Scope: three.js r186, `WebGPURenderer` + TSL node materials, no MSAA, a 4 GB laptop GPU, flat-shaded palette-atlas art (Synty/Unturned look). Zero-cost: techniques and CC0 only.

Where we start: `src/gameplay/fx/fx.ts` already has a CPU ring-buffer system. It uses one `InstancedMesh` each for opaque box chips (256), decal planes (64), additive tracers (16) and translucent smoke (48), plus one muzzle-flash mesh and one always-present `PointLight`. This report keeps that design. It explains how to tune it and what to add, and it changes the architecture in only one place, for explosions later. Numbers in `docs/design/principles.md` §4 take precedence; this report adds to them and does not override them.

**Core idea.** In a flat-shaded game, the effects should be built like the world: small opaque meshes in palette colours, plus a few short-lived transparent elements. The usual realistic approach (big soft alpha sprites and flipbooks) clashes with the art, and its overdraw is the most expensive thing a 4 GB laptop GPU can be asked to draw.

---

## 1. Muzzle flash

**Shape.** Stylized games build the flash from 2–3 crossed quads stretched along the barrel, with a star or disc quad facing back toward the shooter. Real-time VFX artists' main advice is variety: one core shape repeated on every shot quickly looks repetitive (realtimevfx critique thread). Cheap ways to vary it:
- random roll around the barrel axis;
- length scale ×0.8–1.2;
- width scale ×0.9–1.1;
- one of 2–3 shapes chosen per shot (a 4-, 5- or 6-point star). This mirrors Boris FX's "variant + animated seed" model.

A flipbook needs an atlas texture and adds alpha overdraw, so leave it out. A solid unlit additive mesh in the palette's hot colour (`#ffcf70` core, `#ff8a3a` tips through vertex colour) suits the style better.

**Duration.** Show the flash for 1–2 rendered frames, up to 33 ms (principles §4). The time between shots comes from fire rate: 600 RPM means 10 shots/s, which is one shot every 6 frames at 60 fps (worked example from the Renderosity thread). The flash must be gone before the next shot, so full-auto fire reads as a flicker and not a solid blob. Skipping the flash on some shots is fine. Film animators show about 8 flashes/s for 10+ rounds/s, and doing the same also reduces flashing (see §9).

**Light.** Use one pooled `PointLight`, always in the scene, and change only its intensity. Adding or removing lights recompiles shaders in three.js, and `fx.ts` already avoids it. Peak intensity at the shot, linear decay to 0 over 50 ms, range 6 m. Vary the colour by a few percent on each shot, as the Valve muzzle-light tutorial does. Shadows off.

**Smoke.** After a burst of 3 or more shots, or every shot for shotguns, spawn 1–3 smoke cubes or icospheres at the muzzle. Give them low opacity (0.10–0.15), have them drift up at 0.3–0.6 m/s, grow from ×1 to ×3, and last 0.6–1.2 s. Keep them small. A muzzle puff should never be larger than about 0.4 m on screen in first person, or it covers the sights.

**Heat haze.** Skip it. It needs a scene-colour copy and a distortion pass, it is barely visible in a flat palette, and it costs fill rate every frame.

**First person vs third person.**
- First person: the flash is attached to the viewmodel muzzle socket and drawn in the viewmodel pass. Make it smaller, about 0.25–0.35 m long, because it sits close to the lens. Keep it away from the sight line: shift it forward and down, or fade it toward the sight picture while aiming down sights (ADS).
- Third person / other players: place it at the world muzzle position, larger (0.5–0.8 m) so it reads at 30–80 m, with no light beyond about 40 m.
- Zombies don't shoot, so the third-person flash matters only for co-op later.

### Rules for our game
- Flash: 1 merged mesh of 3 crossed quads and 1 disc, additive, `depthWrite:false`, visible ≤ 33 ms (2 frames at 60 fps). Roll random 0–360°, length ×0.8–1.2, 3 star variants.
- Light: 1 permanent `PointLight`, peak intensity 2–4 (tune), 50 ms linear decay, range 6 m, colour jitter ±5% hue. No second combat light.
- Smoke: 1–3 puffs per burst ≥ 3 shots (shotgun: 3 per shot), life 0.6–1.2 s, opacity ≤ 0.15, max size 0.4 m. Drawn from the existing 48-slot smoke pool.
- ADS: flash scale ×0.6 and offset 5 cm below the sight line.
- No heat haze, no flipbooks.

---

## 2. Shell ejection

Use a fake ballistic arc with no physics engine. On a shot, take the next casing from a pool, place it at the ejection port, give it an initial velocity, and simulate `v.y -= g·dt; p += v·dt` with spin. When it reaches the ground height under the port (for a quick test, the player's foot height), let it bounce once with ×0.3 damping, then rest. Fade it out by shrinking its scale.

Pooling advice (Godot casing thread, Unity pooling docs):
- pre-spawn the casings and recycle the oldest when the pool runs out;
- reset all state when a casing is reused;
- never allocate on a shot.

In our system a casing is a single box instance (brass `#c9a24a`, 1.2 × 0.4 × 0.4 cm, scaled up ×1.5 for readability) in its own `InstancedMesh`, or shared with the chip pool if we accept box-shaped brass.

Sound: play the brass "tink" on the first ground contact, not on ejection. It should land about 300–500 ms after the shot. Allow at most one tink per 80 ms per weapon, so full-auto fire doesn't stack identical clicks. Vary pitch by ±6%.

### Rules for our game
- Initial velocity in muzzle space: right 1.5–2.5 m/s, up 1.0–2.0 m/s, back 0–0.5 m/s, plus random ±0.3 on each axis. Spin 10–25 rad/s.
- Gravity 9.8, one bounce with damping 0.3, rest for 3 s, shrink to 0 over 0.3 s.
- Pool: 32 casings per player and 1 draw call. Recycle the oldest. Shotgun hulls use a separate colour (red `#a83a2a`), not a separate pool.
- First person: eject from the viewmodel port, rendered in world space so casings stay behind when the player turns.
- Tink sound on first contact, cooldown 80 ms, pitch ±6%.

---

## 3. Tracers

Real tracers are loaded only every Nth round. Games often draw every round for readability (TV Tropes, "Every Bullet Is a Tracer"). Mods that use a pattern usually choose a deterministic counter with a default of every 3rd shot, rather than a random roll. Speed is a trade-off: too fast and a tracer strobes (it appears for one frame), too slow and players feel they have to lead targets. Trail length works better tied to lifetime than to physical speed. A Unity example uses a 0.12-unit-wide trail with a 0.09 s lifetime.

Our weapons are hitscan, so a tracer is purely cosmetic. It is a stretched additive box that moves from the muzzle toward the hit point.

**Glow without bloom.** Use additive blending, a bright core colour (`#fff2c8`), and two nested boxes:
- a thin core, opacity 1;
- a sheath 2.5× wider, opacity 0.25.

On a dark palette this reads as a glow at zero post-processing cost. Keep the sheath thin: it is transparent, so it adds overdraw.

### Rules for our game
- Player tracers: every 3rd round for rifles and SMGs, first shot of each burst always. Shotguns: none (pellet impacts are enough). Pistols: none. Bolt action: every round.
- Visual speed 250–400 m/s (not real bullet speed), streak length 3–5 m, core width 1.5 cm, sheath 4 cm. Lifetime = distance / speed, capped at 0.25 s.
- Do not spawn a tracer within 4 m of the camera, because it reads as a screen-filling smear.
- Pool: 16 (already in `fx.ts`), 1 draw call.

---

## 4. Impact effects by surface

Layer each impact into a few small, short parts, like the meteor-strike breakdown in the sources (flash, burst of sparks or chips, dust, ground mark). Use GPU or cheap particles for everything that doesn't need collision. A stylized CC0 reference uses the same structure: bright yellow-white centre flash, a few radial sparks, a few chunky grey dust puffs, tiny shards. Tie particle count and speed to weapon calibre, the way the Niagara packs tie debris to bullet speed.

| Surface | Primary (opaque chips) | Secondary (transparent) | Decal | Audio cue |
|---|---|---|---|---|
| Dirt | 6–10 brown cubes, 4–7 cm, upward cone 35°, speed 2–3 m/s, life 0.6–0.8 s | 1 dust puff, life 0.8 s | dark soft disc | thud |
| Wood | 5–8 splinters (boxes scaled 1×1×4 along the normal), 3.5 m/s, spin | none | dark chip, 6 cm | crack |
| Metal | 6–10 sparks (2.5 cm, stretched along velocity), 6–8 m/s, life 0.15–0.25 s, gravity 6 | 1-frame white flash quad, 10 cm | grey dent, 4 cm | ping (pitch ±8%) |
| Concrete | 6–9 grey chips, 3 m/s | 1–2 dust puffs, life 0.8–1.0 s | dark chip, 6 cm | crack |
| Flesh (zombie) | 8–12 dark-red cubes along the normal and the shot direction, 2–3 m/s | 1 red mist puff, opacity 0.25, life 0.25 s | wall/floor splat via a ray up to 3 m behind the target (principles §4) | wet thwack |

Stretch sparks along their velocity: set instance scale z = speed × 0.02 and orient the box to the velocity. Fast stretched opaque boxes read as glowing sparks without any glow pass.

**Decals.** There are three options in three.js.

1. **`DecalGeometry`** builds new geometry by clipping the target mesh's triangles at hit time. The cost grows with target triangle count, and each decal is a separate mesh, so a separate draw call unless merged. A three.js forum thread traced a performance problem to the target's polygon count. This option is good only for rare, large, wrap-around decals such as a blood splat on a curved car body.
2. **Projected box decals** (deferred-style, sampling scene depth) look the best, but they need a depth texture pass and a custom TSL material. Overkill at our scale.
3. **Pooled quads offset along the normal**, as in `fx.ts`. One `InstancedMesh`, one draw call, no geometry rebuilt. On our flat walls and floors this is practically as good as option 1. The drawback is overhang on edges and corners: clamp the size, or skip decals whose four corners don't all lie on the hit surface (4 short raycasts, only for large splats).

**Z-fighting.** Two complementary fixes, both from the three.js forums:
- push the decal off the surface along the normal (0.001–0.01 m);
- `polygonOffset` with a negative factor.

Also keep camera near/far tight. A near of 0.001 with a far of 10 000 causes z-fighting everywhere; use near 0.1, far ≤ 1500.

Fade decals by shrinking them, or through a per-instance alpha attribute, never by popping them out. The pool recycles the oldest. Rotate each decal randomly about its normal and scale it ±20% so repeats don't tile visibly.

### Rules for our game
- Chips: opaque `MeshBasicMaterial` boxes in surface colours, 5–12 per impact. Shotgun pellets use ×0.4 each, so a 9-pellet blast spawns about 30 chips in total.
- Every impact: at most 1 transparent puff; metal gets a 1-frame white flash.
- Decals: pooled quads, offset 0.005 m along the normal + `polygonOffsetFactor -4`, random roll, size ±20%. 64 bullet decals and 32 blood decals in separate pools (blood stays longer). Fade over the last 2 s of a 30 s life, or when recycled.
- Do not use `DecalGeometry` for bullets. It is allowed only for event decals (≤ 8 alive) on curved props.
- Near plane ≥ 0.1 m.

---

## 5. Blood and gore for low poly

**Stylization.** Use chunky cubes or tetrahedra in two or three palette reds, not sprite droplets. The cubes match the faceted world, stay opaque (no sorting, early-Z works), and read well at a distance.

Palette:
- fresh: `#7a0f0c`
- dark: `#4a0806`
- zombie, slightly desaturated toward brown: `#5a1a10`

A separate zombie shade gives the game a "rotten" tone, and a green-black variant can be added for a special zombie type later.

Add a short, small red mist puff for volume. Keep the mist to a 0.2–0.3 s life: long mist is what turns gore into murk.

**Dismemberment basics** (principles §4 already gates *when*: only on a kill, or a limb hit of ≥ 40% of that limb's HP).
- Author each zombie limb as its own mesh, or as a bone you can scale to zero. Hide the limb and spawn a pre-cut limb prop with a flat red "cap" polygon at the cut.
- On the body side, a cap mesh parented to the parent bone covers the hole.
- Throw the limb prop with the ragdoll impulse and add 15–25 blood chips plus 1 splat decal.
- Pool limb props, 8 alive at most. Despawn the oldest, shrinking it over 0.5 s.
- Skinned-mesh mesh cutting at runtime is out of scope.

**Blood pools under corpses.** Use a flat disc or octagon decal (a low-poly circle reads as stylized) placed at the pelvis bone after the ragdoll settles. Scale it from 0 to 0.6–1.0 m radius over 4–6 s with an ease-out, then keep it until the corpse despawns. It uses the blood decal pool.

### Rules for our game
- Blood chips: 8–12 per body hit, 20 per headshot, 15–25 per dismemberment. Size 3–6 cm, life 0.5 s, then they "stick": rest for 0.5 s if they land on the ground, then shrink.
- Mist: 1 puff per hit, opacity ≤ 0.25, life ≤ 0.3 s.
- Gore settings: Full / Reduced (no dismemberment, half the chips) / Off (dust puffs replace blood). Default Full, with no age gate in M1.
- Corpse pools: 1 per corpse, max 12, radius 0.6–1.0 m, grow over 5 s.

---

## 6. Melee feedback

**Swing trail.** This is a ribbon mesh. Each frame of the active swing window, record two points (blade base and tip) in world space into a ring buffer of 12–16 samples. Rebuild a triangle strip from the samples. Fade alpha from 1 at the newest sample to 0 at the oldest (vertex colour alpha). Use one pre-allocated `BufferGeometry` per weapon slot, updated with `addUpdateRange` (r186) so only the active samples are uploaded. Unlit additive, or plain white alpha 0.35 for blunt weapons. Show the trail only during active frames, so its length matches the hit window and the player can read reach.

**Hit sparks / hit feedback.**
- Blades on flesh: blood chips (§5).
- Blunt on flesh: 3–4 dark chips plus one white "impact star" (flash quad, 1 frame).
- Any weapon on metal: sparks (§4).

Timings must match the existing hitstop table (light 50 ms, heavy 90–120 ms, kill 120–150 ms):
- particles spawn on the hit frame;
- particle simulation freezes during hitstop, because the hitstop slows only the target and the viewmodel;
- simulation resumes when hitstop ends, so the burst "pops" on release. This is the main reason melee hits feel heavy.

**Screen effects.**
- Trauma shake at 0.15 for a light hit, 0.3 for heavy (principles §4 slider).
- Optional 1-frame radial white vignette on a kill, opacity 0.15.
- No chromatic aberration and no full-screen flash.

### Rules for our game
- Trail: 14 samples, 1 draw call per equipped melee weapon, only during the active window, fades over 120 ms after the window ends.
- Blunt impact star: 1 frame, 25 cm.
- VFX simulation pauses during hitstop. The vignette is off when "Reduce flashing" is on.

---

## 7. Explosions (grenades, later)

Stylized approach (quirkbit "Creating Stylised Explosions" devlog, Unity dissolve tutorial, jMonkey icosphere thread): fireballs are **solid icospheres** that grow quickly, with a dissolve threshold animated from 0 to 1 against fractal noise. Rotating the noise lookup over time adds swirl. Drive the colour from a ramp over time: white, yellow, orange, dark grey. In TSL, this is a `MeshBasicNodeMaterial` with:
- `colorNode` as a ramp over a per-instance `age` attribute;
- an `alphaTest`-style `discard` when `noise(positionLocal*k + t) < age`.

The fireball stays **opaque with cutout**, so no sorting is needed. Without MSAA, `alphaToCoverage` does nothing, so we accept hard dissolve edges. They look intentionally stylized on flat-shaded geometry.

Event sequence (t in ms):
- **0**: white flash sphere, 1 frame, radius 1.5 m. Spike the combat `PointLight` to intensity 8, range 12 m, decay over 150 ms.
- **0–250**: 5–7 fireball icospheres (detail 1, about 80 triangles each), radius 0.4 → 1.6 m, ease-out, dissolve from 150 ms to 600 ms.
- **0–200**: shockwave ring, a flat torus or ring quad on the ground, radius 0.5 → 6 m, alpha 0.6 → 0, additive.
- **50**: 12–20 debris chips in surface colour, speed 6–12 m/s, gravity, life 1.5 s.
- **200–3000**: smoke column of 6–10 grey icospheres, opacity 0.35 at 0.5 m → 0 at 3 m, rising 1.2 m/s, growing ×3.
- **Camera trauma** by distance: 0.8 at ≤ 5 m, linear down to 0 at 25 m. Apply the low-pass audio filter from principles §4 within 8 m.
- **Decal**: 1 scorch decal (dark `#1d1a17` octagon, 2.5 m), 60 s life.

### Rules for our game
- Per explosion: ≤ 40 instances in total, ≤ 3 draw calls (fire/smoke icospheres, chips, ring).
- At most 4 explosions on screen; the oldest smoke is culled first.
- No sprite smoke.

---

## 8. Particle system implementation in three.js WebGPU

**Three tiers:**

1. **CPU pool + `InstancedMesh`** (our current baseline). The simulation is plain typed arrays, and matrices are written per frame with `instanceMatrix.setUsage(DynamicDrawUsage)`. CPU-updated particles typically top out in the tens to low hundreds of thousands (Utsubo's three.js tips). We need about 500, so this is plenty for M1–M3. Two cheap optimizations:
   - upload only the live range with `addUpdateRange(start, count)`;
   - set `mesh.count` to the high-water mark, so dead slots are not drawn at scale 0.
2. **GPU instanced with TSL vertex logic.** Keep a CPU ring buffer of *spawn parameters only* (origin, velocity, spawn time, colour), written once per spawn. A TSL `positionNode` evaluates `p0 + v·t + ½g·t²` and the spin on the GPU, so nothing is uploaded per frame. This is the recommended next step when particle counts or CPU frame time grow. It also handles billboarding: build the quad corners from the camera's right/up vectors in the vertex node. `SpriteNodeMaterial` does this for you.
3. **Compute particles.** `instancedArray(count,'vec3')` storage buffers are updated by `Fn(()=>{...})().compute(count)` and dispatched with `renderer.compute(node)` *before* `renderer.render`. They are rendered by a `SpriteNodeMaterial` (or an instanced mesh) whose `positionNode = positions.toAttribute()`, with `sprite.count = N` (official `webgpu_compute_particles` example). Use this for 10k+ ambient effects (embers, rain, ash) and for explosions if they ever get dense. Storage buffers need WebGPU; on the WebGL2 fallback, check this tier works or disable it.

**Libraries in 2026.**
- **three.quarks**: a mature WebGL particle system with feature parity with Unity's Shuriken. Its pages make no clear WebGPU/TSL support claim, and its `ShaderMaterial` approach does not work with `WebGPURenderer` node materials, so don't use it.
- **Three-VFX** (mustache-dev): advertises a high-performance particle system for three.js WebGPU. It is young and has few stars. Read its code for TSL patterns rather than adopting it.
- Our needs are small enough that our own ~400 lines stays cheaper than a dependency.

**Budgets: overdraw is the killer.**
- Transparent particles can't use early-Z, so every overlapping layer re-shades its pixels. Each pixel might be drawn 10–50 times.
- Particle cost is driven by **screen coverage**, not count.
- Fixes: keep sprites small, trim padding, use unlit/additive shaders, give effects short lifetimes, and set per-effect budgets.

Draw-call budget: aim for under about 100 draw calls on constrained hardware; desktops handle a few hundred. The `fx.ts` approach costs about 6–8 draw calls in total for every effect.

**Soft particles.** Use the TSL `viewportDepthTexture` / linear-depth node, with the fade `clamp((sceneDepth − particleDepth)/softness)`. This only matters for big smoke intersecting the ground. Our smoke is small and fades quickly, so **skip it** until we have gas clouds or fog banks.

**Sorting and blending.**
- Opaque chips: no sorting, cheapest.
- Additive (flash, tracer, sparks sheath): order-independent, so no sorting needed.
- Alpha-blended smoke and mist: few and small. Turn instance sorting off and accept small errors.
- `alphaToCoverage` needs MSAA, which we don't have. Use `alphaTest` discard or `alphaHash` for cutouts.

### Rules for our game
- Keep tier 1 for M1–M2. Move to tier 2 (GPU-evaluated ballistic `positionNode`) when FX CPU time exceeds 0.5 ms. Tier 3 is only for ambient weather and ash.
- Pools (alive caps): chips 256, smoke/mist 48, decals 64 + blood 32, tracers 16, casings 32, explosion 64. One `InstancedMesh` each. **≤ 10 FX draw calls total.**
- Fill budget: transparent FX should cover ≤ 15% of the screen at once (debug overlay: sum of projected puff areas). In first person, no single transparent quad larger than 0.4 m within 2 m of the camera.
- All FX materials unlit (`MeshBasicNodeMaterial`), shadows off, `frustumCulled=false` with pooled bounds. Never create a material per effect.
- Pre-warm every pool at load. Zero allocations per shot.

---

## 9. Readability and accessibility

**Colour language** (consistent everywhere):
- white/yellow sparks: hard target (metal, armour, vehicles);
- dark red chunky chips: flesh. This is the "you damaged it" signal. Keep red for flesh only, so the player never confuses it with a miss;
- brown/grey dust: miss on the environment;
- headshot: extra chunk burst + head-snap (principles §4) + the different hit-marker shape.

Effects should support the hit marker, not compete with it. The art-direction advice in the sources is that gameplay impact VFX should go subtle, with clarity coming from shape and colour, not size.

**Timing relative to hit markers.**
- The impact VFX spawns on the same frame as the hit marker (100–150 ms marker).
- Chips should peak visually within 50 ms.
- Nothing from a gunshot impact lasts longer than about 1 s except decals.
- Melee: freeze FX during hitstop (§6).

**Accessibility.**
- The broadcast photosensitivity consensus caps flashes at 3 per second. Sensitivity peaks around 10–25 flashes/s, and pattern sensitivity matters for game seizures. Full-auto muzzle flash (10 shots/s) with a lit scene is exactly in the risky band.
- Add a **Reduce flashing** option (also exposed in the first-run settings):
  - muzzle light off;
  - flash shown on at most 1 shot in 3 and at 50% brightness;
  - explosion flash replaced by a fade;
  - no full-screen vignette flashes.
- Combine it with the existing shake slider and a gore setting.
- Large bright flashes should never cover more than about 25% of the screen.

### Rules for our game
- Red = flesh, yellow/white = hard target, brown/grey = miss. No exceptions.
- The impact frame is the hit-marker frame. Impact particles live ≤ 1 s.
- Settings: Reduce flashing (default off, prompted at first run), Gore (Full/Reduced/Off), Shake 0–100% (default 70%).
- With Reduce flashing on, the muzzle light is disabled and flash luminance goes ≤ 3 times per second.

---

## Implementation plan for Project Valley

**Order of work** (each step is playable on its own):
1. Move the `SURFACE_FX` / `DECAL_COLOR` tables from `fx.ts` into `src/content/data/fx.ts` (rule: all tunables in `src/content/data/`). Add sparks stretched along velocity, the metal flash, and a separate blood decal pool.
2. Shell casings (32-slot pool, fake arc, tink sound on contact).
3. Tracer pattern (every 3rd round, first shot of a burst) and the near-camera cull.
4. Muzzle-flash variants + Reduce flashing setting.
5. Melee ribbon trail + hitstop-frozen FX.
6. Blood pools under corpses; dismemberment caps when the zombie art supports separate limbs.
7. (Grenades milestone) Explosion pool with a TSL dissolve material.
8. (Only if profiling demands it) tier-2 GPU-evaluated particles.

**Data-driven effect table shape** (plain data, so the simulation stays separate from rendering):

```ts
// src/content/data/fx.ts
export interface BurstDef {
  pool: 'chips' | 'smoke' | 'flash';
  count: [min: number, max: number];
  color: string[];             // palette hexes, picked at random
  size: [number, number];      // metres
  speed: [number, number];     // m/s
  cone: number;                // degrees around the hit normal (or shot dir if `alongShot`)
  alongShot?: number;          // 0..1 blend of normal → shot direction
  gravity: number;
  life: [number, number];      // seconds
  stretch?: number;            // velocity stretch (sparks)
  opacity?: number;
}
export interface ImpactDef {
  bursts: BurstDef[];
  decal?: { pool: 'bullet' | 'blood' | 'scorch'; color: string; size: [number, number]; life: number };
  sfx: string;                 // audio id
}
export const IMPACTS: Record<Surface, ImpactDef>;
export const WEAPON_FX: Record<WeaponId, {
  flash: { variants: number; length: number; light: number };
  tracerEvery: number;         // 0 = never
  casing: 'brass' | 'hull' | null;
  impactScale: number;         // multiplies burst counts/sizes (calibre)
}>;
```

`Fx.impact(surface, pos, normal, shotDir, scale)` reads `IMPACTS[surface]`. Gameplay code never passes colours or counts directly.

**Perf report items for each milestone:**
- FX draw calls (≤ 10);
- FX CPU ms (≤ 0.5);
- live instances per pool;
- worst-case transparent screen coverage, measured in a 10-zombie full-auto test.

---

## Reading list
- three.js `webgpu_compute_particles` example (TSL compute + `SpriteNodeMaterial`) — the reference for tier 3.
- Utsubo, "100 Three.js Tips That Actually Improve Performance (2026)" — instancing, pooling, `addUpdateRange`, draw-call budgets.
- quirkbit devlog "Creating Stylised Explosions" — fractal noise dissolve with swirl.
- GDC 2017 "Art Directing VFX for Stylized Games"; GDC 2020 "Shader Sauce"; GDC "Controlled Chaos: 12 Principles of Design for VFX".
- realtimevfx.com GDC VFX roundtable notes.
- Harding/consensus photosensitivity material (Wikipedia: Harding test, Photosensitive epilepsy).

## Sources
- https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html
- https://www.utsubo.com/blog/threejs-best-practices-100-tips
- https://gittrend.io/repo/mustache-dev/Three-VFX
- https://lesscad.mattermanifest.com/runtime (three.quarks)
- https://gdcvault.com/play/1023999/Art-Directing-VFX-for-Stylized
- https://gamedeveloper.com/design/video-tips-on-art-directing-vfx-for-stylized-games
- https://gdcvault.com/play/1027131/Visual-Effects-Summit-Shader-Sauce
- https://schedule.gdconf.com/session/controlled-chaos-12-principles-of-design-for-vfx/914747
- https://realtimevfx.com/t/gdc-2023-vfx-roundtable-discussion-notes/23367
- https://realtimevfx.com/t/flipbook-frame-offset-on-muzzle-flashes-for-greater-variations/28301
- https://realtimevfx.com/t/trying-to-develop-my-first-showreel/4701
- https://api.renderosity.com/forums/comments/2998045/permalink
- https://borisfx.com/documentation/sapphire/ae/muzzleflash/
- https://developer.valvesoftware.com/wiki/Adding_Muzzle_Flashes_that_lights_up_the_world
- https://www.oreilly.com/library/view/unity-android-game/9781849692014/ch08s08.html
- https://tropedia.fandom.com/wiki/Every_Bullet_Is_a_Tracer
- https://mods.factorio.com/mod/visual_tracers_mg
- https://nexusmods.com/fallout4/mods/17815
- https://discussions.unity.com/t/bullet-tracer-effect-with-fps-machine-gun-script-tutorial/421673
- https://forums.sixdays.com/main/viewtopic.php?p=3337
- https://www.therookies.co/projects/92115
- https://www.summerengine.com/asset-store/stylized-bullet-impact-vfx-0237bb83
- https://discourse.threejs.org/t/fighting-with-decal-z-fighting-i-have-found-a-solution-but-i-cannot-understand-how-to-implement-it/74691
- https://discourse.threejs.org/t/moving-decal-performance-issue/72467
- https://discourse.threejs.org/t/soft-particles-rendering-performance/27610
- https://bugnet.io/blog/how-to-fix-particle-overdraw-killing-mobile-performance
- https://docs.unity3d.com/cn/2023.1/Manual/OptimizingGraphicsPerformance.html
- https://discussions.unity.com/t/why-is-overdraw-fill-rate-such-an-issue-on-mobile-dev/459136
- https://quirkbit.itch.io/adrift-arena/devlog/122433/creating-stylised-explosions
- https://mirzabeig.substack.com/p/unity-tutorial-dissolve-shader-part-1
- https://hub.jmonkeyengine.org/t/icosphere-explosions/39993
- https://red.127.pp.ua/r/godot/comments/1ip4yp5/quick_bullet_casing_overview
- https://docs.unity.com/en-us/engine/6000.0/manual/analysis/performance-memory/managed-memory/optimizing-code-managed-memory/reusable-code
- https://en.wikipedia.org/wiki/Harding_test
- https://en.wikipedia.org/wiki/Photosensitive_epilepsy
- https://research.aston.ac.uk/en/publications/video-games-and-seizures-a-review/
- https://bugnet.io/blog/qa-testing-for-photosensitivity-and-seizure-safety

Note: no source specific to Unturned or Deep Rock Galactic VFX was found. The stylized recommendations here are drawn from the general stylized-VFX talks and devlogs above, plus our art bible.
