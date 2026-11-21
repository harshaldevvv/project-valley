/**
 * Graphics quality presets (engine/quality.ts applies them; settings show and override them).
 * Measured on a weak-GPU stand-in (headless 960x540, CPU throttled x4): see docs/progress/2026-11-20-overnight.md.
 * Under a slow CPU the render cost is mostly draw submission, and shadows draw every caster again, so the
 * shadow extent (fewer casters in the shadow frustum) and far-cull distances matter more than render scale.
 */
export type QualityId = 'low' | 'medium' | 'high';
export const QUALITY_ORDER: QualityId[] = ['high', 'medium', 'low'];

export interface QualityPreset {
  /** Written into the player's settings when the preset is picked (the player can still fine-tune them after). */
  renderScale: number; // 0.5..1
  shadows: boolean;
  fxaa: boolean;
  look: boolean;
  ao: boolean;
  shafts: boolean;
  /** Bloom in the look chain (not a player setting; its blur mip chain is the costliest post pass). */
  bloom: boolean;
  /** Multiplies fog distances (world/yard/lighting fogNear/fogFar) and the camera far plane (600 m): fully fogged far
   *  POIs stop drawing. The sky dome scales to stay inside the far plane. */
  viewDist: number;
  /** Sun shadow map (px, square) and the half-size of its box round the camera (m). */
  shadowMap: number;
  shadowExtent: number;
  /** Skinned zombies cast shadows only this close to the camera (m; data/zombies horde.shadowDist on high). */
  zombieShadowDist: number;
  /** Fraction of grass tufts and undergrowth bushes drawn (instances are shuffled, so thinning is even). */
  grass: number;
  foliage: number;
  /** Grass shrinks away to nothing at this distance (m). */
  grassFar: number;
  /** Multiplies data/yard FAR_CULL distances (props, decals, vehicles) and data/npc drawDistance. */
  farCull: number;
  npcDraw: number;
  /** Real point lights following the nearest street lamps at night (the bulbs and fake cones always show). */
  lampLights: number;
}

export const QUALITY: Record<QualityId, QualityPreset> = {
  high: { renderScale: 1, shadows: true, fxaa: true, look: true, ao: true, shafts: true, bloom: true, viewDist: 1, shadowMap: 2048, shadowExtent: 40, zombieShadowDist: 15, grass: 1, foliage: 1, grassFar: 46, farCull: 1, npcDraw: 1, lampLights: 4 },
  medium: { renderScale: 0.85, shadows: true, fxaa: true, look: true, ao: false, shafts: false, bloom: true, viewDist: 0.8, shadowMap: 1536, shadowExtent: 30, zombieShadowDist: 10, grass: 0.7, foliage: 0.75, grassFar: 36, farCull: 0.8, npcDraw: 0.8, lampLights: 2 },
  low: { renderScale: 0.7, shadows: false, fxaa: true, look: true, ao: false, shafts: false, bloom: false, viewDist: 0.6, shadowMap: 1024, shadowExtent: 22, zombieShadowDist: 0, grass: 0.45, foliage: 0.5, grassFar: 28, farCull: 0.6, npcDraw: 0.65, lampLights: 1 },
};

/**
 * Auto-pick: frame times are sampled while playing; after `windowS` of samples (ignoring the first `settleS` after start or
 * after a change, which hold shader compiles), if p95 > `p95LimitMs` the preset steps down one level and measures again.
 * Steps only down, and the pick is saved; choosing Auto in settings starts again from high. Off under automation
 * (navigator.webdriver) so audit scripts keep fixed settings; `?autoquality` forces it on, `?noautoquality` off.
 */
export const AUTO_QUALITY = { windowS: 30, settleS: 5, p95LimitMs: 18, maxFrameMs: 250 };
