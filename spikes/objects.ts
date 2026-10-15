// Spike 1: CPU cost per rendered object, WebGLRenderer vs WebGPURenderer (WebGPU and WebGL2 backends).
// ?mode=webgl|webgpu|webgpu-gl&n=1000 . N separate meshes over 200 shared geometries, one material,
// all inside the frustum (no culling wins). Measures CPU time of renderer.render() (submission cost),
// first-frame time (includes pipeline compile) and frame interval. Result -> window.__spike.
import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { WebGPURenderer } from 'three/webgpu';

const q = new URLSearchParams(location.search);
const mode = q.get('mode') ?? 'webgpu';
const n = Number(q.get('n') ?? 1000);
const FRAMES = 300;

const W = 1280;
const H = 720;
let renderer: WebGLRenderer | WebGPURenderer;
if (mode === 'webgl') {
  renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
} else {
  renderer = new WebGPURenderer({ antialias: false, forceWebGL: mode === 'webgpu-gl' });
  await renderer.init();
}
renderer.setPixelRatio(1);
renderer.setSize(W, H);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
scene.add(new HemisphereLight('#ffffff', '#444444', 1.5));
const sun = new DirectionalLight('#ffffff', 2);
sun.position.set(5, 10, 7);
scene.add(sun);

const geos: BufferGeometry[] = [];
for (let i = 0; i < 200; i++) {
  const s = 0.3 + (i % 7) * 0.05;
  geos.push(
    [
      () => new BoxGeometry(s, s, s),
      () => new IcosahedronGeometry(s * 0.6, 1),
      () => new CylinderGeometry(s * 0.4, s * 0.4, s, 10),
      () => new ConeGeometry(s * 0.5, s, 10),
    ][i % 4](),
  );
}
const mat = new MeshStandardMaterial({ color: '#a7825a', roughness: 0.8 });
const side = Math.ceil(Math.cbrt(n));
for (let i = 0; i < n; i++) {
  const m = new Mesh(geos[i % geos.length], mat);
  m.position.set((i % side) - side / 2, Math.floor(i / side) % side - side / 2, -Math.floor(i / (side * side)) - 4);
  m.rotation.set(i, i * 0.7, 0);
  m.matrixAutoUpdate = false; // statics: matrix computed once (dirty-flag rule)
  m.updateMatrix();
  scene.add(m);
}
const camera = new PerspectiveCamera(75, W / H, 0.1, 500);
camera.position.set(0, 0, side * 0.9);

const renderMs: number[] = [];
const intervalMs: number[] = [];
let first = 0;
let last = 0;
let frame = 0;

function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
function p95(a: number[]) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length * 0.95)];
}

const loop = (t: number) => {
  camera.rotation.z = Math.sin(t / 2000) * 0.01; // camera moves -> real per-frame work, objects stay in view
  const t0 = performance.now();
  renderer.render(scene, camera);
  const dt = performance.now() - t0;
  if (frame === 0) first = dt;
  else if (frame > 30) {
    renderMs.push(dt);
    intervalMs.push(t - last);
  }
  last = t;
  frame++;
  if (frame < FRAMES + 31) return;
  renderer.setAnimationLoop(null);
  const info = renderer.info.render as { drawCalls?: number; calls?: number };
  (window as unknown as { __spike: unknown }).__spike = {
    mode,
    n,
    firstFrameMs: +first.toFixed(1),
    renderCpuMedianMs: +median(renderMs).toFixed(2),
    renderCpuP95Ms: +p95(renderMs).toFixed(2),
    usPerObject: +((median(renderMs) * 1000) / n).toFixed(2),
    frameIntervalMedianMs: +median(intervalMs).toFixed(2),
    drawCalls: info.drawCalls ?? info.calls,
  };
  document.title = 'DONE';
};
renderer.setAnimationLoop(loop);
