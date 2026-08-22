/**
 * Benchmarks the end-to-end compiled Lean Dijkstra call on deterministic weighted grids.
 *
 * @file
 */

import { performance } from "node:perf_hooks";

import { ready, shortestPath } from "./runtime.mjs";

const workloads = [
	{ width: 12, height: 8, samples: 30, maximumMedianMs: 0.75 }
	, { width: 14, height: 9, samples: 20, maximumMedianMs: 0.75 }
	, { width: 20, height: 12, samples: 12, maximumMedianMs: 1 }
	, { width: 28, height: 18, samples: 6, maximumMedianMs: 1.5 }
];

const overriddenSamples = Number.parseInt(process.env.LEAN_DIJKSTRA_BENCH_ITERATIONS ?? "", 10);
const invalidSampleOverride = process.env.LEAN_DIJKSTRA_BENCH_ITERATIONS !== undefined
	&& (!Number.isInteger(overriddenSamples) || overriddenSamples < 1);
if(invalidSampleOverride)
{
	throw new Error("LEAN_DIJKSTRA_BENCH_ITERATIONS must be a positive integer");
}

const percentile = (sorted, fraction) =>
	sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];

const edgeWeight = (source, target) => 1 + ((source * 17 + target * 31) % 9);

const makeGrid = ({ width, height }) => {
	const vertexCount = width * height;
	const offsets = new Uint32Array(vertexCount + 1);
	const edgeTargets = [];
	const edgeWeights = [];
	for(let vertex = 0; vertex < vertexCount; vertex += 1)
	{
		offsets[vertex] = edgeTargets.length;
		const x = vertex % width;
		const y = Math.floor(vertex / width);
		const neighbors = [
			x > 0 ? vertex - 1 : -1
			, x + 1 < width ? vertex + 1 : -1
			, y > 0 ? vertex - width : -1
			, y + 1 < height ? vertex + width : -1
		];
		for(const neighbor of neighbors)
		{
			if(neighbor < 0) continue;
			edgeTargets.push(neighbor);
			edgeWeights.push(edgeWeight(vertex, neighbor));
		}
	}
	offsets[vertexCount] = edgeTargets.length;
	return {
		edgeCount: edgeTargets.length
		, offsets
		, targets: Uint32Array.from(edgeTargets)
		, weights: Uint32Array.from(edgeWeights)
		, vertexCount
	};
};

const validatePath = (graph, path) => {
	if(path[0] !== 0 || path.at(-1) !== graph.vertexCount - 1)
	{
		throw new Error("benchmark received a path with incorrect endpoints");
	}
	let cost = 0;
	for(let index = 1; index < path.length; index += 1)
	{
		const source = path[index - 1];
		const target = path[index];
		let weight;
		for(let edge = graph.offsets[source]; edge < graph.offsets[source + 1]; edge += 1)
		{
			if(graph.targets[edge] === target) weight = graph.weights[edge];
		}
		if(weight === undefined) throw new Error("benchmark received a path containing a missing edge");
		cost += weight;
	}
	return cost;
};

const runWorkload = async workload => {
	const graph = makeGrid(workload);
	const request = {
		vertexCount: graph.vertexCount
		, offsets: graph.offsets
		, targets: graph.targets
		, weights: graph.weights
		, start: 0
		, target: graph.vertexCount - 1
	};
	const warmPath = await shortestPath(request);
	const expectedCost = validatePath(graph, warmPath);
	const sampleCount = Number.isInteger(overriddenSamples) ? overriddenSamples : workload.samples;
	const durations = [];
	let checksum = 0;
	for(let sample = 0; sample < sampleCount; sample += 1)
	{
		const started = performance.now();
		const path = await shortestPath(request);
		durations.push(performance.now() - started);
		const cost = validatePath(graph, path);
		if(cost !== expectedCost) throw new Error("benchmark path cost changed between samples");
		checksum += path.length + cost;
	}
	durations.sort((left, right) => left - right);
	return {
		case: `${workload.width}×${workload.height}`
		, vertices: graph.vertexCount
		, edges: graph.edgeCount
		, pathEdges: warmPath.length - 1
		, pathCost: expectedCost
		, samples: sampleCount
		, minimumMs: durations[0]
		, medianMs: percentile(durations, 0.5)
		, p95Ms: percentile(durations, 0.95)
		, maximumMedianMs: workload.maximumMedianMs
		, checksum
	};
};

const initializationStarted = performance.now();
await ready();
const initializationMs = performance.now() - initializationStarted;
const results = [];
for(const workload of workloads)
{
	const result = await runWorkload(workload);
	results.push(result);
	if(process.argv.includes("--assert") && result.medianMs > result.maximumMedianMs)
	{
		throw new Error(
			`${result.case} median ${result.medianMs.toFixed(2)} ms exceeds `
			+ `${result.maximumMedianMs.toFixed(2)} ms regression budget`,
		);
	}
}

const report = {
	schemaVersion: 1
	, runtime: `Node ${process.versions.node}`
	, scope: "warm end-to-end JS API: CSR copies, Lean Dijkstra, certificate check, result copy"
	, initializationMs
	, results
};

if(process.argv.includes("--json"))
{
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
else
{
	process.stdout.write(`Lean Dijkstra Wasm benchmark (${report.runtime})\n`);
	process.stdout.write(`Scope: ${report.scope}\n`);
	process.stdout.write(`Cold initialization: ${initializationMs.toFixed(2)} ms\n\n`);
	process.stdout.write("grid     vertices  edges  samples  path  cost  min ms  median ms  p95 ms\n");
	for(const result of results)
	{
		const columns = [
			result.case.padEnd(8)
			, String(result.vertices).padStart(8)
			, String(result.edges).padStart(6)
			, String(result.samples).padStart(8)
			, String(result.pathEdges).padStart(5)
			, String(result.pathCost).padStart(5)
			, result.minimumMs.toFixed(2).padStart(7)
			, result.medianMs.toFixed(2).padStart(10)
			, result.p95Ms.toFixed(2).padStart(7)
		];
		process.stdout.write(`${columns.join("  ")}\n`);
	}
}
