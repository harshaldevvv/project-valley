import { RenderPipeline } from 'three/webgpu';
import { pass, renderOutput } from 'three/tsl';
import { fxaa } from 'three/examples/jsm/tsl/display/FXAANode.js';
import type { Game } from '../core/game';

/**
 * Post-processing (principles §13: no MSAA; FXAA instead). Installs itself as game.renderFrame.
 *   const post = installPost(game);  post.settings.fxaa = false;  post.apply();
 * Chain: scene pass (at renderScale) -> tonemap + sRGB (renderOutput) -> FXAA (needs sRGB input) -> screen.
 * With FXAA off and renderScale 1 it renders directly (no extra full-screen pass).
 * `?gputime` in the URL enables WebGPU timestamp queries; GPU ms then shows in the perf overlay.
 */
export interface PostSettings {
  fxaa: boolean;
  renderScale: number; // 0.5..1
  shadows: boolean;
}

export function installPost(game: Game, settings: PostSettings = { fxaa: true, renderScale: 1, shadows: true }) {
  const { renderer, scene, camera, sun, perf } = game;
  const scenePass = pass(scene, camera);
  const toned = renderOutput(scenePass);
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputColorTransform = false; // renderOutput above already tonemaps + converts
  let direct = false;

  const apply = () => {
    settings.renderScale = Math.min(1, Math.max(0.5, settings.renderScale));
    scenePass.setResolutionScale(settings.renderScale);
    pipeline.outputNode = settings.fxaa ? fxaa(toned) : toned;
    pipeline.needsUpdate = true;
    direct = !settings.fxaa && settings.renderScale === 1;
    sun.castShadow = settings.shadows;
    perf.extra.post = `${settings.fxaa ? 'FXAA' : 'no AA'} x${settings.renderScale.toFixed(2)}${settings.shadows ? '' : ' no-shadows'}`;
  };
  apply();

  const timing = (renderer.backend as { trackTimestamp?: boolean }).trackTimestamp;
  let frame = 0;
  game.renderFrame = () => {
    if (direct) renderer.render(scene, camera);
    else pipeline.render();
    if (timing && ++frame % 30 === 0) {
      void renderer.resolveTimestampsAsync('render').then((ms) => {
        if (typeof ms === 'number') perf.extra.gpuMs = ms.toFixed(2);
      });
    }
  };
  return { settings, apply, pipeline };
}
export type Post = ReturnType<typeof installPost>;
