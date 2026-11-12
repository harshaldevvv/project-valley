import { RenderPipeline } from 'three/webgpu';
import { pass, renderOutput, uniform, uv, vec3, vec4, float, mix, smoothstep, length, dot, time, fract, sin, clamp } from 'three/tsl';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
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
  /** Look: bloom on HDR highlights, vignette, split-tone grade and film grain (cheap, no extra scene passes). */
  look: boolean;
}

export function installPost(game: Game, settings: PostSettings = { fxaa: true, renderScale: 1, shadows: true, look: true }) {
  const { renderer, scene, camera, sun, perf } = game;
  const scenePass = pass(scene, camera);
  /** Live-tunable grade, fed by gameplay (damage pulse) through post.look. */
  const look = { vignette: uniform(0.42), saturation: uniform(1.14), contrast: uniform(1.1), grain: uniform(0.03), hurt: uniform(0), bloomMix: uniform(1) };
  const bloomNode = bloom(scenePass, 0.28, 0.55, 0.92);
  const hdr = scenePass.add(bloomNode.mul(look.bloomMix));
  const toned = renderOutput(scenePass);
  const tonedHdr = renderOutput(hdr);
  const graded = (() => {
    const c = tonedHdr.rgb;
    const luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // contrast around mid-grey, saturation, warm highlights / cool shadows
    let g = mix(vec3(0.5), c, look.contrast).max(0);
    g = mix(vec3(luma), g, look.saturation);
    g = g.add(vec3(0.035, 0.012, -0.03).mul(smoothstep(0.35, 0.95, luma))).add(vec3(-0.012, 0.0, 0.02).mul(smoothstep(0.4, 0.0, luma)));
    // vignette + hurt pulse (red edges)
    const q = uv().sub(0.5);
    const r = length(q.mul(vec3(1.0, 0.85, 0).xy)).mul(1.35);
    const vig = smoothstep(0.38, 1.0, r);
    g = g.mul(float(1).sub(vig.mul(look.vignette)));
    g = mix(g, vec3(0.55, 0.02, 0.02).mul(luma.add(0.25)), vig.mul(look.hurt).mul(0.85));
    // grain
    const n = fract(sin(dot(uv().add(fract(time)), vec3(12.9898, 78.233, 0).xy)).mul(43758.5453));
    g = g.add(n.sub(0.5).mul(look.grain));
    return vec4(clamp(g, 0, 1), 1);
  })();
  const pipeline = new RenderPipeline(renderer);
  // Time the scene (+ shadow) pass separately from the post chain: render = r.scene + r.post.
  let sceneMs = 0;
  const sceneUpdate = scenePass.updateBefore.bind(scenePass);
  scenePass.updateBefore = (frame) => {
    const t = performance.now();
    const r = sceneUpdate(frame);
    sceneMs += performance.now() - t;
    return r;
  };
  pipeline.outputColorTransform = false; // renderOutput above already tonemaps + converts
  let direct = false;

  const apply = () => {
    settings.renderScale = Math.min(1, Math.max(0.5, settings.renderScale));
    scenePass.setResolutionScale(settings.renderScale);
    const finalNode = settings.look ? graded : toned;
    pipeline.outputNode = settings.fxaa ? fxaa(finalNode) : finalNode;
    pipeline.needsUpdate = true;
    direct = !settings.fxaa && !settings.look && settings.renderScale === 1;
    sun.castShadow = settings.shadows;
    perf.extra.post = `${settings.fxaa ? 'FXAA' : 'no AA'} x${settings.renderScale.toFixed(2)}${settings.shadows ? '' : ' no-shadows'}${settings.look ? '' : ' no-look'}`;
  };
  apply();

  const timing = (renderer.backend as { trackTimestamp?: boolean }).trackTimestamp;
  let frame = 0;
  let hurt = 0;
  let last = performance.now();
  game.events.on('playerDamaged', (e) => { hurt = Math.min(1, hurt + 0.35 + e.amount / 40); });
  game.renderFrame = () => {
    const now = performance.now();
    hurt = Math.max(0, hurt - (now - last) / 900);
    last = now;
    look.hurt.value = hurt * hurt;
    const t0 = performance.now();
    sceneMs = 0;
    if (direct) renderer.render(scene, camera);
    else pipeline.render();
    const total = performance.now() - t0;
    if (direct) sceneMs = total;
    perf.add('r.scene', sceneMs);
    perf.add('r.post', total - sceneMs);
    if (timing && ++frame % 30 === 0) {
      void renderer.resolveTimestampsAsync('render').then((ms) => {
        if (typeof ms === 'number') perf.extra.gpuMs = ms.toFixed(2);
      });
    }
  };
  /** Compile the scene's pipelines for the render target they will really draw into (the scene pass's HDR target). */
  const compileAsync = async () => {
    const prev = renderer.getRenderTarget();
    if (!direct) renderer.setRenderTarget(scenePass.renderTarget);
    await renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(prev);
  };
  return { settings, apply, pipeline, compileAsync, look };
}
export type Post = ReturnType<typeof installPost>;
