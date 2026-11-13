# Credits

The code is MIT licensed (see `LICENSE`). The 3D models, textures and item icons are original:
they are built by the Blender scripts in `tools/blender/` and are covered by the same MIT licence.

Everything below is third-party work used under its own licence. The full per-file table is in
[`docs/pipeline/asset-credits.md`](docs/pipeline/asset-credits.md).

## Animation

**100STYLE dataset** by Ian Mason, Sebastian Starke and Taku Komura, licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
https://www.ianxmason.com/100style/ (Zenodo record 8127870)

Used for the survivor's idle, walk, run, strafe and crouch clips, and the zombies' walk, run,
idle, limp, drag, drunk, old and bent-forward clips. Modified: retargeted to our rig, cycles cut,
stride and speed warped, feet locked. The raw BVH files are not redistributed.

**CMU Graphics Lab Motion Capture Database**, http://mocap.cs.cmu.edu/, via the cgspeed BVH
conversion by Bruce Hahne. Trials 69_13, 104_41, 120_22, 104_03, 111_03 and 105_59 (turns in place,
zombie walks, crawl, stagger). Retargeted and edited; raw files are not redistributed.
The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with
funding from NSF EIA-0196217.

## Audio (all CC0)

| Sounds | Source | Author |
|---|---|---|
| Footsteps, impacts, hit markers, building | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | Kenney |
| UI clicks, open, close, confirm | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | Kenney |
| Reload, bolt, crates, cloth, item pickup | [RPG Audio](https://kenney.nl/assets/rpg-audio) | Kenney |
| Pistol and rifle shots | [Gunshots](https://opengameart.org/content/gunshots) | kurt |
| Pistol, rifle and shotgun shots | [Gunshot Sounds](https://opengameart.org/content/gunshot-sounds) | tabasco |
| Zombie groans, alerts, attacks, deaths | [Zombies Sound Pack](https://opengameart.org/content/zombies-sound-pack) | artisticdude |
| Zombie groans | [Undead Moans](https://opengameart.org/content/undead-moans) | AntumDeluge |
| Zombie groans | [Zombie moans](https://opengameart.org/content/zombie-moans) | darsycho |
| Car engine, start, horn, doors | [Car Sound Effects Pack](https://opengameart.org/content/car-sound-effects-pack-low-quality) | ggbotnet |
| Music while exploring | [EmptyCity: Background Music](https://opengameart.org/content/emptycity-background-music) | yd |
| Music when zombies close in | [Medium Alert](https://opengameart.org/content/medium-alert) | Sudocolon |
| Wind | [wind whoosh loop](https://opengameart.org/content/wind-whoosh-loop) | SketchMan3 |
| Birds by day | [AMB Morning Sounds (Perfect Loop)](https://opengameart.org/content/amb-morning-sounds-perfect-loop) | Kresiek The Furry |
| Crickets at night | [Crickets Ambient Noise - loopable](https://opengameart.org/content/crickets-ambient-noise-loopable) | Wolfgang_ |
| Crows | [Crows singing](https://opengameart.org/content/crows-singing) | IgnasD |
| Crow call | [Crow caw](https://opengameart.org/content/crow-caw) | zeroisnotnull |

CC0 needs no attribution. They are listed here as thanks.

## Code libraries

| Library | Used for | Licence |
| --- | --- | --- |
| [three.js](https://threejs.org) | Rendering (WebGPU) | MIT |
| [Rapier](https://rapier.rs) (`@dimforge/rapier3d-compat`) | Physics | Apache-2.0 |

Build tools (Vite, TypeScript, glTF Transform, meshoptimizer) are used only to build the game and are not shipped
except for the meshopt decoder that ships with three.js.

## AI-generated assets (made locally, 2026-11-13)

| Asset | Made with | Licence of the model |
|---|---|---|
| Detail textures `public/assets/textures/{grass,dirt,concrete,grunge}.png` | z-image-turbo (ComfyUI) | Apache-2.0 |
| Wall decals `public/assets/textures/decals/*.png` (spray paint, stencils, chalk tallies) | z-image-turbo | Apache-2.0 |
| Ambient look: bloom, grade, clouds, grass, motes | original code | MIT |
| Sound effects `public/assets/audio/gen/*.ogg` (melee swings, flesh impacts, headshot crack, body fall) | stable-audio3-sfx | Stability AI Community licence (free under about $1M annual revenue): check before a commercial release |
| Optional scores `public/assets/audio/gen/music_*.ogg` (play with `?music=ai`; loop points crossfaded) | ACE-Step 1.5 XL | Apache-2.0; not yet listened to by the author of this change |
| Loading screen key art `public/assets/art/keyart.jpg` | z-image-turbo | Apache-2.0 |
| Rain loop `public/assets/audio/gen/rain_loop.ogg` | stable-audio3-sfx | Stability AI Community licence |

## Polyfork catalog models (CC BY 4.0)

Props, buildings and trees in `public/assets/models/pf/` come from the Polyfork catalog, https://polyfork.dev
(index: https://github.com/lucas-martinic/polyfork-catalog), used under the CC BY 4.0 option of their licence
(https://polyfork.dev/licensing). Changes: rescaled to the in-game height, instanced or merged, wind sway on trees. Credit format: *Name by Polyfork (page URL), CC BY 4.0*.

| Model | Page |
|---|---|
| Alpine Hay Barn by Polyfork | https://polyfork.dev/asset/alpine-hay-barn-3965e5 |
| Ammo Crate by Polyfork | https://polyfork.dev/asset/ammo-crate-ee3ec0 |
| Birch Tree by Polyfork | https://polyfork.dev/asset/birch-tree-181b33 |
| Boxy-sedan-70s by Polyfork | https://polyfork.dev/asset/boxy-sedan-70s-7d55f7 |
| Brass water tower by Polyfork | https://polyfork.dev/asset/brass-water-tower-b0c6d9 |
| Bush by Polyfork | https://polyfork.dev/asset/bush-8bb596 |
| Camp Tent by Polyfork | https://polyfork.dev/asset/camp-tent-3c5c89 |
| Campfire by Polyfork | https://polyfork.dev/asset/campfire-4390aa |
| Cargo Container by Polyfork | https://polyfork.dev/asset/cargo-container-fd73bc |
| Clapboard Church by Polyfork | https://polyfork.dev/asset/clapboard-church-03a6f5 |
| Construction Dumpster by Polyfork | https://polyfork.dev/asset/construction-dumpster-2de7ae |
| Dead Tree by Polyfork | https://polyfork.dev/asset/dead-tree-6795fa |
| Delivery Truck by Polyfork | https://polyfork.dev/asset/delivery-truck-a9537e |
| Fire Lookout Tower by Polyfork | https://polyfork.dev/asset/fire-lookout-tower-714fa1 |
| Fuel Depot by Polyfork | https://polyfork.dev/asset/fuel-depot-e57cdc |
| Fuel Drum by Polyfork | https://polyfork.dev/asset/fuel-drum-d65fa4 |
| Gabled Farmhouse by Polyfork | https://polyfork.dev/asset/gabled-farmhouse-c7534f |
| Grain Silo by Polyfork | https://polyfork.dev/asset/grain-silo-58ca67 |
| Oak Tree by Polyfork | https://polyfork.dev/asset/oak-tree-50ee7c |
| Site Generator by Polyfork | https://polyfork.dev/asset/site-generator-298792 |
| Sofa by Polyfork | https://polyfork.dev/asset/sofa-9c0e7e |
| Tall Pine Tree by Polyfork | https://polyfork.dev/asset/tall-pine-tree-ab4108 |
| Tyre Stack by Polyfork | https://polyfork.dev/asset/tyre-stack-ad4692 |
| Young Pine by Polyfork | https://polyfork.dev/asset/young-pine-0d7695 |
