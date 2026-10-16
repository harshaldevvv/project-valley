import type { Game } from '../core/game';
import { difficulty } from '../content/data/difficulty';
import { SUNRISE, SUNSET, type TimeOfDay } from './timeofday';

/**
 * World clock (principles §1): one in-game day = difficulty.dayLengthMin real minutes (default 40), split 70/30 so
 * daytime (05:30–19:30, 14 game-hours) lasts 28 min and night (10 game-hours) 12 min. Runs on the fixed sim step,
 * so it stops with game.paused. Read it through game.time { hours, night, day }; `day` starts at 1 and increments at
 * midnight with the 'newDay' event. Save slice 'world.time' v2 = { day, hours } (v1 = { hours } loads as day 1).
 *   const clock = createClock(game, tod);  clock.set(18.5);  clock.fast = true;  // x20, debug
 * Set the time through the clock (not tod.set) so the two never disagree.
 */
const DAY_SHARE = 0.7;
const LIGHT_EVERY = 6; // ticks between lighting updates (10 Hz is plenty for a 40 min cycle)

/** Game-hours per real second at hour h. */
export function hoursPerSecond(h: number, dayLengthMin: number) {
  const dayH = SUNSET - SUNRISE;
  const realS = dayLengthMin * 60;
  return h >= SUNRISE && h < SUNSET ? dayH / (realS * DAY_SHARE) : (24 - dayH) / (realS * (1 - DAY_SHARE));
}

export function createClock(game: Game, tod: TimeOfDay) {
  let hours = tod.hours; // the world's start-up hour (no snap)
  let n = 0;
  const clock = {
    day: 1,
    /** Debug multiplier. */
    speed: 1,
    get fast() {
      return clock.speed > 1;
    },
    set fast(v: boolean) {
      clock.speed = v ? 20 : 1;
    },
    get hours() {
      return hours;
    },
    set(h: number) {
      hours = ((h % 24) + 24) % 24;
      tod.set(hours);
    },
  };
  game.addSystem({
    name: 'clock',
    step(dt) {
      hours += hoursPerSecond(hours, difficulty.dayLengthMin) * dt * clock.speed;
      if (hours >= 24) {
        hours -= 24;
        clock.day++;
        game.events.emit('newDay', { day: clock.day });
      }
      if (++n % LIGHT_EVERY === 0) tod.set(hours);
    },
  });

  try {
    game.save.section('world.time', {
      version: 2,
      save: () => ({ day: clock.day, hours }),
      load: (d, version) => {
        const v = d as { day?: number; hours: number };
        clock.day = version >= 2 && v.day ? v.day : 1;
        clock.set(v.hours);
      },
    });
  } catch {
    /* no save system installed */
  }
  return clock;
}
export type Clock = ReturnType<typeof createClock>;
