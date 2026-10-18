/** Public-dir path -> URL under the deploy base ("/" locally, "/project-valley/" on harshal.dev). */
export const assetUrl = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '');
