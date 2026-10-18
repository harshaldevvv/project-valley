import { atmosphere as A, sounds } from '../content/data/sounds';
import type { Game } from '../core/game';
import type { EngineAudio } from './audio';

export type MenuMode = 'title' | 'playing' | 'paused';

/**
 * Music and ambience (data: content/data/sounds.ts `atmosphere`).
 * - Music: an explore loop and a fight loop, crossfaded on the danger level gameplay sets each step
 *   (game.audio.setDanger). Silent on the title screen, starts after PLAY, ducked while paused.
 * - Ambience: wind always, birds by day, crickets by night (follows game.time.night), crows now and then
 *   (more at dusk and night), and a far-off, low-passed zombie groan.
 * Every change is a setTargetAtTime ramp on a gain, so nothing ever cuts. Files load when this is created
 * (after boot); sound starts when the AudioContext resumes on the first click or key (browser autoplay rules).
 */
export function createAtmosphere(game: Game, audio: EngineAudio, menuMode: () => MenuMode) {
  const { ctx, load, buses } = audio;

  /** A looping file on a bus, at gain 0 until faded in. Returns fade(level, seconds). */
  const layer = (file: string, bus: AudioNode) => {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(bus);
    void load(file).then((b) => {
      if (!b) return;
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.loop = true;
      src.connect(gain);
      src.start();
    });
    let target = 0;
    return (level: number, seconds: number) => {
      if (Math.abs(level - target) < 0.002) return;
      target = level;
      gain.gain.setTargetAtTime(level, ctx.currentTime, seconds / 3); // ~95% of the way after `seconds`
    };
  };

  const oneShot = (file: string, level: number, lowpassHz?: number) =>
    void load(file).then((b) => {
      if (!b || ctx.state !== 'running') return;
      const src = new AudioBufferSourceNode(ctx, { buffer: b });
      const pan = new StereoPannerNode(ctx, { pan: Math.random() * 1.6 - 0.8 });
      const gain = new GainNode(ctx, { gain: level });
      const head = lowpassHz ? src.connect(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: lowpassHz })) : src;
      head.connect(gain).connect(pan).connect(buses.amb);
      src.onended = () => pan.disconnect();
      src.start();
    });

  const explore = layer(A.music.explore, buses.music);
  const combat = layer(A.music.combat, buses.music);
  const wind = layer(A.amb.wind.file, buses.amb);
  const birds = layer(A.amb.birds.file, buses.amb);
  const crickets = layer(A.amb.crickets.file, buses.amb);

  const rand = ([a, b]: [number, number]) => a + Math.random() * (b - a);
  const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
  let now = 0;
  let fightUntil = -1;
  let nextCrow = rand(A.amb.crows.everyS);
  let nextGroan = rand(A.amb.groan.everyS);
  const state = { fight: false, music: 'off' as 'off' | 'explore' | 'combat', night: 0 };

  game.addSystem({
    name: 'atmosphere',
    render(_alpha, frameDt) {
      now += frameDt;
      const mode = menuMode();
      const night = game.time.night;
      if (audio.danger >= A.music.combatAt) fightUntil = now + A.music.holdS;
      const fight = mode !== 'title' && now < fightUntil;
      const duck = mode === 'paused' ? A.music.pausedDuck : 1;
      const xf = fight ? A.music.toCombatS : A.music.toExploreS;
      explore(mode !== 'title' && !fight ? A.music.exploreLevel * duck : 0, xf);
      combat(fight ? A.music.combatLevel * duck : 0, xf);
      state.fight = fight;
      state.music = mode === 'title' ? 'off' : fight ? 'combat' : 'explore';
      state.night = night;

      wind(A.amb.wind.level * (1 + A.amb.wind.nightBoost * night), A.amb.fadeS);
      birds(A.amb.birds.level * (1 - night) ** 2, A.amb.fadeS);
      crickets(A.amb.crickets.level * night, A.amb.fadeS);

      if (now > nextCrow) {
        nextCrow = now + rand(A.amb.crows.everyS);
        if (Math.random() < 0.25 + 0.75 * night) oneShot(pick(A.amb.crows.files), A.amb.crows.level);
      }
      if (now > nextGroan) {
        nextGroan = now + rand(A.amb.groan.everyS) * (1 - 0.5 * night); // twice as often at night
        oneShot(pick(sounds.zombie_groan.files), A.amb.groan.level, A.amb.groan.lowpassHz);
      }
    },
  });

  return state;
}
