import { expect, test } from 'vitest';
import { isIntegrated } from './gpuinfo';

test('integrated GPU heuristic', () => {
  expect(isIntegrated('amd gcn-5', 'amd', 'gcn-5')).toBe(true); // Ryzen Vega APU (this laptop)
  expect(isIntegrated('ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11)', '', '')).toBe(true);
  expect(isIntegrated('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)', '', '')).toBe(true);
  expect(isIntegrated('intel xe-hpg Intel(R) Arc(TM) A770', 'intel', 'xe-hpg')).toBe(false);
  expect(isIntegrated('nvidia ampere', 'nvidia', 'ampere')).toBe(false);
  expect(isIntegrated('ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Ti Laptop GPU Direct3D11)', '', '')).toBe(false);
  expect(isIntegrated('amd rdna-2 AMD Radeon RX 6700 XT', 'amd', 'rdna-2')).toBe(false);
});
