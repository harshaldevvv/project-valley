# Outskirts (south of the Yard)

Flat plateau x -160..160, z 100..300 behind the open south gate (0, 100); hills blend back in over 40 m. Data: `src/content/data/outskirts.ts` (roads, pads, placed models, enterable buildings, fields), `outskirts_fill.ts` (seeded filler and micro-POIs), `pois.ts` (POIs, container spots, zombie zones, spawn tuning). Builder: `src/world/outskirts/`.

| POI | Tier | Centre | Reason to visit | Landmark |
|---|---|---|---|---|
| Gate Checkpoint | 2 | 4, 122 | first military cache, police locker, ambulance | site light tower, tank |
| Route 9 Fuel Stop | 1 | -30, 158 | shop shelves, register, workshop shelves | pump canopy |
| Maple Street | 1 | -70, 198 | two furnished houses, driveway cars | two-storey house |
| Westside School | 2 | -146, 198 | lockers and desks | schoolhouse, bus |
| Hollow Creek Farm | 2 | 112, 168 | pantry, hay shed tools, fields | silos |
| Crossroads Diner | 1 | 36, 220 | kitchen stock, trucks, branch point | diner car |
| Pinewood Camp | 2 | 40, 268 | stashes, coolers, camper van | pine stand |
| Medevac Crash Site | 3 | -66, 262 | best medical and military loot | helicopter |
| Ranger Ridge | 3 | 124, 262 | footlockers, vantage | fire lookout |
| Broken-Down Bus / Hunting Stand / Roadside Memorial | 1 | see pois.ts | small stashes between the big POIs | bus, tower, shrine |

Danger rises with distance from the gate (tier 1 near, 3 far): `POI_SPAWN.tierScale` multiplies each zone's zombie count. Zombies stream in near the player (never in view, never closer than 24 m, 22 alive at most) and are removed again beyond 160 m.

Containers: every spot is in `poiSpots` (type, theme, position). Enterable buildings (house A and B, farmhouse, gas shop, workshop, hay shed) have doors (except the shed) that open with E.

Tools: `tools/audit/poiperf.mjs` (views and perf), `outskirtswalk.mjs` (walk, prompts, zombies), `pfget.mjs` and `pfindex.mjs` (add models), `pfunused.mjs` (prune).
