import { describe, expect, it } from 'vitest';
import { difficulty } from '../content/data/difficulty';
import { ITEMS } from '../content/data/items';
import { SURVIVAL, WOUNDS } from '../content/data/survival';
import { createRng } from '../engine/rng';
import { Survival, type SurvivalHost } from './survival';

const host = (night = false) => {
  const h = { hp: 100, events: [] as string[] };
  const api: SurvivalHost = {
    maxHp: () => 100,
    hurt: (n, cause) => ((h.hp -= n), h.events.push(cause)),
    heal: (n) => (h.hp = Math.min(100, h.hp + n)),
    isNight: () => night,
    statusChanged: (id, on) => h.events.push(`${id}:${on}`),
  };
  return { h, api };
};
const run = (s: Survival, seconds: number, dt = 0.5) => {
  for (let t = 0; t < seconds; t += dt) s.step(dt);
};

describe('survival', () => {
  it('needs drain on the principles clock and hurt slowly at zero', () => {
    const { h, api } = host();
    const s = new Survival(createRng(1), api);
    run(s, 30 * 60, 5); // 30 min
    expect(s.hunger).toBeCloseTo(100 - 100 / 3, 0); // 90 min full->empty
    expect(s.thirst).toBeCloseTo(50, 0); // 60 min
    s.adjust({ thirst: -100 });
    const hp = h.hp;
    run(s, 24, 0.5);
    expect(hp - h.hp).toBe(2); // -1 HP / 12 s
    expect(s.statuses.has('dehydrated')).toBe(true);
  });

  it('bleeding ticks, stops by itself, and a bandage cures it', () => {
    const { h, api } = host();
    const s = new Survival(createRng(2), api);
    s.addStatus('bleeding');
    run(s, 3);
    expect(h.hp).toBeLessThan(100);
    run(s, WOUNDS.bleeding.seconds[1]);
    expect(s.statuses.has('bleeding')).toBe(false);
    s.addStatus('heavy_bleeding');
    s.applyUse(ITEMS.bandage.use!);
    expect(s.statuses.has('heavy_bleeding')).toBe(false);
  });

  it('fracture limps and blocks sprint until splinted', () => {
    const s = new Survival(createRng(3), host().api);
    s.addStatus('fracture');
    expect(s.mods).toMatchObject({ moveSpeed: WOUNDS.fracture.moveSpeed, sprintAllowed: false });
    s.applyUse(ITEMS.splint.use!);
    expect(s.mods.sprintAllowed).toBe(true);
  });

  it('infection advances in stages; antibiotics only cure early stages', () => {
    const s = new Survival(createRng(4), host().api);
    s.addStatus('infection');
    const stage = (WOUNDS.infection.totalGameDays * SURVIVAL.gameDaySeconds) / 4;
    run(s, stage * 2 + 1, 5);
    expect(s.statuses.get('infection')?.stage).toBe(3);
    s.applyUse(ITEMS.antibiotics.use!);
    expect(s.statuses.has('infection')).toBe(true);
    s.applyUse(ITEMS.antiviral.use!);
    expect(s.statuses.has('infection')).toBe(false);
    difficulty.infection = false;
    s.addStatus('infection');
    expect(s.statuses.has('infection')).toBe(false);
    difficulty.infection = true;
  });

  it('armour 3+ blocks infection from hits; food restores; save round-trips', () => {
    const s = new Survival(createRng(5), host().api);
    for (let i = 0; i < 200; i++) s.onZombieHit({ damage: 10, zone: 'limb', armour: 3 });
    expect(s.statuses.has('infection')).toBe(false);
    s.adjust({ hunger: -50 });
    s.applyUse(ITEMS.canned_beans.use!);
    expect(s.hunger).toBe(75);
    const t = new Survival(createRng(6), host().api);
    t.load(JSON.parse(JSON.stringify(s.serialize())));
    expect(t.serialize()).toEqual(s.serialize());
  });
});
