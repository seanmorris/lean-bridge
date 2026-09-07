/**
 * Matched complete pair outputs for sparse 2D/3D and dense collision scenes.
 *
 * @file
 */

import { prepareSweep } from "./runtime.mjs";
import { prepareJavascript, solveOracle, verifyResult } from "./reference.mjs";
import { measureSyncBenchmark } from "../shared/browser-benchmark.mjs";

/**
 * Generate reproducible signed-coordinate boxes with configurable density.
 *
 * @param {object} [configuration] Box count, dimensionality, density, and seed.
 * @param {number} [configuration.count] Number of boxes.
 * @param {number} [configuration.dimensions] Two or three spatial dimensions.
 * @param {number} [configuration.axis] Axis used for sweeping.
 * @param {boolean} [configuration.dense] Force every box to overlap every other box.
 * @param {number} [configuration.seed] Deterministic seed.
 */
export const makeWorkload = ({ count = 256, dimensions = 2, axis = 0, dense = false, seed = 0x1141cafe } = {}) => {
	let state = seed || 1;
	const random = maximum => {
		state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
		return (state >>> 0) % maximum;
	};
	const stride = dimensions * 2;
	const boxes = new Int32Array(count * stride);
	const extent = dimensions === 2 ? 4096 : 8192;
	for(let body = 0; body < count; body++)
		for(let dimension = 0; dimension < dimensions; dimension++)
		{
			const start = dense ? -32 - random(64) : random(extent) - extent / 2;
			boxes[body * stride + dimension] = start;
			boxes[body * stride + dimensions + dimension] = dense ? 32 + random(64) : start + 40 + random(180);
		}
	return { boxes, dimensions, axis };
};

/**
 * Prepare identical snapshots and independently check every measured pair set.
 *
 * @param {object} [configuration] Workload dimensions and density.
 */
export const createBenchmark = async configuration => {
	const request = makeWorkload(configuration);
	const solve = await prepareSweep(request);
	const javascript = prepareJavascript(request);
	const expected = solveOracle(request);
	const sample = (index = 0) => {
		let lean;
		let js;
		if(index % 2)
		{ js = measureSyncBenchmark(javascript, 4); lean = measureSyncBenchmark(solve, 4); }
		else
		{ lean = measureSyncBenchmark(solve, 4); js = measureSyncBenchmark(javascript, 4); }
		verifyResult(request, lean.result, expected);
		verifyResult(request, js.result, expected);
		return { leanMs: lean.milliseconds, javascriptMs: js.milliseconds };
	};
	return { sample, count: request.boxes.length / (request.dimensions * 2)
		, dimensions: request.dimensions
		, candidateCount: expected.candidates.length / 2
		, overlapCount: expected.overlaps.length / 2
		, dispose: solve.dispose };
};
