# Design and engineering principles

This is our rulebook, distilled from the research in `docs/research/`:
- `game-feel-combat.md`
- `survival-systems-loops.md`
- `engine-architecture-optimization.md`
- the two the reference game teardowns

Every number is a **default**: it lives in `src/content/data/` and can be tuned live from the debug panel. When a number changes after playtesting, update it here too and note why.

**How to use it.** Before building a feature, read its section. When you finish, run that section's **checklist**. A feature isn't done until its checklist passes in the browser.

---

## 0. Philosophy (the ten rules)

1. **Mechanics → dynamics → aesthetics (MDA).** Judge a mechanic by the player behaviour it produces ("players kite hordes", "players hoard ammo"), not by its spreadsheet.
2. **Competence and autonomy drive retention (SDT/PENS).** Controls must feel immediate. Input-to-visible-change stays under 100 ms, always.
3. **The 30-second loop must be fun on its own:** sneak → melee one → shoot the rest → loot. Vary it through places, weapons and enemies, not by repeating it.
4. **Perception beats numbers.** Sound, animation and camera make a weapon feel strong. Tune feel before tuning damage.
5. **Spiky pacing (L4D Director).** Constant combat is exhausting and constant calm is boring. Alternate build-up, peak and relax.
6. **Scarcity creates tension.** We are not Doom: ammo and meds stay meaningful from day 1 to day 100.
7. **Every faucet has a sink.** Loot, cash and XP never snowball.
8. **Loss gives success meaning.** Death costs something, but it never wipes hours of work by default.
9. **Readable and fair beats smart.** Zombies can be simple, but they must be predictable from sight and sound and must never cheat the player.
10. **Never lose a player's save.**

---

## 1. Loops and pacing

**Three timescales**

| Timescale | Loop | Tension source |
|---|---|---|
| Moment (5–60 s) | Aim, shoot, reload, juke, loot a container | Ammo count, noise, being surrounded |
| Session (15–90 min) | Pick a POI or quest, run it, return, craft, upgrade | Needs, carry space, day/night, horde countdown |
| Long-term | Zone tier → gear tier → base tier → faction/story → region bosses | Raids escalate, infestations spread |

**Time and runs**
- **Day length:** 40 real minutes (28 min day, 12 min night). Slider 20–120.
- **Horde night:** every 5 in-game days. The countdown is always shown on the HUD. Slider 3–14 days or off.
- **POI runs** take 8–20 minutes. Each POI has at least one shortcut or extraction route.
- **"Next goal" widget:** the nearest craftable item or perk the player is close to, always visible.

