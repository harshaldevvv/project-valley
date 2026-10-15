// Spike 3: float32 precision jitter far from the origin (principles §13, "corner probe").
// For each world offset O we render the SAME camera-relative scene 16 times, nudging both the
// camera and the object by k * 0.37 mm. With perfect precision every frame is identical; jitter
// shows up as pixels that differ from frame 0. A 4x4 km map centred on 0 reaches ~2.83 km.
// ?webgl forces the WebGPURenderer's WebGL2 backend. Result -> window.__spike.
import { DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, RenderTarget, Scene, TorusKnotGeometry, UnsignedByteType } from 'three';
import { WebGPURenderer } from 'three/webgpu';

const forceWebGL = new URLSearchParams(location.search).has('webgl');
const renderer = new WebGPURenderer({ antialias: false, forceWebGL });
await renderer.init();
renderer.setSize(256, 256);
document.body.appendChild(renderer.domElement);

const S = 256;
const rt = new RenderTarget(S, S, { type: UnsignedByteType });
const scene = new Scene();
scene.add(new HemisphereLight('#ffffff', '#333333', 1.5));
const sun = new DirectionalLight('#ffffff', 2);
scene.add(sun);
// A small, detailed object 0.6 m from the camera (a hand-held item / nearby prop scale).
const knot = new Mesh(new TorusKnotGeometry(0.1, 0.03, 200, 24), new MeshStandardMaterial({ color: '#c08040', roughness: 0.4 }));
scene.add(knot);
const camera = new PerspectiveCamera(60, 1, 0.05, 1000);

async function renderAt(ox: number, oz: number, nudge: number) {
  const x = ox + nudge;
  const z = oz + nudge;
  knot.position.set(x, 1.6, z);
  knot.rotation.set(0.4, 0.8, 0);
  sun.position.set(x + 2, 5, z + 3);
  sun.target.position.copy(knot.position);
  sun.target.updateMatrixWorld();
  camera.position.set(x, 1.6, z + 0.6);
  camera.lookAt(knot.position);
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  return (await renderer.readRenderTargetPixelsAsync(rt, 0, 0, S, S)) as Uint8Array;
}

const results: Record<string, { maxDiffPixels: number; maxChannelDelta: number }> = {};
for (const [label, o] of [
  ['origin', 0],
  ['500m', 500 / Math.SQRT2],
  ['2.83km (4x4 map corner)', 2000],
  ['5.66km (8x8 map corner)', 4000],
  ['14km', 10000],
] as const) {
  const base = await renderAt(o, o, 0);
  let maxDiffPixels = 0;
  let maxChannelDelta = 0;
  for (let k = 1; k < 16; k++) {
    const img = await renderAt(o, o, k * 0.00037);
    let diff = 0;
    for (let i = 0; i < img.length; i += 4) {
      const d = Math.max(Math.abs(img[i] - base[i]), Math.abs(img[i + 1] - base[i + 1]), Math.abs(img[i + 2] - base[i + 2]));
      if (d > 8) diff++;
      if (d > maxChannelDelta) maxChannelDelta = d;
    }
    maxDiffPixels = Math.max(maxDiffPixels, diff);
  }
  results[label] = { maxDiffPixels, maxChannelDelta };
}
(window as unknown as { __spike: unknown }).__spike = {
  backend: (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2',
  pixels: S * S,
  results,
};
document.title = 'DONE';
