/**
 * Bound repeated hashing of immutable historical source text to a small cache.
 *
 * @file
 */
import { sha256 as uncachedSha256 } from "../../src/capsule/node.mjs";

/**
 * Cache exact string inputs only. Mutable buffers always reach the original hash.
 *
 * @param digest - Original digest implementation.
 * @param options - Independent bounds for retained text and entry bookkeeping.
 * @param options.maxEntries - Maximum cached string inputs.
 * @param options.maxBytes - Maximum UTF-16 bytes of retained inputs and digests.
 */
export const createSourceHistoryDigest = (digest = uncachedSha256, { maxEntries = 256, maxBytes = 64 * 1024 * 1024 } = {}) => {
	if(typeof digest !== "function") throw new TypeError("A digest function is required");
	for(const limit of [maxEntries, maxBytes])
		if(!Number.isSafeInteger(limit) || limit < 0) throw new TypeError("Digest cache bounds must be nonnegative safe integers");
	const cache = new Map(); let retained = 0;
	return input => {
		if(typeof input !== "string" || maxEntries === 0 || maxBytes === 0) return digest(input);
		const hit = cache.get(input);
		if(hit)
		{
			cache.delete(input); cache.set(input, hit);
			return hit.value;
		}
		const value = digest(input);
		if(typeof value !== "string") return value;
		const bytes = 2 * (input.length + value.length);
		if(bytes > maxBytes) return value;
		while(cache.size >= maxEntries || retained + bytes > maxBytes)
		{
			const oldest = cache.keys().next().value;
			retained -= cache.get(oldest).bytes; cache.delete(oldest);
		}
		cache.set(input, { value, bytes }); retained += bytes;
		return value;
	};
};

export const sha256 = createSourceHistoryDigest();
