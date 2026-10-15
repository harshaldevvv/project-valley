import { expect, test } from 'vitest';
import { weaponDefs, ballistics } from '../content/data/weapons';
import { stamina as SD } from '../content/data/player';
import { falloffMul, recoilKick, recover, spreadDeg, addBloom } from './weapons/math';
import { Stamina } from './player/stamina';
import { newSenseState, sightRate, updateSenses } from './zombies/senses';

const rifle = weaponDefs.rifle_a;
const dt = 1 / 60;

test('falloff: full to R1, linear to min at 2.5·R1, flat after', () => {
  expect(falloffMul(10, 40, 0.65)).toBe(1);
  expect(falloffMul(40, 40, 0.65)).toBe(1);
  expect(falloffMul(70, 40, 0.65)).toBeCloseTo(0.825);
  expect(falloffMul(100, 40, 0.65)).toBeCloseTo(0.65);
  expect(falloffMul(500, 40, 0.65)).toBeCloseTo(0.65);
});

test('recoil: first 5 shots climb straight up, ±15 % noise, ~90 % recovered in 250 ms', () => {
  const r = () => 0.5;
  for (let i = 0; i < 5; i++) expect(recoilKick(rifle, i, r)[1]).toBe(0);
  const [p] = recoilKick(rifle, 6, () => 1);
  expect(p).toBeLessThanOrEqual(rifle.recoilPitch[1] * 1.15 + 1e-9);
  let off = 1;
  for (let i = 0; i < 15; i++) off = recover(off, rifle.recoverPerSec, dt);
  expect(off).toBeLessThan(0.12);
});

test('spread: ADS standing still is near-perfect; sprint/jump add; bloom capped', () => {
  const add = { sprint: ballistics.sprintSpreadAdd, air: ballistics.airSpreadAdd, move: ballistics.moveSpreadAdd };
  const still = spreadDeg(rifle, { ads: 1, bloom: 0, speed01: 0, sprinting: false, airborne: false, exhausted: false }, add);
  expect(still).toBeLessThanOrEqual(0.5);
  const air = spreadDeg(rifle, { ads: 0, bloom: 0, speed01: 1, sprinting: true, airborne: true, exhausted: false }, add);
  expect(air).toBeGreaterThan(still + 10);
  let b = 0;
  for (let i = 0; i < 100; i++) b = addBloom(b, rifle);
  expect(b).toBe(rifle.bloomMax);
});

test('stamina: sprint drains, regen waits 1 s, exhausted until 30', () => {
  const s = new Stamina();
  for (let i = 0; i < 60 * 10; i++) s.drain(SD.sprintPerSec, dt);
  expect(s.value).toBe(0);
  expect(s.exhausted).toBe(true);
  expect(s.canSprint).toBe(false);
  for (let i = 0; i < 55; i++) s.step(dt); // < regen delay
  expect(s.value).toBe(0);
  for (let i = 0; i < 60; i++) s.step(dt); // ~1 s of regen (20/s)
  expect(s.value).toBeGreaterThan(15);
  expect(s.exhausted).toBe(true);
  for (let i = 0; i < 60; i++) s.step(dt);
  expect(s.exhausted).toBe(false);
  expect(s.spend(1000)).toBe(false);
});

test('senses: sight builds suspicion gradually, never straight to detected; hearing -> searching', () => {
  expect(sightRate(10, 60, 1, 1)).toBe(0); // outside 80° cone
  expect(sightRate(40, 0, 1, 1)).toBe(0); // out of range
  expect(sightRate(5, 0, 1, 1)).toBeGreaterThan(sightRate(20, 0, 1, 1));
  expect(sightRate(18, 0, 0.6, 0)).toBe(0); // crouched + still at 18 m: unseen

  const s = newSenseState();
  const rate = sightRate(3, 0, 1, 1);
  updateSenses(s, rate, false, dt);
  expect(s.awareness).toBe('unaware');
  let t = 0;
  while (s.awareness !== 'detected' && t < 3) {
    updateSenses(s, rate, false, dt);
    t += dt;
  }
  expect(t).toBeGreaterThan(0.4); // passed through suspicious, took ≥ 0.5 s
  expect(t).toBeLessThan(1.6);

  const h = newSenseState();
  updateSenses(h, 0, true, dt); // a gunshot far away
  expect(h.awareness).toBe('searching');
  for (let i = 0; i < 60 * 40; i++) updateSenses(h, 0, false, dt);
  expect(h.awareness).toBe('unaware');
});
