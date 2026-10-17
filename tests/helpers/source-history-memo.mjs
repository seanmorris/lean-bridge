/**
 * Reuse exact immutable source transitions without retaining unbounded histories.
 *
 * @file
 */
import assert from "node:assert/strict";

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

const sha256Pattern = /^[0-9a-f]{64}$/u;

/**
 * Select bounded stopping hashes from an exact, singly linked source history.
 * Conflicting or cyclic evidence is rejected rather than choosing a branch.
 *
 * @param transitions - Authenticated current-to-previous digest transitions.
 * @param current - Digest of the source that will be normalized.
 * @param expected - Optional digest at which normalization should stop.
 * @param chunkSize - Maximum number of transitions in one normalization call.
 */
export const exactSourceHistoryCheckpoints = (
	transitions, current, expected, chunkSize = 4
) => {
	if(!Array.isArray(transitions))
		throw new TypeError("Source history transitions must be an array");
	if(!sha256Pattern.test(current)
		|| (expected !== undefined && !sha256Pattern.test(expected)))
		throw new TypeError("Source history digests must be lowercase SHA-256 values");
	if(!Number.isSafeInteger(chunkSize) || chunkSize < 1)
		throw new TypeError("Source history chunk size must be a positive safe integer");
	const edges = new Map();
	for(const transition of transitions)
	{
		if(!transition || !sha256Pattern.test(transition.currentSha256)
			|| !sha256Pattern.test(transition.previousSha256))
			throw new TypeError("Source history transitions require exact SHA-256 values");
		assert.notEqual(transition.currentSha256, transition.previousSha256
			, "Source history transitions must change the digest");
		const previous = edges.get(transition.currentSha256);
		const consistent = previous === undefined
			|| previous === transition.previousSha256;
		assert.ok(consistent
			, `Conflicting source history transition for ${transition.currentSha256}`);
		edges.set(transition.currentSha256, transition.previousSha256);
	}
	const chain = [], seen = new Set();
	let digest = current;
	while(digest !== expected && edges.has(digest))
	{
		assert.ok(!seen.has(digest), `Cyclic source history transition at ${digest}`);
		seen.add(digest); digest = edges.get(digest); chain.push(digest);
	}
	const checkpoints = chain.filter((_, index) =>
		(index + 1) % chunkSize === 0 || index === chain.length - 1);
	return Object.freeze({
		checkpoints: Object.freeze(checkpoints)
		, reachedExpected: expected !== undefined && digest === expected
		, terminalSha256: digest
	});
};
