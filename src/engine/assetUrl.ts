/**
 * Public-dir path -> URL under the deploy base ("/" locally, "/project-valley/" on harshal.dev).
 * With VITE_ASSET_VERSION set (harshal.dev builds pass the commit hash), `?v=<version>` is appended so the host
 * can cache public files forever (immutable) and a new build still fetches fresh copies. Unset in dev.
 */
const version = import.meta.env.VITE_ASSET_VERSION as string | undefined;
export const assetUrl = (path: string) =>
  import.meta.env.BASE_URL + path.replace(/^\//, '') + (version ? `?v=${encodeURIComponent(version)}` : '');
