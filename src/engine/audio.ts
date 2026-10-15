import { Vector3, type Object3D, type PerspectiveCamera } from 'three';
import type { AudioApi } from '../core/contracts';
import { sounds, type SoundDef } from '../content/data/sounds';

/**
 * Web Audio engine (principles §14). Implements AudioApi:
 *   game.audio.play('rifle_shot', muzzlePos)               // 3D one-shot (HRTF panner, inverse distance)
 *   game.audio.play('ui_click')                            // 2D
 *   const h = game.audio.loop('car_engine_loop', carRoot); h.setRate(1 + rpm); h.stop();
 * - Ids come from src/content/data/sounds.ts; a random file per play, ± pitch jitter.
 * - Max 32 voices; the oldest one-shot is stolen. Sources farther than maxDistance are skipped.
 * - Gunshot-loud sounds farther than 50 m are delayed by distance / 343 m/s.
 * - Unknown ids warn once; missing/failed files fall back to a procedural placeholder, so play() never throws.
 * - The AudioContext resumes on the first click/key (browser autoplay policy).
 * Call `update(camera)` once per rendered frame (installEngine does) to move the listener and loops.
 */
const MAX_VOICES = 32;
const SPEED_OF_SOUND = 343;

export interface AudioSettings {
  master: number; // 0..1
  sfx: number;
  ui: number;
}

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  panner: PannerNode | null;
  loop: boolean;
}

