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
| Pistol, rifle and shotgun shots and tails (1911, PPQ, AK-47, AR-15, SKS, Nova, Model 12) | [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) | Ben Jaszczak et al. |
| Magazine and bolt sounds | [Gun reload sounds](https://opengameart.org/content/gun-reload-sounds) | Joaken |
| Knife and melee swings | [20 Sword Sound Effects](https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes), [3 melee sounds](https://opengameart.org/content/3-melee-sounds) | StarNinjas, qubodup |
| Knife stab | [150 Combat Sound Effects](https://opengameart.org/content/150-combat-sound-effects) (Kenney RPG Audio) | Kenney, MedicineStorm |
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
| Student with Backpack by Polyfork (player hero `chr_hero_pf`: our survivor animation clips retargeted onto its skeleton by `tools/audit/retarget_pf_hero.py`, turned to face -Z, meshes joined, backpack kept as a separate part) | https://polyfork.dev/asset/student-with-backpack-65d2b4 |
| Player in Flannel by Polyfork (gloves part only, worn by the player hero) | https://polyfork.dev/asset/player-in-flannel-d0bae4 |
| Infantry Rifleman by Polyfork (wearable parts for the player hero: hat_infantry, bottom_infantry, feet_combat, belt_webbing; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/infantry-rifleman-c1c0a5 |
| Construction Worker by Polyfork (wearable parts for the player hero: hat_hardhat, coat_hivis, bottom_work; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/construction-worker-c1ad8c |
| Firefighter by Polyfork (wearable parts for the player hero: hat_firefighter, coat_firefighter, hands_tactical; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/firefighter-b13b36 |
| Trucker by Polyfork (wearable parts for the player hero: hat_trucker, bottom_jeans; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/trucker-9266a8 |
| Police Officer by Polyfork (wearable parts for the player hero: hat_police, bottom_police; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/police-officer-1cc379 |
| Park Ranger by Polyfork (wearable parts for the player hero: hat_ranger; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/park-ranger-c1697e |
| Outlaw by Polyfork (wearable parts for the player hero: hat_cowboy, coat_duster, neck_bandana; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/outlaw-e0fd6a |
| Skier by Polyfork (wearable parts for the player hero: hat_beanie, eyes_goggles, coat_skier, hands_winter; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/skier-e7ad44 |
| Hiker by Polyfork (wearable parts for the player hero: hat_bucket, coat_hiker, feet_hiker, back_hiker; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/hiker-3d1a41 |
| Field Medic by Polyfork (wearable parts for the player hero: hat_medic, back_medic; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/field-medic-fd8919 |
| Highway Patrol Officer by Polyfork (wearable parts for the player hero: eyes_sunglasses, belt_duty; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/highway-patrol-officer-e81282 |
| Village Mechanic by Polyfork (wearable parts for the player hero: eyes_workgoggles, belt_tools; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/village-mechanic-508a0a |
| Mountaineer by Polyfork (wearable parts for the player hero: coat_mountain; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/mountaineer-13df29 |
| Forest Ranger by Polyfork (wearable parts for the player hero: coat_ranger, feet_ranger; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/forest-ranger-6906b0 |
| Squad Officer by Polyfork (wearable parts for the player hero: coat_police; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/squad-officer-e5c52b |
| Student In A Hoodie by Polyfork (wearable parts for the player hero: coat_hoodie; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/student-in-a-hoodie-7c8223 |
| Lake Angler by Polyfork (wearable parts for the player hero: coat_fishvest, feet_rubber; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/lake-angler-1c4740 |
| Backpacker by Polyfork (wearable parts for the player hero: back_big; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/backpacker-f56207 |
| Paramedic by Polyfork (wearable parts for the player hero: back_satchel; `chr_hero_pf_parts.glb`) | https://polyfork.dev/asset/paramedic-b0f358 |
| Farmer by Polyfork (zombie `zmb_pfz_farmer_a`: vertex colours zombified by `tools/audit/zombify_pf.py`, held props removed, our zombie clips retargeted) | https://polyfork.dev/asset/farmer-304a43 |
| Trucker by Polyfork (zombie `zmb_pfz_trucker_a`: vertex colours zombified by `tools/audit/zombify_pf.py`, held props removed, our zombie clips retargeted) | https://polyfork.dev/asset/trucker-9266a8 |
| Police Officer by Polyfork (zombie `zmb_pfz_police_a`: vertex colours zombified by `tools/audit/zombify_pf.py`, held props removed, our zombie clips retargeted) | https://polyfork.dev/asset/police-officer-1cc379 |
| Construction Worker by Polyfork (zombie `zmb_pfz_worker_a`: vertex colours zombified by `tools/audit/zombify_pf.py`, held props removed, our zombie clips retargeted) | https://polyfork.dev/asset/construction-worker-c1ad8c |
| Ward Nurse by Polyfork (zombie `zmb_pfz_nurse_a`: vertex colours zombified by `tools/audit/zombify_pf.py`, held props removed, our zombie clips retargeted) | https://polyfork.dev/asset/ward-nurse-84b61d |
| Hiker by Polyfork (zombie `zmb_pfz_hiker_a`: vertex colours zombified by `tools/audit/zombify_pf.py`, held props removed, our zombie clips retargeted) | https://polyfork.dev/asset/hiker-3d1a41 |
| Suburban Resident by Polyfork (zombie `zmb_pfz_resident_a`: vertex colours zombified by `tools/audit/zombify_pf.py`, held props removed, our zombie clips retargeted) | https://polyfork.dev/asset/suburban-resident-a9db9c |
| Diner Waitress by Polyfork (zombie `zmb_pfz_waitress_a`: vertex colours zombified by `tools/audit/zombify_pf.py`, held props removed, our zombie clips retargeted) | https://polyfork.dev/asset/diner-waitress-60f6a1 |
| Infantry Rifleman by Polyfork (zombie `zmb_pfz_soldier_a`: vertex colours zombified by `tools/audit/zombify_pf.py`, held props removed, our zombie clips retargeted) | https://polyfork.dev/asset/infantry-rifleman-c1c0a5 |
| Patient in Gown by Polyfork (zombie `zmb_pfz_patient_a`: vertex colours zombified by `tools/audit/zombify_pf.py`, held props removed, our zombie clips retargeted) | https://polyfork.dev/asset/patient-in-gown-fdab75 |
| Student in a Hoodie by Polyfork (zombie `zmb_pfz_hoodie_a`: vertex colours zombified by `tools/audit/zombify_pf.py`, held props removed, our zombie clips retargeted) | https://polyfork.dev/asset/student-in-a-hoodie-7c8223 |
| Firefighter by Polyfork (zombie `zmb_pfz_firefighter_a`: vertex colours zombified by `tools/audit/zombify_pf.py`, held props removed, our zombie clips retargeted) | https://polyfork.dev/asset/firefighter-b13b36 |
| Abandoned Shopping Trolley by Polyfork | https://polyfork.dev/asset/abandoned-shopping-trolley-3de6cb |
| Alcove Bookcase by Polyfork | https://polyfork.dev/asset/alcove-bookcase-83894d |
| Alpine Hay Barn by Polyfork | https://polyfork.dev/asset/alpine-hay-barn-3965e5 |
| Ammo Crate by Polyfork | https://polyfork.dev/asset/ammo-crate-ee3ec0 |
| Arc Floor Lamp by Polyfork | https://polyfork.dev/asset/arc-floor-lamp-fa0b5f |
| Area Rug by Polyfork | https://polyfork.dev/asset/area-rug-5c56e2 |
| Back Bar Shelf Unit by Polyfork | https://polyfork.dev/asset/back-bar-shelf-unit-11ab89 |
| Barbed Wire Fence Section by Polyfork | https://polyfork.dev/asset/barbed-wire-fence-section-a01906 |
| Bed by Polyfork | https://polyfork.dev/asset/bed-6e10e8 |
| Bedside Table by Polyfork | https://polyfork.dev/asset/bedside-table-3f2b80 |
| Birch Tree by Polyfork | https://polyfork.dev/asset/birch-tree-181b33 |
| Bistro Table by Polyfork | https://polyfork.dev/asset/bistro-table-877a6d |
| Board Privacy Fence Run by Polyfork | https://polyfork.dev/asset/board-privacy-fence-run-319bef |
| Boxy-sedan-70s by Polyfork | https://polyfork.dev/asset/boxy-sedan-70s-7d55f7 |
| Brass water tower by Polyfork | https://polyfork.dev/asset/brass-water-tower-b0c6d9 |
| Bus Shelter by Polyfork | https://polyfork.dev/asset/bus-shelter-f786b4 |
| Bush by Polyfork | https://polyfork.dev/asset/bush-8bb596 |
| Camp Tent by Polyfork | https://polyfork.dev/asset/camp-tent-3c5c89 |
| Campfire by Polyfork | https://polyfork.dev/asset/campfire-4390aa |
| Cardboard Delivery Box by Polyfork | https://polyfork.dev/asset/cardboard-delivery-box-59cc68 |
| Cargo Container by Polyfork | https://polyfork.dev/asset/cargo-container-fd73bc |
| Clapboard Church by Polyfork | https://polyfork.dev/asset/clapboard-church-03a6f5 |
| Collapse Rubble Mound by Polyfork | https://polyfork.dev/asset/collapse-rubble-mound-4fbfed |
| Compact Hatchback by Polyfork | https://polyfork.dev/asset/compact-hatchback-386417 |
| Construction Dumpster by Polyfork | https://polyfork.dev/asset/construction-dumpster-2de7ae |
| Dead Tree by Polyfork | https://polyfork.dev/asset/dead-tree-6795fa |
| Delivery Truck by Polyfork | https://polyfork.dev/asset/delivery-truck-a9537e |
| Dining Chair by Polyfork | https://polyfork.dev/asset/dining-chair-530532 |
| Dorm Wardrobe by Polyfork | https://polyfork.dev/asset/dorm-wardrobe-b10546 |
| Field Barricade by Polyfork | https://polyfork.dev/asset/field-barricade-a646b9 |
| Field Grave Marker by Polyfork | https://polyfork.dev/asset/field-grave-marker-15380b |
| Filing Cabinet by Polyfork | https://polyfork.dev/asset/filing-cabinet-f8a251 |
| Fire Lookout Tower by Polyfork | https://polyfork.dev/asset/fire-lookout-tower-714fa1 |
| Firewood Stack by Polyfork | https://polyfork.dev/asset/firewood-stack-810f49 |
| Fridge Freezer by Polyfork | https://polyfork.dev/asset/fridge-freezer-fb9b5a |
| Fuel Depot by Polyfork | https://polyfork.dev/asset/fuel-depot-e57cdc |
| Fuel Drum by Polyfork | https://polyfork.dev/asset/fuel-drum-d65fa4 |
| Gabled Farmhouse by Polyfork | https://polyfork.dev/asset/gabled-farmhouse-c7534f |
| Glass-Door Drinks Fridge by Polyfork | https://polyfork.dev/asset/glass-door-drinks-fridge-21f077 |
| Grain Silo by Polyfork | https://polyfork.dev/asset/grain-silo-58ca67 |
| Hay Bale by Polyfork | https://polyfork.dev/asset/hay-bale-079e8c |
| Mailbox by Polyfork | https://polyfork.dev/asset/mailbox-8e36e8 |
| Marigold Pickup by Polyfork | https://polyfork.dev/asset/marigold-pickup-f4b6f9 |
| Material Pallet by Polyfork | https://polyfork.dev/asset/material-pallet-6af263 |
| Metal Trash Can by Polyfork | https://polyfork.dev/asset/metal-trash-can-f57043 |
| Oak Tree by Polyfork | https://polyfork.dev/asset/oak-tree-50ee7c |
| Police Barricade by Polyfork | https://polyfork.dev/asset/police-barricade-0bbf37 |
| Police Cruiser by Polyfork | https://polyfork.dev/asset/police-cruiser-a2d25e |
| Sandbag Wall Section by Polyfork | https://polyfork.dev/asset/sandbag-wall-section-7075ee |
| Scout Jeep by Polyfork | https://polyfork.dev/asset/scout-jeep-c02efe |
| Site Generator by Polyfork | https://polyfork.dev/asset/site-generator-298792 |
| Skated Jersey Barrier by Polyfork | https://polyfork.dev/asset/skated-jersey-barrier-7f0a04 |
| Sofa by Polyfork | https://polyfork.dev/asset/sofa-9c0e7e |
| Tall Pine Tree by Polyfork | https://polyfork.dev/asset/tall-pine-tree-ab4108 |
| Timber Utility Pole by Polyfork | https://polyfork.dev/asset/timber-utility-pole-a93693 |
| Traffic Cone by Polyfork | https://polyfork.dev/asset/traffic-cone-247748 |
| Tree Stump by Polyfork | https://polyfork.dev/asset/tree-stump-00f3bf |
| Tyre Stack by Polyfork | https://polyfork.dev/asset/tyre-stack-ad4692 |
| Young Pine by Polyfork | https://polyfork.dev/asset/young-pine-0d7695 |
| Air Ambulance Helicopter by Polyfork | https://polyfork.dev/asset/air-ambulance-helicopter-ed9acc |
| Ambulance Van by Polyfork | https://polyfork.dev/asset/ambulance-van-29919a |
| Auto Repair Garage by Polyfork | https://polyfork.dev/asset/auto-repair-garage-b91464 |
| Backyard Barbecue Grill by Polyfork | https://polyfork.dev/asset/backyard-barbecue-grill-84d4ef |
| Backyard Doghouse by Polyfork | https://polyfork.dev/asset/backyard-doghouse-50a492 |
| Backyard Garden Shed by Polyfork | https://polyfork.dev/asset/backyard-garden-shed-38d79f |
| Bocage Hedgerow Section by Polyfork | https://polyfork.dev/asset/bocage-hedgerow-section-4c3126 |
| Camp Cooler by Polyfork | https://polyfork.dev/asset/camp-cooler-8ba941 |
| Camper-van by Polyfork | https://polyfork.dev/asset/camper-van-8d10e2 |
| Campground Pine Stand by Polyfork | https://polyfork.dev/asset/campground-pine-stand-0bf4f2 |
| Campsite Picnic Table by Polyfork | https://polyfork.dev/asset/campsite-picnic-table-361d51 |
| Canvas Ridge Tent by Polyfork | https://polyfork.dev/asset/canvas-ridge-tent-f0df0d |
| Cattle Wagon by Polyfork | https://polyfork.dev/asset/cattle-wagon-0d3070 |
| Chain-Link Fence Run by Polyfork | https://polyfork.dev/asset/chain-link-fence-run-6c3d68 |
| Chicken Coop by Polyfork | https://polyfork.dev/asset/chicken-coop-371f97 |
| Corn Crop by Polyfork | https://polyfork.dev/asset/corn-crop-b71f2f |
| Crash Barrier Run by Polyfork | https://polyfork.dev/asset/crash-barrier-run-b47d1d |
| Czech Hedgehog by Polyfork | https://polyfork.dev/asset/czech-hedgehog-d77ae5 |
| Depot Fuel Tank by Polyfork | https://polyfork.dev/asset/depot-fuel-tank-55a00e |
| Detached Garage by Polyfork | https://polyfork.dev/asset/detached-garage-38a178 |
| Diner-sign by Polyfork | https://polyfork.dev/asset/diner-sign-ab5f0a |
| Dome Tent by Polyfork | https://polyfork.dev/asset/dome-tent-9ee59d |
| Fallen Log by Polyfork | https://polyfork.dev/asset/fallen-log-1685fb |
| Family Crossover SUV by Polyfork | https://polyfork.dev/asset/family-crossover-suv-42027f |
| Farm Gate by Polyfork | https://polyfork.dev/asset/farm-gate-8ab320 |
| Feed Sack by Polyfork | https://polyfork.dev/asset/feed-sack-c84641 |
| Field Hospital Marquee by Polyfork | https://polyfork.dev/asset/field-hospital-marquee-8cf79b |
| Field rock by Polyfork | https://polyfork.dev/asset/field-rock-5e37c6 |
| Fire Hydrant by Polyfork | https://polyfork.dev/asset/fire-hydrant-b68b17 |
| Forest Outhouse by Polyfork | https://polyfork.dev/asset/forest-outhouse-e968d1 |
| Garbage Truck by Polyfork | https://polyfork.dev/asset/garbage-truck-a7ffbf |
| Gas-pump by Polyfork | https://polyfork.dev/asset/gas-pump-5014a8 |
| Globe Gas Pump by Polyfork | https://polyfork.dev/asset/globe-gas-pump-b8e80d |
| Grave Cross by Polyfork | https://polyfork.dev/asset/grave-cross-95b3e9 |
| Greenhouse by Polyfork | https://polyfork.dev/asset/greenhouse-53ab6d |
| Guardrail Section by Polyfork | https://polyfork.dev/asset/guardrail-section-68c3c4 |
| Hammock on Posts by Polyfork | https://polyfork.dev/asset/hammock-on-posts-7d5c47 |
| Haystack by Polyfork | https://polyfork.dev/asset/haystack-77b0dd |
| Hearth Log Bench by Polyfork | https://polyfork.dev/asset/hearth-log-bench-c3c5ec |
| Hollow Log by Polyfork | https://polyfork.dev/asset/hollow-log-329fd7 |
| Large Boulder by Polyfork | https://polyfork.dev/asset/large-boulder-a29b99 |
| Log Cabin by Polyfork | https://polyfork.dev/asset/log-cabin-4fac3b |
| Log Store by Polyfork | https://polyfork.dev/asset/log-store-25e0b5 |
| Loot Crate by Polyfork | https://polyfork.dev/asset/loot-crate-23dd3b |
| Medicine Cabinet by Polyfork | https://polyfork.dev/asset/medicine-cabinet-a9f13d |
| Medium Tank by Polyfork | https://polyfork.dev/asset/medium-tank-65da6b |
| Mesh Site Fence Run by Polyfork | https://polyfork.dev/asset/mesh-site-fence-run-a798a0 |
| Military Cargo Truck by Polyfork | https://polyfork.dev/asset/military-cargo-truck-652f66 |
| Minefield Warning Sign by Polyfork | https://polyfork.dev/asset/minefield-warning-sign-296d9e |
| Motel-sign by Polyfork | https://polyfork.dev/asset/motel-sign-21033b |
| Newspaper Box by Polyfork | https://polyfork.dev/asset/newspaper-box-3f2c0e |
| Nissen Hut by Polyfork | https://polyfork.dev/asset/nissen-hut-dafb56 |
| Oil-drum by Polyfork | https://polyfork.dev/asset/oil-drum-386c30 |
| One-Room Schoolhouse by Polyfork | https://polyfork.dev/asset/one-room-schoolhouse-107ec9 |
| Orchard Apple Tree by Polyfork | https://polyfork.dev/asset/orchard-apple-tree-b21f85 |
| Pay Phone Booth by Polyfork | https://polyfork.dev/asset/pay-phone-booth-b8a1db |
| Picket Fence Run by Polyfork | https://polyfork.dev/asset/picket-fence-run-9310c1 |
| Portable Toilet by Polyfork | https://polyfork.dev/asset/portable-toilet-a3f1a2 |
| Pump Island Canopy by Polyfork | https://polyfork.dev/asset/pump-island-canopy-c3aa62 |
| Pumpkin Crop by Polyfork | https://polyfork.dev/asset/pumpkin-crop-7de137 |
| Ranger Station by Polyfork | https://polyfork.dev/asset/ranger-station-ef6407 |
| Red Barn by Polyfork | https://polyfork.dev/asset/red-barn-d41683 |
| Riding Lawn Tractor by Polyfork | https://polyfork.dev/asset/riding-lawn-tractor-09e93c |
| Roadside Billboard by Polyfork | https://polyfork.dev/asset/roadside-billboard-c3c053 |
| Roadside Farm Stand by Polyfork | https://polyfork.dev/asset/roadside-farm-stand-e218ca |
| Rock Outcrop by Polyfork | https://polyfork.dev/asset/rock-outcrop-158ac3 |
| Rolled plate silo by Polyfork | https://polyfork.dev/asset/rolled-plate-silo-42304a |
| Route Shield Sign by Polyfork | https://polyfork.dev/asset/route-shield-sign-462947 |
| RV Travel Trailer by Polyfork | https://polyfork.dev/asset/rv-travel-trailer-bd53d7 |
| Salvage crate by Polyfork | https://polyfork.dev/asset/salvage-crate-3a7e1d |
| Scarecrow by Polyfork | https://polyfork.dev/asset/scarecrow-334079 |
| Scrap-built aeroplane by Polyfork | https://polyfork.dev/asset/scrap-built-aeroplane-65ac95 |
| Security Gatehouse by Polyfork | https://polyfork.dev/asset/security-gatehouse-fd00c8 |
| Sideline Medical Tent by Polyfork | https://polyfork.dev/asset/sideline-medical-tent-ce1649 |
| Single-Storey Ranch House by Polyfork | https://polyfork.dev/asset/single-storey-ranch-house-3880ea |
| Site Lighting Tower by Polyfork | https://polyfork.dev/asset/site-lighting-tower-674c45 |
| Sleeping Bag by Polyfork | https://polyfork.dev/asset/sleeping-bag-730d7d |
| Soda Vending Machine by Polyfork | https://polyfork.dev/asset/soda-vending-machine-4a5347 |
| Soldiers' Tent by Polyfork | https://polyfork.dev/asset/soldiers-tent-4bd5b9 |
| Speed Limit Sign by Polyfork | https://polyfork.dev/asset/speed-limit-sign-1c55a2 |
| Split-Level House by Polyfork | https://polyfork.dev/asset/split-level-house-40fe1a |
| Split-Rail Fence Run by Polyfork | https://polyfork.dev/asset/split-rail-fence-run-87da39 |
| Station Lamp Post by Polyfork | https://polyfork.dev/asset/station-lamp-post-7d14dd |
| Station-wagon-70s by Polyfork | https://polyfork.dev/asset/station-wagon-70s-11d67b |
| Stone Fire Pit by Polyfork | https://polyfork.dev/asset/stone-fire-pit-4136b0 |
| Stone Well by Polyfork | https://polyfork.dev/asset/stone-well-2b4717 |
| Streamline Diner Car by Polyfork | https://polyfork.dev/asset/streamline-diner-car-de9777 |
| Street Lamp by Polyfork | https://polyfork.dev/asset/street-lamp-136745 |
| Street Tree by Polyfork | https://polyfork.dev/asset/street-tree-0d33f3 |
| Suburban Pickup Truck by Polyfork | https://polyfork.dev/asset/suburban-pickup-truck-d15ea2 |
| Sunflower by Polyfork | https://polyfork.dev/asset/sunflower-80ce15 |
| Tank Wagon by Polyfork | https://polyfork.dev/asset/tank-wagon-d860fa |
| Teardrop Trailer by Polyfork | https://polyfork.dev/asset/teardrop-trailer-580e25 |
| Tire by Polyfork | https://polyfork.dev/asset/tire-ccf0eb |
| Tow Truck by Polyfork | https://polyfork.dev/asset/tow-truck-7d04f8 |
| Trailhead Sign by Polyfork | https://polyfork.dev/asset/trailhead-sign-aa29e1 |
| Two-Burner Camp Stove by Polyfork | https://polyfork.dev/asset/two-burner-camp-stove-3e83f5 |
| Two-Storey Family House by Polyfork | https://polyfork.dev/asset/two-storey-family-house-c63c4a |
| Vending Machine by Polyfork | https://polyfork.dev/asset/vending-machine-471c29 |
| Water Trough by Polyfork | https://polyfork.dev/asset/water-trough-318ee1 |
| Wheat Crop by Polyfork | https://polyfork.dev/asset/wheat-crop-7e08e6 |
| Wheelbarrow by Polyfork | https://polyfork.dev/asset/wheelbarrow-0f8406 |
| Windpump Tower by Polyfork | https://polyfork.dev/asset/windpump-tower-1633a9 |
| Wooden Crate by Polyfork | https://polyfork.dev/asset/wooden-crate-b9c96a |
| Yellow School Bus by Polyfork | https://polyfork.dev/asset/yellow-school-bus-0fd3b6 |
| Pickup Truck by Polyfork | https://polyfork.dev/asset/pickup-truck-a34bf2 |
| Teen Zombie by Polyfork (characters, retargeted with our zombie clips, `tools/audit/retarget_pf.py`) | https://polyfork.dev/asset/teen-zombie-b5bb27 |
| Shambling Ghoul by Polyfork (characters, retargeted with our zombie clips, `tools/audit/retarget_pf.py`) | https://polyfork.dev/asset/shambling-ghoul-256f2f |
| Police Officer by Polyfork (characters, retargeted with our zombie clips, `tools/audit/retarget_pf.py`) | https://polyfork.dev/asset/police-officer-1cc379 |
| Construction Worker by Polyfork (characters, retargeted with our zombie clips, `tools/audit/retarget_pf.py`) | https://polyfork.dev/asset/construction-worker-c1ad8c |
| Farmer by Polyfork (characters, retargeted with our zombie clips, `tools/audit/retarget_pf.py`) | https://polyfork.dev/asset/farmer-304a43 |
| Senior Scientist by Polyfork (characters, retargeted with our zombie clips, `tools/audit/retarget_pf.py`) | https://polyfork.dev/asset/senior-scientist-631736 |
| Infantry Rifleman by Polyfork (characters, retargeted with our zombie clips, `tools/audit/retarget_pf.py`) | https://polyfork.dev/asset/infantry-rifleman-c1c0a5 |
| Groundworker by Polyfork (characters, retargeted with our zombie clips, `tools/audit/retarget_pf.py`) | https://polyfork.dev/asset/groundworker-083f5c |
| Apple by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/apple-b15012 |
| Bread Loaf by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/bread-loaf-0e0ab5 |
| Chocolate Bar by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/chocolate-bar-284f07 |
| Energy Drink Can by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/energy-drink-can-c47bcf |
| First Aid Bag by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/first-aid-bag-8a7f09 |
| Camp Water Jug by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/camp-water-jug-1aba54 |
| Fuel Jerrycan by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/fuel-jerrycan-6f1d85 |
| Axe by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/axe-b545d6 |
| Compass by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/compass-d16dde |
| Kit Bag by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/kit-bag-7d617f |
| Adventurer's Backpack by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/adventurer-s-backpack-b1365c |
| Leather Belt Satchel by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/leather-belt-satchel-5bb107 |
| Skate Helmet by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/skate-helmet-cf1e6e |
| Steel Helmet by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/steel-helmet-f5aa7d |
| Field Radio Set by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/field-radio-set-b6f3fd |
| Tool Case by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/tool-case-d92909 |
| Camping Lantern by Polyfork (item pickup model in `public/assets/models/item/`, rescaled) | https://polyfork.dev/asset/camping-lantern-21d14b |

(The drivable truck `veh_pickup_pf.glb` is the Pickup Truck above, converted with `tools/audit/pf_vehicle.mjs`: rotated to this game's front axis and re-pivoted wheels.)

## Local AI zombie variants (optional, `?chars=ai`)

`public/assets/models/zmb/zmb_ai_*.glb`: z-image-turbo picture, Hunyuan3D-2.1 mesh and texture, skinned to our zombie rig in Blender (`tools/audit/retarget_char.py`). Hunyuan3D-2.1 is under the Tencent Hunyuan community licence (not valid in the EU, UK and South Korea): owner decision needed before shipping them.

### Main character (chr_hero_a)
`public/assets/models/chr/chr_hero_a.glb`: loading-screen poster art (z-image-turbo), front/side/back/T-pose views by qwen-image-edit-2511 (Apache-2.0), mesh and texture by TRELLIS.2-4B (Microsoft; MIT licence, per the model card: re-check before shipping; the earlier Hunyuan3D-2.1 version is kept out of the build in assets/gen), then fitted, rigged and skinned in Blender (`tools/audit/build_hero.py`, `retarget_hero.py`); animation clips retargeted from our own survivor rig.

### Base body and wearables (chr_body_a, chr_body_a_parts)
Underwear base body: picture by qwen-image-edit-2511 (Apache-2.0) from the hero T-pose, mesh by TRELLIS.2-4B (MIT per the model card, re-check before shipping), rigged with fingers in Blender (`tools/audit/build_body.py`). Garments (jacket, vest, trousers, boots, gloves) are cut from a remeshed copy of the body. Rigid gear: Steel Helmet, Adventurer's Backpack, Pupil Backpack, Kit Bag and Leather Belt Satchel from the Polyfork catalog (https://polyfork.dev, CC BY 4.0, credit format *Name by Polyfork*); cap, sunglasses and goggles generated locally (SDXL base 1.0 picture, TRELLIS.2 mesh).
