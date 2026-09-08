/**
 * Exercises the compiled generic Lean Dijkstra module from Node.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";

import { prepareShortestPath, ready, shortestPath } from "./runtime.mjs";

const graph = (vertexCount, edges) => {
	const outgoing = Array.from({ length: vertexCount }, () => []);
	for(const [source, target, weight] of edges) outgoing[source].push([target, weight]);
	const offsets = new Uint32Array(vertexCount + 1);
	const targets = [];
	const weights = [];
	for(let vertex = 0; vertex < vertexCount; vertex += 1)
	{
		offsets[vertex] = targets.length;
		for(const [target, weight] of outgoing[vertex])
		{
			targets.push(target);
			weights.push(weight);
		}
	}
	offsets[vertexCount] = targets.length;
	return { vertexCount, offsets, targets: Uint32Array.from(targets), weights: Uint32Array.from(weights) };
};

const pathCost = (weighted, path) => {
	let cost = 0;
	for(let index = 1; index < path.length; index += 1)
	{
		const source = path[index - 1];
		const target = path[index];
		let found;
		for(let edge = weighted.offsets[source]; edge < weighted.offsets[source + 1]; edge += 1)
		{
			if(weighted.targets[edge] === target) found = weighted.weights[edge];
		}
		assert.notEqual(found, undefined);
		cost += found;
	}
	return cost;
};

const referenceDistance = (weighted, start, target) => {
	const distances = new Float64Array(weighted.vertexCount).fill(Number.POSITIVE_INFINITY);
	const visited = new Uint8Array(weighted.vertexCount);
	distances[start] = 0;
	for(let step = 0; step < weighted.vertexCount; step += 1)
	{
		let source = -1;
		for(let vertex = 0; vertex < weighted.vertexCount; vertex += 1)
		{
			if(!visited[vertex] && (source < 0 || distances[vertex] < distances[source])) source = vertex;
		}
		if(source < 0 || !Number.isFinite(distances[source])) break;
		if(source === target) return distances[source];
		visited[source] = 1;
		for(let edge = weighted.offsets[source]; edge < weighted.offsets[source + 1]; edge += 1)
		{
			const next = weighted.targets[edge];
			distances[next] = Math.min(distances[next], distances[source] + weighted.weights[edge]);
		}
	}
	return distances[target];
};

test("compiled Lean selects the cheaper weighted route", async () => {
	const weighted = graph(4, [[0, 1, 4], [1, 3, 1], [0, 2, 1], [2, 3, 1]]);
	assert.deepEqual(await shortestPath({ ...weighted, start: 0, target: 3 }), [0, 2, 3]);
});

test("compiled Lean returns an empty path for a disconnected target", async () => {
	const disconnected = graph(3, [[0, 1, 1]]);
	assert.deepEqual(await shortestPath({ ...disconnected, start: 0, target: 2 }), []);
});

test("compiled Lean supports a zero-weight edge", async () => {
	const zeroWeight = graph(2, [[0, 1, 0]]);
	assert.deepEqual(await shortestPath({ ...zeroWeight, start: 0, target: 1 }), [0, 1]);
});

test("prepared Lean graph supports repeated endpoint queries", async () => {
	const weighted = graph(4, [[0, 1, 4], [1, 3, 1], [0, 2, 1], [2, 3, 1]]);
	const solve = await prepareShortestPath(weighted);
	assert.deepEqual(await solve(0, 3), [0, 2, 3]);
	assert.deepEqual(await solve(1, 3), [1, 3]);
	solve.dispose();
});

test("prepared graphs snapshot before await and retain independent owned lifetimes", async () => {
	const request = graph(3, [[0, 1, 1], [1, 2, 1]]);
	const pending = prepareShortestPath(request);
	request.targets.fill(0); request.weights.fill(99); request.offsets.fill(0);
	const [first, second] = await Promise.all([pending, prepareShortestPath(graph(3, [[0, 2, 1]]))]);
	try
	{
		const retained = first(0, 2);
		assert.deepEqual(retained, [0, 1, 2]);
		assert.deepEqual(second(0, 2), [0, 2]);
		first(0, 2).fill(99);
		assert.deepEqual(first(0, 2), retained);
		second.dispose(); second.dispose();
		assert.throws(() => second(0, 2), /disposed/u);
		assert.deepEqual(first(0, 2), retained);
		first.dispose();
		assert.deepEqual(retained, [0, 1, 2]);
	}
	finally
	{ first.dispose(); second.dispose(); }
});

test("one-shot requests snapshot arrays and reject endpoint coercion", async () => {
	const request = { ...graph(3, [[0, 1, 1], [1, 2, 1]]), start: 0, target: 2 };
	const pending = shortestPath(request);
	request.targets.fill(0);
	assert.deepEqual(await pending, [0, 1, 2]);
	for(const start of [-1, 0.5, NaN, Infinity, 0x1_0000_0000])
		await assert.rejects(shortestPath({ ...request, start }), /endpoints/u);
});

test("duplicate weighted edges are rejected instead of misreported as unreachable", async () => {
	const request = graph(2, [[0, 1, 2], [0, 1, 1]]);
	await assert.rejects(shortestPath({ ...request, start: 0, target: 1 }), /Duplicate/u);
	await assert.rejects(prepareShortestPath(request), /Duplicate/u);
	const module = await ready();
	const pointer = module._malloc(28);
	try
	{
		module.HEAPU32.set([0, 2, 2, 1, 1, 2, 1], pointer >>> 2);
		assert.equal(module._lean_demo_prepare_graph(2, pointer, 3, pointer + 12, pointer + 20, 2), 0);
	}
	finally
	{ module._free(pointer); }
});

test("full Uint32 weights and path totals above Uint32 use bounded queue storage", async () => {
	for(const weight of [4095, 4096, 0x7fff_ffff, 0xffff_ffff])
	{
		const request = graph(4, [[0, 1, weight], [1, 3, weight], [0, 2, weight], [2, 3, 1]]);
		const expected = [0, 2, 3];
		assert.deepEqual(await shortestPath({ ...request, start: 0, target: 3 }), expected);
		const solve = await prepareShortestPath(request);
		try
		{
			assert.deepEqual(solve(0, 3), expected);
			assert.equal(pathCost(request, solve(0, 3)), weight + 1);
		}
		finally
		{ solve.dispose(); }
	}
});

test("bucketed Lean Dijkstra matches randomized weighted graphs", async () => {
	let state = 0xd1a57a;
	const random = () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 0x1_0000_0000;
	};
	for(let caseIndex = 0; caseIndex < 100; caseIndex += 1)
	{
		const vertexCount = 3 + Math.floor(random() * 22);
		const edges = [];
		for(let source = 0; source < vertexCount; source += 1)
		{
			for(let target = 0; target < vertexCount; target += 1)
			{
				if(source !== target && random() < .16)
				{
					edges.push([source, target, Math.floor(random() * 16)]);
				}
			}
		}
		const weighted = graph(vertexCount, edges);
		const start = Math.floor(random() * vertexCount);
		const target = Math.floor(random() * vertexCount);
		const path = await shortestPath({ ...weighted, start, target });
		const expected = referenceDistance(weighted, start, target);
		if(Number.isFinite(expected))
		{
			assert.equal(path[0], start);
			assert.equal(path.at(-1), target);
			assert.equal(pathCost(weighted, path), expected);
		}
		else assert.deepEqual(path, []);
	}
});
