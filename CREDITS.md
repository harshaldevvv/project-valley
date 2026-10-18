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

CC0 needs no attribution. They are listed here as thanks.

## Libraries

- [three.js](https://threejs.org/) (MIT)
- [Rapier](https://rapier.rs/) physics (Apache 2.0)
- [Vite](https://vite.dev/), [Vitest](https://vitest.dev/), [glTF Transform](https://gltf-transform.dev/), [meshoptimizer](https://meshoptimizer.org/) (MIT)

## Code libraries

| Library | Used for | Licence |
| --- | --- | --- |
| [three.js](https://threejs.org) | Rendering (WebGPU) | MIT |
| [Rapier](https://rapier.rs) (`@dimforge/rapier3d-compat`) | Physics | Apache-2.0 |

Build tools (Vite, TypeScript, glTF Transform, meshoptimizer) are used only to build the game and are not shipped
except for the meshopt decoder that ships with three.js.
