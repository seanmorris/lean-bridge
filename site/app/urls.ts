/**
 * Share deployment-relative asset and navigation URLs across React components.
 *
 * @file
 */

/** Resolve a registry asset path under Vite's configured public base. */
export const assetHref = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//u, "");
