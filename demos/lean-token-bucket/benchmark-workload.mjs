/**
 * Matched token-bucket traces with bursts, idle refills, and rejected clock regressions.
 *
 * @file
 */

import { prepareTrace } from "./runtime.mjs";
import { prepareJavascriptTrace, prepareOracleTrace } from "./reference.mjs";
import { measureSyncBenchmark } from "../shared/browser-benchmark.mjs";

/**
 * Generate deterministic integer timestamps and costs without timing setup work.
 *
 * @param {number} [operationCount] Number of requests in each trace.
 * @returns {object} Initially full bucket and timestamp/cost pairs.
 */
export const makeWorkload = (operationCount = 1024) => {
	const operations = new Uint32Array(operationCount * 2);
	let timestamp = 100;
	let seed = 0x7b1137;
	for(let index = 0; index < operationCount; index += 1)
	{
		seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
		timestamp += index % 31 === 0 ? 25 : index % 8 === 0 ? 1 : 0;
		operations[index * 2] = index % 43 === 7 ? timestamp - 1 : timestamp;
		operations[index * 2 + 1] = index % 67 === 11 ? 101 : 5 + (seed >>> 0) % 24;
	}
	return { capacity: 100, rate: 3, now: 100, operations };
};

const sameWire = (left, right) => left.length === right.length
	&& left.every((value, index) => value === right[index]);

/**
 * Prepare both implementations and check full outputs after each matched measurement.
 *
 * @param {object} [configuration] Benchmark dimensions.
 * @param {number} [configuration.operationCount] Requests per initially full trace.
 * @returns {Promise<object>} Prepared sampling, result counts, and disposal.
 */
export const createBenchmark = async ({ operationCount = 1024 } = {}) => {
	const request = makeWorkload(operationCount);
	const solve = await prepareTrace(request);
	const javascriptSolve = prepareJavascriptTrace(request);
	const expected = prepareOracleTrace(request)();
	const counts = [0, 0, 0];
	for(let offset = 0; offset < expected.length; offset += 7) counts[expected[offset]] += 1;
	const sample = (index = 0) => {
		let lean;
		let javascript;
		if(index % 2)
		{ javascript = measureSyncBenchmark(javascriptSolve, 4); lean = measureSyncBenchmark(solve, 4); }
		else
		{ lean = measureSyncBenchmark(solve, 4); javascript = measureSyncBenchmark(javascriptSolve, 4); }
		if(!sameWire(lean.result, expected) || !sameWire(javascript.result, expected))
			throw new Error("Lean and JavaScript disagree with the BigInt oracle on token-bucket event records");
		return { leanMs: lean.milliseconds, javascriptMs: javascript.milliseconds };
	};
	return {
		sample
		, operationCount
		, allowedCount: counts[0]
		, throttledCount: counts[1]
		, regressionCount: counts[2]
		, dispose: solve.dispose
	};
};
