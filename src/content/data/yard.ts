/**
 * M1 test sandbox "the Yard" — station anchors. The lead owns the layout grid; environment-builder
 * owns everything placed inside each station's area. Coordinates: metres, +Y up, north = -Z.
 *
 *              N (-Z)
 *   ┌───────────────────────────────┐  walled 200 x 200 m (±100)
 *   │        SHOOTING RANGE         │  firing line z=-12, targets 5/25/80 m north
 *   │  LOOT          ↑        PEN   │
 *   │ (-35,-15)   SPAWN     (40,-15)│
 *   │              (0,0)            │
 *   │ BUILD PAD   ANIM STAND  TRACK │
 *   │ (-40,35)     (0,25)   (55,50) │
 *   └───────────────────────────────┘
 */
export const yard = {
  half: 100, // yard is ±100 m, walled
  spawn: { x: 0, z: 0, yaw: 0 },
  stations: {
    loot: { x: -35, z: -15, w: 24, d: 18, label: 'LOOT & CONTAINERS' },
    // firing line at z, targets at z - distance (5/25/80 m), lane x ∈ [x - w/2, x + w/2]
    range: { x: 0, z: -12, w: 30, d: 86, label: 'SHOOTING RANGE', targetDistances: [5, 25, 80] },
    pen: { x: 40, z: -15, w: 24, d: 24, label: 'ZOMBIE PEN' },
    build: { x: -40, z: 35, w: 24, d: 24, label: 'BUILD PAD' },
    anim: { x: 0, z: 25, w: 12, d: 12, label: 'ANIMATION STAND' },
    track: { x: 55, z: 50, w: 70, d: 50, label: 'VEHICLE TRACK' },
  },
} as const;

export type StationId = keyof typeof yard.stations;
