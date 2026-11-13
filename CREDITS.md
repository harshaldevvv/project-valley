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
| 8 props in `public/assets/models/gen/` (sedan wreck, tent, sandbags, barrels, dead tree, generator, pallets, dumpster): concept picture from z-image-turbo, mesh and texture from Hunyuan3D-2.1, cleaned in Blender (`tools/audit/fit_glb.py`) | z-image-turbo, Hunyuan3D-2.1 | Apache-2.0; Tencent Hunyuan community licence (not valid in the EU, UK and South Korea): owner decision needed, see `docs/progress/2026-11-13-overnight.md` |
| Distant buildings (barn, ruined houses, gas station, church, water tower, silo) in `public/assets/models/gen/` | z-image-turbo, Hunyuan3D-2.1 | Apache-2.0; Tencent Hunyuan community licence (not valid in the EU, UK and South Korea) |
| Wall decals `public/assets/textures/decals/*.png` (spray paint, stencils, chalk tallies) | z-image-turbo | Apache-2.0 |
| Ambient look: bloom, grade, clouds, grass, motes | original code | MIT |
| Survivor and 4 zombie variants `chr_survivor_a.glb`, `zmb_ai_*.glb` (picture, mesh and texture; skinned to the project's own rig in Blender with `tools/audit/retarget_char.py`) | z-image-turbo, Hunyuan3D-2.1 | Apache-2.0; Tencent Hunyuan community licence (not valid in the EU, UK and South Korea) |
| Sound effects `public/assets/audio/gen/*.ogg` (melee swings, flesh impacts, headshot crack, body fall) | stable-audio3-sfx | Stability AI Community licence (free under about $1M annual revenue): check before a commercial release |
| Optional scores `public/assets/audio/gen/music_*.ogg` (play with `?music=ai`; loop points crossfaded) | ACE-Step 1.5 XL | Apache-2.0; not yet listened to by the author of this change |
| Loading screen key art `public/assets/art/keyart.jpg` | z-image-turbo | Apache-2.0 |
