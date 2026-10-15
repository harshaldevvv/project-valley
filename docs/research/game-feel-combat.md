# Research: game feel, gunplay, melee, zombie AI, audio (Oct 2026)

Every number here is a starting default to tune in playtests, not a fact.
- **[V]**: confirmed in a primary or near-primary source.
- **[S]**: secondary source (wiki, guide, blog).
- **[U]**: practitioner convention, not verified.

The key primary source is Michael Booth's GDC 2009 slides, "The AI Systems of Left 4 Dead", read in full. The rules distilled from this research are in `docs/design/principles.md`.

## 0. Why feel matters
- **MDA (Hunicke, LeBlanc, Zubek 2004)** [V]: designers write mechanics, which produce dynamics, which produce aesthetics. Our target aesthetics are Challenge, Sensation, Discovery and Fantasy. Judge each mechanic by the dynamic it produces.
- **SDT/PENS (Ryan, Rigby, Przybylski 2006)** [V]: perceived competence and autonomy predict enjoyment and continued play. Both depend on controls feeling intuitive. Unresponsive controls lower retention.
- **"30 seconds of fun" (Jaime Griesemer, Halo)** [V]: a short, satisfying encounter, varied across environments, weapons and enemies.
- **Perception beats numbers** [S, Bungie]: Destiny made a weapon *feel* overpowered by changing only its sound. Balance with spreadsheets; judge by feel.

## 1. Guns
**Hitscan vs projectile.** At 900 m/s a bullet travels about 30 m per frame, so anything under 50 m is effectively instant.
- Use projectiles where travel time and bullet drop are part of the skill.
- Hybrid approach: each tick, raycast the segment the bullet moves (`p += v*dt; v.y -= g*dt; v *= 1-drag*dt`). Gears E-Day is moving to simulated ballistics in the same way [S].
- Tarkov-style armor penetration is only worth it if we add armored humans [S].

**Recoil.**
- CS:GO splits recoil into visual and actual [V]:
  - `actual = aimPunch × 2.0`
  - `visual = viewPunch + aimPunch × 2.0 × 0.45`
  - The crosshair therefore shows only about 45% of where bullets really go. For PvE, keep visual equal to actual and add a cosmetic punch only.
- Keep the recoil offset separate from mouse-look and apply it on a child transform. Decay it with `exp(-k·dt)` at a fixed step; per-frame recoil makes the result depend on FPS [S].
- Use a learnable pattern: the first 3–5 shots climb vertically, then the gun wanders mildly, with ±10–20% noise added. Auto-recover 70–90% of the climb.

**Spread.**
- The first ADS shot while standing still should be near-perfect.
- Bloom grows with each shot and decays over 150–300 ms.
- Doom 2016 [V]: enemies aim worse at a player moving at top speed. Apply the mirror of that to the player (moving makes your own aim worse).

**ADS times** (CoD guide, game unspecified) [S]:

| Class | ADS time |
|---|---|
| SMG | 180 ms |
| AR | 250 ms |
| Sniper | 400 ms |
| LMG | 450 ms |

Sprint-to-fire is a separate stat [S]. Destiny places the crosshair slightly below center [S].

**Doom 2016's resource loop** (enemies as walking ammo and health packs, no reload) is the opposite of scarcity. Do not copy it. Do copy its pain-reaction tiers.

## 2. Hit feedback
- **Vlambeer pistol shot** [S]: sound, a shell ejected at 100–150°, the camera pushed back about 6 px, screenshake +4 that decays fast, and gun kick 2 that snaps back. Many tiny, fast offsets beat one big effect. Jan Willem Nijman's talk "The Art of Screenshake" is the reference.
- **Hitstop** [V]: a study found the best hit-stop is 0.1–0.2 s and the best slow-motion is 0.2–0.4 s. Practitioners use 50–100 ms scaled by hit weight and freeze only the attacker and target, not the UI or audio.
- **Camera trauma** (Squirrel Eiserloh, GDC 2016) [S]: trauma runs 0–1 and decays linearly; shake = trauma² (or trauma³) × Perlin noise.
- **Doom pain ladder** [V]: twitch (disturbs aim), then falter (interrupts behavior), then stagger (opens a finisher). Reactions are specific to each weapon.
- **Dead Island 2 FLESH** [S]: layered procedural damage. Our cheap version is per-limb damage states, swappable gore meshes or decals, and wound type taken from damage type.
- **Gun audio layers** [S]: transient, body (the most important layer), sub, mechanical, tail. NPC guns get close and distant layers. Exaggerate everything and use variations.
- **Destiny camera** [S]: a camera rigidly attached to the body feels floaty, while following the body too closely causes motion sickness. If 10% of players get sick, that is 100k players lost per million.

## 3. Movement and camera
- **Steve Swink, *Game Feel*:** responsiveness should stay under ~100 ms; around 240 ms or more, players lose the sense of direct control [U].
- **Coyote time and input buffer:** about 100 ms each; 150–200 ms in slow games [S].
- **Over-the-shoulder camera** (Cinemachine third-person follow model) [S]:
  - Shoulder offset plus arm length, with collision pulling the camera in.
  - Sphere-cast from head to pivot first, then pivot to camera, so the pivot never ends up inside a wall.
  - Gears E-Day lets you swap shoulders mid-aim; fans had complained when it couldn't.

