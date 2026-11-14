// Shared launcher for every audit/test script: HEADLESS (no window, never takes focus or the mouse, no pointer lock),
// muted, real GPU (WebGPU works in new headless Chrome). Owner request 2026-11-14.
import { chromium } from 'playwright';
export const launch = () => chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--mute-audio', '--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