**AI Director** (open-world version of Booth's L4D design):
- **Intensity** (0–100) rises with:
  - damage taken
  - being downed or grabbed
  - nearby kills, weighted by 1/distance
- **Intensity decay** is 5/s, with no decay while any zombie is engaging the player.
- **States:**

| State | Behaviour |
|---|---|
| Build-up | Normal spawns |
| Peak | Starts when intensity is ≥ 70; holds for 3–5 s |
| Fade | Waits for a natural break |
| Relax | 30–45 s with no new groups, or until the player moves 150 m |

- **Mobs/hordes:**
  - Triggered by noise: 15–30 zombies, 20–40 s after a loud event.
  - Random mobs every 90–180 s during build-up, with size growing over time.
  - **75% arrive from behind or the flanks.**

**Checklist**
- [ ] A 20-minute playtest has at least 2 clear peaks and 2 clear calm periods.
- [ ] The player always knows the next goal and when the next horde comes.

---

## 2. Player movement and camera

**Speeds** (m/s)

| Movement | Speed |
|---|---|
| Walk | 1.6 |
| Jog (default) | 3.5 |
| Sprint | 5.5–6.0 |
| Crouch | 1.5 |
| Prone | 0.6 |
| ADS | × 0.6 |

Shamblers move at 1.0–1.5 m/s and runners at 4.5–5.0 m/s, which is **slower than a sprint, so kiting works**.

**Acceleration**
- 0 → jog in 120–150 ms; stop in about 100 ms; sprint ramp 250 ms.
- Air control 20–30%.
- Use Rapier's `KinematicCharacterController` with our own velocity state (not a dynamic body).

**Stamina** (100 pool)

| Action | Cost |
|---|---|
| Sprint | 12/s |
| Melee | 10–20 |
| Shove | 15 |
| Jump / vault | 10 |

- Regenerates at 20/s after a 1.0 s delay.
- At 0 the player is **exhausted**: no sprinting until stamina is back to 30, and more weapon sway.

**Jump and vault**
- Coyote time 100 ms; jump buffer 120 ms.
- Context vault over obstacles 0.5–1.3 m tall and up to 0.6 m thick, taking 0.4–0.6 s.
- **Zombies need 1.5–2 s to climb the same obstacle**, so vaulting works as an escape.

**Third-person camera**
- Shoulder offset (0.5, 0.15, 0) m; arm 2.6 m (hip) / 1.2 m (ADS).
- FOV 70° (hip) / 55° (ADS).
- Collision: sphere-cast with radius 0.2 m, from the head to the pivot to the camera. Snap in instantly, ease back out over 300 ms.
- Shoulder swap takes 200 ms and is allowed while aiming.
- **Aiming:** cast the aim ray from the camera, fire from the muzzle at the ray's hit point. If the muzzle is blocked, show a "blocked" reticle.

**First-person camera**
- FOV slider 70–100 (default 85).
- Head bob 2–3 cm (toggleable).
- Weapon sway lags the view by 60–80 ms, and the weapon bobs, not the camera.

**Input**
- Mouse uses `requestPointerLock({unadjustedMovement:true})`, with no smoothing and no acceleration.
- Gamepad: deadzone 0.12, response curve, slowdown-only aim assist (40–50% inside a 2–3° cone). The player can always overpower it.

**Checklist**
- [ ] Input-to-visible-motion is under 100 ms.
- [ ] The camera never clips into walls.
- [ ] The player can outrun a runner while stamina lasts.

---

## 3. Guns

**Ballistics**
- Each sim tick, raycast along the bullet's path segment: `p += v·dt; v.y -= 9.81·dt; v *= 1 − drag·dt`.
- Under about 50 m this behaves as hitscan automatically.
- Muzzle velocity: pistol 350 m/s, rifle 700–900 m/s, pellets 400 m/s.
- Rounds despawn after 1.5 s or 600 m.

**Time to kill (TTK)**

| Target | Rule |
|---|---|
| Shambler (headshot) | 1 rifle round or 1–2 pistol rounds |
| Shambler (body only) | 1.0–2.0 s with a primary weapon, so a group of 5 overwhelms a player who doesn't aim for the head |
| Humans | 0.3–0.6 s with a rifle up close |

- Zombie head multiplier ×3–4; limbs ×0.6 with a chance to cripple.
- Human head multiplier ×2–2.5.

**Fire rate** (RPM)

| Weapon | RPM |
|---|---|
| Pistol | 300–400, semi-auto with the input rate capped |
| SMG | 750–900 |
| AR | 600–750 |
| Bolt-action | 40–50 |
| Pump shotgun | 70, firing 8–9 pellets |

**Damage falloff**
- Full damage up to R1, then a linear drop to 60–70% at 2.5 × R1.
- R1: pistol 15 m, SMG 20 m, AR 40 m, rifle 80 m.
- Shotgun pellets fall to 30% at 25 m.

**ADS and sprint-to-fire**
- **ADS time:** pistol 150, SMG 190, AR 250, scoped rifle 375, LMG 400 ms, with `easeOutCubic`.
- **Sprint-to-fire:** 150 ms (pistol) to 350 ms (LMG).
- **ADS FOV:** irons ×0.8, 2× sight ×0.5, scopes by their magnification.

**Recoil**
- Pitch 0.4–1.2° per shot, yaw ±0.15–0.4° per shot.
- Learnable pattern: shots 1–5 climb straight up, then mild wander, plus ±15% noise.
- Auto-recovery is exponential, about 90% back within 250 ms.
- Visual recoil equals actual recoil. There is also a cosmetic view punch: a 0.5–1.5° spring (stiffness 300, damping 25).
- Weapon model kick: 2–4 cm back, returns in 80 ms.
- Recoil runs on the fixed sim step, so it doesn't depend on frame rate.

**Spread**
- Hip fire 2–4°, ADS 0.1–0.5°.
- Bloom +0.3–0.8° per shot, capped at 6°, recovering at 8–10°/s.
- Sprinting adds +4°, jumping +6°.

**Sway**
- ADS sway is a Lissajous figure, 0.1–0.3° at 0.3–0.5 Hz.
- Holding breath steadies it for 3–4 s and costs stamina.
- Low stamina or an injury adds more sway.

**Reloading**
- Tactical reload 1.8–2.2 s (keeps the +1 in the chamber); empty reload 2.4–3.0 s.
- The magazine is committed at 70% of the animation. Cancelling before that loses nothing.
- Sprinting or melee cancels a reload.
- Magazines are real items, tracked one by one.

**Attachments and rarity**
- **Attachments are trade-offs**, never pure upgrades. For example, a suppressor gives −60% noise radius but −10% velocity.
- **Rarity** changes handling by up to ±15% and damage by up to ×1.3 between tiers, so skill still matters more than loot.

**Durability**
- Malfunction chance starts below 85% durability and rises as it drops.
- A cleaning kit fixes it.

**Checklist**
- [ ] Shots at 5 m, 25 m and 80 m feel distinct.
- [ ] Recoil behaves the same at 30 fps and at 144 fps.
- [ ] A body-only fight against 5 shamblers is lost; a headshot fight is won.

---

## 4. Hit feedback (juice)

**Own shot**
- Four audio layers at once: transient, body, mechanical and tail. Tail reverb depends on the space (indoor, street or forest).
- Pitch varies ±4% and volume ±2 dB.
- Muzzle flash lasts up to 33 ms, with a point light that decays in 50 ms. This is the only dynamic light allowed in combat.

**Camera trauma**
- Each shot adds 0.08–0.15 trauma (rifles) or 0.3 (shotguns). Trauma decays at 1.5/s.
- Shake = trauma² × Perlin noise, up to 3° of rotation.
- FOV kick +1–2°, recovering over 120 ms.
- **Shake slider 0–100%, default 70%.**

**Hit markers**
- Shown for 100–150 ms. A headshot has a different shape and sound. A kill gets a bigger marker and a thud; a head kill also gets a crunch.

**Hitstop**
- **Melee only:**

| Hit | Hitstop |
|---|---|
| Light | 50 ms |
| Heavy | 90–120 ms |
| Killing blow | 120–150 ms |

- Only the target and the viewmodel slow down (to 0.05×). The world and audio keep running.
- **No hitstop for guns**, because automatic fire would stutter.

**Zombie reaction ladder**
- Every hit causes an additive flinch on the hit bone for 150–250 ms, without stopping movement.
- Taking 30% of max HP within 1.5 s causes a 0.6–1.0 s stagger that interrupts the zombie's attack.
- Losing at least 50% of leg HP turns the zombie into a crawler.
- A headshot always snaps the head back.
- Shotguns and shoves add extra stagger.

**Gore**
- Blood spray along the surface normal at the hit point.
- Wall and floor decals from continuing the raycast up to 3 m behind the target. The decal pool holds 64, recycling the oldest.
- Dismemberment only on a kill, or on a limb hit dealing at least 40% of that limb's HP.
- On death, a ragdoll impulse along the shot direction (pistol 150, shotgun 600 N·s).

**Taking damage**
- A directional red wedge for 1 s, and a vignette that grows with missing HP.
- Trauma 0.3–0.5.
- A heavy hit low-pass filters the audio at 800 Hz for 300 ms.

**Gamepad rumble:** 30–60 ms pulses. Automatic weapons use the weak motor at 0.3; shotguns and melee use the strong motor at 0.8.

**Checklist**
- [ ] Every player action gives feedback through at least two channels.
- [ ] A screen recording with the sound off still shows clearly what was hit.

---

## 5. Melee

**Swing timing**
- Windup 150–250 ms.
- Active window 80–120 ms, using 3–5 raycasts along the swing arc.
- Recovery 250–400 ms. The next swing can be buffered in the last 150 ms. After a hit, recovery can be cancelled into a dodge or a shove.

**Stagger**
- Heavy weapons stagger on every hit.
- Light weapons stagger on the second hit within 1 s.

**Shove (crowd control)**
- Takes 0.4 s and costs 15 stamina.
- Hits a 100° cone out to 1.8 m and staggers up to 3 zombies for 1.0 s, pushing them back 1.5 m.
- Shoving a zombie into a wall or off a ledge knocks it down.

**Finishers**
- Available on a staggered or downed zombie: a stomp or stab lasting 0.8 s.
- The player is **invulnerable** during the finisher and it uses no ammo (Doom's rule).

**Durability and balance**
- Melee weapons last 40–150 hits. Wear shows up in the sound and as a UI tint before the weapon breaks.
- 1v1 against a shambler takes 2–4 swings. Three or more zombies at once in melee is dangerous.

**Checklist**
- [ ] A crowd of 3 can be survived with good shove timing, but not by button-mashing.

---

## 6. Zombie and enemy AI

**Senses**

*Sight*
- A 70–90° cone. Range 25 m by day, 10 m at night.
- Multiplied by the player's stance (stand 1.0, crouch 0.6, prone 0.35) and by how fast the player is moving.
- Suspicion builds over 0.5–1.5 s depending on distance, with a visible head-turn while it builds.
- States: Unaware → Suspicious → Detected → Searching. Never jump straight to Detected.

*Hearing*
- Gameplay noise events are separate from audio playback. Noise radius in metres:

| Source | Radius (m) |
|---|---|
| Sprint | 15 |
| Jog | 8 |
| Crouch | 2 |
| Unsuppressed pistol | 80 |
| Unsuppressed rifle | 150 |
| Suppressed weapon | 20–30 |
| Melee kill | 5 |
| Breaking glass | 25 |
| Car alarm | 200 |

- Ideally noise travels along the navmesh, so walls and doors weaken it.
- A zombie that hears something goes to the last heard position, searches for 20–30 s, then returns to idle.

**Attack tokens (Doom)**
- At most 3 zombies attack the player at once (4–5 on Hard).
- Zombies without a token circle at 1.5–2.5 m and growl.
- A player sprinting at full speed is missed 30–50% of the time.

**Telegraphs**
- Every attack winds up first: shamblers 0.5–0.7 s, runners 0.3–0.4 s, heavies 1.0 s or more.
- Every windup has an audio cue.
- A grab can be escaped by shoving within 0.8 s, followed by 1.0 s of invulnerability.

**Spawning**
- Never inside the camera's view frustum or line of sight, and never closer than 25 m.
- Wandering zombies are stored as a **count per cell**. They are created when the player approaches, and a cell's count resets once the player has seen it.
- No respawning on save load. This fixes a the reference game complaint.

**Anti-cheese (the reference game's exploits)**
- Zombies **climb onto vehicles and low walls**.
- Zombies **react to sniping** by searching toward the sound.
- Zombies are always audible: idle groans every 4–10 s, a shriek when they detect the player, and footsteps 3 dB louder than normal when within 6 m behind the player.

**Human AI**
- Line of sight is required to shoot. **No shooting through walls.**
- Uses cover and fires suppressing fire.
- Accuracy drops against a moving player.

**Zombie LOD tiers** (see §10 for budgets)

| Tier | Range | Behaviour |
|---|---|---|
| A | < 30 m, or visible and < 60 m (max 40) | Thinks at 30 Hz, crowd agent, collision capsule |
| B | < 120 m | Thinks at 5 Hz, crowd agent, no collider |
| C | Beyond 120 m | Updates at 1 Hz on an abstract cell graph |

**Checklist**
- [ ] Each zombie state can be identified with your eyes closed.
- [ ] Nothing ever spawns in view.
- [ ] No safe spot can be found within 10 minutes of trying.

---

## 7. Survival needs and medical

**Needs** (in real minutes at default settings)

| Need | Full → empty | At 0 | Thresholds |
|---|---|---|---|
| Hunger | 90 min | −1 HP per 20 s (never instant death) | Above 70: **Well Fed**, +10% stamina regen. Below 25: −15% stamina |
| Thirst | 60 min | −1 HP per 12 s | Same as hunger |

- **Fatigue** only builds at night or from exertion. High fatigue hurts aim; sleep is never forced. Sleeping skips time in single-player.
- **Temperature** only matters in specific cold or wet regions, and gear solves it. It is not tracked everywhere.

**Wounds** (three types)
- **Bleeding** (and heavy bleeding): a bandage stops it.
- **Fracture:** a splint fixes it. The player limps for about 10 minutes.
- **Infection:**
  - Each bite has a 15% chance (0% if the limb has armor rating 3 or more).
  - It progresses through 4 stages over 3 in-game days.
  - Antibiotics cure stages 1–2. Stages 3+ need a rare antiviral from a hospital or lab, which doubles as a quest hook.

**Medical items**
- Using one takes 2–5 s and can be interrupted.
- Item stats follow the the reference game table in the research doc.

**Sliders:** drain rate for each need 0–200%; infection on/off; starvation damage on/off.

---

## 8. Inventory

**Hybrid model**
- The grid is the space limit.
- Weight only affects stamina and speed: above 60% of the limit, −10% speed; above 100%, −35% speed and no sprinting.
- Weight **never** blocks picking an item up.

**Containers and slots**
- Backpack inside backpack: on by default (players love it), toggleable.
- Equipment slots: head, face, eyes, ears, torso, armor/rig, legs, gloves, feet, backpack, plus pockets and a secure pouch.

**Item footprints**

| Item | Size |
|---|---|
| Pistol | 2×1 |
| SMG | 3×2 |
| Rifle | 5×2 |
| Ammo box (stacks to 60) | 1×1 |
| Bandage | 1×1 |
| Can of food | 1×1 |
| Medkit | 2×2 |

Backpacks: 4×4, 5×6 and 6×8.

**Quality-of-life features (all required)**
- R to rotate, Ctrl+click to quick-move, Shift+click to split a stack.
- Auto-sort, auto-stack on pickup, search/filter.
- Ghost preview of the footprint while placing.
- Hover to compare with the equipped item.
- Take all, and take filtered.
- Value-per-cell hint, locked slots, hotbar 1–6.
- Vicinity panel for items on the ground.
- Drag ammo onto a magazine, and a magazine onto a gun.

**Opening the inventory doesn't pause the game.** It slows the player to walking speed and makes a sound that attracts zombies.

**Stash:** 10×20 at the base, expanded through base upgrades.

---

## 9. Loot, economy and progression

**Loot tables**
- Tables nest: POI → container type → category → item, then rarity and affixes are rolled.
- **At least 60% of each POI table is specific to that POI** (police, hospital, hardware, military, farm, gas station…).
- Each region has 2–3 **regional-only items**.

**Rarity**
- Common / Uncommon / Rare / Epic / Legendary, plus a separate *Damaged* condition.

| Zone tier | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| T1 | 70 | 25 | 5 | 0 | 0 |
| T2 | 55 | 30 | 12 | 3 | 0 |
| T3 | 45 | 32 | 17 | 5.5 | 0.5 |
| T4 | 35 | 33 | 22 | 9 | 1 |
| T5 | 25 | 33 | 27 | 13 | 2 |

- **Legendaries only drop from bosses, raid chests and quests.** World containers cap at Epic.

**Item level and affixes**
- `iLvl = zoneTier × 10 + rand(−3, +3)`, and stats scale by `× (1 + 0.04 × iLvl)`.
- Affixes per rarity: 0 / 1 / 2 / 3, and Legendary gets 3 plus one **unique behaviour** (for example "reload on kill" or "silent").

**Pity and duplicates**
- Each source keeps its own pity counter: soft pity starts at 1/p attempts, hard pity guarantees the drop at 2/p.
- An already-owned unique is never dropped again; you get salvage instead.

**World stock (DayZ-style)**
- High-value items have regional stock caps, and **items stored at your base count toward the cap**.
- A POI restocks 3–5 in-game days after it was looted, and shows a "last looted" state.

**Economy**
- **Sources:** selling loot, quests, capped base production. **No passive interest.**
- **Sinks**, most wanted first: base upgrades, crafting ammo and meds, repairs, trader-exclusive items, base upkeep (3% of base value per day, or defenses decay 1% per day), death losses, fuel and parts.

**Traders**
- Buy from the player at 30% of their sell price.
- Each repeat sale of the same item pays 6% less; prices recover 15% per day.
- Daily cash cap of `2000 × traderLevel`.
- Stock refreshes every 2 days, with limited top-tier stock.
- Reputation 1–4, earned through quests, not money.

**Ammo economy**
- Crafting ammo costs real materials (gunpowder, 70% of casings recovered).
- A full-auto T5 fight should cost 10–15% of the median player's cash.

**Telemetry**
- Log the median player's wealth every in-game day.
- From day 10 onward, sinks should remove at least 90% of what sources add.
- If wealth grows more than 1.5× in 5 days, raise the sinks before nerfing the sources.
- **Model the first 30 days in a spreadsheet before locking content.**

**Progression**
- **Character level** gives perk points:
  - `xpToNext(L) = 200 + 120·(L−1)`, then tuned by hand to hit about 15 min per level at L5, 45 min at L20, 90 min at L30.
  - Soft cap at L40. After that, Paragon points give +0.5% each, up to +15%.
  - XP from enemies more than 2 tiers above you is capped at 2×.
- **Learn-by-doing skills** (0–10) cover weapons and crafting:
  - XP comes only from meaningful actions.
  - Repeating the same action 20 times within 5 minutes halves its XP.
- **Recipes** come from blueprints and magazines you find, not from perks.
- **Perks change how you play.** At most 25% may be plain stat boosts. Capstones at levels 5, 15, 25 and 35 define a build: Scavenger, Gunsmith, Engineer, Medic, Ghost.
- **Respec** is free once per in-game week, and costs money otherwise.
- **Gating:**
  - Zone tiers T1–T5. T4 and T5 need a key item (radiation suit, military keycard, repaired bridge).
  - Killing a region's boss or destroying its infestation core unlocks the next region's key.

---

## 10. Base building and raids

**Game stage (GS)**
- `GS = round(level × (1 + daysSurvived × 0.04) × diff)`, where diff is 0.8, 1.0, 1.25 or 1.5.
- Dying reduces days survived by 2.
- **GS is locked when a horde starts.**

**Heat (0–100 per base)**
- Gains: +1 per craft, +0.5 per 100 cash of stored value per day, +5 per generator-hour, +2 per gunshot within 60 m.
- Decays by 10 per day.
- At Heat ≥ 60, a **scout raid** (20% of horde size) arrives within 1 day.

**Hordes**
- Size = `8 + GS × 0.6`, with **at most 24 alive per player**; the rest arrive in waves.
- Zombie types unlock by GS:

| GS | Type |
|---|---|
| 20+ | Runners |
| 30+ | Screamers |
| 40+ | Armored |
| 60+ | Demolishers (5× block damage) |
| 80+ | Infestation boss |

**Structure tiers**

| Tier | HP | Cost |
|---|---|---|
| Wood | 500 | 1× |
| Reinforced wood | 1,200 | 2.5× |
| Scrap metal | 3,000 | 6× |
| Concrete | 7,500 | 15× |
| Steel | 18,000 | 35× |

- Doors and windows have 70% of the wall HP.
- Repairing costs 25% of the material per 100% HP restored.

**Pathing**
- Zombies use A* over the block grid, with a cost per block of `1 + HP / group DPS`.
- **They go for the weakest wall or door**, and target your loot, the generator, or you.
- **There are no unreachable safe spots.** Climbers pile up and demolishers spawn. Pillar cheese gets breakers from GS 40.
- Paths are recalculated every 2 s, or whenever a block is destroyed.

**Why build at all:** the base tier unlocks stash size, crafting stations, ammo production and vehicle repair.

**Raid timing:** raids only happen while the player is present or in-game time is running (the Valheim model).

---

## 11. Quests, factions and world state

**Quests**
- **Main arc:** 8–12 hand-made quests, revealed through **radio signals** (as in Subnautica). Each ends at a region boss or infestation core.
- **Factions:** 3 factions, each with a 6–10 quest chain that branches. Siding with one cuts another's reputation by 50%.
- **Contracts:** 3 per trader every 2 days. Types: fetch, clear, escort, defend an outpost, rescue, retrieve data from a lab, kill a named zombie.

**Infestations**
- **Spread:** each core's radius grows 5% per day (capped).
- **Inside the radius:** +30% spawns, no POI restocks, nearby traders charge +20%.
- **Clearing:**
  - Clearing a core permanently shrinks it and unlocks an outpost slot.
  - The remaining cores escalate, each stage adding **a new mechanic, not just more HP**.
  - Primary cores are invulnerable until their secondary cores are destroyed (the reference game's model).

**Dynamic events**
- Rolled every 30–45 real minutes, with a 40% chance.
- Types: airdrop, distress call, horde migration, caravan under attack, heavy fog.

**Emergent stories**
- A zombie that kills you **keeps your gun and gets a name** ("Burnt Larry"). Kill it to get the gun back plus a bonus.
- An auto-written **journal** logs notable moments.

**Writing**
- Notes under 120 words, radio clips under 45 s, item descriptions 1–2 lines.

---

## 12. Difficulty, death and saves

**Difficulty presets:** Story / Survivor (default) / Hardcore / Custom.
- **Every slider can be changed mid-game**, except permadeath, which is locked once on.
- A modified save shows a "modified" badge.

**Sliders**
- **Time:** day length; horde frequency.
- **Survival:** needs drain rate; infection on/off.
- **Zombies:** density 25–300%; speed (walk / jog / mixed / run); damage.
- **Loot:** loot amount; legendary rate.
- **Economy and base:** trader prices; raid strength; heat on/off.
- **Gear:** durability; malfunctions.
- **Inventory:** backpack-inside-backpack; keep inventory on death.
- **Combat:** headshot mode.
- **Death:** penalty level (see below).

**Death penalty**

| Mode | On death |
|---|---|
| Story | Keep everything, lose 10% of cash |
| **Survivor** | Backpack and held weapon drop in a bag (marked on the map, lasts 2 in-game days). You keep equipped armor and the 2×2 secure pouch (3×3 via a quest) |
| Hardcore | Drop everything except the pouch. The bag lasts 1 day. −2 days survived |
| Permadeath | A new character inherits 25% of the base stash as a "legacy" |

- **Insurance:** 15% of a weapon's value, and it comes back after 1 day.
- **Respawn:** at your bed or base (1 min cooldown), or at a random T1 location.

**Saves**
- **Storage:** IndexedDB.
- **Write protocol:**
  1. Serialize.
  2. Write a new generation.
  3. Read it back and compare SHA-256.
  4. In a separate transaction, flip the `current` pointer.
  5. Keep 3 generations.

  A torn write can never corrupt the current save.
- **Slots:** 3 manual slots plus an automatic pre-horde snapshot.
- **Autosave:**
  - Every 5 real minutes.
  - On sleep, on entering the base, and before a horde.
  - On `visibilitychange` (hidden) and `pagehide`.
  - **Never during combat** (wait up to 60 s).
  - All writes go through one queue.
- **Loading:** validate the hash and the schema. If either fails, **fall back to the previous generation automatically** and tell the player.
- **Migrations:** one migration function per version (`v → v+1`). CI tests load fixture saves from every version.
- **Persistence:** call `navigator.storage.persist()` after 15 minutes of play. **One-click export and import** of a `.zsave` file. Only deltas are saved (looted containers, built and destroyed blocks, NPC state), never the generated world.

---

## 13. Engine and performance (60 fps on a 4 GB laptop GPU)

**Loop**
- Fixed 60 Hz sim; the accumulator is clamped to 0.25 s with at most 4 steps per frame. Rendering is interpolated (lerp/slerp).
- Seeded RNG only, no `Math.random` or wall-clock reads inside the sim, fixed iteration order.

**Architecture**
- **Sim and rendering are split.** The sim imports nothing from three.js or the DOM; a lint rule enforces this.
- All intent goes through `applyInput(playerId, cmd, tick)`, even in single-player.
- Entity ids are stable. State is structure-of-arrays typed arrays, so it can be serialized for saves and future co-op.
- **ECS: bitECS** (decided in M0: 56 µs/tick vs Koota 105–219 µs; see `docs/perf/m0-spikes.md`).
- **Events:** a typed ring buffer, drained once per tick. Never call other systems from inside a physics callback.
- **Content:** schema-validated JSON/TS tables, with numeric ids at runtime.
- **Zero per-frame allocations** in hot paths: pools and scratch vectors, no closures or `forEach`.

**CPU budget per frame (main thread, 16.6 ms)**

| System | Budget |
|---|---|
| Sim / gameplay | ≤ 3 ms |
| AI | ≤ 2 ms |
| Physics | ≤ 2.5 ms (main thread first; move to a worker if exceeded) |
| Render submit | ≤ 5 ms |
| Streaming | ≤ 1 ms |
| UI / audio | ≤ 1 ms |
| Slack | ≥ 2 ms |

**Rendering**
- **Object count is the main budget, not triangles.** Measured in M0: WebGPURenderer costs 2.4–4 µs per object on the CPU (1.4–1.7× WebGLRenderer).
- **No MSAA.** In M0 it crashed the WebGPU device on the target laptop; use FXAA/SMAA instead.
- **Draw calls:** ≤ 400 (hard cap 600), including shadow passes. Every repeated object is instanced or batched.
- **Triangles:** ≤ 1.5 M visible, ≤ 500 k in shadow passes.
- **GPU memory:** ≤ 1.5 GB total.
  - Textures ≤ 900 MB, all KTX2: ETC1S for albedo, UASTC for normals.
  - Geometry ≤ 300 MB, render targets ≤ 200 MB, bone/VAT textures ≤ 64 MB.
- **Materials:** ≤ 40 pipelines. All are compiled at boot through a "material zoo" with `compileAsync`. **No compile hitch over 8 ms** after loading.
- **Shadows:** 2 cascades on Medium (1024²), 3 on High (2048²). Shadow distance ≤ 80 m. Foliage never casts shadows beyond the first cascade. The far cascade updates every other frame.
- **Post-processing:** ≤ 2.5 ms of GPU time (tonemap, FXAA/SMAA, cheap bloom; SSAO only on High).
- **Dynamic resolution:** 0.6–1.0, targeting 13 ms of GPU time.
- **Quality presets:** Low (safe for WebGL2), Medium (the target laptop), High.
- **Foliage:** per-instance BVH or chunk culling, with LOD → meshoptimizer → octahedral impostor. Grass is a single merged-blade patch around the camera, ≤ 60 m on Medium.
- **Zombies:**
  - One InstancedMesh per archetype (≤ 6), animated from a baked bone texture (≤ 40 bones).
  - Animation runs at full rate within 20 m, 15 fps within 60 m, 7.5 fps beyond, and freezes off-screen.
  - At most 4 ragdolls at once, from a pool.

**World streaming**
- 128 m cells. Active ring of 5×5 cells, visible ring with radius 6, prefetch +1. Cells unload with hysteresis.
- Per cell: ≤ 8 MB on the GPU, ≤ 2 MB downloaded, ≤ 150 static instances.
- Never upload more than 4 MB of textures in one frame.
- The world is centred on (0,0,0); no floating origin is needed at 4 km. Run a jitter probe at the map corners.
- **Terrain:** a CDLOD quadtree with an instanced 33×33 patch, ≤ 4 draw calls.
- **Navmesh:** a tiled navmesh **baked offline** per cell. Barricades and base pieces are TileCache obstacles.

**Physics**
- ≤ 150 active dynamic bodies, ≤ 64 kinematic capsules, ≤ 4 vehicles.
- Collision groups: STATIC, TERRAIN, PLAYER, ZOMBIE, VEHICLE, PROJECTILE, DEBRIS, SENSOR, BUILD.
- Dynamic objects use primitive colliders only. Building trimeshes are ≤ 2k triangles.

**AI budget**
- ≤ 2 ms for 300 zombies. The Detour crowd holds ≤ 120 agents.
- ≤ 10 path queries per frame; a zombie re-paths at most every 0.5 s.
- A spatial hash with 6 m cells.

**Memory:** JS heap ≤ 600 MB, WASM ≤ 256 MB, heap growth ≤ 20 MB per 10 minutes.

**Loading**
- ≤ 15 MB to reach the menu, ≤ 40 MB to the first spawn, entry JS ≤ 400 KB gzipped.
- Cold load ≤ 15 s, warm load ≤ 5 s.
- Rapier, Recast and debug tools are dynamic imports. Never bundle WebGLRenderer alongside `three/webgpu`.
- Self-host every asset. COOP/COEP headers are set from day 1, so SharedArrayBuffer is available.

**Asset pipeline:** gltf-transform runs dedup → prune → weld → simplify (LODs) → instance → join → palette → resize → KTX2 → meshopt. **CI rejects** PNG/JPEG textures, props with more than one material, and meshes over 2k triangles without LODs.

**Perf gate** (target laptop, 1080p, Medium preset)
- p95 frame time ≤ 16.6 ms, p99 ≤ 25 ms.
- **0 hitches over 50 ms** during a 3-minute traversal.
- ≤ 600 draw calls.
- Measured with a Playwright scripted camera path in headed Chrome (headless numbers are meaningless).

**Profiling tools:** the three.js Inspector (stats-gl doesn't work with WebGPU r181+), `renderer.info`, Chrome Performance, Spector.js (WebGL), and a per-system ms overlay.

**M0 spikes: done** (`docs/perf/m0-spikes.md`). Keep WebGPURenderer. bitECS. No floating origin needed at 4 km (5 of 65k pixels flicker at the corner).

---

## 14. Audio

**3D audio**
- `PannerNode` with HRTF, inverse distance model, refDistance 2 m, rolloff 1.2.
- Max distance: zombies 60 m, gunshots 400 m or more.

**Occlusion**
- A raycast at 10 Hz per source. When blocked: low-pass at 1–1.5 kHz and −6 dB.

**Zombie vocals**
- Each zombie has an idle groan, an alert shriek, chase breathing, and an attack windup sound.
- **Every attack is preceded by a sound at least 0.3 s before it lands.**

**Distance and mixing**
- Gunshots more than 50 m away crossfade to a distant layer, delayed by distance / 343 s.
- The player's own gunfire ducks ambient sound by 3–4 dB, but **never** ducks zombie cues.

**Music and accessibility**
- Music follows the Director: a build-up pulse, a peak layer, and near-silence during long relax periods.
- Optional on-screen sound indicators for accessibility.

---

## 15. The feature-done checklist (every feature)

- [ ] The numbers live in data and can be tuned from the debug panel.
- [ ] Feedback comes through at least 2 channels (visual + audio/camera).
- [ ] The section's checklist above passes in the browser.
- [ ] The perf overlay shows the feature's cost, within budget.
- [ ] No allocations in the hot path (Chrome trace).
- [ ] State is serializable, and save/load round-trips it.
- [ ] Non-trivial logic has one `vitest` check.
