/**
 * Benchmarks the compiled Lean topological-sort API.
 *
 * @file
 */

import { performance } from "node:perf_hooks";
import { prepareSort } from "./runtime.mjs";

const assertBudgets = process.argv.includes("--assert");
const iterations = Number.parseInt(process.env.LEAN_TOPOLOGICAL_BENCH_ITERATIONS || "50", 10);
const makeDag = (count, degree) => {
	const edges = [];
	for(let target = 1; target < count; target += 1)
		for(let offset = 1; offset <= degree && offset <= target; offset += 1)
			edges.push(target - offset, target);
	return Uint32Array.from(edges);
};
const javascriptSort = (count, edges) => {
	const indegree = new Uint32Array(count);
	const adjacent = Array.from({ length: count }, () => []);
	for(let index = 0; index < edges.length; index += 2)
	{
		adjacent[edges[index]].push(edges[index + 1]);
		indegree[edges[index + 1]] += 1;
	}
	const order = new Uint32Array(count);
	let head = 0;
	let tail = 0;
	for(let vertex = 0; vertex < count; vertex += 1) if(indegree[vertex] === 0) order[tail++] = vertex;
	while(head < tail)
	{
		for(const target of adjacent[order[head++]]) if(--indegree[target] === 0) order[tail++] = target;
	}
	return order.slice(0, tail);
};
const measure = operation => {
	for(let index = 0; index < 5; index += 1) operation();
	const samples = [];
	for(let index = 0; index < iterations; index += 1)
	{
		const started = performance.now(); operation(); samples.push(performance.now() - started);
	}
	samples.sort((a, b) => a - b);
	return { medianMs: samples[Math.floor(samples.length / 2)], p95Ms: samples[Math.floor(samples.length * .95)] };
};
for(const workload of [{ count: 256, degree: 3, budget: 8 }, { count: 1024, degree: 4, budget: 35 }])
{
	const edges = makeDag(workload.count, workload.degree);
	const solve = await prepareSort({ vertexCount: workload.count, edges });
	const lean = measure(solve);
	const javascript = measure(() => javascriptSort(workload.count, edges));
	const ratio = lean.medianMs / javascript.medianMs;
	process.stdout.write(`${workload.count} vertices / ${edges.length / 2} edges: `
		+ `Lean ${lean.medianMs.toFixed(4)} ms (p95 ${lean.p95Ms.toFixed(4)} ms), `
		+ `JS ${javascript.medianMs.toFixed(4)} ms (p95 ${javascript.p95Ms.toFixed(4)} ms), `
		+ `${ratio.toFixed(2)}x relative cost (${iterations} samples, Node ${process.versions.node})\n`);
	if(assertBudgets && lean.medianMs > workload.budget)
		throw new Error(`${workload.count}-vertex median exceeded budget`);
	if(assertBudgets && ratio > 8) throw new Error(`${workload.count}-vertex relative cost exceeded 8x`);
}
