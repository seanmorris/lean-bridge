/**
 * Paired LRU workload and independent insertion-ordered Map baseline.
 *
 * @file
 */

import { prepareTrace } from "./runtime.mjs";
import { measureSyncBenchmark } from "../shared/browser-benchmark.mjs";

/**
 * Execute the trace with an insertion-ordered Map, oldest entry first.
 *
 * @param {number} capacity Maximum entries.
 * @param {Uint32Array} operations Get/put triples.
 * @returns {Uint32Array} Outcome quads matching the public ABI.
 */
export const javascriptTrace = (capacity, operations) => {
	const cache = new Map();
	const output = new Uint32Array(operations.length / 3 * 4);
	for(let index = 0, target = 0; index < operations.length; index += 3, target += 4)
	{
		const kind = operations[index];
		const key = operations[index + 1];
		const value = operations[index + 2];
		const hit = cache.has(key);
		if(kind === 0)
		{
			if(!hit) continue;
			const stored = cache.get(key);
			cache.delete(key); cache.set(key, stored);
			output[target] = 1; output[target + 1] = stored;
		}
		else
		{
			output[target + 1] = value;
			if(capacity === 0)
			{ output[target] = 5; continue; }
			output[target] = hit ? 3 : 2;
			if(hit) cache.delete(key);
			else if(cache.size === capacity)
			{
				const [evictedKey, evictedValue] = cache.entries().next().value;
				cache.delete(evictedKey);
				output[target] = 4;
				output[target + 2] = evictedKey; output[target + 3] = evictedValue;
			}
			cache.set(key, value);
		}
	}
	return output;
};

/**
 * Create a deterministic mix of hot requests, updates, misses, and new keys.
 *
 * @param {number} capacity Cache capacity.
 * @param {number} count Operation count.
 * @param {string} kind Mixed workload, scan pollution, or repeated MRU hits.
 * @returns {Uint32Array} Input triples.
 */
export const makeWorkload = (capacity = 32, count = 4096, kind = "mixed") => {
	let seed = 0x6c7275;
	const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
	const output = new Uint32Array(count * 3);
	const hot = Math.max(1, Math.floor(capacity / 2));
	for(let index = 0; index < count; index += 1)
	{
		const value = random();
		const key = kind === "mru" ? 7 : kind === "scan" ? index % (capacity + 1)
			: value % 10 < 8 ? (value >>> 4) % hot : (value >>> 8) % Math.max(1, capacity * 4);
		output[index * 3] = index < capacity || kind === "scan" || index % 3 === 0 ? 1 : 0;
		output[index * 3 + 1] = key;
		output[index * 3 + 2] = value;
	}
	return output;
};

/**
 * Prepare independent, repeatedly checked Lean/Map timings for browser and CLI.
 *
 * @param root0 Workload configuration.
 * @param {number} [root0.capacity] Maximum entries.
 * @param {number} [root0.count] Operation count per trace.
 * @param {string} [root0.kind] Workload kind.
 * @returns {Promise<object>} Paired sample function and disposal hook.
 */
export const createBenchmark = async ({ capacity = 32, count = 4096, kind = "mixed" } = {}) => {
	const input = makeWorkload(capacity, count, kind);
	const trace = await prepareTrace(capacity, input);
	const js = () => javascriptTrace(capacity, input);
	const sample = (index = 0) => {
		let lean;
		let javascript;
		if(index % 2)
		{ javascript = measureSyncBenchmark(js, 4); lean = measureSyncBenchmark(trace.run, 4); }
		else
		{ lean = measureSyncBenchmark(trace.run, 4); javascript = measureSyncBenchmark(js, 4); }
		if(lean.result.length !== javascript.result.length
			|| lean.result.some((value, offset) => value !== javascript.result[offset]))
			throw new Error("Lean and JavaScript disagree on the operation trace");
		return { leanMs: lean.milliseconds, javascriptMs: javascript.milliseconds };
	};
	return { sample, capacity, count, kind, dispose: trace.dispose };
};
