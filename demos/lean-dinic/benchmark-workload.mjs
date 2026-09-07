/**
 * Matched prepared max-flow networks, with all returned edges checked outside timing.
 *
 * @file
 */

import { prepareGraph } from "./runtime.mjs";
import { fromEdges, prepareJavascript, solveOracle, verifyResult } from "./reference.mjs";
import { measureSyncBenchmark } from "../shared/browser-benchmark.mjs";

/**
 * Construct a seeded layered network with several possible bottleneck cuts.
 *
 * @param {object} root0 Network configuration.
 * @param {number} [root0.layers] Number of relay layers.
 * @param {number} [root0.width] Vertices per relay layer.
 */
export const makeWorkload = ({ layers = 16, width = 8 } = {}) => {
	const count = layers * width + 2;
	const sink = count - 1;
	const edges = [];
	let seed = 0x1139abcd;
	const random = maximum => {
		seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
		return (seed >>> 0) % maximum;
	};
	for(let column = 0; column < width; column++)
	{
		edges.push([0, 1 + column, 20 + random(20)]);
		for(let layer = 0; layer < layers - 1; layer++)
			for(let jump = 0; jump < 4; jump++)
					edges.push([1 + layer * width + column
						, 1 + (layer + 1) * width + (column + 3 * jump + layer) % width
						, 1 + random(20)]);
		edges.push([1 + (layers - 1) * width + column, sink, 20 + random(20)]);
	}
	return fromEdges(count, edges, 0, sink);
};

/**
 * Prepare equivalent Lean and JS calls and a separately computed BigInt optimum.
 *
 * @param {object} [configuration] Layer and width workload dimensions.
 */
export const createBenchmark = async configuration => {
	const request = makeWorkload(configuration);
	const solve = await prepareGraph(request);
	const javascript = prepareJavascript(request);
	const expected = solveOracle(request).value;
	const sample = (index = 0) => {
		let lean;
		let js;
		if(index % 2)
		{ js = measureSyncBenchmark(javascript, 4); lean = measureSyncBenchmark(solve, 4); }
		else
		{ lean = measureSyncBenchmark(solve, 4); js = measureSyncBenchmark(javascript, 4); }
		if(lean.result.usedFallback) throw new Error("Benchmark entered the exhaustive reference fallback");
		verifyResult(request, lean.result, expected);
		verifyResult(request, js.result, expected);
		return { leanMs: lean.milliseconds, javascriptMs: js.milliseconds };
	};
	return {
		sample
		, vertexCount: request.vertexCount
		, edgeCount: request.targets.length
		, value: expected, dispose: solve.dispose };
};
