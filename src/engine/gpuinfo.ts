import type { WebGPURenderer } from 'three/webgpu';

/**
 * Which GPU are we actually on (QA-075)? WebGPU: device/adapter info (vendor, architecture, description);
 * WebGL2: the unmasked renderer string. `integrated` is a heuristic: Intel UHD/Iris/Xe-LP, AMD "Radeon(TM) Graphics"
 * (no model number) or the gcn-5 (Vega) architecture used by Ryzen APUs.
 *   const gpu = await detectGpu(renderer);  // { label: 'amd gcn-5', integrated: true }
 */
export interface GpuInfo {
  label: string;
  integrated: boolean;
}

export async function detectGpu(renderer: WebGPURenderer): Promise<GpuInfo> {
  try {
    const backend = renderer.backend as { isWebGPUBackend?: boolean; device?: GPUDevice & { adapterInfo?: GPUAdapterInfo }; gl?: WebGL2RenderingContext };
    if (backend.isWebGPUBackend) {
      const info = backend.device?.adapterInfo ?? (await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }))?.info;
      if (!info) return { label: 'unknown', integrated: false };
      const label = [info.vendor, info.architecture, info.description].filter(Boolean).join(' ').trim() || 'unknown';
      return { label, integrated: isIntegrated(label, info.vendor, info.architecture) };
    }
    const gl = backend.gl;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const label = (ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '') || 'unknown';
    return { label, integrated: isIntegrated(label, '', '') };
  } catch {
    return { label: 'unknown', integrated: false };
  }
}

export function isIntegrated(label: string, vendor: string, arch: string) {
  const l = label.toLowerCase();
  if (/intel/.test(vendor) || /intel/.test(l)) return !/\barc\b|xe-hpg|alchemist|battlemage/.test(l + ' ' + arch);
  if (/radeon\(tm\) graphics|radeon graphics|vega \d+ graphics/.test(l)) return true;
  if (/amd/.test(vendor) && /gcn-5/.test(arch)) return true;
  return false;
}