## 4. Melee
- **Doom** [V]: stagger leads into a finisher; the player is invulnerable during it and the AI can't start new attacks.
- **Dead Island 2** [S]: wound type depends on the weapon.
- **Dying Light: The Beast** [S]: balanced swing and stop timing, active ragdoll, short reaction animations, heavy hits. No numbers published.

## 5. Zombie and horde AI
**Left 4 Dead AI Director (Booth 2009)** [V]:
- Per-player intensity rises with damage taken, being incapacitated, being pulled off a ledge, and nearby kills (weighted by 1/distance). It decays to 0, but does not decay while enemies are engaging. The Director uses the maximum across players.
- States:
  1. Build Up (full threat) until intensity peaks.
  2. Sustain Peak for 3–5 s.
  3. Peak Fade (minimal threat) until intensity drops and there is a natural break.
  4. Relax (no wanderers, no mobs, no new specials) for 30–45 s or until the players travel far enough.
- Unpredictability comes from overlapping randomized populations: wanderers, mobs of 20–30 every 90–180 s with size growing over time, specials, and bosses.
- Spawning happens only in nearby nav areas that are **not visible to any survivor**. 75% of mobs come from behind.
- Wanderers are stored as a count per area, materialized when the player approaches and zeroed once the area has been seen.
- Bosses are dealt from a shuffled deck with no repeats.
- Bots cheat in the players' favor to protect trust.

**Doom 2016 attack tokens** [V]: an enemy must hold a token to attack. Token count scales with difficulty, better-positioned enemies steal tokens, and enemies deliberately miss players moving at top speed.

**Days Gone, "Freak-O-System" (GDC 2018)** [S]: hordes of up to about 300. Details not verified.

**Perception** [S/U]:
- Hearing should use gameplay noise events with a radius and falloff, separate from audio playback. Ideally noise propagates along the navmesh so walls and doors attenuate it.
- Detection should be graded: Unaware → Suspicious → Detected → Searching. No "gotcha" detections.

## 6. Audio as information
- Use HRTF panning. Run occlusion raycasts with a low-pass filter when the path is blocked.
- Each zombie state has its own vocal class, and every attack has an audio tell.
- Distant gunshots switch to a distant layer and are delayed by d/343 s (speed of sound).
- Player gunfire never ducks zombie tells.
- Music follows the Director state.
- Offer on-screen sound indicators for accessibility.

## Reading list
**Books**
- Steve Swink, *Game Feel* (2008)
- Jesse Schell, *The Art of Game Design* (3rd ed. 2019)
- Robert Nystrom, *Game Programming Patterns* (2014)
- Tynan Sylvester, *Designing Games* (2013)
- Raph Koster, *A Theory of Fun* (2004)

**Talks**
- Michael Booth, "The AI Systems of Left 4 Dead" (2009)
- Jan Willem Nijman, "The Art of Screenshake" (2013)
- Martin Jonasson & Petri Purho, "Juice it or lose it" (2012)
- Squirrel Eiserloh, "Juicing Your Cameras With Math" (GDC 2016)
- Kurt Loudy & Jake Campbell, "Embracing Push Forward Combat in DOOM" (GDC 2018)
- Timothy Ford, "Overwatch Gameplay Architecture and Netcode" (GDC 2017)
- Darren Chisum & Tobias Karlsson, "The Freak-O-System: Days Gone" (GDC 2018)
- Travis McIntosh, "The Last of Us: Human Enemy AI" (GDC 2014)
- Nick Weihs (Insomniac), "Techniques for Building Aim Assist" (GDC 2013)

**Papers**
- Hunicke, LeBlanc & Zubek, "MDA" (2004)
- Ryan, Rigby & Przybylski, *Motivation & Emotion* 30(4) (2006)
- Mihaly Csikszentmihalyi, *Flow* (1990)
- Sweetser & Wyeth, "GameFlow" (2005)
- Hit-stop duration study, SciTePress 2024 (paper 124614)

## Sources
- steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf
- gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-
- gdcvault.com/play/1024940
- davidbdurst.com/blog/csknow_recoil.html
- infovore.org/?p=5275
- scitepress.org/Papers/2024/124614/124614.pdf
- critpoints.net hitstop article
- gamedeveloper.com/programming/video-sprucing-up-cameras-with-math
- gdcvault.com/play/1017942 (aim assist)
- docs.unity3d.com Cinemachine Third Person Follow
- gamingbolt.com Gears E-Day ballistics
- hone.gg/blog/ads-in-call-of-duty
- mein-mmo.de Destiny feel articles
- ggrecon.com Dead Island 2 FLESH
- gdconf.com Days Gone Freak-O-System
- violetrecording.com and liortega.com gun sound design
- users.cs.northwestern.edu/~hunicke/MDA.pdf
- engadget.com 2011 Griesemer interview
