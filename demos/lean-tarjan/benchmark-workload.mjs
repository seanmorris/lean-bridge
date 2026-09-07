/**
 * Paired Tarjan workloads with many cyclic components linked by a sparse DAG.
 *
 * @file
 */

import { prepareGraph } from "./runtime.mjs";
import { prepareJavascriptGraph } from "./reference.mjs";
import { measureSyncBenchmark } from "../shared/browser-benchmark.mjs";

/**
 * Generate deterministic cyclic blocks and forward links between components.
 *
 * @param {number} [vertexCount] Number of vertices.
 * @param {number} [blockSize] Maximum size of each strongly connected block.
 * @returns {object} Generic CSR graph.
 */
export const makeWorkload = (vertexCount = 1024, blockSize = 8) => {
	const offsets = new Uint32Array(vertexCount + 1);
	const targets = [];
	for(let vertex = 0; vertex < vertexCount; vertex += 1)
	{
		offsets[vertex] = targets.length;
		const first = Math.floor(vertex / blockSize) * blockSize;
		const size = Math.min(blockSize, vertexCount - first);
		targets.push(first + (vertex - first + 1) % size);
		targets.push(first + (vertex - first + 3) % size);
		if(first + blockSize < vertexCount) targets.push(first + blockSize);
		if(first + blockSize * 7 < vertexCount) targets.push(first + blockSize * 7);
	}
	offsets[vertexCount] = targets.length;
	return { vertexCount, offsets, targets: Uint32Array.from(targets) };
};

const sameArray = (left, right) => left.length === right.length
	&& left.every((value, index) => value === right[index]);

/**
 * Prepare identical Tarjan searches and check every measured pair of results.
 *
 * @param {object} [configuration] Graph workload configuration.
 * @param {number} [configuration.vertexCount] Number of vertices.
 * @param {number} [configuration.blockSize] Vertices per cyclic block.
 * @returns {Promise<object>} Paired sampling and prepared graph disposal.
 */
export const createBenchmark = async ({ vertexCount = 1024, blockSize = 8 } = {}) => {
	const request = makeWorkload(vertexCount, blockSize);
	const solve = await prepareGraph(request);
	const javascriptSolve = prepareJavascriptGraph(request);
	const sample = (index = 0) => {
		let lean;
		let javascript;
		if(index % 2)
		{ javascript = measureSyncBenchmark(javascriptSolve, 4); lean = measureSyncBenchmark(solve, 4); }
		else
		{ lean = measureSyncBenchmark(solve, 4); javascript = measureSyncBenchmark(javascriptSolve, 4); }
		if(lean.result.usedFallback) throw new Error("Tarjan benchmark unexpectedly used the reference closure");
		if(lean.result.componentCount !== javascript.result.componentCount
			|| !sameArray(lean.result.labels, javascript.result.labels)
			|| !sameArray(lean.result.condensation, javascript.result.condensation)
			|| lean.result.components.some((members, group) => !sameArray(members, javascript.result.components[group])))
			throw new Error("Lean and JavaScript disagree on the component partition or condensation");
		return {
			leanMs: lean.milliseconds, javascriptMs: javascript.milliseconds
			, componentCount: lean.result.componentCount
		};
	};
	return { sample, vertexCount, edgeCount: request.targets.length, dispose: solve.dispose };
};
