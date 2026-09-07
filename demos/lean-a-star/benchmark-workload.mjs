/**
 * Deterministic weighted graphs and paired, prewarmed A* benchmark samples.
 *
 * @file
 */

import { prepareSearch } from "./runtime.mjs";
import { prepareJavascriptSearch } from "./reference.mjs";
import { measureSyncBenchmark } from "../shared/browser-benchmark.mjs";

/**
 * Create a weighted lattice with a consistent Manhattan lower bound.
 *
 * @param {number} [width] Lattice width.
 * @param {number} [height] Lattice height.
 * @param {number} [seed] Deterministic terrain seed.
 * @returns {object} Generic CSR search request.
 */
export const makeWorkload = (width = 36, height = 28, seed = 0xa57a) => {
	const vertexCount = width * height;
	const offsets = new Uint32Array(vertexCount + 1);
	const heuristic = new Uint32Array(vertexCount);
	const terrain = new Uint32Array(vertexCount);
	let state = seed >>> 0;
	for(let vertex = 0; vertex < vertexCount; vertex += 1)
	{
		state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
		terrain[vertex] = 1 + (state >>> 0) % 9;
	}
	const targets = [];
	const weights = [];
	for(let vertex = 0; vertex < vertexCount; vertex += 1)
	{
		const x = vertex % width;
		const y = Math.floor(vertex / width);
		heuristic[vertex] = width - 1 - x + height - 1 - y;
		offsets[vertex] = targets.length;
		const neighbors = [];
		if(y > 0) neighbors.push(vertex - width);
		if(x > 0) neighbors.push(vertex - 1);
		if(x + 1 < width) neighbors.push(vertex + 1);
		if(y + 1 < height) neighbors.push(vertex + width);
		for(const next of neighbors)
		{ targets.push(next); weights.push(terrain[next]); }
	}
	offsets[vertexCount] = targets.length;
	return {
		vertexCount
		, offsets
		, targets: Uint32Array.from(targets)
		, weights: Uint32Array.from(weights)
		, heuristic, start: 0, target: vertexCount - 1
	};
};

const sameArray = (left, right) => left.length === right.length
	&& left.every((value, index) => value === right[index]);

/**
 * Prepare matching Lean and JavaScript A* runs, excluding graph setup from timing.
 *
 * @param {object} [configuration] Workload dimensions and deterministic seed.
 * @param {number} [configuration.width] Lattice width.
 * @param {number} [configuration.height] Lattice height.
 * @param {number} [configuration.seed] Terrain seed.
 * @returns {Promise<object>} Checked paired samples and lifetime management.
 */
export const createBenchmark = async ({ width = 36, height = 28, seed = 0xa57a } = {}) => {
	const request = makeWorkload(width, height, seed);
	const solve = await prepareSearch(request);
	const javascriptSearch = prepareJavascriptSearch(request);
	const sample = (index = 0) => {
		let lean;
		let javascript;
		if(index % 2)
		{ javascript = measureSyncBenchmark(javascriptSearch, 4); lean = measureSyncBenchmark(solve, 4); }
		else
		{ lean = measureSyncBenchmark(solve, 4); javascript = measureSyncBenchmark(javascriptSearch, 4); }
		if(lean.result.usedFallback) throw new Error("A* benchmark unexpectedly used its reference fallback");
		if(lean.result.kind !== javascript.result.kind || lean.result.cost !== javascript.result.cost
			|| !sameArray(lean.result.path, javascript.result.path)
			|| !sameArray(lean.result.expanded, javascript.result.expanded))
			throw new Error("Lean and JavaScript A* disagree on the path or expansion order");
		return {
			leanMs: lean.milliseconds, javascriptMs: javascript.milliseconds
			, expanded: lean.result.expanded.length, cost: lean.result.cost
		};
	};
	return { sample, vertexCount: request.vertexCount, edgeCount: request.targets.length, dispose: solve.dispose };
};