export function createAudio(settings: AudioSettings = { master: 0.8, sfx: 1, ui: 0.8 }) {
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  const master = ctx.createGain();
  const sfx = ctx.createGain();
  const ui = ctx.createGain();
  sfx.connect(master);
  ui.connect(master);
  master.connect(ctx.destination);
  const applyVolumes = () => {
    master.gain.value = settings.master;
    sfx.gain.value = settings.sfx;
    ui.gain.value = settings.ui;
  };
  applyVolumes();

  const resume = () => {
    if (ctx.state !== 'running') void ctx.resume();
  };
  addEventListener('pointerdown', resume, { capture: true });
  addEventListener('keydown', resume, { capture: true });

  // --- buffers --------------------------------------------------------------------------------
  const buffers = new Map<string, AudioBuffer | null>(); // file -> buffer (null = failed)
  const loading = new Map<string, Promise<AudioBuffer | null>>();
  const load = (file: string) => {
    let p = loading.get(file);
    if (!p) {
      p = fetch(`/assets/audio/${file}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((b) => ctx.decodeAudioData(b))
        .catch((e) => {
          console.warn(`audio: ${file} failed (${e}); using a synth placeholder`);
          return null;
        })
        .then((b) => (buffers.set(file, b), b));
      loading.set(file, p);
    }
    return p;
  };
  const synthCache = new Map<string, AudioBuffer>();
  const synth = (kind: NonNullable<SoundDef['synth']>) => {
    let b = synthCache.get(kind);
    if (!b) synthCache.set(kind, (b = makeSynth(ctx, kind)));
    return b;
  };
  /** A loaded buffer for this def, or a synth placeholder if none is available (yet). */
  const pick = (def: SoundDef): AudioBuffer => {
    if (def.files.length) {
      const f = def.files[(Math.random() * def.files.length) | 0];
      const b = buffers.get(f);
      if (b) return b;
      if (b === undefined) void load(f);
      for (const g of def.files) if (buffers.get(g)) return buffers.get(g)!; // any loaded sibling
    }
    return synth(def.synth ?? 'click');
  };
  /** Starts loading every file in the table (call after boot; ~2.6 MB). */
  const preload = () => Promise.all(Object.values(sounds).flatMap((d) => d.files.map(load)));

  // --- voices ---------------------------------------------------------------------------------
  const voices: Voice[] = [];
  const warned = new Set<string>();
  const listenerPos = new Vector3();
  const tmp = new Vector3();

  const makeVoice = (def: SoundDef, pos: Vector3 | null, loop: boolean, volume: number, rate: number): Voice => {
    const src = ctx.createBufferSource();
    src.buffer = pick(def);
    src.loop = loop;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = def.volume * volume;
    src.connect(gain);
    let panner: PannerNode | null = null;
    if (pos) {
      panner = new PannerNode(ctx, {
        panningModel: 'HRTF',
        distanceModel: 'inverse',
        refDistance: def.refDistance,
        maxDistance: def.maxDistance,
        rolloffFactor: 1.2,
        positionX: pos.x,
        positionY: pos.y,
        positionZ: pos.z,
      });
      gain.connect(panner).connect(sfx);
    } else gain.connect(def.maxDistance <= 1 ? ui : sfx);
    const v: Voice = { src, gain, panner, loop };
    src.onended = () => {
      const i = voices.indexOf(v);
      if (i >= 0) voices.splice(i, 1);
      gain.disconnect();
      panner?.disconnect();
    };
    if (voices.length >= MAX_VOICES) {
      const oldest = voices.find((x) => !x.loop); // loops are never stolen
      if (oldest) {
        oldest.src.stop(); // onended disconnects it
        voices.splice(voices.indexOf(oldest), 1);
      }
    }
    voices.push(v);
    return v;
  };

  const lookup = (id: string): SoundDef | null => {
    const def = sounds[id];
    if (!def && !warned.has(id)) {
      warned.add(id);
      console.warn(`audio: unknown sound id "${id}"`);
    }
    return def ?? null;
  };

  const follows: { v: Voice; obj: Object3D }[] = [];

  const api: AudioApi = {
    play(id, position, opts) {
      const def = lookup(id);
      if (!def || ctx.state !== 'running') return;
      let delay = 0;
      if (position) {
        const d = tmp.copy(position).distanceTo(listenerPos);
        if (d > def.maxDistance) return;
        if (d > 50 && def.maxDistance >= 300) delay = d / SPEED_OF_SOUND;
      }
      const j = opts?.pitchJitter ?? def.jitter ?? 0;
      const vol = (opts?.volume ?? 1) * (1 - Math.random() * 0.2); // ~±1 dB around -1 dB
      const v = makeVoice(def, position ?? null, false, vol, 1 + (Math.random() * 2 - 1) * j);
      v.src.start(ctx.currentTime + delay);
    },
    loop(id, follow, opts) {
      const def = lookup(id) ?? { files: [], volume: 0, refDistance: 1, maxDistance: 1, synth: 'hum' as const };
      const v = makeVoice(def, follow.getWorldPosition(tmp), true, opts?.volume ?? 1, 1);
      v.src.start();
      const entry = { v, obj: follow };
      follows.push(entry);
      // If the real file was still loading, swap it in once ready (a source's buffer can be set once only,
      // so restart with a new source on the same gain/panner chain).
      if (def.files.length && !buffers.get(def.files[0])) {
        void load(def.files[0]).then((b) => {
          if (!b || !follows.includes(entry)) return;
          const s = ctx.createBufferSource();
          s.buffer = b;
          s.loop = true;
          s.playbackRate.value = v.src.playbackRate.value;
          s.connect(v.gain);
          v.src.onended = null;
          v.src.stop();
          v.src = s;
          s.start();
        });
      }
      return {
        setVolume: (x) => (v.gain.gain.value = def.volume * x),
        setRate: (r) => (v.src.playbackRate.value = r),
        stop: () => {
          const i = follows.indexOf(entry);
          if (i >= 0) follows.splice(i, 1);
          const k = voices.indexOf(v);
          if (k >= 0) voices.splice(k, 1);
          v.src.onended = null;
          v.src.stop();
          v.gain.disconnect();
          v.panner?.disconnect();
        },
      };
    },
  };

  const fwd = new Vector3();
  const up = new Vector3();
  const lastP = new Vector3(NaN); // last listener pos; orientation compared via fwd/up below
  const lastF = new Vector3();
  const lastU = new Vector3();
  /** Per rendered frame: listener follows the camera, looping sources follow their objects.
   *  AudioParam writes are not free (~10 µs each), so only changed values are written. */
  const update = (camera: PerspectiveCamera) => {
    const l = ctx.listener;
    camera.getWorldPosition(listenerPos);
    fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const moved = listenerPos.distanceToSquared(lastP) > 1e-6;
    const turned = fwd.distanceToSquared(lastF) > 1e-8 || up.distanceToSquared(lastU) > 1e-8;
    if (l.positionX) {
      if (moved) {
        l.positionX.value = listenerPos.x;
        l.positionY.value = listenerPos.y;
        l.positionZ.value = listenerPos.z;
      }
      if (turned) {
        l.forwardX.value = fwd.x;
        l.forwardY.value = fwd.y;
        l.forwardZ.value = fwd.z;
        l.upX.value = up.x;
        l.upY.value = up.y;
        l.upZ.value = up.z;
      }
    } else {
      l.setPosition(listenerPos.x, listenerPos.y, listenerPos.z); // Firefox
      l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
    lastP.copy(listenerPos);
    lastF.copy(fwd);
    lastU.copy(up);
    for (let i = 0; i < follows.length; i++) {
      const { v, obj } = follows[i];
      if (!v.panner) continue;
      obj.getWorldPosition(tmp);
      v.panner.positionX.value = tmp.x;
      v.panner.positionY.value = tmp.y;
      v.panner.positionZ.value = tmp.z;
    }
  };

  return {
    api,
    ctx,
    settings,
    applyVolumes,
    preload,
    update,
    get voices() {
      return voices.length;
    },
    /** Ids that have no real file (procedural placeholder only). */
    synthesizedIds: () => Object.keys(sounds).filter((k) => !sounds[k].files.length || sounds[k].files.every((f) => buffers.get(f) === null)),
  };
}
export type EngineAudio = ReturnType<typeof createAudio>;

/** Procedural placeholder buffers: short, quiet, recognisable by shape. */
function makeSynth(ctx: BaseAudioContext, kind: NonNullable<SoundDef['synth']>): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = { whoosh: 0.28, click: 0.05, thud: 0.18, noise: 0.35, beep: 0.25, hum: 0.8 }[kind];
  const n = Math.floor(sr * len);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const u = i / n;
    const white = Math.random() * 2 - 1;
    let s = 0;
    switch (kind) {
      case 'whoosh': {
        // band-swept noise, swelling then fading
        const a = 0.05 + 0.4 * Math.sin(Math.PI * u);
        lp += (white - lp) * (0.05 + 0.35 * u);
        s = lp * Math.sin(Math.PI * u) * 2 * a;
        break;
      }
      case 'click':
        s = white * Math.exp(-t * 180) * 0.8;
        break;
      case 'thud':
        lp += (white - lp) * 0.08;
        s = (Math.sin(2 * Math.PI * 70 * t) * 0.8 + lp * 2) * Math.exp(-t * 22);
        break;
      case 'noise':
        s = white * Math.exp(-t * 12);
        break;
      case 'beep':
        s = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 9) * 0.6;
        break;
      case 'hum':
        s = (Math.sin(2 * Math.PI * 95 * t) + 0.5 * Math.sin(2 * Math.PI * 143 * t)) * 0.3 * Math.sin(Math.PI * u);
        break;
    }
    d[i] = s;
  }
  return buf;
}
