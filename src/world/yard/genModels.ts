import { PF, pfFiles } from './pfModels';
/** Polyfork models in public/assets/models/pf (file, bytes unknown: sizes are small), so the boot screen can prefetch them. */
export const genModels: [string, number][] = [...new Set(pfFiles)].map((f) => [f, 120_000]);
export const genModelPath = (file: string) => `assets/models/pf/${file}.glb`;
void PF;
