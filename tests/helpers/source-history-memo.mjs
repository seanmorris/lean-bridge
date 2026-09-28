/**
 * Reuse exact immutable source transitions without retaining unbounded histories.
 *
 * @file
 */

/**
 * Memoize a synchronous source normalizer by full text, path and stopping hash.
 * Unknown text and failed checks still reach the original verifier. Each entry
 * retains at most one source version per path and requested predecessor.
 *
 * @param normalize - Existing source normalizer with immutable receipt inputs.
 * @param options - Bounds for retained strings and entry bookkeeping.
 * @param options.maxEntries - Maximum number of successful changed-source entries.
 * @param options.maxBytes - Maximum conservative UTF-16 size of retained strings.
 */
export const memoizeSourceHistory = (normalize, { maxEntries = 1024, maxBytes = 64 * 1024 * 1024 } = {}) => {
	if(typeof normalize !== "function") throw new TypeError("A source normalizer is required");
	for(const limit of [maxEntries, maxBytes])
		if(!Number.isSafeInteger(limit) || limit < 0) throw new TypeError("History cache bounds must be nonnegative safe integers");
	const entries = new Map(); let retained = 0;
	return (path, source, expected) => {
		if(maxEntries === 0 || maxBytes === 0 || typeof path !== "string" || typeof source !== "string"
			|| (expected !== undefined && typeof expected !== "string")) return normalize(path, source, expected);
		const key = JSON.stringify([path, expected ?? null]);
		const hit = entries.get(key);
		if(hit && hit.source === source && hit.expected === expected)
		{
			entries.delete(key); entries.set(key, hit);
			return hit.result;
		}
		const result = normalize(path, source, expected);
		if(typeof result !== "string" || result === source) return result;
		const bytes = 2 * (source.length + result.length + key.length);
		if(bytes > maxBytes) return result;
		if(hit)
		{
			entries.delete(key); retained -= hit.bytes;
		}
		while(entries.size >= maxEntries || retained + bytes > maxBytes)
		{
			const oldest = entries.keys().next().value;
			retained -= entries.get(oldest).bytes; entries.delete(oldest);
		}
		entries.set(key, { source, expected, result, bytes }); retained += bytes;
		return result;
	};
};
