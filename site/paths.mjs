/**
 * Resolve public site paths without assuming a domain-root deployment.
 *
 * @file
 */

/**
 * Normalize the explicitly configured static-host prefix.
 *
 * @param {string} value Requested deployment directory.
 */
export const normalizeBase = (value = "/") => {
	if(!/^\/(?:[A-Za-z0-9._~-]+\/)*$/u.test(value)
		|| value.split("/").some(part => part === "." || part === ".."))
		throw new Error("LEAN_BRIDGE_SITE_BASE must be an absolute directory path ending in /.");
	return value;
};

/**
 * Prefix a registry path with its deployment directory.
 *
 * @param {string} base Validated deployment prefix.
 * @param {string} path Registry path without its deployment prefix.
 */
export const withBase = (base, path) => normalizeBase(base) + path.replace(/^\//u, "");
