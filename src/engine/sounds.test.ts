import { describe, expect, it } from 'vitest';
import { atmosphere, sounds } from '../content/data/sounds';

const A = atmosphere;
const files = [
  ...Object.values(sounds).flatMap((d) => d.files),
  A.music.explore,
  A.music.combat,
  A.amb.wind.file,
  A.amb.birds.file,
  A.amb.crickets.file,
  ...A.amb.crows.files,
];

// Every file under public/assets/audio (keys only; nothing is loaded).
const present = new Set(Object.keys(import.meta.glob('/public/assets/audio/**/*')).map((k) => k.replace('/public/assets/audio/', '')));

describe('sound files', () => {
  it('every file the sound table and the music/ambience reference exists (no 404s at runtime)', () => {
    expect(files.filter((f) => !present.has(f))).toEqual([]);
  });
});
