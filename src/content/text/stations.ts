/** Yard station signage. `sign` is the painted board (max 22 chars), `hint` the tester prompt. */
export const stationText: Record<'loot' | 'range' | 'pen' | 'build' | 'anim' | 'track', { sign: string; hint: string }> = {
  loot: {
    sign: 'SUPPLY & SALVAGE',
    hint: 'Hold E on a container to search it, then press Tab to sort what you found into your inventory.',
  },
  range: {
    sign: 'LIVE FIRE RANGE',
    hint: 'Pick a weapon with 1–4, hold RMB to aim, LMB to fire, R to reload and X to switch fire mode.',
  },
  pen: {
    sign: 'PEN - DO NOT FEED',
    hint: 'Fight what is in here: aim with RMB, fire with LMB, and press V to shove it back when it gets close.',
  },
  build: {
    sign: 'BUILD PAD',
    hint: 'Press B for build mode, scroll the mouse wheel to pick a piece, R to rotate, LMB to place and X to remove.',
  },
  anim: {
    sign: 'MOVEMENT CHECK',
    hint: 'Walk, sprint with Shift, crouch with C and vault with Space; press T to change camera and Q to swap shoulders.',
  },
  track: {
    sign: 'MOTOR POOL',
    hint: 'Press F to get in or out of the truck, WASD to drive, Space for the handbrake and H for the horn.',
  },
};
