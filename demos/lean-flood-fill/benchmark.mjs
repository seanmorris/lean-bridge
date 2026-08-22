/**
 * End-to-end benchmark for the compiled Lean flood-fill APIs.
 *
 * @file
 */

import { performance } from "node:perf_hooks";
import { reachable, reachableWithCapabilities, ready } from "./runtime.mjs";

const flags = new Set(process.argv.slice(2));
const json = flags.has("--json");
const assertBudgets = flags.has("--assert");
const iterations = Number.parseInt(process.env.LEAN_FLOOD_BENCH_ITERATIONS || "60", 10);

const makeGrid = (width, height, capabilityCount) => {
	const vertexCount = width * height;
	const rows = Array.from({ length: vertexCount }, () => []);
	for(let y = 0; y < height; y += 1)
	{
		for(let x = 0; x < width; x += 1)
		{
			const source = y * width + x;
			if(x > 0) rows[source].push(source - 1);
			if(x + 1 < width) rows[source].push(source + 1);
			if(y > 0) rows[source].push(source - width);
			if(y + 1 < height) rows[source].push(source + width);
		}
	}
	const offsets = new Uint32Array(vertexCount + 1);
	const targets = [];
	for(let vertex = 0; vertex < vertexCount; vertex += 1)
	{
		targets.push(...rows[vertex]);
		offsets[vertex + 1] = targets.length;
	}
	const targetArray = Uint32Array.from(targets);
	const allowedVertices = Uint32Array.from({ length: vertexCount }, (_, vertex) =>
		Number(vertex === 0 || vertex % 19 !== 0));
	const requirements = Uint32Array.from(targetArray, (_, edge) =>
		edge % 97 === 0 ? edge % capabilityCount : capabilityCount);
	const grants = Uint32Array.from({ length: vertexCount }, (_, vertex) =>
		vertex > 0 && vertex % 211 === 0 ? vertex % capabilityCount : capabilityCount);
	return {
		vertexCount, offsets, targets: targetArray
		, allowedVertices, requirements, grants
		, initialCapabilities: new Uint32Array(), capabilityCount, start: 0
	};
};

const percentile = (samples, fraction) => samples[Math.min(samples.length - 1,
	Math.floor(samples.length * fraction))];

const measure = async operation => {
	await operation();
	const samples = [];
	for(let index = 0; index < iterations; index += 1)
	{
		const started = performance.now();
		await operation();
		samples.push(performance.now() - started);
	}
	samples.sort((left, right) => left - right);
	return {
		minimumMs: samples[0]
		, medianMs: percentile(samples, .5)
		, p95Ms: percentile(samples, .95)
	};
};

const jsReachable = (request, allowedEdges) => {
	if(!request.allowedVertices[request.start]) return new Uint32Array();
	const visited = new Uint8Array(request.vertexCount);
	const queue = new Uint32Array(request.vertexCount);
	let head = 0;
	let tail = 1;
	queue[0] = request.start;
	visited[request.start] = 1;
	while(head < tail)
	{
		const source = queue[head++];
		for(let edge = request.offsets[source]; edge < request.offsets[source + 1]; edge += 1)
		{
			const target = request.targets[edge];
			if(allowedEdges[edge] && request.allowedVertices[target] && !visited[target])
			{
				visited[target] = 1;
				queue[tail++] = target;
			}
		}
	}
	return queue.slice(0, tail);
};

const jsCapabilityClosure = request => {
	const capabilities = new Uint8Array(request.capabilityCount);
	for(const capability of request.initialCapabilities) capabilities[capability] = 1;
	const allowedEdges = new Uint32Array(request.targets.length);
	let vertices = new Uint32Array();
	for(let round = 0; round <= request.capabilityCount; round += 1)
	{
		for(let edge = 0; edge < allowedEdges.length; edge += 1)
		{
			const requirement = request.requirements[edge];
			allowedEdges[edge] = Number(requirement === request.capabilityCount || capabilities[requirement]);
		}
		vertices = jsReachable(request, allowedEdges);
		let changed = false;
		for(const vertex of vertices)
		{
			const grant = request.grants[vertex];
			if(grant < request.capabilityCount && !capabilities[grant])
			{
				capabilities[grant] = 1;
				changed = true;
			}
		}
		if(!changed) return vertices;
	}
	return vertices;
};

await ready();
const workloads = [
	{ name: "32×24", width: 32, height: 24, budgetMs: 1.5 }
	, { name: "64×48", width: 64, height: 48, budgetMs: 4 }
	, { name: "96×64", width: 96, height: 64, budgetMs: 9 }
];
const results = [];
for(const workload of workloads)
{
	const request = makeGrid(workload.width, workload.height, 4);
	const allowedEdges = Uint32Array.from(request.targets, () => 1);
	const manual = await measure(() => reachable({ ...request, allowedEdges }));
	const automatic = await measure(() => reachableWithCapabilities(request));
	const manualJs = await measure(() => jsReachable(request, allowedEdges));
	const automaticJs = await measure(() => jsCapabilityClosure(request));
	const result = {
		...workload, vertices: request.vertexCount, edges: request.targets.length
		, lean: { manual, automatic }
		, javascript: { manual: manualJs, automatic: automaticJs }
		, ratio: {
			manual: manual.medianMs / manualJs.medianMs
			, automatic: automatic.medianMs / automaticJs.medianMs
		}
	};
	results.push(result);
	if(assertBudgets && Math.max(manual.medianMs, automatic.medianMs) > workload.budgetMs)
	{
		throw new Error(`${workload.name} median exceeded ${workload.budgetMs}ms`);
	}
}
if(json) process.stdout.write(`${JSON.stringify({ iterations, results }, null, 2)}\n`);
else
{
	for(const result of results)
	{
		process.stdout.write(`${result.name} (${result.vertices} vertices, ${result.edges} edges): `
			+ `Lean manual ${result.lean.manual.medianMs.toFixed(2)}ms (${result.ratio.manual.toFixed(1)}× JS), `
			+ `auto ${result.lean.automatic.medianMs.toFixed(2)}ms (${result.ratio.automatic.toFixed(1)}× JS)\n`);
	}
}
