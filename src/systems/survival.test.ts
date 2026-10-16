import { describe, expect, it } from 'vitest';
import { difficulty } from '../content/data/difficulty';
import { ITEMS } from '../content/data/items';
import { WOUNDS } from '../content/data/survival';
import { createRng } from '../engine/rng';
import { Survival, type SurvivalHost } from './survival';

const host = (night = false) => {
  const h = { hp: 100, events: [] as string[], days: 0 };
  const api: SurvivalHost = {
    maxHp: () => 100,
    hurt: (n, cause) => ((h.hp -= n), h.events.push(cause)),
    hp: () => h.hp,
    heal: (n) => (h.hp = Math.min(100, h.hp + n)),
    isNight: () => night,
    days: () => h.days,
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
    run(s, WOUNDS.bleeding.seconds![1]);
    expect(s.statuses.has('bleeding')).toBe(false);
    s.addStatus('heavy_bleeding');
    run(s, 120, 1);
    expect(s.statuses.has('heavy_bleeding')).toBe(true); // heavy bleeds need treatment
    s.applyUse(ITEMS.bandage.use!);
    expect(s.statuses.has('heavy_bleeding')).toBe(false);
  });

  it('refuses uses that would do nothing (QA-085)', () => {
    const { h, api } = host();
    const s = new Survival(createRng(8), api);
    expect(s.useRefusal(ITEMS.bandage.use!, 'medical')).toBeTruthy(); // full HP, no bleed
    s.addStatus('bleeding');
    expect(s.useRefusal(ITEMS.bandage.use!, 'medical')).toBeNull();
    s.cure('bleeding');
    h.hp = 80;
    expect(s.useRefusal(ITEMS.bandage.use!, 'medical')).toBeNull(); // still heals
    s.addStatus('infection', { stage: 3 });
    expect(s.useRefusal(ITEMS.antibiotics.use!, 'medical')).toMatch(/3/);
    expect(s.useRefusal(ITEMS.antiviral.use!, 'medical')).toBeNull();
    expect(s.useRefusal(ITEMS.canned_beans.use!, 'food')).toBeTruthy(); // not hungry
    s.adjust({ hunger: -10 });
    expect(s.useRefusal(ITEMS.canned_beans.use!, 'food')).toBeNull();
  });

  it('fracture limps and blocks sprint until splinted', () => {
    const s = new Survival(createRng(3), host().api);
    s.addStatus('fracture');
    expect(s.mods).toMatchObject({ moveSpeed: WOUNDS.fracture.moveSpeed, sprintAllowed: false });
    s.applyUse(ITEMS.splint.use!);
    expect(s.mods.sprintAllowed).toBe(true);
  });

  it('infection advances in stages; antibiotics only cure early stages', () => {
    const { h, api } = host();
    const s = new Survival(createRng(4), api);
    s.addStatus('infection');
    const stageDays = WOUNDS.infection.totalGameDays / 4;
    s.step(0.1); // first step only records the clock
    for (let i = 0; i < 2; i++) {
      h.days += stageDays + 0.01; // the engine clock advances
      s.step(0.1);
    }
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
