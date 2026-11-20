/** Horde night text (data/zombie_arch.ts HORDE_NIGHT). */
export const hordeText = {
  warn: 'The sky is wrong tonight. They are coming within the hour. Find walls, a fire, and a way out.',
  warnBanner: (h: string) => `HORDE NIGHT · they come at ${h}`,
  start: 'They are here. Hold until dawn.',
  banner: (left: number) => `HORDE NIGHT · survive until dawn · ${left} left`,
  end: 'Dawn. The horde thins out in the light.',
  survived: 'You held the night. They left something behind.',
  failed: 'The night took more than it gave.',
  reward: (name: string, n: number) => `+ ${name}${n > 1 ? ` ×${n}` : ''}`,
};
