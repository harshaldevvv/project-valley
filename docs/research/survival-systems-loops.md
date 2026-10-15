# Research: survival game systems and loops (Oct 2026)

Labels: [V] = verified in a fetched source, [DK] = established design knowledge, [U] = unverified or conflicting. GDC talk contents could only be verified from session descriptions. All numbers are tunable defaults; the distilled rules live in `docs/design/principles.md`.

## 1. Core loops
**Evidence**
- **The Long Dark:** tension comes from slow attrition, with nature as the antagonist [V].
- **L4D Director:** plans new attacks when the game is quiet and lets things settle after long fights [V].
- **Destiny 2:** a fast soft cap, then weekly-limited "Powerful" sources, then a pinnacle cap with only about 10 levels available from the hardest content [V].
- **Valheim:** boss drops unlock the tools needed for the next biome [V].

**What makes "one more run" work** [DK]:
- A closed 10–25 minute run loop.
- A visible "almost there" goal.
- Variable reward with a guaranteed floor.
- Stakes you can lose.
- A threat you can forecast (7 Days to Die's Blood Moon every 7 days, 22:00–04:00 [V]).

## 2. Loot
**Mechanisms**
- Weighted cumulative tables, nested and conditional tables, minimum-rarity filters, pity counters, and deterministic seeds for testing [V].

**Pity**
- A 1/100 drop has only a 63% chance after 100 tries [V].
- Old School RuneScape: a 1/20 drop is guaranteed by attempt 40 (2× the base rate) [V].
- WoW Legion: weighted bad-luck protection. It started conservative "because it's more fixable" [V].
- Keep one counter per drop; a shared counter is a common bug [V].

**Rarity and drop sources**
- **Diablo III Loot 2.0:** fewer but better drops, smart loot, a guaranteed legendary on each act boss's first kill, and the auction house removed [V].
- **Borderlands 2:** legendary rates were tripled because they were "dishearteningly rare" [U figures]. Lesson: legendaries come from targeted sources.

**World stock**
- **DayZ Central Economy:** each item has `nominal` and `min` (50–70% of nominal triggers restock), plus lifetime and restock timers. Map tiers 1–4 run from coast to inland military. Hoarded items can count toward world totals [V].
- **Destiny:** drops are tuned to the player's level [V].

## 3. Economy
**Faucets and sinks**
- When faucets exceed sinks you get inflation [V].
- Sinks players *want* (crafting, upgrades) work better than punitive ones [V].
- The most dangerous faucets are those that scale with wealth, such as interest or passive production [V].

**Reference designs**
- **Machinations (Adams & Dormans):** feedback loops, engines, friction and escalation. Simulate an economy before tuning it [V].
- **Path of Exile (Chris Wilson):** economic integrity first; progression should come from playing [V].
- **Tarkov:** "found-in-raid" requirements, flea-market bans and level gates slow gear acquisition [V]. Insurance returns gear about 24 h later [U].
- **Rust:** upkeep is a fraction of build cost every 24 h; decay timers are staged per material tier [V].

## 4. Survival needs
**Reference numbers**
- **Project Zomboid:** the default day is 60 minutes, and needs drain per in-game hour. A "Stats Decrease" slider scales all needs together [V].
- **The Long Dark:**
  - 2500 kcal. At 0 kcal you lose 1% condition per hour, which is about 4 days to starve [V].
  - Thirst runs out in 8 h awake or 12 h asleep [V].
  - Running out is slow-burning, not instant death.
- **State of Decay 2:** infection with an antidote; escalating plague hearts that block base claims [V].

**What's tedious vs. what's fun** [DK]
- Tedious: micromanaging every few minutes, instant death, needs you can't solve in the field, many redundant bars.
- Fun: needs that gate travel, buffs for being well fed, cooking and medicine as crafting depth, infection as a ticking clock.

## 5. Inventory
- **Resident Evil 4:** the attaché case grid is a satisfying puzzle; rotation matters; it pauses the game [V].
- **Lineage:** Diablo II → RE2 → RE4 → Tarkov. Tarkov splits storage into containers by role [V].
- **Grid** pros: icon recognition, and size signals value. Cons: costs time and per-item art, and breaks when the scale is wrong (RE5) [V].
- **Weight** scales to many items but ignores volume. Hybrid systems use a grid with weight as a penalty [V].

## 6. Base building and raids
**7 Days to Die**
- The horde arrives on predictable days, with size set by gamestage [V]:
  `gameStage = level + level × (days × bonus + diffMult)`
- Days survived drop on death [V].
- The gamestage is locked when the horde starts [V].
- 8 zombies alive per player by default [V].

**Valheim raids**
- Rolled every 46 minutes with a 20% chance [V].
- The player must be within 40 m of 3 or more base structures and not in a dungeon [V].
- Raid type depends on which bosses are defeated [V].
- Raids last 80–150 s, and the timer pauses while the player is away [V].

**Conan Exiles purge**
- A hidden meter fills from gathering, crafting and killing; waves are regional and themed [V].
- Voluntary purge via a coffer [U]. Players felt it was too predictable [V].

**State of Decay 2:** escalating hearts. Late-game hearts became a chore, so escalation needs variety [V].

**Rust:** upkeep scales with base size. Decay by tier: twig 1 h, wood 3 h, stone 5 h, metal 8 h, armored 12 h [V].

## 7. Progression
- **7 Days to Die A21:** recipes moved into "learn by reading" magazines, and perks were reworked to change how you play [V].
- **Project Zomboid:** learn-by-doing with a nonlinear curve, about 75 XP at level 2 and about 9000 at level 10. Strength and Fitness need about 150k. Skill books give XP multipliers [V].
- **XP curves:** linear increments are the middle ground. Design by *time to level* and hand-tune the table [V].
  - RuneScape: +10% per level [V].
  - Power law: x·L^1.5 [V].
  - Sara Jensen Schubert: cap XP from overleveled enemies [V].
- **Gating:** Valheim by boss/biome, Destiny by level cap, Tarkov by trader level, keys and found-in-raid items [V].

## 8. Quests and world state
- **RimWorld** works as a story generator, with an AI storyteller that paces incidents [V].
- **The Long Dark** split story mode from survival mode [V].
- **Subnautica (Charlie Cleveland, GDC 2019):** radio signals structure the sandbox, plus mysterious tooltips [V].
- **State of Decay 2:** persistent infestation state blocks expansion [V].

## 9. Difficulty and death
- Granular sliders are standard: 7 Days to Die, Project Zomboid, Conan, Valheim [V].
- **On death penalties:**
  - Too low means nothing is at stake; too high makes players quit [V].
  - "Loss is a mechanic that gives meaning to success" [V].
  - Removing the cost of respawning kills the sense of danger [V].
- **Tarkov:** a secure container protects a core of items [V].
- **7 Days to Die:** dying lowers days survived, which makes the next horde smaller (rubber band) [V].

## 10. Saves
**Atomic writes**
- Write to a temp location, flush, verify, then swap.
- Keep 1–2 backup generations.
- Validate on load with a checksum and fall back to a backup on failure.
- A parse failure is recoverable, not a crash.
- Route all writes through a single queue.
- Handle out-of-space errors visibly [V].

**Browser specifics**
- Browser storage is best-effort and can be evicted (Safari evicts after inactivity).
- Call `navigator.storage.persist()` and `estimate()`.
- Offer export and import.
- Version the save format and write migrations [V/U].

## Reading list
**Books**
- Tynan Sylvester, *Designing Games* (2013)
- Ernest Adams & Joris Dormans, *Game Mechanics: Advanced Game Design* (2012)
- Jesse Schell, *The Art of Game Design*

**Papers and theses**
- Dormans, *Engineering Emergence* (2012)
- Dormans, "Integrating Emergence and Progression" (DiGRA 2011)

**Talks**
- Charlie Cleveland, "The Design of Subnautica" (2019)
- Raphael van Lierop, "A Long Dark Road" (2018)
- Tynan Sylvester, RimWorld talk (2017)
- Michael Booth, L4D AI (2009)
- Chris Wilson, "Designing Path of Exile to Be Played Forever" (2019)

**Other:** Quantic Foundry Gamer Motivation Model.

## Sources
- thelongdark.fandom.com (Hunger, Thirst)
- 7daystodie.wiki.gg (Gamestage, Blood Moon Horde, Learn by Reading)
- gamever.io (Valheim raids)
- wiki.facepunch.com/rust/the_tool_cupboard
- Conan purge guides (xgamingserver, supercraft)
- shacknews.com and support.stateofdecay.com
- di.diablowiki.net/Loot_2.0
- oldschool.runescape.wiki/w/Bad_luck_mitigation
- wowhead.com (legendary bad-luck protection)
- lootlocker.io/blog/random-with-weights
- bugnet.io (loot tables, save corruption, web save loss)
- xgamingserver.com/docs/dayz/central-economy
- unity.com game economy design guide
- 80.lv (GDC: Designing Path of Exile)
- nme.com and dexerto.com (Tarkov flea market)
- gamedeveloper.com (Quantitative design: XP thresholds)
- oldschool.runescape.wiki/w/Experience_table
- gdcvault.com/play/1025745 (Subnautica)
- bloody-disgusting.com (RE4 inventory)
- pcgamer.com (best inventory systems)
- app.cinevva.com/tutorials/indexeddb-game-saves
