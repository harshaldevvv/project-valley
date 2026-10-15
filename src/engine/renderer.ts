import { WebGPURenderer } from 'three/webgpu';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';

export type Backend = 'webgpu' | 'webgl2';

/**
 * WebGPURenderer with automatic WebGL2 fallback. `?webgl` in the URL forces the fallback
 * (to test the Low tier); `?gputime` turns on GPU timestamp queries (perf overlay shows GPU ms). Pixel ratio is capped at 1.5: fill rate is the 4 GB GPU's weak spot.
 */
export async function createRenderer(canvasParent: HTMLElement) {
  const q = new URLSearchParams(location.search);
  const forceWebGL = q.has('webgl');
  // No MSAA: measured in M0, antialias:true on WebGPU (+ shadows) reset the GPU device on this RTX 3050 Ti laptop
  // and costs fill rate anyway. Anti-aliasing comes from an FXAA/SMAA pass instead (principles §13).
  const renderer = new WebGPURenderer({ antialias: false, forceWebGL, powerPreference: 'high-performance', trackTimestamp: q.has('gputime') });
  await renderer.init();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(Math.max(1, innerWidth), Math.max(1, innerHeight)); // a 0-size canvas invalidates the WebGPU swap texture
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  canvasParent.appendChild(renderer.domElement);
  // A lost GPU device (driver reset / TDR) can't be recovered in place; tell the player instead of a frozen black frame.
  // ponytail: reload prompt only; add auto-save-then-reload once saves exist (M2).
  renderer.onDeviceLost = (info) => {
    console.error('GPU device lost', info);
    const el = document.createElement('div');
    el.textContent = 'The graphics device was reset. Click to reload.';
    el.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;color:#eee;background:#000c;font:16px system-ui;z-index:20;cursor:pointer';
    el.onclick = () => location.reload();
    document.body.appendChild(el);
  };

  const backend: Backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  return { renderer, backend };
}
