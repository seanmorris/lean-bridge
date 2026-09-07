/**
 * Benchmarks the compiled Lean union-find API end to end.
 *
 * @file
 */

import { performance } from "node:perf_hooks";
import { partition, ready } from "./runtime.mjs";

const flags = new Set(process.argv.slice(2));
const json = flags.has("--json");
const assertBudgets = flags.has("--assert");
const iterations = Number.parseInt(process.env.LEAN_UNION_FIND_BENCH_ITERATIONS || "50", 10);

const makeLinks = (count, degree, seed) => {
	let value = seed >>> 0;
	const next = () => {
		value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
		return value;
	};
	const links = [];
	for(let vertex = 1; vertex < count; vertex += 1) links.push(vertex, next() % vertex);
	for(let edge = count; edge < count * degree; edge += 1) links.push(next() % count, next() % count);
	return Uint32Array.from(links);
};

const jsPartition = (count, links) => {
	const parent = Uint32Array.from({ length: count }, (_, index) => index);
	const sizes = new Uint32Array(count);
	sizes.fill(1);
	const find = start => {
		let root = start;
		while(parent[root] !== root) root = parent[root];
		let vertex = start;
		while(parent[vertex] !== vertex)
		{
			const next = parent[vertex];
			parent[vertex] = root;
			vertex = next;
		}
		return root;
	};
	for(let index = 0; index < links.length; index += 2)
	{
		let left = find(links[index]);
		let right = find(links[index + 1]);
		if(left === right) continue;
		if(sizes[left] < sizes[right] || (sizes[left] === sizes[right] && right < left)) [left, right] = [right, left];
		parent[right] = left;
		sizes[left] += sizes[right];
	}
	const representatives = new Uint32Array(count);
	for(let vertex = 0; vertex < count; vertex += 1) representatives[vertex] = find(vertex);
	return representatives;
};

const percentile = (samples, fraction) => samples[Math.min(samples.length - 1,
	Math.floor(samples.length * fraction))];

const measure = async operation => {
	for(let index = 0; index < 5; index += 1) await operation();
	const samples = [];
	for(let index = 0; index < iterations; index += 1)
	{
		const started = performance.now();
		await operation();
		samples.push(performance.now() - started);
	}
	samples.sort((left, right) => left - right);
	return { minimumMs: samples[0], medianMs: percentile(samples, .5), p95Ms: percentile(samples, .95) };
};

await ready();
const workloads = [
	{ name: "small sparse", count: 512, degree: 2, budgetMs: 3 }
	, { name: "percolation scale", count: 653, degree: 4, budgetMs: 4 }
	, { name: "medium redundant", count: 4096, degree: 4, budgetMs: 55 }
];
const results = [];
for(const workload of workloads)
{
	const links = makeLinks(workload.count, workload.degree, workload.count ^ 0xa53c9e1d);
	const lean = await measure(() => partition({ elementCount: workload.count, links }));
	const javascript = await measure(() => jsPartition(workload.count, links));
	const result = {
		...workload, links: links.length / 2, lean, javascript
		, ratio: lean.medianMs / javascript.medianMs
	};
	results.push(result);
	if(assertBudgets && lean.medianMs > workload.budgetMs)
	{
		throw new Error(`${workload.name} median exceeded ${workload.budgetMs}ms`);
	}
}
if(json) process.stdout.write(`${JSON.stringify({ iterations, results }, null, 2)}\n`);
else
{
	for(const result of results)
	{
		process.stdout.write(`${result.name} (${result.count} elements, ${result.links} links): `
			+ `Lean ${result.lean.medianMs.toFixed(2)}ms, JS ${result.javascript.medianMs.toFixed(2)}ms, `
			+ `${result.ratio.toFixed(1)}×\n`);
	}
}
