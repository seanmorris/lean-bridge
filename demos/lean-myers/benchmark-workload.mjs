/**
 * Matched complete edit scripts, checked against an independent quadratic oracle.
 *
 * @file
 */

import { prepareDiff } from "./runtime.mjs";
import { prepareJavascript, solveOracle, verifyResult } from "./reference.mjs";
import { measureSyncBenchmark } from "../shared/browser-benchmark.mjs";

/**
 * Make deterministic document-token sequences with separated edits or repeated lines.
 *
 * @param {object} [configuration] Workload length and repeated-token mode.
 * @param {number} [configuration.length] Original sequence length.
 * @param {boolean} [configuration.repeated] Use a small repeated-token alphabet.
 * @param {boolean} [configuration.reordered] Swap two blocks, requiring an order-sensitive certificate.
 */
export const makeWorkload = ({ length = 384, repeated = false, reordered = false } = {}) => {
	const before = Uint32Array.from({ length }, (_, index) => repeated ? index % 11 : index + 1);
	const after = Array.from(before);
	if(reordered)
	{
		const start = Math.floor(length / 3);
		after.splice(start, 8, ...before.slice(start + 4, start + 8), ...before.slice(start, start + 4));
		return { before, after: Uint32Array.from(after) };
	}
	for(const fraction of [.12, .33, .57, .82])
	{
		const index = Math.floor(length * fraction);
		after.splice(index, 1, 0xf000_0000 + index, 0xe000_0000 + index);
	}
	after.splice(Math.floor(length * .7), 2);
	return { before, after: Uint32Array.from(after) };
};

/**
 * Prepare equivalent owned Lean and JS solves; validate full replay outside timing.
 *
 * @param {object} [configuration] Workload dimensions.
 */
export const createBenchmark = async configuration => {
	const { before, after } = makeWorkload(configuration);
	const solve = await prepareDiff({ before, after });
	const javascript = prepareJavascript(before, after);
	const expected = solveOracle(before, after).distance;
	const sample = (index = 0) => {
		let lean;
		let js;
		if(index % 2)
		{ js = measureSyncBenchmark(javascript, 4); lean = measureSyncBenchmark(solve, 4); }
		else
		{ lean = measureSyncBenchmark(solve, 4); js = measureSyncBenchmark(javascript, 4); }
		if(lean.result.usedFallback) throw new Error("Benchmark entered the exhaustive reference fallback");
		verifyResult(before, after, lean.result, expected);
		verifyResult(before, after, js.result, expected);
		return { leanMs: lean.milliseconds, javascriptMs: js.milliseconds };
	};
	return { sample, beforeLength: before.length, afterLength: after.length
		, distance: expected, dispose: solve.dispose };
};
